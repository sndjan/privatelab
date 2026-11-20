// Jan's running plan (half marathon in September 2027) and gym routine, as in
// the "Jans Laufplan" and "Jans Ganzkörper-Routine" pages: 43 weeks, by
// default from Monday 23.11.2026. The start can move and single weeks can be
// repeated or skipped (Einstellungen / Plan tab); the dates follow.
import { addDays, daysBetween, mondayOf } from "./calc";
import type { PlanChange, Settings } from "./types";

export const DEFAULT_PLAN_START = "2026-11-23";

const phases = [
  { from: 1, to: 6, name: "Wiedereinstieg" },
  { from: 7, to: 12, name: "10-km-Block" },
  { from: 13, to: 18, name: "Grundlage" },
  { from: 19, to: 30, name: "Aufbau" },
  { from: 31, to: 41, name: "Halbmarathon-spezifisch" },
  { from: 42, to: 43, name: "Tapering" },
];

// Longest session of each week in minutes (week 43: the race week's last easy run).
const longest = [
  25, 28, 30, 34, 37, 41, 45, 50, 55, 60, 64, 70, 60, 70, 70, 75, 75, 78, 78, 80, 80, 82, 82, 85, 85, 85, 88, 88, 90, 90,
  90, 90, 95, 95, 100, 100, 105, 110, 110, 115, 100, 70, 30,
];

// Sessions as in the plan page (Mo, Fr, So).
function sessionsOf(number: number): string[] {
  const easy = (min: number) => `${min} min locker`;
  if (number <= 4) {
    const blocks = ["5 × (4 min Laufen / 1 min Gehen)", "4 × (6 min / 1 min)", "3 × (9 min / 1 min)", "2 × (16 min / 1 min)"];
    return [blocks[number - 1], blocks[Math.max(0, number - 2)]];
  }
  if (number <= 6) return [number === 5 ? "37 min durchgehend locker" : "41 min locker", "30 min locker"];
  if (number <= 12) {
    const short = number <= 9 ? 30 : 35;
    const strides = number >= 8 ? " + 4–6 × 20 s Steigerungen" : "";
    return [easy(short), `${easy(short)}${strides}`, number === 12 ? "ZIEL: 10 km am Stück, Zone 1, schmerzfrei" : `Langer Lauf ${longest[number - 1]} min locker`];
  }
  if (number <= 18) {
    return [easy(number === 13 ? 35 : 40), number === 13 ? "5-km-Test" : `${easy(40)} + 6 × 20 s Steigerungen`, `Langer Lauf ${longest[number - 1]} min locker`];
  }
  if (number <= 30) return ["40–45 min locker", "Qualität: zügig in Zone 2", `Langer Lauf ${longest[number - 1]} min locker`];
  if (number <= 41) return ["45 min locker", "Qualität: Halbmarathon-Tempo", `Langer Lauf ${longest[number - 1]} min`];
  if (number === 42) return ["35 min locker", "2 × 10 min HM-Tempo", "Langer Lauf 70 min locker"];
  return ["30 min locker + 4 × 20 s Steigerungen", "20 min locker", "HALBMARATHON"];
}

const notes: Record<number, string> = {
  1: "Start mit ca. 25 min, alles unter 145 bpm",
  5: "Zwischenziel: über 30 min am Stück",
  12: "Ziel: 10 km am Stück, Zone 1, schmerzfrei",
  13: "5-km-Test für die Pace-Zonen",
  15: "Woche ohne Steigerung",
  42: "Umfang −40 bis −60 %",
  43: "Halbmarathon am Sonntag",
};

export type PlanWeek = {
  // Position in the (changed) plan, 1-based, and the plan week it comes from.
  number: number;
  base: number;
  repeat: boolean;
  start: string;
  phase: string;
  runs: number;
  longestMinutes: number;
  sessions: string[];
  gym: number;
  note: string | null;
};

export const BASE_WEEKS = longest.length;

export function buildPlan(start: string, changes: PlanChange[]): PlanWeek[] {
  let order: { base: number; repeat: boolean }[] = longest.map((_, index) => ({ base: index + 1, repeat: false }));
  for (const change of changes) {
    const index = order.findIndex((entry) => entry.base === change.week && !entry.repeat);
    if (index < 0) continue;
    if (change.action === "repeat") order.splice(index + 1, 0, { base: change.week, repeat: true });
    else order = order.filter((_, position) => position !== index);
  }
  return order.map(({ base, repeat }, index) => ({
    number: index + 1,
    base,
    repeat,
    start: addDays(mondayOf(start), index * 7),
    phase: phases.find((phase) => base >= phase.from && base <= phase.to)!.name,
    runs: base <= 6 ? 2 : 3,
    longestMinutes: longest[base - 1],
    sessions: sessionsOf(base),
    gym: base === BASE_WEEKS ? 1 : 3,
    note: repeat ? "Wiederholung" : (notes[base] ?? null),
  }));
}

export const planFromSettings = (settings: Settings | null | undefined) =>
  buildPlan(settings?.planStart ?? DEFAULT_PLAN_START, settings?.planChanges ?? []);

export function planWeekOf(plan: PlanWeek[], date: string): PlanWeek | null {
  if (plan.length === 0) return null;
  const index = Math.floor(daysBetween(plan[0].start, mondayOf(date)) / 7);
  return plan[index] ?? null;
}

// The usual week from both plans (Monday first). The long run starts in plan week 7.
export function plannedDay(weekdayIndex: number, week: PlanWeek | null): { label: string; kind: "run" | "gym" | "free"; detail?: string } {
  if (!week) return { label: "–", kind: "free" };
  const last = week.base === BASE_WEEKS;
  switch (weekdayIndex) {
    case 0: return { label: "Lauf 1", kind: "run", detail: week.sessions[0] };
    case 1: return { label: "Gym A", kind: "gym" };
    case 3: return { label: "Gym B", kind: "gym" };
    case 4: return { label: "Lauf 2", kind: "run", detail: week.sessions[1] };
    case 5: return last ? { label: "frei", kind: "free" } : { label: "Gym C", kind: "gym" };
    case 6: return week.base >= 7 ? { label: last ? "Halbmarathon" : "Langer Lauf", kind: "run", detail: week.sessions[2] } : { label: "frei", kind: "free" };
    default: return { label: "frei", kind: "free" };
  }
}

// --- Gym routine ------------------------------------------------------------------

export type RoutineExercise = { name: string; sets: number; repsMin: number; repsMax: number; reserve: boolean; goal?: string };
export type RoutineDay = { id: "A" | "B" | "C"; weekday: string; exercises: RoutineExercise[] };

const ex = (name: string, sets: number, repsMin: number, repsMax: number, reserve = false, goal?: string): RoutineExercise => ({ name, sets, repsMin, repsMax, reserve, goal });

export const routine: RoutineDay[] = [
  {
    id: "A",
    weekday: "Dienstag",
    exercises: [
      ex("Squat (Langhantel)", 2, 5, 8, true, "85 kg × 8"),
      ex("Bankdrücken (Kurzhantel)", 2, 6, 10),
      ex("Klimmzüge (Unterstützt)", 2, 5, 10, false, "0 kg Hilfe"),
      ex("Beinbeugen sitzend (Maschine)", 2, 8, 12),
      ex("Einarmiges Seitheben (Kabelzug)", 2, 10, 20),
      ex("Wadenheben sitzend", 2, 10, 15),
    ],
  },
  {
    id: "B",
    weekday: "Donnerstag",
    exercises: [
      ex("Rumänisches Kreuzheben (Langhantel)", 2, 6, 10, true, "85 kg × 10"),
      ex("Schulterpresse (Kurzhantel)", 2, 6, 10),
      ex("Sitzendes Rudern - V-Griff (Kabelzug)", 2, 8, 12),
      ex("Bulgarian Split Squat (Kurzhantel)", 2, 8, 12, true),
      ex("Hüftabduktion (Maschine)", 2, 12, 20),
      ex("Trizeps-Pushdown (Einseitig)", 1, 10, 15),
      ex("Bizepscurl (Kurzhantel)", 1, 8, 12),
    ],
  },
  {
    id: "C",
    weekday: "Samstag oder Sonntag",
    exercises: [
      ex("Beinpresse (Maschine)", 2, 8, 12),
      ex("Schrägbankdrücken (Kurzhantel)", 2, 6, 10),
      ex("Latzug (Kabelzug)", 2, 8, 12),
      ex("Beinstrecken (Maschine)", 2, 10, 15),
      ex("Fliegende (Maschine)", 2, 10, 15),
      ex("Einarmiges Seitheben (Kabelzug)", 2, 10, 20),
      ex("Wadenheben stehend (Maschine)", 2, 8, 12),
      ex("Beinbeugen sitzend (Maschine)", 1, 8, 12),
      ex("Crunch (Maschine)", 2, 10, 15),
    ],
  },
];

// Warm-up before every gym day (about 7 min), as on the routine page without the rowing. Items with
// a Hevy template become their own exercises in the Hevy routines (as warm-up
// sets, so they don't count as working sets); the rest go into the note of
// Hevy's "Warm Up" exercise.
export type WarmupItem = {
  name: string;
  amount: string;
  note: string;
  hevy?: { templateId: string; reps?: number; durationS?: number };
};

export const warmup: WarmupItem[] = [
  { name: "Mobilisation (Arme, Schultern, Hüfte, Beinschwingen)", amount: "2 min", note: "wie bisher" },
  { name: "Short Foot (Fußgewölbe aktiv anheben)", amount: "2 × 30 s je Fuß", note: "Knick-Senkfuß; Wirkung erst nach über 6 Wochen messbar" },
  { name: "Soleus Lunge", amount: "1 × 12 je Seite", note: "Knie über die Zehen schieben, Ferse bleibt unten", hevy: { templateId: "fe1d93a8-165e-48dd-b4c9-3c2203bafe5d", reps: 12 } },
  { name: "Einbeinstand", amount: "1 × 30 s je Seite", note: "später auf weicher Unterlage oder mit Augen zu", hevy: { templateId: "6baa4ec1-9d22-4b77-b6e6-046f9d1f2938" } },
  { name: "Pogo Hops", amount: "2 × 15", note: "kleine Sprünge aus dem Sprunggelenk; ab Woche 5 an Tag A zusätzlich Box Jumps 2 × 5, an Tag C Skater-Sprünge 2 × 5 je Seite; nur bei Knie ≤ 3/10" },
  { name: "Aufwärmsätze der ersten Übung", amount: "ca. 50 / 70 / 85 %", note: "zählen nicht als Arbeitssätze" },
];

// Hevy's "Warm Up" exercise (duration) for the items without their own template.
export const WARMUP_TEMPLATE = "79EF4E4F";

// Hevy names can carry another equipment tag or a gym name
// ("Crunch Maschine (Vöhringen)"); compare the words without brackets first.
const words = (name: string) =>
  name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-zäöüß]+/g, " ")
    .trim();
const full = (name: string) => name.toLowerCase().replace(/[^a-zäöüß]+/g, "");

export function sameExercise(planName: string, hevyName: string) {
  if (full(planName) === full(hevyName)) return true;
  const a = words(planName);
  const b = words(hevyName);
  return a.length > 0 && (a === b || b.startsWith(`${a} `) || (a.includes("crunch") && b.includes("crunch")));
}

export function routineExerciseFor(hevyName: string): RoutineExercise | null {
  for (const day of routine) {
    const exact = day.exercises.find((entry) => full(entry.name) === full(hevyName));
    if (exact) return exact;
  }
  for (const day of routine) {
    const match = day.exercises.find((entry) => sameExercise(entry.name, hevyName));
    if (match) return match;
  }
  return null;
}
