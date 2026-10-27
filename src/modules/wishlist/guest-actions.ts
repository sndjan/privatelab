"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureDeviceHash, rememberGuestName } from "./claims";

// Actions of the public share page /w/<token>. Guests have no account, so
// these use the secret key; the share token is what grants access, and every
// action checks that the wish belongs to that list and is still open. A
// reservation can only be undone from the browser that made it (its cookie).

const isId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

function cleanName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 60);
}

// The open wish on the list behind this share token, or null.
async function openWish(shareToken: string, itemId: string) {
  if (!isId(shareToken) || !isId(itemId)) return null;
  const { data } = await createAdminClient()
    .from("wishlist_items")
    .select("id, user_id, wishlist_lists!inner (share_token)")
    .eq("id", itemId)
    .eq("wishlist_lists.share_token", shareToken)
    .is("received_at", null)
    .maybeSingle<{ id: string; user_id: string }>();
  if (!data) return null;
  // The owner can't reserve their own wishes (and would see names doing so).
  const user = await getCurrentUser();
  if (user?.id === data.user_id) return null;
  return data;
}

async function claimOf(shareToken: string, claimId: string) {
  if (!isId(claimId)) return null;
  const { data } = await createAdminClient()
    .from("wishlist_claims")
    .select("id, item_id, is_group")
    .eq("id", claimId)
    .maybeSingle<{ id: string; item_id: string; is_group: boolean }>();
  if (!data || !(await openWish(shareToken, data.item_id))) return null;
  return data;
}

type Result = { error: string } | undefined;

export async function reserve(shareToken: string, itemId: string, group: boolean, rawName: string): Promise<Result> {
  const name = cleanName(rawName);
  if (group && !name) return { error: "Für ein Gruppengeschenk brauchen die anderen deinen Namen." };
  if (!(await openWish(shareToken, itemId))) return { error: "Diesen Wunsch gibt es nicht mehr." };

  const device = await ensureDeviceHash();
  await rememberGuestName(name);
  const { data, error } = await createAdminClient().rpc("wishlist_claim", {
    target_item: itemId,
    group_gift: group,
    guest_name: name,
    guest_device_hash: device,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/w/${shareToken}`);
  if (!data) return { error: "Schade, jemand war schneller: der Wunsch ist schon vergeben." };
}

export async function joinGroup(shareToken: string, claimId: string, rawName: string): Promise<Result> {
  const name = cleanName(rawName);
  if (!name) return { error: "Bitte gib deinen Namen an, damit die anderen wissen, wer mitmacht." };
  const claim = await claimOf(shareToken, claimId);
  if (!claim?.is_group) return { error: "Diese Gruppe gibt es nicht mehr." };

  const device = await ensureDeviceHash();
  await rememberGuestName(name);
  const { error } = await createAdminClient()
    .from("wishlist_claim_members")
    .upsert({ claim_id: claim.id, name, device_hash: device }, { onConflict: "claim_id,device_hash" });
  if (error) throw new Error(error.message);
  revalidatePath(`/w/${shareToken}`);
}

// Leaves a reservation made from this browser. The last one out frees the wish.
export async function release(shareToken: string, claimId: string): Promise<Result> {
  const claim = await claimOf(shareToken, claimId);
  if (!claim) return { error: "Diese Reservierung gibt es nicht mehr." };
  const device = await ensureDeviceHash();
  const admin = createAdminClient();

  const { data: removed, error } = await admin
    .from("wishlist_claim_members")
    .delete()
    .eq("claim_id", claim.id)
    .eq("device_hash", device)
    .select("id");
  if (error) throw new Error(error.message);
  if (!removed?.length) return { error: "Diese Reservierung wurde in einem anderen Browser gemacht." };

  const { count } = await admin
    .from("wishlist_claim_members")
    .select("id", { count: "exact", head: true })
    .eq("claim_id", claim.id);
  if (!count) await admin.from("wishlist_claims").delete().eq("id", claim.id);
  revalidatePath(`/w/${shareToken}`);
}
