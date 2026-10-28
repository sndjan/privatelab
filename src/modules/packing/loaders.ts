// Server only. What the browser cache loads for the packing lists (see
// src/lib/query/data.ts).
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import type { Chip, Item, Section } from "./data";

export type Place = { id: string; name: string };
export type List = { id: string; name: string; starred: boolean };

type ItemRow = {
  id: string;
  list_id: string;
  section_id: string;
  chip_id: string | null;
  name: string;
  note: string | null;
  done: boolean;
};

const toItem = (row: ItemRow): Item & { listId: string } => ({
  id: row.id,
  listId: row.list_id,
  sectionId: row.section_id,
  chipId: row.chip_id,
  name: row.name,
  note: row.note,
  done: row.done,
});

export const packingLoaders = {
  // Lists with their items and chips (for the progress), places with the
  // number of things in their inventory.
  overview: async () => {
    const supabase = await createClient();
    const [{ data: listRows }, { data: itemRows }, { data: chipRows }, { data: placeRows }, { data: inventoryRows }] =
      await Promise.all([
        supabase.from("packing_lists").select("id, name, starred").order("created_at"),
        supabase.from("packing_items").select("id, list_id, section_id, chip_id, name, note, done"),
        supabase.from("packing_chips").select("id, list_id, name, active"),
        supabase.from("packing_places").select("id, name").order("created_at"),
        supabase.from("packing_inventory").select("place_id"),
      ]);
    return {
      lists: (listRows ?? []) as List[],
      items: ((itemRows ?? []) as ItemRow[]).map(toItem),
      chips: (chipRows ?? []).map((row) => ({ id: row.id, listId: row.list_id, name: row.name, active: row.active })),
      places: ((placeRows ?? []) as Place[]).map((place) => ({
        ...place,
        count: (inventoryRows ?? []).filter((row) => row.place_id === place.id).length,
      })),
    };
  },
  list: async ({ id }) => {
    const supabase = await createClient();
    const [{ data: list }, { data: sectionRows }, { data: itemRows }, { data: chipRows }] = await Promise.all([
      supabase.from("packing_lists").select("id, name, starred").eq("id", id).maybeSingle<List>(),
      supabase.from("packing_sections").select("id, name").eq("list_id", id).order("sort").order("created_at"),
      supabase
        .from("packing_items")
        .select("id, list_id, section_id, chip_id, name, note, done")
        .eq("list_id", id)
        .order("sort")
        .order("created_at"),
      supabase.from("packing_chips").select("id, name, active").eq("list_id", id).order("sort").order("created_at"),
    ]);
    return {
      list: list ?? null,
      sections: (sectionRows ?? []) as Section[],
      items: ((itemRows ?? []) as ItemRow[]).map(toItem),
      chips: (chipRows ?? []) as Chip[],
    };
  },
  place: async ({ id }) => {
    const supabase = await createClient();
    const [{ data: place }, { data: rows }] = await Promise.all([
      supabase.from("packing_places").select("id, name").eq("id", id).maybeSingle<Place>(),
      supabase.from("packing_inventory").select("id, name, quantity").eq("place_id", id).order("name"),
    ]);
    return { place: place ?? null, inventory: (rows ?? []) as { id: string; name: string; quantity: number }[] };
  },
} satisfies Record<string, Loader>;
