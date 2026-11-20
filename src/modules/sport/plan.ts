// Jan's running plan (half marathon in September 2027) and gym routine, as in
// the "Jans Laufplan" and "Jans Ganzkörper-Routine" pages: 43 weeks from
// Monday 23.11.2026. Only what the week check compares is kept here.
import { addDays, daysBetween, mondayOf } from "./calc";

export const PLAN_START = "2026-11-23";

const phases = [
  { from: 1, to: 6, name: "Wiedereinstieg" },
  { from: 7, to: 12, name: "10-km-Block" },
  { from: 13, to: 18, name: "Grundlage" },
  { from: 19, to: 30, name: "Aufbau" },
  { from: 31, to: 41, name: "Halbmarathon-spezifisch" },
  { from: 42, to: 43, name: "Tapering" },
];

// Longest session of each week in minutes (week 43: the race itself).
const longest = [
  25, 28, 30, 34, 37, 41, 45, 50, 55, 60, 64, 70, 60, 70, 70, 75, 75, 78, 78, 80, 80, 82, 82, 85, 85, 85, 88, 88, 90, 90,
  90, 90, 95, 95, 100, 100, 105, 110, 110, 115, 100, 70, 30,
];

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
  number: number;
  start: string;
  phase: string;
  runs: number;
  longestMinutes: number;
  gym: number;
  note: string | null;
};

export const planWeeks: PlanWeek[] = longest.map((minutes, index) => {
  const number = index + 1;
  return {
    number,
    start: addDays(PLAN_START, index * 7),
    phase: phases.find((phase) => number >= phase.from && number <= phase.to)!.name,
    runs: number <= 6 ? 2 : 3,
    longestMinutes: minutes,
    gym: number === 43 ? 1 : 3,
    note: notes[number] ?? null,
  };
});

export function planWeekOf(date: string): PlanWeek | null {
  const index = Math.floor(daysBetween(PLAN_START, mondayOf(date)) / 7);
  return planWeeks[index] ?? null;
}

// The usual week from both plans (Monday first). The long run starts in week 7.
export function plannedDay(weekdayIndex: number, week: PlanWeek | null): { label: string; kind: "run" | "gym" | "free" } {
  if (!week) return { label: "–", kind: "free" };
  switch (weekdayIndex) {
    case 0: return { label: "Lauf 1", kind: "run" };
    case 1: return { label: "Gym A", kind: "gym" };
    case 3: return { label: "Gym B", kind: "gym" };
    case 4: return { label: "Lauf 2", kind: "run" };
    case 5: return week.number === 43 ? { label: "frei", kind: "free" } : { label: "Gym C", kind: "gym" };
    case 6: return week.number >= 7 ? { label: week.number === 43 ? "Halbmarathon" : "Langer Lauf", kind: "run" } : { label: "frei", kind: "free" };
    default: return { label: "frei", kind: "free" };
  }
}
