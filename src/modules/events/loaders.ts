// Server only. What the browser cache loads for the Ereignis-Tracker (see
// src/lib/query/data.ts). All tabs read the same data: every type and entry.
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import { entryColumns, entryFromRow, typeColumns, typeFromRow, type EntryRow, type TypeRow } from "./data";

export const eventsLoaders = {
  all: async () => {
    const supabase = await createClient();
    const [types, entries] = await Promise.all([
      supabase.from("event_types").select(typeColumns).order("position").order("created_at"),
      supabase.from("event_entries").select(entryColumns).order("start_date", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    return {
      types: ((types.data ?? []) as TypeRow[]).map(typeFromRow),
      entries: ((entries.data ?? []) as EntryRow[]).map(entryFromRow),
    };
  },
} satisfies Record<string, Loader>;
