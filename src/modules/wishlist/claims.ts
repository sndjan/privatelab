// Server-only: reservations are read and written with the secret key, because
// guests have no account and the owner must not see the names (see the
// wishlist migration). Every caller checks first that the list was reached
// through its share token or belongs to the signed-in user.
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { displayName, type GuestClaim, type OwnerClaims } from "./data";

const DEVICE_COOKIE = "wishlist_device";
const NAME_COOKIE = "wishlist_name";
const YEARS_2 = 60 * 60 * 24 * 365 * 2;
const secure = process.env.NODE_ENV === "production";

type ClaimRow = {
  id: string;
  item_id: string;
  is_group: boolean;
  wishlist_claim_members: { name: string; device_hash: string; created_at: string }[];
};

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// The hash of this browser's guest token, or null if it never reserved anything.
export async function deviceHash() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  return token ? hash(token) : null;
}

// Same as deviceHash, but creates the token on the first reservation.
export async function ensureDeviceHash() {
  const store = await cookies();
  let token = store.get(DEVICE_COOKIE)?.value;
  if (!token) {
    token = randomBytes(24).toString("hex");
    store.set(DEVICE_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: YEARS_2 });
  }
  return hash(token);
}

export async function guestName() {
  return (await cookies()).get(NAME_COOKIE)?.value ?? "";
}

export async function rememberGuestName(name: string) {
  if (name) (await cookies()).set(NAME_COOKIE, name, { sameSite: "lax", secure, path: "/", maxAge: YEARS_2 });
}

async function loadClaimRows(itemIds: string[]) {
  if (itemIds.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("wishlist_claims")
    .select("id, item_id, is_group, wishlist_claim_members (name, device_hash, created_at)")
    .in("item_id", itemIds)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as ClaimRow[];
}

function membersOf(row: ClaimRow) {
  return [...row.wishlist_claim_members].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function guestClaims(itemIds: string[], device: string | null) {
  const byItem = new Map<string, GuestClaim[]>();
  for (const row of await loadClaimRows(itemIds)) {
    const members = membersOf(row);
    const claim: GuestClaim = {
      id: row.id,
      isGroup: row.is_group,
      mine: device !== null && members.some((member) => member.device_hash === device),
      names: members.map((member) => member.name),
    };
    byItem.set(row.item_id, [...(byItem.get(row.item_id) ?? []), claim]);
  }
  return byItem;
}

export async function ownerClaims(itemIds: string[]) {
  const byItem = new Map<string, OwnerClaims>();
  for (const row of await loadClaimRows(itemIds)) {
    const current = byItem.get(row.item_id) ?? { taken: 0, groups: 0, people: 0 };
    byItem.set(row.item_id, {
      taken: current.taken + 1,
      groups: current.groups + (row.is_group ? 1 : 0),
      people: current.people + row.wishlist_claim_members.length,
    });
  }
  return byItem;
}

// Names of everyone who reserved the wish, for the archive.
export async function claimNames(itemId: string) {
  const names = (await loadClaimRows([itemId])).flatMap((row) => membersOf(row).map((member) => displayName(member.name)));
  return [...new Set(names)].slice(0, 50);
}

export async function deleteClaims(itemId: string) {
  const { error } = await createAdminClient().from("wishlist_claims").delete().eq("item_id", itemId);
  if (error) throw new Error(error.message);
}
