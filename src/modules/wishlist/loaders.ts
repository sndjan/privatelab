// Server only. What the browser cache loads for the wishlists (see
// src/lib/query/data.ts). Reservations aren't readable here at all (no table
// grants), so the owner never sees them.
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import { toWish, wishColumns, type Wish, type WishRow } from "./data";

export type List = { id: string; name: string; occasion_date: string | null; share_token: string };

type ItemRow = WishRow & { received_at: string | null; received_from: string[] };

export type OwnerWish = Wish & { receivedAt: string | null; receivedFrom: string[] };

export const wishlistLoaders = {
  // Every list with the number of open wishes.
  lists: async () => {
    const supabase = await createClient();
    const [{ data: listRows }, { data: itemRows }] = await Promise.all([
      supabase.from("wishlist_lists").select("id, name, occasion_date, share_token").order("created_at"),
      supabase.from("wishlist_items").select("list_id").is("received_at", null),
    ]);
    return ((listRows ?? []) as List[]).map((list) => ({
      ...list,
      open: (itemRows ?? []).filter((row) => row.list_id === list.id).length,
    }));
  },
  // One list with all its wishes, newest first.
  list: async ({ id }) => {
    const supabase = await createClient();
    const [{ data: list }, { data: itemRows }] = await Promise.all([
      supabase.from("wishlist_lists").select("id, name, occasion_date, share_token").eq("id", id).maybeSingle<List>(),
      supabase
        .from("wishlist_items")
        .select(`${wishColumns}, received_at, received_from`)
        .eq("list_id", id)
        .order("created_at", { ascending: false }),
    ]);
    return {
      list: list ?? null,
      wishes: ((itemRows ?? []) as ItemRow[]).map(
        (row): OwnerWish => ({ ...toWish(row), receivedAt: row.received_at, receivedFrom: row.received_from ?? [] }),
      ),
    };
  },
} satisfies Record<string, Loader>;
