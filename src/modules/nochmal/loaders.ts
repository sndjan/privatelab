// Server only. What the browser cache loads for the Noch-mal-Blätter (see
// src/lib/query/data.ts).
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import { cleanSheet, type Sheet } from "./data";

export type SheetEntry = { id: string; name: string; updatedAt: string; sheet: Sheet };

type Row = { id: string; name: string; updated_at: string; data: unknown };

const toEntry = (row: Row): SheetEntry => ({ id: row.id, name: row.name, updatedAt: row.updated_at, sheet: cleanSheet(row.data) });
const columns = "id, name, updated_at, data";

export const nochmalLoaders = {
  // All sheets, last changed first (with their data, for the small previews).
  list: async () => {
    const supabase = await createClient();
    const { data } = await supabase.from("nochmal_sheets").select(columns).order("updated_at", { ascending: false });
    return ((data ?? []) as Row[]).map(toEntry);
  },
  sheet: async ({ id }) => {
    if (!/^[0-9a-f-]{36}$/i.test(id ?? "")) return null;
    const supabase = await createClient();
    const { data } = await supabase.from("nochmal_sheets").select(columns).eq("id", id).maybeSingle<Row>();
    return data ? toEntry(data) : null;
  },
} satisfies Record<string, Loader>;
