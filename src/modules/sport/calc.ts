import type { Activity, ExerciseSession, HealthDay, Run, SportData, Workout } from "./types";

// --- Dates ("YYYY-MM-DD", calendar days in Germany) ------------------------------

const DAY = 86_400_000;
const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromTime = (time: number) => new Date(time).toISOString().slice(0, 10);

export function todayInGermany() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}
export const addDays = (date: string, days: number) => fromTime(toTime(date) + days * DAY);
export const daysBetween = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / DAY);
// 0 = Monday … 6 = Sunday
export const weekday = (date: string) => (new Date(toTime(date)).getUTCDay() + 6) % 7;
export const mondayOf = (date: string) => addDays(date, -weekday(date));

const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric", timeZone: "UTC" });
const longDateFormat = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
export const formatDate = (date: string) => dateFormat.format(new Date(toTime(date)));
export const formatDayDate = (date: string) => longDateFormat.format(new Date(toTime(date)));
export const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

// ISO calendar week of a date.
export function isoWeek(date: string) {
  const thursday = addDays(date, 3 - weekday(date));
  const firstThursday = addDays(`${thursday.slice(0, 4)}-01-04`, 3 - weekday(`${thursday.slice(0, 4)}-01-04`));
  return 1 + Math.round(daysBetween(firstThursday, thursday) / 7);
}

// The Mondays of the last `count` weeks, oldest first, ending with this week.
export function lastWeeks(today: string, count: number) {
  const monday = mondayOf(today);
  return Array.from({ length: count }, (_, index) => addDays(monday, (index - count + 1) * 7));
}

// --- Numbers ------------------------------------------------------------------------

const number1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const number0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
export const formatKm = (km: number) => `${number1.format(km)} km`;
export const formatNumber = (value: number) => number0.format(value);
export const formatTonnes = (kg: number) => (kg >= 1000 ? `${number1.format(kg / 1000)} t` : `${number0.format(kg)} kg`);
export const formatWeight = (kg: number) => `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(kg)} kg`;

export function formatMinutes(minutes: number) {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} h`;
}
export function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
export const formatPace = (secondsPerKm: number) => `${formatDuration(secondsPerKm)}/km`;
export const formatSleep = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} h`;
};

export const average = (values: (number | null | undefined)[]) => {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
};

// --- Running --------------------------------------------------------------------

// Zone 1 of the running plan: under 145 bpm.
export const ZONE1_MAX_HR = 145;

export const runKind = (type: string) =>
  type.includes("treadmill") ? "Laufband" : type.includes("indoor") ? "Halle" : type.includes("trail") ? "Trail" : "Draußen";

export const paceOf = (run: Run) => (run.km && run.km > 0.2 && run.durationS ? run.durationS / run.km : null);

export const easyShare = (run: Run) => {
  const known = (run.easyS ?? 0) + (run.hardS ?? 0);
  return known > 0 ? (run.easyS ?? 0) / known : null;
};

export type RunWeek = { week: string; runs: number; km: number; minutes: number; easyMinutes: number; hardMinutes: number; unknownMinutes: number };

export function runWeeks(runs: Run[], weeks: string[]): RunWeek[] {
  const byWeek = new Map(weeks.map((week) => [week, { week, runs: 0, km: 0, minutes: 0, easyMinutes: 0, hardMinutes: 0, unknownMinutes: 0 }]));
  for (const run of runs) {
    const entry = byWeek.get(mondayOf(run.day));
    if (!entry) continue;
    const minutes = (run.durationS ?? 0) / 60;
    entry.runs += 1;
    entry.km += run.km ?? 0;
    entry.minutes += minutes;
    if (run.zoneSource === "none") entry.unknownMinutes += minutes;
    else {
      // Scale the zone split to the run's duration (zone times can miss pauses).
      const share = easyShare(run) ?? 0;
      entry.easyMinutes += minutes * share;
      entry.hardMinutes += minutes * (1 - share);
    }
  }
  return weeks.map((week) => byWeek.get(week)!);
}

export function easyPercent(weeks: RunWeek[]) {
  const easy = weeks.reduce((sum, week) => sum + week.easyMinutes, 0);
  const hard = weeks.reduce((sum, week) => sum + week.hardMinutes, 0);
  return easy + hard > 0 ? (easy / (easy + hard)) * 100 : null;
}

// Plan rule: no run more than 10 % longer than the longest of the last 30 days.
export function tenPercentRule(runs: Run[], today: string) {
  const since = addDays(today, -30);
  const recent = runs.filter((run) => run.day > since && run.day <= today);
  const longest = recent.reduce<Run | null>((best, run) => ((run.durationS ?? 0) > (best?.durationS ?? 0) ? run : best), null);
  if (!longest?.durationS) return null;
  return { longest, maxNextMinutes: (longest.durationS / 60) * 1.1 };
}

// --- Recovery -------------------------------------------------------------------

export type Point = { day: string; value: number | null };

export function series(health: HealthDay[], from: string, to: string, pick: (day: HealthDay) => number | null): Point[] {
  const byDay = new Map(health.map((day) => [day.day, day]));
  const points: Point[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const entry = byDay.get(day);
    points.push({ day, value: entry ? pick(entry) : null });
  }
  return points;
}

// Rolling mean over the last `size` days that have a value.
export function rolling(points: Point[], size = 7): Point[] {
  return points.map((point, index) => ({
    day: point.day,
    value: average(points.slice(Math.max(0, index - size + 1), index + 1).map((entry) => entry.value)),
  }));
}

export const latest = (health: HealthDay[], pick: (day: HealthDay) => number | null) => {
  for (let index = health.length - 1; index >= 0; index -= 1) {
    const value = pick(health[index]);
    if (value != null) return { day: health[index].day, value, entry: health[index] };
  }
  return null;
};

export const hrvStatusLabel = (status: string | null) =>
  ({ BALANCED: "ausgeglichen", UNBALANCED: "unausgeglichen", LOW: "niedrig", POOR: "sehr niedrig" })[status ?? ""] ?? "unbekannt";

// A short, factual read of last night: HRV status and resting heart rate
// compared to its 30-day mean. No advice beyond the plan's own rules.
export function readiness(health: HealthDay[], today: string) {
  const hrv = latest(health, (day) => day.hrv);
  const rhr = latest(health, (day) => day.restingHr);
  const sleep = latest(health, (day) => day.sleepS);
  const monthRhr = average(health.filter((day) => day.day > addDays(today, -30)).map((day) => day.restingHr));
  const rhrDiff = rhr && monthRhr ? rhr.value - monthRhr : null;
  const hrvOk = hrv?.entry.hrvStatus === "BALANCED";
  const rhrHigh = rhrDiff != null && rhrDiff >= 5;
  const parts = [
    hrv ? `HRV ${hrvStatusLabel(hrv.entry.hrvStatus)}` : null,
    rhrDiff == null ? null : rhrHigh ? `Ruhepuls ${formatNumber(rhrDiff)} bpm über dem Schnitt` : "Ruhepuls wie üblich",
  ].filter(Boolean);
  const headline = !hrv && !rhr ? "Noch keine Werte von heute Nacht." : hrvOk && !rhrHigh ? "Gut erholt." : "Heute lieber locker.";
  return { headline, detail: parts.join(", "), hrv, rhr, sleep, monthRhr };
}

// --- Gym ------------------------------------------------------------------------

export type GymWeek = { week: string; sessions: number; volumeKg: number };

export function gymWeeks(exercises: ExerciseSession[], workouts: Workout[], weeks: string[]): GymWeek[] {
  const byWeek = new Map(weeks.map((week) => [week, { week, sessions: 0, volumeKg: 0 }]));
  for (const workout of workouts) {
    const entry = byWeek.get(mondayOf(workout.day));
    if (entry) entry.sessions += 1;
  }
  for (const session of exercises) {
    const entry = byWeek.get(mondayOf(session.day));
    if (entry && !session.assisted) entry.volumeKg += session.volumeKg;
  }
  return weeks.map((week) => byWeek.get(week)!);
}

export type ExerciseSummary = {
  name: string;
  assisted: boolean;
  sessions: ExerciseSession[];
  last: ExerciseSession;
  best: ExerciseSession | null;
  recentVolume: number;
};

// Exercises done since `from`, most frequent first; their whole history is kept.
export function exerciseSummaries(exercises: ExerciseSession[], from: string, today: string): ExerciseSummary[] {
  const byName = new Map<string, ExerciseSession[]>();
  for (const session of exercises) {
    const list = byName.get(session.exercise) ?? [];
    list.push(session);
    byName.set(session.exercise, list);
  }
  const fourWeeks = addDays(today, -28);
  return [...byName.entries()]
    .map(([name, sessions]) => {
      const assisted = sessions[0].assisted;
      const withWeight = sessions.filter((session) => session.topWeightKg != null);
      const best = withWeight.reduce<ExerciseSession | null>((top, session) => {
        if (!top) return session;
        const a = session.topWeightKg!, b = top.topWeightKg!;
        if (assisted ? a < b : a > b) return session;
        return a === b && (session.topReps ?? 0) > (top.topReps ?? 0) ? session : top;
      }, null);
      return {
        name,
        assisted,
        sessions,
        last: sessions[sessions.length - 1],
        best,
        recentVolume: sessions.filter((session) => session.day > fourWeeks).reduce((sum, session) => sum + session.volumeKg, 0),
        inRange: sessions.filter((session) => session.day >= from).length,
      };
    })
    .filter((summary) => summary.inRange > 0)
    .sort((a, b) => b.inRange - a.inRange || b.last.day.localeCompare(a.last.day));
}

export const formatSet = (session: ExerciseSession | null) =>
  session?.topWeightKg == null ? "–" : `${formatWeight(session.topWeightKg)} × ${session.topReps ?? "?"}`;

// --- Training days --------------------------------------------------------------

export type TrainingDay = { run: boolean; gym: boolean; other: boolean; labels: string[] };

const activityLabels: Record<string, string> = {
  tennis_v2: "Tennis",
  tennis: "Tennis",
  indoor_rowing: "Rudern",
  rowing: "Rudern",
  indoor_cycling: "Rad",
  cycling: "Rad",
  walking: "Gehen",
  hiking: "Wandern",
  lap_swimming: "Schwimmen",
  open_water_swimming: "Schwimmen",
  paddelball: "Padel",
  squash: "Squash",
  elliptical: "Crosstrainer",
  stair_climbing: "Treppen",
};
export const activityLabel = (type: string) =>
  type.includes("running") ? "Lauf" : type === "strength_training" ? "Gym" : (activityLabels[type] ?? "Sport");

export function trainingDays(activities: Activity[], workouts: Workout[]) {
  const days = new Map<string, TrainingDay>();
  const get = (day: string) => {
    let entry = days.get(day);
    if (!entry) days.set(day, (entry = { run: false, gym: false, other: false, labels: [] }));
    return entry;
  };
  for (const activity of activities) {
    const entry = get(activity.day);
    const label = activityLabel(activity.type);
    if (label === "Lauf") entry.run = true;
    else if (label === "Gym") entry.gym = true;
    else entry.other = true;
    if (!entry.labels.includes(label)) entry.labels.push(label);
  }
  for (const workout of workouts) {
    const entry = get(workout.day);
    entry.gym = true;
    if (!entry.labels.includes("Gym")) entry.labels.push("Gym");
  }
  return days;
}

// Recent sessions of every kind, newest first: Garmin activities (strength
// training only when Hevy has no workout that day) and Hevy workouts.
export type FeedItem = { key: string; day: string; kind: "run" | "gym" | "other"; title: string; meta: string };

export function feed(data: SportData, limit: number): FeedItem[] {
  const hevyDays = new Set(data.workouts.map((workout) => workout.day));
  const volumeByWorkout = new Map<string, number>();
  const setsByWorkout = new Map<string, number>();
  for (const session of data.exercises) {
    if (!session.assisted) volumeByWorkout.set(session.workoutId, (volumeByWorkout.get(session.workoutId) ?? 0) + session.volumeKg);
    setsByWorkout.set(session.workoutId, (setsByWorkout.get(session.workoutId) ?? 0) + session.sets);
  }
  const items: FeedItem[] = [];
  for (const activity of data.activities) {
    const label = activityLabel(activity.type);
    if (label === "Gym" && hevyDays.has(activity.day)) continue;
    const parts = [formatDayDate(activity.day)];
    if (activity.durationS) parts.push(formatMinutes(activity.durationS / 60));
    if (activity.km && activity.km > 0.2) parts.push(formatKm(activity.km));
    items.push({ key: `g${activity.id}`, day: activity.day, kind: label === "Lauf" ? "run" : label === "Gym" ? "gym" : "other", title: activity.name || label, meta: parts.join(" · ") });
  }
  for (const workout of data.workouts) {
    const parts = [formatDayDate(workout.day)];
    if (workout.durationS) parts.push(formatMinutes(workout.durationS / 60));
    const sets = setsByWorkout.get(workout.id);
    if (sets) parts.push(`${sets} Sätze`);
    const volume = volumeByWorkout.get(workout.id);
    if (volume) parts.push(formatTonnes(volume));
    items.push({ key: `h${workout.id}`, day: workout.day, kind: "gym", title: workout.title || "Gym", meta: parts.join(" · ") });
  }
  return items.sort((a, b) => b.day.localeCompare(a.day) || a.key.localeCompare(b.key)).slice(0, limit);
}
