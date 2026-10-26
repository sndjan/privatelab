"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appliesTo, isCondition, starter, type ItemKind } from "./data";

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

function optionalId(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  return value && value !== "none" ? value : null;
}

function kind(formData: FormData): ItemKind {
  return formData.get("kind") === "task" ? "task" : "pack";
}

function conditionList(formData: FormData) {
  return formData.getAll("conditions").map(String).filter(isCondition);
}

// Throws on a Supabase error; otherwise returns the data (an empty result for writes without select).
function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

// --- Starter data ---------------------------------------------------------

export async function loadStarter() {
  const supabase = await db();

  const places = check(
    await supabase
      .from("packing_places")
      .insert(starter.places.map((name) => ({ name })))
      .select("id, name"),
  );
  const placeId = (name: string) => places.find((place) => place.name === name)?.id ?? null;

  for (const template of starter.templates) {
    const created = check(
      await supabase
        .from("packing_templates")
        .insert({ name: template.name, from_place_id: placeId(template.from), to_place_id: placeId(template.to) })
        .select("id")
        .single(),
    );
    check(
      await supabase.from("packing_template_items").insert(
        template.items.map((item) => ({
          template_id: created.id,
          name: item.name,
          note: "note" in item ? item.note : null,
          kind: "kind" in item ? item.kind : "pack",
          conditions: "conditions" in item ? item.conditions : [],
        })),
      ),
    );
  }

  for (const [place, entries] of Object.entries(starter.inventory)) {
    check(
      await supabase
        .from("packing_inventory")
        .insert(entries.map(([name, quantity]) => ({ place_id: placeId(place), name, quantity }))),
    );
  }

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

// --- Templates ------------------------------------------------------------

export async function createTemplate(formData: FormData) {
  const name = text(formData, "name", 80);
  if (!name) return;
  const supabase = await db();
  const created = check(
    await supabase
      .from("packing_templates")
      .insert({ name, from_place_id: optionalId(formData, "from"), to_place_id: optionalId(formData, "to") })
      .select("id")
      .single(),
  );
  revalidatePath(PATH);
  redirect(`${PATH}?template=${created.id}`);
}

export async function updateTemplate(formData: FormData) {
  const name = text(formData, "name", 80);
  if (!name) return;
  const supabase = await db();
  check(
    await supabase
      .from("packing_templates")
      .update({ name, from_place_id: optionalId(formData, "from"), to_place_id: optionalId(formData, "to") })
      .eq("id", String(formData.get("templateId"))),
  );
  revalidatePath(PATH);
}

export async function deleteTemplate(formData: FormData) {
  const supabase = await db();
  check(await supabase.from("packing_templates").delete().eq("id", String(formData.get("templateId"))));
  revalidatePath(PATH);
  redirect(PATH);
}

export async function saveTemplateItem(formData: FormData) {
  const name = text(formData, "name", 80);
  if (!name) return;
  const row = {
    name,
    note: text(formData, "note", 200) || null,
    kind: kind(formData),
    conditions: conditionList(formData),
  };
  const supabase = await db();
  const itemId = optionalId(formData, "itemId");
  if (itemId) {
    check(await supabase.from("packing_template_items").update(row).eq("id", itemId));
  } else {
    check(
      await supabase.from("packing_template_items").insert({ ...row, template_id: String(formData.get("templateId")) }),
    );
  }
  revalidatePath(PATH);
}

export async function deleteTemplateItem(formData: FormData) {
  const supabase = await db();
  check(await supabase.from("packing_template_items").delete().eq("id", String(formData.get("itemId"))));
  revalidatePath(PATH);
}

// --- Runs -----------------------------------------------------------------

// Copies the template's matching items into a new run. Items flagged as
// forgotten are pinned; items the inventory says are already at the
// destination are marked as such.
export async function startRun(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "");
  const tripDate = String(formData.get("date") ?? "");
  if (!templateId || !/^\d{4}-\d{2}-\d{2}$/.test(tripDate)) return;
  const runConditions = conditionList(formData);

  const supabase = await db();
  const template = check(
    await supabase
      .from("packing_templates")
      .select("id, name, from_place_id, to_place_id")
      .eq("id", templateId)
      .single(),
  );
  const items = check(
    await supabase
      .from("packing_template_items")
      .select("id, name, note, kind, conditions, forgotten")
      .eq("template_id", templateId)
      .order("created_at"),
  );
  const atDestination = new Set<string>();
  if (template.to_place_id) {
    const inventory = check(
      await supabase
        .from("packing_inventory")
        .select("name, quantity")
        .eq("place_id", template.to_place_id)
        .gt("quantity", 0),
    );
    for (const entry of inventory) atDestination.add(entry.name.toLowerCase());
  }

  const run = check(
    await supabase
      .from("packing_runs")
      .insert({
        template_id: template.id,
        title: text(formData, "title", 80) || template.name,
        trip_date: tripDate,
        from_place_id: template.from_place_id,
        to_place_id: template.to_place_id,
        conditions: runConditions,
      })
      .select("id")
      .single(),
  );

  const runItems = items
    .filter((item) => appliesTo(item.conditions, runConditions))
    .map((item, index) => ({
      run_id: run.id,
      template_item_id: item.id,
      name: item.name,
      note: item.note,
      kind: item.kind,
      pinned: item.forgotten,
      at_destination: item.kind === "pack" && atDestination.has(item.name.toLowerCase()),
      sort: index,
    }));
  if (runItems.length > 0) check(await supabase.from("packing_run_items").insert(runItems));

  revalidatePath(PATH);
  redirect(`${PATH}?run=${run.id}`);
}

export async function setRunItem(id: string, values: { done?: boolean; forgotten?: boolean }) {
  const supabase = await db();
  check(await supabase.from("packing_run_items").update(values).eq("id", id));
  revalidatePath(PATH);
}

export async function addRunItem(formData: FormData) {
  const name = text(formData, "name", 80);
  if (!name) return;
  const supabase = await db();
  check(
    await supabase
      .from("packing_run_items")
      .insert({ run_id: String(formData.get("runId")), name, kind: kind(formData), sort: 1000 }),
  );
  revalidatePath(PATH);
}

// Finishing a run carries the "forgotten" flags over to the template, so the
// next run pins exactly the items forgotten this time.
export async function finishRun(formData: FormData) {
  const runId = String(formData.get("runId"));
  const supabase = await db();
  const items = check(
    await supabase.from("packing_run_items").select("template_item_id, forgotten").eq("run_id", runId),
  );
  for (const forgotten of [true, false]) {
    const ids = items
      .filter((item) => item.template_item_id && item.forgotten === forgotten)
      .map((item) => item.template_item_id as string);
    if (ids.length > 0) {
      check(await supabase.from("packing_template_items").update({ forgotten }).in("id", ids));
    }
  }
  check(await supabase.from("packing_runs").update({ finished_at: new Date().toISOString() }).eq("id", runId));
  revalidatePath(PATH);
}

export async function reopenRun(formData: FormData) {
  const supabase = await db();
  check(await supabase.from("packing_runs").update({ finished_at: null }).eq("id", String(formData.get("runId"))));
  revalidatePath(PATH);
}

export async function deleteRun(formData: FormData) {
  const supabase = await db();
  check(await supabase.from("packing_runs").delete().eq("id", String(formData.get("runId"))));
  revalidatePath(PATH);
  redirect(PATH);
}
