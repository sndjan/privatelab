// Server only. What the browser cache loads for the Noch-mal-Blätter (see
// src/lib/query/data.ts).
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import { cleanSheet, isOwnImage, type Sheet } from "./data";

// mine: the signed-in user's own sheet (others' sheets are only shown,
// printed and copied); author: the owner's short name.
export type SheetEntry = { id: string; name: string; updatedAt: string; sheet: Sheet; mine: boolean; author: string };

type Row = { id: string; name: string; updated_at: string; data: unknown; user_id: string; author?: string };

const toEntry = (row: Row, userId: string): SheetEntry => ({
  id: row.id,
  name: row.name,
  updatedAt: row.updated_at,
  sheet: cleanSheet(row.data),
  mine: row.user_id === userId,
  author: row.author ?? "",
});
// "*" so the list still loads before the author column exists.
const columns = "*";

// A sticker in the shared library: mine = uploaded by the signed-in user
// (only they can remove it).
export type LibrarySticker = { id: string; url: string; ratio: number; mine: boolean };

export const nochmalLoaders = {
  // The shared sticker library, newest first (empty before its migration ran).
  stickers: async (_params, user) => {
    const supabase = await createClient();
    const { data } = await supabase.from("nochmal_stickers").select("id, url, ratio, user_id").order("created_at", { ascending: false }).limit(300);
    return ((data ?? []) as { id: string; url: string; ratio: number; user_id: string }[])
      .filter((row) => isOwnImage(row.url))
      .map((row): LibrarySticker => ({ id: row.id, url: row.url, ratio: Number(row.ratio) || 1, mine: row.user_id === user.id }));
  },
  // All sheets (own and everyone else's), last changed first (with their
  // data, for the small previews).
  list: async (_params, user) => {
    const supabase = await createClient();
    const { data } = await supabase.from("nochmal_sheets").select(columns).order("updated_at", { ascending: false });
    return ((data ?? []) as Row[]).map((row) => toEntry(row, user.id));
  },
  sheet: async ({ id }, user) => {
    if (!/^[0-9a-f-]{36}$/i.test(id ?? "")) return null;
    const supabase = await createClient();
    const { data } = await supabase.from("nochmal_sheets").select(columns).eq("id", id).maybeSingle<Row>();
    return data ? toEntry(data, user.id) : null;
  },
} satisfies Record<string, Loader>;
