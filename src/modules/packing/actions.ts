"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { starter } from "./data";

// All writes go through the user's own Supabase client, so RLS enforces
// ownership and access to the 'packing' module.

const PATH = "/m/packing";

async function db() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return createClient();
}

function text(formData: FormData, key: string, max: number) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function clean(value: string, max: number) {
  return value.trim().slice(0, max);
}

// Throws on a Supabase error; otherwise returns the data (an empty result for writes without select).
function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

// --- Starter data ---------------------------------------------------------

export async function loadStarter() {
  const supabase = await db();

  for (const list of starter.lists) {
    const created = check(
      await supabase.from("packing_lists").insert({ name: list.name, starred: true }).select("id").single(),
    );
    const chips = check(
      await supabase
        .from("packing_chips")
        .insert(list.chips.map((name, sort) => ({ list_id: created.id, name, sort })))
        .select("id, name"),
    );
    const sections = check(
      await supabase
        .from("packing_sections")
        .insert(list.sections.map((section, sort) => ({ list_id: created.id, name: section.name, sort })))
        .select("id, name"),
    );
    check(
      await supabase.from("packing_items").insert(
        list.sections.flatMap((section) =>
          section.items.map((item, sort) => ({
            list_id: created.id,
            section_id: sections.find((row) => row.name === section.name)!.id,
            chip_id: ("chip" in item && chips.find((chip) => chip.name === item.chip)?.id) || null,
            name: item.name,
            note: ("note" in item && item.note) || null,
            sort,
          })),
        ),
      ),
    );
  }

  // Places and inventory survive from the first version of the module, so
  // only add them when there are none yet.
  const existing = check(await supabase.from("packing_places").select("id").limit(1));
  if (existing.length === 0) {
    const places = check(
      await supabase
        .from("packing_places")
        .insert(starter.places.map((name) => ({ name })))
        .select("id, name"),
    );
    for (const [place, entries] of Object.entries(starter.inventory)) {
      const placeId = places.find((row) => row.name === place)?.id;
      if (!placeId) continue;
      check(
        await supabase
          .from("packing_inventory")
          .insert(entries.map(([name, quantity]) => ({ place_id: placeId, name, quantity }))),
      );
    }
  }

  revalidatePath(PATH);
}

// --- Lists ----------------------------------------------------------------

// A new list starts with one section and opens in edit mode.
export async function createList(formData: FormData) {
  const name = text(formData, "name", 80);
  if (!name) return;
  const supabase = await db();
  const created = check(await supabase.from("packing_lists").insert({ name }).select("id").single());
  check(await supabase.from("packing_sections").insert({ list_id: created.id, name: "Allgemein" }));
  revalidatePath(PATH);
  redirect(`${PATH}?list=${created.id}&edit=1`);
}

export async function updateList(id: string, values: { name?: string; starred?: boolean }) {
  const row = { ...values, ...(values.name !== undefined && { name: clean(values.name, 80) }) };
  if (row.name === "") return;
  const supabase = await db();
  check(await supabase.from("packing_lists").update(row).eq("id", id));
  revalidatePath(PATH);
}

export async function deleteList(formData: FormData) {
  const supabase = await db();
  check(await supabase.from("packing_lists").delete().eq("id", String(formData.get("listId"))));
  revalidatePath(PATH);
  redirect(PATH);
}

// Unticks everything and returns what was ticked, so the reset can be undone.
export async function resetList(listId: string) {
  const supabase = await db();
  const ticked = check(
    await supabase.from("packing_items").update({ done: false }).eq("list_id", listId).eq("done", true).select("id"),
  );
  revalidatePath(PATH);
  return ticked.map((row) => row.id);
}

export async function tickItems(ids: string[], done: boolean) {
  if (ids.length === 0) return;
  const supabase = await db();
  check(await supabase.from("packing_items").update({ done }).in("id", ids));
  revalidatePath(PATH);
}

// --- Chips ----------------------------------------------------------------

export async function addChip(listId: string, name: string, sort: number) {
  const value = clean(name, 40);
  if (!value) return;
  const supabase = await db();
  check(await supabase.from("packing_chips").insert({ list_id: listId, name: value, sort }));
  revalidatePath(PATH);
}

export async function updateChip(id: string, values: { name?: string; active?: boolean }) {
  const row = { ...values, ...(values.name !== undefined && { name: clean(values.name, 40) }) };
  if (row.name === "") return;
  const supabase = await db();
  check(await supabase.from("packing_chips").update(row).eq("id", id));
  revalidatePath(PATH);
}

export async function deleteChip(id: string) {
  const supabase = await db();
  check(await supabase.from("packing_chips").delete().eq("id", id));
  revalidatePath(PATH);
}

// --- Sections -------------------------------------------------------------

export async function addSection(listId: string, name: string, sort: number) {
  const value = clean(name, 60);
  if (!value) return;
  const supabase = await db();
  check(await supabase.from("packing_sections").insert({ list_id: listId, name: value, sort }));
  revalidatePath(PATH);
}

export async function renameSection(id: string, name: string) {
  const value = clean(name, 60);
  if (!value) return;
  const supabase = await db();
  check(await supabase.from("packing_sections").update({ name: value }).eq("id", id));
  revalidatePath(PATH);
}

// Deletes the section with its items.
export async function deleteSection(id: string) {
  const supabase = await db();
  check(await supabase.from("packing_sections").delete().eq("id", id));
  revalidatePath(PATH);
}

export async function reorderSections(ids: string[]) {
  const supabase = await db();
  const results = await Promise.all(
    ids.map((id, sort) => supabase.from("packing_sections").update({ sort }).eq("id", id)),
  );
  results.forEach(check);
  revalidatePath(PATH);
}

// --- Items ----------------------------------------------------------------

export async function addItem(listId: string, sectionId: string, name: string, sort: number) {
  const value = clean(name, 80);
  if (!value) return;
  const supabase = await db();
  check(await supabase.from("packing_items").insert({ list_id: listId, section_id: sectionId, name: value, sort }));
  revalidatePath(PATH);
}

// A changed section puts the item at the end of that section.
export async function updateItem(formData: FormData) {
  const name = text(formData, "name", 80);
  if (!name) return;
  const chip = String(formData.get("chipId") ?? "");
  const supabase = await db();
  const id = String(formData.get("itemId"));
  const sectionId = String(formData.get("sectionId"));
  const row: { name: string; note: string | null; chip_id: string | null; section_id?: string; sort?: number } = {
    name,
    note: text(formData, "note", 200) || null,
    chip_id: chip && chip !== "none" ? chip : null,
  };
  if (sectionId !== String(formData.get("previousSectionId"))) {
    const last = check(
      await supabase
        .from("packing_items")
        .select("sort")
        .eq("section_id", sectionId)
        .order("sort", { ascending: false })
        .limit(1),
    );
    row.section_id = sectionId;
    row.sort = (last[0]?.sort ?? -1) + 1;
  }
  check(await supabase.from("packing_items").update(row).eq("id", id));
  revalidatePath(PATH);
}

export async function deleteItem(id: string) {
  const supabase = await db();
  check(await supabase.from("packing_items").delete().eq("id", id));
  revalidatePath(PATH);
}

export async function reorderItems(ids: string[]) {
  const supabase = await db();
  const results = await Promise.all(ids.map((id, sort) => supabase.from("packing_items").update({ sort }).eq("id", id)));
  results.forEach(check);
  revalidatePath(PATH);
}

// --- Places and inventory -------------------------------------------------

export async function addPlace(formData: FormData) {
  const name = text(formData, "name", 60);
  if (!name) return;
  const supabase = await db();
  check(await supabase.from("packing_places").insert({ name }));
  revalidatePath(PATH);
}

export async function deletePlace(formData: FormData) {
  const supabase = await db();
  check(await supabase.from("packing_places").delete().eq("id", String(formData.get("placeId"))));
  revalidatePath(PATH);
  redirect(PATH);
}

export async function addInventoryItem(formData: FormData) {
  const name = text(formData, "name", 80);
  const quantity = Math.max(0, Math.min(999, Math.round(Number(formData.get("quantity") ?? 1)) || 0));
  if (!name) return;
  const placeId = String(formData.get("placeId"));
  const supabase = await db();
  // Names are unique per place regardless of case: update an existing entry.
  const existing = check(
    await supabase
      .from("packing_inventory")
      .select("id, name")
      .eq("place_id", placeId),
  ).find((entry) => entry.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    check(await supabase.from("packing_inventory").update({ quantity }).eq("id", existing.id));
  } else {
    check(await supabase.from("packing_inventory").insert({ place_id: placeId, name, quantity }));
  }
  revalidatePath(PATH);
}

export async function setInventoryQuantity(id: string, quantity: number) {
  const supabase = await db();
  check(
    await supabase
      .from("packing_inventory")
      .update({ quantity: Math.max(0, Math.min(999, Math.round(quantity))) })
      .eq("id", id),
  );
  revalidatePath(PATH);
}

export async function deleteInventoryItem(formData: FormData) {
  const supabase = await db();
  check(await supabase.from("packing_inventory").delete().eq("id", String(formData.get("itemId"))));
  revalidatePath(PATH);
}
