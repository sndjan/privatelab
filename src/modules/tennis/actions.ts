"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanExercise, focusTags, type ExerciseInput, type PlanItem } from "./data";
import { starterExercises } from "./starter";

// All writes go through the user's own Supabase client, so RLS enforces
// ownership and access to the 'tennis' module.

const PATH = "/m/tennis";

async function db() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return createClient();
}

function text(formData: FormData, key: string, max: number) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

// Throws on a Supabase error; otherwise returns the data (an empty result for writes without select).
function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const isId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

function toRow(input: ExerciseInput) {
  return {
    name: input.name,
    phase: input.phase,
    minutes: input.minutes,
    summary: input.summary,
    description: input.description,
    tips: input.tips,
    focus: input.focus,
    diagram: input.diagram,
  };
}

// --- Exercises --------------------------------------------------------------

export async function loadStarterExercises() {
  const supabase = await db();
  const existing = new Set(check(await supabase.from("tennis_exercises").select("name")).map((row) => row.name));
  const rows = starterExercises.filter((exercise) => !existing.has(exercise.name)).map(toRow);
  if (rows.length > 0) check(await supabase.from("tennis_exercises").insert(rows));
  revalidatePath(PATH);
}

// Saves a new or changed exercise and opens it.
export async function saveExercise(id: string | null, input: ExerciseInput) {
  const clean = cleanExercise(input as unknown as Record<string, unknown>);
  if (!clean) return;
  const supabase = await db();
  let savedId = id;
  if (id) {
    check(await supabase.from("tennis_exercises").update(toRow(clean)).eq("id", id));
  } else {
    savedId = check(await supabase.from("tennis_exercises").insert(toRow(clean)).select("id").single()).id;
  }
  revalidatePath(PATH);
  redirect(`${PATH}?exercise=${savedId}`);
}

// Exercises pasted from an AI chat. Returns how many were added.
export async function importExercises(inputs: ExerciseInput[]) {
  const rows = inputs
    .slice(0, 50)
    .map((input) => cleanExercise(input as unknown as Record<string, unknown>))
    .filter((input): input is ExerciseInput => input !== null)
    .map(toRow);
  if (rows.length === 0) return 0;
  const supabase = await db();
  check(await supabase.from("tennis_exercises").insert(rows));
  revalidatePath(PATH);
  return rows.length;
}

export async function saveExerciseNotes(formData: FormData) {
  const supabase = await db();
  check(
    await supabase
      .from("tennis_exercises")
      .update({ notes: text(formData, "notes", 1000) })
      .eq("id", String(formData.get("exerciseId"))),
  );
  revalidatePath(PATH);
}

export async function deleteExercise(formData: FormData) {
  const supabase = await db();
  check(await supabase.from("tennis_exercises").delete().eq("id", String(formData.get("exerciseId"))));
  revalidatePath(PATH);
  redirect(`${PATH}?exercises=1`);
}

export async function setFavorite(groupId: string, exerciseId: string, favorite: boolean) {
  const supabase = await db();
  if (favorite) {
    check(
      await supabase
        .from("tennis_favorites")
        .upsert({ group_id: groupId, exercise_id: exerciseId }, { onConflict: "group_id,exercise_id", ignoreDuplicates: true }),
    );
  } else {
    check(await supabase.from("tennis_favorites").delete().eq("group_id", groupId).eq("exercise_id", exerciseId));
  }
  revalidatePath(PATH);
}

// --- Groups -----------------------------------------------------------------

function groupValues(formData: FormData) {
  const startTime = text(formData, "startTime", 5);
  const minutes = Math.round(Number(formData.get("minutes")));
  return {
    name: text(formData, "name", 60),
    note: text(formData, "note", 500),
    ...(isTime(startTime) && { start_time: startTime }),
    ...(minutes >= 15 && minutes <= 180 && { minutes }),
  };
}

export async function createGroup(formData: FormData) {
  const values = groupValues(formData);
  if (!values.name) return;
  const supabase = await db();
  const created = check(await supabase.from("tennis_groups").insert(values).select("id").single());
  revalidatePath(PATH);
  redirect(`${PATH}?group=${created.id}`);
}

export async function updateGroup(formData: FormData) {
  const values = groupValues(formData);
  if (!values.name) return;
  const supabase = await db();
  check(await supabase.from("tennis_groups").update(values).eq("id", String(formData.get("groupId"))));
  revalidatePath(PATH);
}

export async function deleteGroup(formData: FormData) {
  const supabase = await db();
  check(await supabase.from("tennis_groups").delete().eq("id", String(formData.get("groupId"))));
  revalidatePath(PATH);
  redirect(PATH);
}

// --- Sessions ---------------------------------------------------------------

export async function saveSession(
  id: string | null,
  values: { groupId: string | null; date: string; startTime: string; focus: string | null; plan: PlanItem[] },
) {
  if (!isDate(values.date) || !isTime(values.startTime)) throw new Error("Ungültiges Datum oder Uhrzeit");
  const plan = values.plan
    .filter((item) => isId(item.exerciseId))
    .slice(0, 20)
    .map((item) => ({ exerciseId: item.exerciseId, minutes: Math.min(90, Math.max(5, Math.round(item.minutes))) }));
  const row = {
    group_id: isId(values.groupId) ? values.groupId : null,
    date: values.date,
    start_time: values.startTime,
    minutes: Math.max(5, plan.reduce((sum, item) => sum + item.minutes, 0)),
    focus: values.focus && (focusTags as readonly string[]).includes(values.focus) ? values.focus : null,
    plan,
  };
  const supabase = await db();
  let savedId = id;
  if (id) {
    check(await supabase.from("tennis_sessions").update(row).eq("id", id));
  } else {
    savedId = check(await supabase.from("tennis_sessions").insert(row).select("id").single()).id;
  }
  revalidatePath(PATH);
  redirect(`${PATH}?session=${savedId}`);
}

export async function saveSessionNotes(formData: FormData) {
  const supabase = await db();
  check(
    await supabase
      .from("tennis_sessions")
      .update({ notes: text(formData, "notes", 2000) })
      .eq("id", String(formData.get("sessionId"))),
  );
  revalidatePath(PATH);
}

export async function deleteSession(formData: FormData) {
  const supabase = await db();
  check(await supabase.from("tennis_sessions").delete().eq("id", String(formData.get("sessionId"))));
  revalidatePath(PATH);
  redirect(PATH);
}
