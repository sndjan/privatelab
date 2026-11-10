// Server only. What the browser cache loads for the packing lists (see
// src/lib/query/data.ts).
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import type { Chip, Item, Section, Stock } from "./data";

export type Place = { id: string; name: string };
export type List = { id: string; name: string; starred: boolean; placeId: string | null };

type ItemRow = {
  id: string;
  list_id: string;
  section_id: string;
  chip_id: string | null;
  name: string;
  note: string | null;
  done: boolean;
  once: boolean;
};

const toItem = (row: ItemRow): Item & { listId: string } => ({
  id: row.id,
  listId: row.list_id,
  sectionId: row.section_id,
  chipId: row.chip_id,
  name: row.name,
  note: row.note,
  done: row.done,
  once: row.once,
});

type ListRow = { id: string; name: string; starred: boolean; place_id: string | null };
const toList = (row: ListRow): List => ({ id: row.id, name: row.name, starred: row.starred, placeId: row.place_id });

export const packingLoaders = {
  // Lists with their items and chips (for the progress), places with the
  // number of things in their inventory.
  overview: async () => {
    const supabase = await createClient();
    const [{ data: listRows }, { data: itemRows }, { data: chipRows }, { data: placeRows }, { data: inventoryRows }] =
      await Promise.all([
        supabase.from("packing_lists").select("id, name, starred, place_id").order("created_at"),
        supabase.from("packing_items").select("id, list_id, section_id, chip_id, name, note, done, once"),
        supabase.from("packing_chips").select("id, list_id, name, active"),
        supabase.from("packing_places").select("id, name").order("created_at"),
        supabase.from("packing_inventory").select("place_id"),
      ]);
    return {
      lists: ((listRows ?? []) as ListRow[]).map(toList),
      items: ((itemRows ?? []) as ItemRow[]).map(toItem),
      chips: (chipRows ?? []).map((row) => ({ id: row.id, listId: row.list_id, name: row.name, active: row.active })),
      places: ((placeRows ?? []) as Place[]).map((place) => ({
        ...place,
        count: (inventoryRows ?? []).filter((row) => row.place_id === place.id).length,
      })),
    };
  },
  // One list with the inventory of the place it packs for, if it has one.
  list: async ({ id }) => {
    const supabase = await createClient();
    const [{ data: listRow }, { data: sectionRows }, { data: itemRows }, { data: chipRows }, { data: placeRows }] =
      await Promise.all([
        supabase.from("packing_lists").select("id, name, starred, place_id").eq("id", id).maybeSingle<ListRow>(),
        supabase.from("packing_sections").select("id, name").eq("list_id", id).order("sort").order("created_at"),
        supabase
          .from("packing_items")
          .select("id, list_id, section_id, chip_id, name, note, done, once")
          .eq("list_id", id)
          .order("sort")
          .order("created_at"),
        supabase.from("packing_chips").select("id, name, active").eq("list_id", id).order("sort").order("created_at"),
        supabase.from("packing_places").select("id, name").order("created_at"),
      ]);
    const list = listRow ? toList(listRow) : null;
    const places = (placeRows ?? []) as Place[];
    const place = places.find((entry) => entry.id === list?.placeId) ?? null;
    const { data: stockRows } = place
      ? await supabase.from("packing_inventory").select("id, name, quantity").eq("place_id", place.id).order("name")
      : { data: [] };
    return {
      list,
      sections: (sectionRows ?? []) as Section[],
      items: ((itemRows ?? []) as ItemRow[]).map(toItem),
      chips: (chipRows ?? []) as Chip[],
      places,
      place,
      inventory: (stockRows ?? []) as Stock[],
    };
  },
  place: async ({ id }) => {
    const supabase = await createClient();
    const [{ data: place }, { data: rows }] = await Promise.all([
      supabase.from("packing_places").select("id, name").eq("id", id).maybeSingle<Place>(),
      supabase.from("packing_inventory").select("id, name, quantity").eq("place_id", id).order("name"),
    ]);
    return { place: place ?? null, inventory: (rows ?? []) as Stock[] };
  },
} satisfies Record<string, Loader>;
