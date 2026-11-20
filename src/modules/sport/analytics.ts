// Evaluations on top of the synced data: sleep against the goal range,
// regularity, training load, aerobic fitness, VO2max and race estimates,
// streaks, and for the gym: estimated 1RM, records, progression hints,
// sets per muscle group and the routine check. Pure functions, no I/O.
import { addDays, average, daysBetween, mondayOf, paceOf } from "./calc";
import { routine, routineExerciseFor, sameExercise, type PlanWeek, type RoutineDay } from "./plan";
import type { ExerciseSession, HealthDay, Run, Settings, SportData, Template, Workout } from "./types";

// --- Sleep -----------------------------------------------------------------------

export function sleepStats(health: HealthDay[], from: string, to: string, settings: Settings) {
  const nights = health.filter((day) => day.day >= from && day.day <= to && day.sleepS);
  const hours = nights.map((day) => day.sleepS! / 3600);
  const inRange = hours.filter((value) => value >= settings.sleepMinH && value <= settings.sleepMaxH).length;
  const below = hours.filter((value) => value < settings.sleepMinH).length;
  return { nights: nights.length, average: average(hours), inRange, below, above: nights.length - inRange - below };
}

// Minutes after 18:00 for bed times (so 23:30 and 00:30 are close), after midnight for wake times.
const clockMinutes = (stamp: string, offsetHours: number) => {
  const [hours, minutes] = stamp.slice(11, 16).split(":").map(Number);
  return (((hours - offsetHours + 24) % 24) * 60 + minutes);
};
const spread = (values: number[]) => {
  const mean = average(values);
  if (mean == null || values.length < 3) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
};
export const formatClock = (minutesAfter: number, offsetHours: number) => {
  const total = (Math.round(minutesAfter) + offsetHours * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export function sleepRegularity(health: HealthDay[], today: string, days = 28) {
  const from = addDays(today, -days + 1);
  const nights = health.filter((day) => day.day >= from && day.bed && day.wake);
  const bed = nights.map((day) => clockMinutes(day.bed!, 18));
  const wake = nights.map((day) => clockMinutes(day.wake!, 0));
  return {
    nights: nights.map((day) => ({ day: day.day, bed: clockMinutes(day.bed!, 18), wake: clockMinutes(day.wake!, 0) })),
    bedAvg: average(bed),
    wakeAvg: average(wake),
    bedSpread: spread(bed),
    wakeSpread: spread(wake),
  };
}

// --- Training load (running minutes) ----------------------------------------------

export type Load = {
  acute: number;
  chronic: number;
  ratio: number | null;
  level: "build" | "low" | "ok" | "high" | "spike";
  label: string;
  hint: string;
};

// Last 7 days against the weekly average of the last 28 days.
export function runLoad(runs: Run[], today: string): Load {
  const minutesBetween = (from: string, to: string) =>
    runs.filter((run) => run.day > from && run.day <= to).reduce((sum, run) => sum + (run.durationS ?? 0) / 60, 0);
  const acute = minutesBetween(addDays(today, -7), today);
  const chronic = minutesBetween(addDays(today, -28), today) / 4;
  if (chronic < 20) {
    return { acute, chronic, ratio: null, level: "build", label: "Aufbau", hint: "Noch zu wenig Laufzeit der letzten 4 Wochen für einen Vergleich. Halte dich an den Plan und die 10-%-Regel." };
  }
  const ratio = acute / chronic;
  if (ratio > 1.5) return { acute, chronic, ratio, level: "spike", label: "Zu schneller Anstieg", hint: "Diese Woche mehr als das 1,5-Fache deines Schnitts. Die nächsten Tage lieber kürzer oder locker." };
  if (ratio > 1.3) return { acute, chronic, ratio, level: "high", label: "Erhöht", hint: "Etwas mehr als sonst. Achte auf das Knie und die 10-%-Regel." };
  if (ratio < 0.8) return { acute, chronic, ratio, level: "low", label: "Weniger als sonst", hint: "Weniger Laufzeit als in den letzten Wochen, z. B. Erholungswoche." };
  return { acute, chronic, ratio, level: "ok", label: "Im grünen Bereich", hint: "Laufzeit passt zu den letzten 4 Wochen." };
}

// --- Aerobic fitness and VO2max --------------------------------------------------------

// Pace at 140 bpm: the run's pace scaled by its average heart rate (speed
// roughly rises in line with heart rate at easy effort). Lower is fitter.
export const AEROBIC_HR = 140;
export function paceAt140(run: Run) {
  const pace = paceOf(run);
  if (!pace || !run.avgHr || run.avgHr < 100 || (run.km ?? 0) < 1.5) return null;
  return pace * (run.avgHr / AEROBIC_HR);
}

export function linearTrend(points: { x: number; y: number }[]) {
  if (points.length < 3) return null;
  const n = points.length;
  const mx = points.reduce((sum, p) => sum + p.x, 0) / n;
  const my = points.reduce((sum, p) => sum + p.y, 0) / n;
  const sxx = points.reduce((sum, p) => sum + (p.x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const slope = points.reduce((sum, p) => sum + (p.x - mx) * (p.y - my), 0) / sxx;
  return { slope, intercept: my - slope * mx };
}

export function vo2maxSeries(health: HealthDay[]) {
  return health.filter((day) => day.vo2max != null).map((day) => ({ day: day.day, value: Number(day.vo2max) }));
}

// Trend of the last 180 days, per 30 days, and a cautious projection: at most
// ±0.5 per month and ±5 in total.
export function vo2maxOutlook(health: HealthDay[], today: string, target: string) {
  const series = vo2maxSeries(health);
  const latest = series.at(-1) ?? null;
  const recent = series.filter((point) => point.day > addDays(today, -180));
  const trend = linearTrend(recent.map((point) => ({ x: daysBetween(today, point.day), y: point.value })));
  const perMonth = trend ? Math.max(-0.5, Math.min(0.5, trend.slope * 30)) : null;
  const months = daysBetween(today, target) / 30;
  const projected = latest && perMonth != null ? latest.value + Math.max(-5, Math.min(5, perMonth * months)) : null;
  // Scenario with the plan: an assumed +0.25 per month for regular easy
  // running (beginners often gain more at first), at most +5.
  const withPlan = latest ? latest.value + Math.min(5, 0.25 * Math.max(0, months)) : null;
  return { series, latest, perMonth, projected, withPlan };
}

// Race time from VO2max with Jack Daniels' formulas (VDOT): the time t (min)
// at which the oxygen cost of running d metres in t equals the share of VO2max
// one can hold for t. Garmin's VO2max is close to VDOT; treat it as an estimate.
export function raceTimeFromVo2(vo2: number, metres: number) {
  const cost = (t: number) => {
    const v = metres / t;
    return -4.6 + 0.182258 * v + 0.000104 * v * v;
  };
  const share = (t: number) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  let lo = 5;
  let hi = 400;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (cost(mid) / share(mid) > vo2) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 60;
}

// Riegel: time over another distance from a recent effort (t2 = t1 · (d2/d1)^1.06).
export const riegel = (seconds: number, fromKm: number, toKm: number) => seconds * (toKm / fromKm) ** 1.06;

// The fastest run of at least `km` in the last `days` days, for a Riegel estimate.
export function bestEffort(runs: Run[], today: string, km: number, days = 90) {
  const since = addDays(today, -days);
  return runs
    .filter((run) => run.day > since && (run.km ?? 0) >= km && run.durationS && !run.type.includes("treadmill"))
    .reduce<Run | null>((best, run) => (!best || paceOf(run)! < paceOf(best)! ? run : best), null);
}

// --- Plan progress ---------------------------------------------------------------

// Longest run per plan week against the plan, for "ahead / behind".
export function planProgress(plan: PlanWeek[], runs: Run[], today: string) {
  const rows = plan
    .filter((week) => week.start <= today)
    .map((week) => {
      const end = addDays(week.start, 6);
      const longest = Math.max(0, ...runs.filter((run) => run.day >= week.start && run.day <= end).map((run) => (run.durationS ?? 0) / 60));
      return { week, longest };
    });
  const last = [...rows].reverse().find((row) => row.longest > 0) ?? null;
  return { rows, last, diff: last ? last.longest - last.week.longestMinutes : null };
}

// --- Streaks -------------------------------------------------------------------------

// Consecutive periods (newest first) for which `ok` holds; the current,
// unfinished period counts only when it is already met.
function streak<T>(items: T[], ok: (item: T) => boolean, currentIndex: number) {
  let count = 0;
  for (let index = currentIndex; index >= 0; index -= 1) {
    if (ok(items[index])) count += 1;
    else if (index === currentIndex) continue;
    else break;
  }
  return count;
}

export function streaks(data: SportData, today: string, gymByWeek: Map<string, number>, runsByWeek: Map<string, number>, plan: PlanWeek[]) {
  const settings = data.settings;
  const thisMonday = mondayOf(today);
  const weeks: string[] = [];
  for (let week = addDays(thisMonday, -51 * 7); week <= thisMonday; week = addDays(week, 7)) weeks.push(week);
  const gym = streak(weeks, (week) => (gymByWeek.get(week) ?? 0) >= settings.gymPerWeek, weeks.length - 1);
  const planRuns = new Map(plan.map((week) => [week.start, week.runs]));
  const runs = streak(weeks, (week) => (runsByWeek.get(week) ?? 0) >= (planRuns.get(week) ?? 2), weeks.length - 1);

  const byDay = new Map(data.health.map((day) => [day.day, day]));
  const days: string[] = [];
  for (let day = addDays(today, -365); day <= today; day = addDays(day, 1)) days.push(day);
  const inRange = (day: string) => {
    const s = byDay.get(day)?.sleepS;
    return s != null && s / 3600 >= settings.sleepMinH && s / 3600 <= settings.sleepMaxH;
  };
  const sleep = streak(days, inRange, days.length - 1);
  const stepsOk = (day: string) => {
    const entry = byDay.get(day);
    const goal = settings.stepsGoal ?? entry?.stepsGoal ?? 7000;
    return (entry?.steps ?? 0) >= goal;
  };
  const steps = streak(days, stepsOk, days.length - 1);
  return { gym, runs, sleep, steps };
}

// --- Gym ------------------------------------------------------------------------------

// Epley; above 12 reps the estimate gets unreliable, so those sets are left out.
export const e1rm = (kg: number | null, reps: number | null) => (kg && reps && reps > 0 && reps <= 12 ? kg * (1 + reps / 30) : null);

export const sessionE1rm = (session: ExerciseSession) =>
  session.assisted ? null : session.setList.reduce<number | null>((best, [kg, reps]) => {
    const value = e1rm(kg, reps);
    return value != null && (best == null || value > best) ? value : best;
  }, null);

export type Record_ = { exercise: string; day: string; kind: "e1rm" | "weight"; value: number; detail: string };

// New bests over time: estimated 1RM (or least assistance) and heaviest weight.
export function records(exercises: ExerciseSession[]): Record_[] {
  const best = new Map<string, { e1rm: number; weight: number }>();
  const out: Record_[] = [];
  for (const session of exercises) {
    const previous = best.get(session.exercise);
    const top = session.topWeightKg;
    const estimate = sessionE1rm(session);
    if (!previous) {
      best.set(session.exercise, { e1rm: estimate ?? 0, weight: top ?? (session.assisted ? Infinity : 0) });
      continue;
    }
    if (estimate != null && estimate > previous.e1rm * 1.001) {
      out.push({ exercise: session.exercise, day: session.day, kind: "e1rm", value: estimate, detail: `${session.topWeightKg} kg × ${session.topReps}` });
      previous.e1rm = estimate;
    }
    if (top != null) {
      const better = session.assisted ? top < previous.weight : top > previous.weight;
      if (better) {
        out.push({ exercise: session.exercise, day: session.day, kind: "weight", value: top, detail: `${top} kg × ${session.topReps ?? "?"}${session.assisted ? " Hilfe" : ""}` });
        previous.weight = top;
      }
    }
  }
  return out.reverse();
}

// kg: the weight (or, for assisted exercises, the help) to start with next time.
export type Hint = { tone: "up" | "keep" | "down"; text: string; kg: number | null };

// Double progression from the routine: reps up to the top of the range in every
// working set, then +2.5–5 % weight; below the bottom of the range: 5–10 % less.
const de = (kg: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(kg);

export function progressionHint(last: ExerciseSession): Hint | null {
  const plan = routineExerciseFor(last.exercise);
  if (!plan) return null;
  const sets = last.setList.filter(([, reps]) => reps != null) as [number | null, number][];
  if (sets.length === 0) return null;
  const reps = sets.map(([, value]) => value);
  const weight = sets[0][0];
  const round = (kg: number) => Math.round(kg * 2) / 2;
  if (last.assisted) {
    const less = weight != null ? round(Math.max(0, weight - 2.5)) : null;
    if (reps.every((value) => value >= plan.repsMax)) return { tone: "up", text: `Alle Sätze ≥ ${plan.repsMax} Wdh.: Hilfe verringern, z. B. ${less != null ? `${de(less)} kg` : "−2,5 kg"}.`, kg: less };
    if (Math.max(...reps) < plan.repsMin) return { tone: "down", text: `Unter ${plan.repsMin} Wdh.: etwas mehr Hilfe nehmen.`, kg: weight };
    return { tone: "keep", text: `Hilfe so lassen, Wiederholungen bis ${plan.repsMax} steigern.`, kg: weight };
  }
  if (reps.every((value) => value >= plan.repsMax) && weight) {
    const next = round(weight * 1.025) === weight ? weight + 1 : round(weight * 1.025);
    return { tone: "up", text: `Obergrenze ${plan.repsMax} erreicht: nächstes Mal ${de(round(next))}–${de(round(weight * 1.05))} kg, wieder ab ${plan.repsMin} Wdh.`, kg: round(next) };
  }
  if (Math.max(...reps) < plan.repsMin && weight) {
    return { tone: "down", text: `Unter ${plan.repsMin} Wdh.: Gewicht um 5–10 % senken, auf ${de(round(weight * 0.92))} kg.`, kg: round(weight * 0.92) };
  }
  return { tone: "keep", text: `Gewicht halten, Wiederholungen bis ${plan.repsMax} steigern (zuletzt ${reps.join(" / ")}).`, kg: weight };
}

export const muscleLabels: Record<string, string> = {
  chest: "Brust",
  shoulders: "Schultern",
  biceps: "Bizeps",
  triceps: "Trizeps",
  forearms: "Unterarme",
  lats: "Latissimus",
  upper_back: "Oberer Rücken",
  lower_back: "Unterer Rücken",
  traps: "Trapez",
  neck: "Nacken",
  abdominals: "Bauch",
  quadriceps: "Quadrizeps",
  hamstrings: "Beinbeuger",
  glutes: "Gesäß",
  calves: "Waden",
  abductors: "Abduktoren",
  adductors: "Adduktoren",
  cardio: "Cardio",
  full_body: "Ganzkörper",
  other: "Sonstiges",
};

// Working sets per muscle group: 1 for the primary muscle, ½ for each secondary.
export function setsPerMuscle(exercises: ExerciseSession[], templates: Record<string, Template>, from: string, to: string) {
  const totals = new Map<string, number>();
  for (const session of exercises) {
    if (session.day < from || session.day > to) continue;
    const template = session.templateId ? templates[session.templateId] : undefined;
    if (!template?.primary) continue;
    totals.set(template.primary, (totals.get(template.primary) ?? 0) + session.sets);
    for (const muscle of template.secondary ?? []) totals.set(muscle, (totals.get(muscle) ?? 0) + session.sets / 2);
  }
  return [...totals.entries()]
    .filter(([muscle]) => muscle !== "cardio" && muscle !== "other")
    .map(([muscle, sets]) => ({ muscle, label: muscleLabels[muscle] ?? muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}

export type RoutineCheck = { workout: Workout; day: RoutineDay; done: string[]; missing: string[]; extra: string[] };

// Which routine day (A/B/C) a workout matches best, and which exercises were left out.
export function routineCheck(workout: Workout, exercises: ExerciseSession[]): RoutineCheck | null {
  const names = exercises.filter((session) => session.workoutId === workout.id).map((session) => session.exercise);
  if (names.length === 0) return null;
  let best: RoutineCheck | null = null;
  for (const day of routine) {
    const done = day.exercises.filter((entry) => names.some((name) => sameExercise(entry.name, name))).map((entry) => entry.name);
    if (done.length === 0) continue;
    const missing = day.exercises.filter((entry) => !done.includes(entry.name)).map((entry) => entry.name);
    const extra = names.filter((name) => !day.exercises.some((entry) => sameExercise(entry.name, name)));
    if (!best || done.length > best.done.length) best = { workout, day, done, missing, extra };
  }
  return best && best.done.length >= 2 ? best : null;
}
