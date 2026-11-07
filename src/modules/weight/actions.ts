"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  cleanCircumferenceInput,
  cleanParticipantInput,
  cleanSettingsInput,
  cleanSiteInput,
  cleanWeighingInput,
  isDate,
  participantToRow,
  siteKey,
  weighingToRow,
  type CircumferenceInput,
  type ParticipantInput,
  type Settings,
  type WeighingInput,
} from "./data";

// All writes go through the user's own Supabase client, so RLS decides:
// everyone with access to the module writes measurements (for anyone), only
// admins write the setup. They take plain objects and are called from the
// browser, which updates its cache right away. Measurements are addressed by
// participant and day (one weighing and one set of circumferences each).

const PATH = "/m/weight";

async function db() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return createClient();
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

function checkKey(participantId: unknown, date: unknown) {
  if (typeof participantId !== "string" || !isDate(date)) throw new Error("Invalid key");
}

// --- Measurements -------------------------------------------------------------

// Adds or replaces the participant's weighing of that day.
export async function saveWeighing(input: Partial<Record<keyof WeighingInput, unknown>>) {
  const supabase = await db();
  const weighing = cleanWeighingInput(input);
  check(await supabase.from("weight_entries").upsert(weighingToRow(weighing), { onConflict: "participant_id,date" }));
  revalidatePath(PATH);
}

export async function deleteWeighing(participantId: string, date: string) {
  checkKey(participantId, date);
  const supabase = await db();
  check(await supabase.from("weight_entries").delete().eq("participant_id", participantId).eq("date", date));
  revalidatePath(PATH);
}

// Adds or replaces the participant's circumferences of that day; without any
// value the set is deleted.
export async function saveCircumferences(input: Partial<Record<keyof CircumferenceInput, unknown>>) {
  const supabase = await db();
  const set = cleanCircumferenceInput(input);
  if (Object.keys(set.values).length === 0) {
    check(
      await supabase.from("weight_circumferences").delete().eq("participant_id", set.participantId).eq("date", set.date),
    );
  } else {
    check(
      await supabase
        .from("weight_circumferences")
        .upsert({ participant_id: set.participantId, date: set.date, values: set.values }, { onConflict: "participant_id,date" }),
    );
  }
  revalidatePath(PATH);
}

export async function deleteCircumferences(participantId: string, date: string) {
  checkKey(participantId, date);
  const supabase = await db();
  check(await supabase.from("weight_circumferences").delete().eq("participant_id", participantId).eq("date", date));
  revalidatePath(PATH);
}

// --- Setup (admins) -------------------------------------------------------------

export async function saveSettings(input: Partial<Record<keyof Settings, unknown>>) {
  const supabase = await db();
  const settings = cleanSettingsInput(input);
  check(
    await supabase
      .from("weight_settings")
      .upsert({ id: 1, title: settings.title, start_date: settings.startDate, end_date: settings.endDate }),
  );
  revalidatePath(PATH);
}

export async function createParticipant(input: Partial<Record<keyof ParticipantInput, unknown>>) {
  const supabase = await db();
  const participant = cleanParticipantInput(input);
  const { data } = await supabase
    .from("weight_participants")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  const position = ((data?.[0]?.position as number | undefined) ?? -1) + 1;
  check(await supabase.from("weight_participants").insert({ ...participantToRow(participant), position }));
  revalidatePath(PATH);
}

export async function updateParticipant(id: string, input: Partial<Record<keyof ParticipantInput, unknown>>) {
  const supabase = await db();
  const participant = cleanParticipantInput(input);
  // An account belongs to one participant: linking moves it.
  if (participant.userId) {
    check(
      await supabase
        .from("weight_participants")
        .update({ user_id: null })
        .eq("user_id", participant.userId)
        .neq("id", id),
    );
  }
  check(await supabase.from("weight_participants").update(participantToRow(participant)).eq("id", id));
  revalidatePath(PATH);
}

export async function deleteParticipant(id: string) {
  const supabase = await db();
  check(await supabase.from("weight_participants").delete().eq("id", id));
  revalidatePath(PATH);
}

export async function moveParticipant(ids: string[]) {
  const supabase = await db();
  const results = await Promise.all(
    ids.slice(0, 50).map((id, position) => supabase.from("weight_participants").update({ position }).eq("id", id)),
  );
  results.forEach(check);
  revalidatePath(PATH);
}

export async function createSite(input: { label?: unknown; sided?: unknown }) {
  const supabase = await db();
  const site = cleanSiteInput(input);
  const { data } = await supabase.from("weight_sites").select("key, position");
  const rows = (data ?? []) as { key: string; position: number }[];
  // A free key: "huefte", "huefte-2", …
  const base = siteKey(site.label);
  let key = base;
  for (let index = 2; rows.some((row) => row.key === key); index++) key = `${base}-${index}`;
  const position = Math.max(-1, ...rows.map((row) => row.position)) + 1;
  check(await supabase.from("weight_sites").insert({ key, label: site.label, sided: site.sided, position }));
  revalidatePath(PATH);
}

// The label and on/off; whether a point is sided stays as created, because
// its values are stored under the sided keys.
export async function updateSite(key: string, input: { label?: unknown; active?: unknown }) {
  const supabase = await db();
  const { label } = cleanSiteInput({ label: input.label });
  check(await supabase.from("weight_sites").update({ label, active: input.active !== false }).eq("key", key));
  revalidatePath(PATH);
}

export async function reorderSites(keys: string[]) {
  const supabase = await db();
  const results = await Promise.all(
    keys.slice(0, 100).map((key, position) => supabase.from("weight_sites").update({ position }).eq("key", key)),
  );
  results.forEach(check);
  revalidatePath(PATH);
}
