"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanExercise, focusTags, parseDiagram, replan, type Exercise, type ExerciseInput, type PlanItem } from "./data";
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
    players_min: input.playersMin,
    players_max: input.playersMax,
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
  const weekday = Number(formData.get("weekday"));
  return {
    name: text(formData, "name", 60),
    note: text(formData, "note", 500),
    ...(isTime(startTime) && { start_time: startTime }),
    ...(minutes >= 15 && minutes <= 180 && { minutes }),
    ...(formData.has("weekday") && { weekday: Number.isInteger(weekday) && weekday >= 1 && weekday <= 7 ? weekday : null }),
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

// --- Players and holidays ---------------------------------------------------

const gender = (value: FormDataEntryValue | null) => (value === "m" || value === "f" ? value : null);

export async function addPlayer(formData: FormData) {
  const name = text(formData, "name", 60);
  const groupId = String(formData.get("groupId"));
  if (!name || !isId(groupId)) return;
  const supabase = await db();
  check(await supabase.from("tennis_players").insert({ group_id: groupId, name, gender: gender(formData.get("gender")) }));
  revalidatePath(PATH);
}

export async function setPlayerGender(playerId: string, value: string | null) {
  const supabase = await db();
  check(await supabase.from("tennis_players").update({ gender: gender(value) }).eq("id", playerId));
  revalidatePath(PATH);
}

export async function deletePlayer(formData: FormData) {
  const supabase = await db();
  check(await supabase.from("tennis_players").delete().eq("id", String(formData.get("playerId"))));
  revalidatePath(PATH);
}

export async function addHoliday(formData: FormData) {
  const startDate = text(formData, "startDate", 10);
  const endDate = text(formData, "endDate", 10) || startDate;
  if (!isDate(startDate) || !isDate(endDate)) return;
  const supabase = await db();
  check(
    await supabase.from("tennis_holidays").insert({
      name: text(formData, "name", 60),
      start_date: startDate <= endDate ? startDate : endDate,
      end_date: startDate <= endDate ? endDate : startDate,
    }),
  );
  revalidatePath(PATH);
}

export async function deleteHoliday(formData: FormData) {
  const supabase = await db();
  check(await supabase.from("tennis_holidays").delete().eq("id", String(formData.get("holidayId"))));
  revalidatePath(PATH);
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

// Marks a player of the session's group as absent (cancelled) or back.
export async function setAbsent(sessionId: string, playerId: string, absent: boolean) {
  if (!isId(playerId)) return;
  const supabase = await db();
  const session = check(await supabase.from("tennis_sessions").select("absent").eq("id", sessionId).single());
  const current = (session.absent ?? []) as string[];
  const next = absent ? [...new Set([...current, playerId])] : current.filter((id) => id !== playerId);
  check(await supabase.from("tennis_sessions").update({ absent: next }).eq("id", sessionId));
  revalidatePath(PATH);
}

// Re-plans a session for the kids who are there (see replan in data.ts):
// from item `from` on (earlier ones already happened) it swaps what doesn't
// work for that many kids, or with `all` everything. Returns the old plan, so
// the change can be undone.
export async function replanSession(sessionId: string, { from = 0, all = false }: { from?: number; all?: boolean }) {
  const supabase = await db();
  const session = check(
    await supabase.from("tennis_sessions").select("id, group_id, plan, absent, focus").eq("id", sessionId).single(),
  );
  const plan = (Array.isArray(session.plan) ? session.plan : []) as PlanItem[];
  const absent = new Set((session.absent ?? []) as string[]);
  const [exerciseRows, players, favorites, recentSessions] = await Promise.all([
    supabase.from("tennis_exercises").select("id, name, phase, minutes, focus, players_min, players_max"),
    session.group_id ? supabase.from("tennis_players").select("id").eq("group_id", session.group_id) : Promise.resolve({ data: [], error: null }),
    session.group_id
      ? supabase.from("tennis_favorites").select("exercise_id").eq("group_id", session.group_id)
      : Promise.resolve({ data: [], error: null }),
    session.group_id
      ? supabase
          .from("tennis_sessions")
          .select("plan")
          .eq("group_id", session.group_id)
          .neq("id", sessionId)
          .order("date", { ascending: false })
          .limit(2)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const exercises = check(exerciseRows).map(
    (row): Exercise => ({
      id: row.id,
      name: row.name,
      phase: row.phase,
      minutes: row.minutes,
      focus: row.focus ?? [],
      playersMin: row.players_min,
      playersMax: row.players_max,
      summary: "",
      description: "",
      tips: [],
      diagram: parseDiagram(null),
      notes: "",
    }),
  );
  const groupPlayers = check(players) as { id: string }[];
  const present = groupPlayers.length > 0 ? groupPlayers.filter((player) => !absent.has(player.id)).length : null;
  const result = replan(
    plan,
    {
      exercises,
      favorites: new Set((check(favorites) as { exercise_id: string }[]).map((row) => row.exercise_id)),
      recent: new Set(
        (check(recentSessions) as { plan: unknown }[]).flatMap((row) =>
          Array.isArray(row.plan) ? (row.plan as PlanItem[]).map((item) => item.exerciseId) : [],
        ),
      ),
      focus: session.focus,
      players: present,
    },
    { from: Math.max(0, Math.round(from)), all },
  );
  if (result.changed > 0) check(await supabase.from("tennis_sessions").update({ plan: result.plan }).eq("id", sessionId));
  revalidatePath(PATH);
  return { changed: result.changed, previous: plan };
}

export async function restorePlan(sessionId: string, plan: PlanItem[]) {
  const clean = plan
    .filter((item) => isId(item.exerciseId))
    .slice(0, 20)
    .map((item) => ({ exerciseId: item.exerciseId, minutes: Math.min(90, Math.max(5, Math.round(item.minutes))) }));
  const supabase = await db();
  check(await supabase.from("tennis_sessions").update({ plan: clean }).eq("id", sessionId));
  revalidatePath(PATH);
}
