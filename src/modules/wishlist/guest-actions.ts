"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureDeviceHash, rememberGuestName } from "./claims";
import { isShareToken } from "./data";

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
  if (!isShareToken(shareToken) || !isId(itemId)) return null;
  const { data } = await createAdminClient()
    .from("wishlist_items")
    .select("id, user_id, wishlist_lists!inner (share_token)")
    .eq("id", itemId)
    .eq("wishlist_lists.share_token", shareToken)
    .is("received_at", null)
    .maybeSingle<{ id: string; user_id: string }>();
  if (!data) return null;
  // The owner can't reserve their own wishes (and must not see reservations).
  const user = await getCurrentUser();
  if (user?.id === data.user_id) return null;
  return data;
}

type Result = { error: string } | undefined;

export async function reserve(shareToken: string, itemId: string, rawName: string): Promise<Result> {
  const name = cleanName(rawName);
  if (!(await openWish(shareToken, itemId))) return { error: "Diesen Wunsch gibt es nicht mehr." };

  const device = await ensureDeviceHash();
  await rememberGuestName(name);
  const { data, error } = await createAdminClient().rpc("wishlist_claim", {
    target_item: itemId,
    guest_name: name,
    guest_device_hash: device,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/w/${shareToken}`);
  if (!data) return { error: "Schade, jemand war schneller: der Wunsch ist schon vergeben." };
}

// Undoes a reservation made from this browser.
export async function release(shareToken: string, claimId: string): Promise<Result> {
  if (!isId(claimId)) return { error: "Diese Reservierung gibt es nicht mehr." };
  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("wishlist_claims")
    .select("id, item_id")
    .eq("id", claimId)
    .maybeSingle<{ id: string; item_id: string }>();
  if (!claim || !(await openWish(shareToken, claim.item_id))) return { error: "Diese Reservierung gibt es nicht mehr." };

  const device = await ensureDeviceHash();
  const { data: mine, error } = await admin
    .from("wishlist_claim_members")
    .select("id")
    .eq("claim_id", claim.id)
    .eq("device_hash", device);
  if (error) throw new Error(error.message);
  if (!mine?.length) return { error: "Diese Reservierung wurde in einem anderen Browser gemacht." };

  const { error: deleteError } = await admin.from("wishlist_claims").delete().eq("id", claim.id);
  if (deleteError) throw new Error(deleteError.message);
  revalidatePath(`/w/${shareToken}`);
}
