// Shapes returned by public.sport_dashboard() (supabase/migrations/*_sport_module.sql).
// Dates are "YYYY-MM-DD"; local start times are "YYYY-MM-DDTHH:MM:SS".

export type Run = {
  id: string;
  start: string;
  day: string;
  type: string;
  name: string | null;
  km: number | null;
  durationS: number | null;
  avgHr: number | null;
  maxHr: number | null;
  // Seconds in Garmin zones 1–2 (easy) and 3–5 (hard); without zone times the
  // whole run counts by its average heart rate (under 145 = easy).
  easyS: number | null;
  hardS: number | null;
  zoneSource: "zones" | "avg_hr" | "none";
};

export type HealthDay = {
  day: string;
  restingHr: number | null;
  sleepS: number | null;
  deepS: number | null;
  remS: number | null;
  sleepScore: number | null;
  hrv: number | null;
  hrvWeekly: number | null;
  hrvStatus: string | null;
  hrvLow: number | null;
  hrvHigh: number | null;
};

export type ExerciseSession = {
  workoutId: string;
  day: string;
  exercise: string;
  assisted: boolean;
  sets: number;
  reps: number;
  volumeKg: number;
  topWeightKg: number | null;
  topReps: number | null;
};

export type Workout = {
  id: string;
  title: string | null;
  start: string;
  day: string;
  durationS: number | null;
};

export type Activity = {
  id: string;
  day: string;
  type: string;
  name: string | null;
  km: number | null;
  durationS: number | null;
};

export type SyncRun = {
  startedAt: string;
  finishedAt: string | null;
  ok: boolean | null;
  errors: Record<string, string> | null;
};

export type SportData = {
  runs: Run[];
  health: HealthDay[];
  exercises: ExerciseSession[];
  workouts: Workout[];
  activities: Activity[];
  syncRuns: SyncRun[];
};
