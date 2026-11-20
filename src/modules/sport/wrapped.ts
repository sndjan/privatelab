// The year in numbers ("Dein Sportjahr"): everything the review story shows,
// computed from the synced data for one calendar year (up to today).
import { paceAt140, records, setsPerMuscle } from "./analytics";
import { activityLabel, addDays, average, easyPercent, mondayOf, runWeeks, trainingDays } from "./calc";
import { planFromSettings } from "./plan";
import type { SportData } from "./types";

// Rough step length for "that many kilometres" (Garmin keeps the real one per day).
const STEP_M = 0.75;

// Straight-line distances from Bellenberg, for "once to … and back".
const places: [string, number][] = [
  ["Ulm", 15],
  ["Stuttgart", 85],
  ["München", 125],
  ["Zürich", 170],
  ["Frankfurt", 280],
  ["Wien", 520],
  ["Berlin", 560],
  ["Paris", 600],
  ["Rom", 760],
  ["London", 860],
  ["Barcelona", 1000],
  ["Stockholm", 1300],
  ["Lissabon", 1900],
  ["Kairo", 2800],
];

export function distanceComparison(km: number) {
  const roundTrip = [...places].reverse().find(([, distance]) => distance * 2 <= km);
  if (roundTrip) return `einmal nach ${roundTrip[0]} und zurück`;
  const oneWay = [...places].reverse().find(([, distance]) => distance <= km);
  return oneWay ? `bis nach ${oneWay[0]}` : "ein guter Anfang";
}

export type YearReview = ReturnType<typeof yearReview>;

export function yearReview(data: SportData, year: number, today: string) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31` < today ? `${year}-12-31` : today;
  const inYear = (day: string) => day >= from && day <= to;
  const days = trainingDays(
    data.activities.filter((activity) => inYear(activity.day)),
    data.workouts.filter((workout) => inYear(workout.day)),
  );
  const activeDays = [...days.keys()].filter(inYear).length;

  // Hours: Garmin activities, plus Hevy workouts on days Garmin recorded no strength training.
  const garminGymDays = new Set(data.activities.filter((a) => a.type === "strength_training").map((a) => a.day));
  const activities = data.activities.filter((activity) => inYear(activity.day));
  const workouts = data.workouts.filter((workout) => inYear(workout.day));
  const seconds =
    activities.reduce((sum, activity) => sum + (activity.durationS ?? 0), 0) +
    workouts.filter((workout) => !garminGymDays.has(workout.day)).reduce((sum, workout) => sum + (workout.durationS ?? 0), 0);

  const mixCount = new Map<string, number>();
  for (const activity of activities) {
    const label = activityLabel(activity.type);
    if (label === "Gym") continue;
    mixCount.set(label, (mixCount.get(label) ?? 0) + 1);
  }
  const gymSessions = new Set([...workouts.map((w) => w.day), ...activities.filter((a) => a.type === "strength_training").map((a) => a.day)]).size;
  mixCount.set("Gym", gymSessions);
  const mix = [...mixCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => ({ label, count }));

  // Steps
  const health = data.health.filter((day) => inYear(day.day));
  const steps = health.reduce((sum, day) => sum + (day.steps ?? 0), 0);
  const stepsKm = (steps * STEP_M) / 1000;
  const bestStepDay = health.reduce<(typeof health)[number] | null>((best, day) => ((day.steps ?? 0) > (best?.steps ?? 0) ? day : best), null);
  const stepsByMonth = Array.from({ length: 12 }, (_, month) =>
    health.filter((day) => Number(day.day.slice(5, 7)) === month + 1).reduce((sum, day) => sum + (day.steps ?? 0), 0),
  );

  // Running
  const runs = data.runs.filter((run) => inYear(run.day));
  const runKm = runs.reduce((sum, run) => sum + (run.km ?? 0), 0);
  const longestRun = runs.reduce<(typeof runs)[number] | null>((best, run) => ((run.km ?? 0) > (best?.km ?? 0) ? run : best), null);
  const weeks: string[] = [];
  for (let week = mondayOf(from); week <= to; week = addDays(week, 7)) weeks.push(week);
  const zone1 = easyPercent(runWeeks(runs, weeks));
  const aerobic = runs.map((run) => paceAt140(run)).filter((pace): pace is number => pace != null);
  const aerobicFrom = aerobic.length >= 4 ? average(aerobic.slice(0, 3)) : null;
  const aerobicTo = aerobic.length >= 4 ? average(aerobic.slice(-3)) : null;

  // Gym
  const sessions = data.exercises.filter((session) => inYear(session.day));
  const tonnes = sessions.filter((session) => !session.assisted).reduce((sum, session) => sum + session.volumeKg, 0) / 1000;
  const byExercise = new Map<string, typeof sessions>();
  for (const session of sessions) byExercise.set(session.exercise, [...(byExercise.get(session.exercise) ?? []), session]);
  const favourite = [...byExercise.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? null;
  let jump: { exercise: string; from: number; to: number } | null = null;
  for (const [exercise, list] of byExercise) {
    if (list.length < 3 || list[0].assisted) continue;
    const first = list.find((session) => session.topWeightKg != null)?.topWeightKg;
    const best = Math.max(...list.map((session) => session.topWeightKg ?? 0));
    if (first != null && best - first > (jump ? jump.to - jump.from : 0)) jump = { exercise, from: first, to: best };
  }
  const recordCount = records(data.exercises).filter((record) => inYear(record.day)).length;
  const topMuscle = setsPerMuscle(data.exercises, data.templates, from, to)[0] ?? null;

  // Sleep
  const nights = health.filter((day) => day.sleepS);
  const sleepAvg = average(nights.map((day) => day.sleepS! / 3600));
  const inRange = nights.filter((day) => day.sleepS! / 3600 >= data.settings.sleepMinH && day.sleepS! / 3600 <= data.settings.sleepMaxH).length;
  const clock = (stamp: string, offset: number) => {
    const [h, m] = stamp.slice(11, 16).split(":").map(Number);
    return ((h - offset + 24) % 24) * 60 + m;
  };
  const beds = nights.filter((day) => day.bed).map((day) => clock(day.bed!, 18));
  const wakes = nights.filter((day) => day.wake).map((day) => clock(day.wake!, 0));
  const bedAvg = average(beds);
  const wakeAvg = average(wakes);
  const spread = (() => {
    const mean = average(wakes);
    if (mean == null || wakes.length < 3) return null;
    return Math.sqrt(wakes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / wakes.length);
  })();
  const sleepType =
    wakeAvg != null && wakeAvg < 6 * 60 + 45
      ? "Frühaufsteher"
      : bedAvg != null && bedAvg > 6 * 60 + 15
        ? "Nachteule"
        : sleepAvg != null && sleepAvg >= 8
          ? "Langschläfer"
          : spread != null && spread < 30
            ? "Taktgeber"
            : "Freigeist";

  // Heart: first month of the year against the last 30 days.
  const firstMonth = health.filter((day) => day.day < addDays(health[0]?.day ?? from, 30));
  const last30 = health.filter((day) => day.day > addDays(to, -30));
  const vo2 = health.filter((day) => day.vo2max != null);
  const heart = {
    rhrFrom: average(firstMonth.map((day) => day.restingHr)),
    rhrTo: average(last30.map((day) => day.restingHr)),
    vo2From: vo2[0]?.vo2max ?? null,
    vo2To: vo2.at(-1)?.vo2max ?? null,
    hrvFrom: average(firstMonth.map((day) => day.hrv)),
    hrvTo: average(last30.map((day) => day.hrv)),
  };

  // Strongest month and the longest run of weeks with the gym goal.
  const activeByMonth = Array.from({ length: 12 }, (_, month) => [...days.keys()].filter((day) => inYear(day) && Number(day.slice(5, 7)) === month + 1).length);
  const bestMonth = activeByMonth.indexOf(Math.max(...activeByMonth));
  const gymByWeek = new Map<string, number>();
  for (const workout of workouts) gymByWeek.set(mondayOf(workout.day), (gymByWeek.get(mondayOf(workout.day)) ?? 0) + 1);
  let longestGymStreak = 0;
  let current = 0;
  for (const week of weeks) {
    current = (gymByWeek.get(week) ?? 0) >= data.settings.gymPerWeek ? current + 1 : 0;
    longestGymStreak = Math.max(longestGymStreak, current);
  }

  const plan = planFromSettings(data.settings);
  const raceDay = plan.at(-1) ? addDays(plan.at(-1)!.start, 6) : null;

  return {
    year,
    to,
    activeDays,
    hours: seconds / 3600,
    mix,
    steps,
    stepsKm,
    stepsComparison: distanceComparison(stepsKm),
    bestStepDay: bestStepDay?.steps ? { day: bestStepDay.day, steps: bestStepDay.steps } : null,
    stepsByMonth,
    runKm,
    runCount: runs.length,
    longestRun: longestRun?.km ? { km: longestRun.km, day: longestRun.day } : null,
    zone1,
    aerobicFrom,
    aerobicTo,
    tonnes,
    elephants: tonnes / 6,
    gymSessions,
    favourite: favourite ? { exercise: favourite[0], count: favourite[1].length } : null,
    jump,
    recordCount,
    topMuscle,
    sleepAvg,
    inRange,
    nights: nights.length,
    bedAvg,
    wakeAvg,
    wakeSpread: spread,
    sleepType,
    heart,
    bestMonth: activeByMonth[bestMonth] > 0 ? { month: bestMonth, days: activeByMonth[bestMonth] } : null,
    longestGymStreak,
    raceDay,
  };
}
