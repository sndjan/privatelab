// Server only. What the browser cache loads for the tennis training (see
// src/lib/query/data.ts): every table as one list; the views pick from them.
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import {
  isStage,
  parseDiagram,
  parseVariations,
  type Exercise,
  type Gender,
  type Group,
  type Holiday,
  type PlanItem,
  type Player,
  type Session,
  type StandIn,
} from "./data";

// --- Rows ---------------------------------------------------------------------

// Exercises, groups and players are read with "*": before the migration
// 20261116000000_tennis_variations_ages_principles.sql their new columns
// (variations, stage, birth_year) don't exist yet.
const standInColumns = "id, group_id, date, note";
const sessionColumns = "id, group_id, date, start_time, minutes, focus, plan, notes, absent";
const holidayColumns = "id, name, start_date, end_date";

type ExerciseRow = Omit<Exercise, "diagram" | "playersMin" | "playersMax" | "variations"> & {
  diagram: unknown;
  players_min: number | null;
  players_max: number | null;
  variations?: unknown;
};
type GroupRow = {
  id: string;
  name: string;
  note: string;
  start_time: string;
  minutes: number;
  weekday: number | null;
  coach: string | null;
  stage?: string | null;
};
type StandInRow = { id: string; group_id: string; date: string; note: string };
type PlayerRow = { id: string; group_id: string; name: string; gender: Gender | null; birth_year?: number | null };
type HolidayRow = { id: string; name: string; start_date: string; end_date: string };
type SessionRow = {
  id: string;
  group_id: string | null;
  date: string;
  start_time: string;
  minutes: number;
  focus: string | null;
  plan: unknown;
  notes: string;
  absent: string[] | null;
};

const toExercise = (row: ExerciseRow): Exercise => ({
  id: row.id,
  name: row.name,
  phase: row.phase,
  minutes: row.minutes,
  summary: row.summary,
  description: row.description,
  tips: row.tips,
  focus: row.focus,
  diagram: parseDiagram(row.diagram),
  notes: row.notes,
  playersMin: row.players_min,
  playersMax: row.players_max,
  variations: parseVariations(row.variations),
});

const toPlayer = (row: PlayerRow): Player => ({
  id: row.id,
  groupId: row.group_id,
  name: row.name,
  gender: row.gender,
  birthYear: row.birth_year ?? null,
});

const toHoliday = (row: HolidayRow): Holiday => ({ id: row.id, name: row.name, startDate: row.start_date, endDate: row.end_date });

const toGroup = (row: GroupRow): Group => ({
  id: row.id,
  name: row.name,
  note: row.note,
  startTime: row.start_time.slice(0, 5),
  minutes: row.minutes,
  weekday: row.weekday,
  coach: row.coach ?? "",
  stage: isStage(row.stage) ? row.stage : null,
});

const toStandIn = (row: StandInRow): StandIn => ({ id: row.id, groupId: row.group_id, date: row.date, note: row.note });

function toSession(row: SessionRow): Session {
  const plan = (Array.isArray(row.plan) ? row.plan : []).filter(
    (item): item is PlanItem => typeof item?.exerciseId === "string" && typeof item?.minutes === "number",
  );
  return {
    id: row.id,
    groupId: row.group_id,
    date: row.date,
    startTime: row.start_time.slice(0, 5),
    minutes: row.minutes,
    focus: row.focus,
    plan,
    notes: row.notes,
    absent: row.absent ?? [],
  };
}


export const tennisLoaders = {
  groups: async () => {
    const supabase = await createClient();
    const { data } = await supabase.from("tennis_groups").select("*").order("name");
    return ((data ?? []) as GroupRow[]).map(toGroup);
  },
  exercises: async () => {
    const supabase = await createClient();
    const { data } = await supabase.from("tennis_exercises").select("*").order("name");
    return ((data ?? []) as ExerciseRow[]).map(toExercise);
  },
  // Newest first.
  sessions: async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tennis_sessions")
      .select(sessionColumns)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false });
    return ((data ?? []) as SessionRow[]).map(toSession);
  },
  players: async () => {
    const supabase = await createClient();
    const { data } = await supabase.from("tennis_players").select("*").order("name");
    return ((data ?? []) as PlayerRow[]).map(toPlayer);
  },
  holidays: async () => {
    const supabase = await createClient();
    const { data } = await supabase.from("tennis_holidays").select(holidayColumns).order("start_date");
    return ((data ?? []) as HolidayRow[]).map(toHoliday);
  },
  standIns: async () => {
    const supabase = await createClient();
    const { data } = await supabase.from("tennis_stand_ins").select(standInColumns).order("date");
    return ((data ?? []) as StandInRow[]).map(toStandIn);
  },
  // The coach's principles for the AI; "" = the defaults. Before the
  // migration 20261116000000 the table doesn't exist; then also "".
  principles: async () => {
    const supabase = await createClient();
    const { data } = await supabase.from("tennis_settings").select("principles").maybeSingle();
    return (data?.principles as string | undefined) ?? "";
  },
  // "groupId:exerciseId"
  favorites: async () => {
    const supabase = await createClient();
    const { data } = await supabase.from("tennis_favorites").select("group_id, exercise_id");
    return (data ?? []).map((row) => `${row.group_id}:${row.exercise_id}`);
  },
} satisfies Record<string, Loader>;
