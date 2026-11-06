"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  cleanEntryInput,
  cleanTypeInput,
  entryToRow,
  isDate,
  typeToRow,
  type EntryInput,
  type TypeInput,
} from "./data";

// All writes go through the user's own Supabase client, so RLS enforces
// ownership and access to the 'events' module. They take plain objects and
// are called from the browser, which updates its cache right away.

const PATH = "/m/events";

async function db() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return createClient();
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function typeFor(supabase: Supabase, typeId: string) {
  return check(
    await supabase.from("event_types").select("kind, track_amount, track_rating").eq("id", typeId).single<{
      kind: "moment" | "span";
      track_amount: boolean;
      track_rating: boolean;
    }>(),
  );
}

// --- Types ------------------------------------------------------------------

async function nextPosition(supabase: Supabase) {
  const { data } = await supabase.from("event_types").select("position").order("position", { ascending: false }).limit(1);
  return ((data?.[0]?.position as number | undefined) ?? -1) + 1;
}

export async function createType(input: Partial<TypeInput>) {
  const supabase = await db();
  const type = cleanTypeInput(input);
  const row = check(
    await supabase
      .from("event_types")
      .insert({ ...typeToRow(type), position: await nextPosition(supabase) })
      .select("id")
      .single(),
  );
  revalidatePath(PATH);
  return row.id as string;
}

export async function createTypes(inputs: Partial<TypeInput>[]) {
  const supabase = await db();
  const start = await nextPosition(supabase);
  check(
    await supabase
      .from("event_types")
      .insert(inputs.slice(0, 20).map((input, index) => ({ ...typeToRow(cleanTypeInput(input)), position: start + index }))),
  );
  revalidatePath(PATH);
}

export async function updateType(id: string, input: Partial<TypeInput>) {
  const supabase = await db();
  const type = cleanTypeInput(input);
  // The kind only changes while the type has no entries.
  const { count } = await supabase.from("event_entries").select("id", { count: "exact", head: true }).eq("type_id", id);
  const row = typeToRow(type) as Partial<ReturnType<typeof typeToRow>>;
  if (count) delete row.kind;
  check(await supabase.from("event_types").update(row).eq("id", id));
  // Fields the type no longer tracks stay in the old entries but are hidden.
  revalidatePath(PATH);
}

export async function deleteType(id: string) {
  const supabase = await db();
  check(await supabase.from("event_types").delete().eq("id", id));
  revalidatePath(PATH);
}

export async function reorderTypes(ids: string[]) {
  const supabase = await db();
  const results = await Promise.all(
    ids.slice(0, 200).map((id, position) => supabase.from("event_types").update({ position }).eq("id", id)),
  );
  results.forEach(check);
  revalidatePath(PATH);
}

// --- Entries ----------------------------------------------------------------

export async function addEntry(input: Partial<EntryInput>) {
  const supabase = await db();
  const type = await typeFor(supabase, String(input.typeId ?? ""));
  const entry = cleanEntryInput(input, { kind: type.kind, trackAmount: type.track_amount, trackRating: type.track_rating });
  const row = check(await supabase.from("event_entries").insert(entryToRow(entry)).select("id").single());
  revalidatePath(PATH);
  return row.id as string;
}

export async function updateEntry(id: string, input: Partial<EntryInput>) {
  const supabase = await db();
  const type = await typeFor(supabase, String(input.typeId ?? ""));
  const entry = cleanEntryInput(input, { kind: type.kind, trackAmount: type.track_amount, trackRating: type.track_rating });
  check(await supabase.from("event_entries").update(entryToRow(entry)).eq("id", id));
  revalidatePath(PATH);
}

// Ends a running span on the given day (not before its start).
export async function endSpan(id: string, endDate: string) {
  if (!isDate(endDate)) throw new Error("Invalid end date");
  const supabase = await db();
  const entry = check(await supabase.from("event_entries").select("start_date").eq("id", id).single<{ start_date: string }>());
  check(
    await supabase
      .from("event_entries")
      .update({ end_date: endDate < entry.start_date ? entry.start_date : endDate })
      .eq("id", id),
  );
  revalidatePath(PATH);
}

export async function reopenSpan(id: string) {
  const supabase = await db();
  check(await supabase.from("event_entries").update({ end_date: null }).eq("id", id));
  revalidatePath(PATH);
}

export async function deleteEntry(id: string) {
  const supabase = await db();
  check(await supabase.from("event_entries").delete().eq("id", id));
  revalidatePath(PATH);
}
