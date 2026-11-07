// Numbers for the Gewicht-Challenge: progress, trend, weekly table and
// formatting. Pure functions on YYYY-MM-DD strings (UTC midnight internally,
// so no time zone or daylight saving surprises).
import type { Circumference, Participant, Settings, Weighing } from "./data";

const DAY = 24 * 60 * 60 * 1000;
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

// --- Formatting ---------------------------------------------------------------

export function formatNumber(value: number, decimals = 1) {
  return value.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// +1,2 / −0,4 / ±0
export function formatSigned(value: number, decimals = 1) {
  if (Math.abs(value) < 0.5 * 10 ** -decimals) return "±0";
  return `${value > 0 ? "+" : "−"}${formatNumber(Math.abs(value), decimals)}`;
}

// 18.10.
export const formatShortDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.`;
// 18.10.2026
export const formatDate = (date: string) => `${formatShortDate(date)}${date.slice(0, 4)}`;

const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
export const monthName = (date: string) => monthNames[Number(date.slice(5, 7)) - 1];

// Text field value: 87.3 → "87,3"
export const toField = (value: number | null | undefined, decimals = 1) =>
  value === null || value === undefined ? "" : formatNumber(value, decimals).replace(/\./g, "");

// --- Challenge ------------------------------------------------------------------

export function challengeProgress(settings: Settings, today: string) {
  const total = daysBetween(settings.startDate, settings.endDate);
  const day = Math.min(total, Math.max(0, daysBetween(settings.startDate, today) + 1));
  const left = Math.max(0, daysBetween(today, settings.endDate));
  return { total, day, left, share: total > 0 ? day / total : 0 };
}

// --- Per participant ------------------------------------------------------------

// The participant's weighings, oldest first.
export function weighingsOf(weighings: Weighing[], participantId: string) {
  return weighings
    .filter((weighing) => weighing.participantId === participantId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type Standing = {
  participant: Participant;
  current: number;
  lastDate: string | null;
  change: number;
  // Goal minus start: negative to lose, positive to gain.
  span: number;
  // 0…100: share of the own goal span that is done.
  percent: number;
  // Change goes the right way.
  onTrack: boolean;
  bodyFat: number | null;
  trend: Trend | null;
};

export type Trend = {
  // kg per day, from a least-squares line through change-since-start.
  slope: number;
  intercept: number;
  // Day index (since the challenge start) of the first weighing.
  fromDay: number;
  // When the line reaches the goal, if it heads that way.
  goalDate: string | null;
};

export function trendOf(participant: Participant, own: Weighing[], settings: Settings): Trend | null {
  if (own.length < 2) return null;
  const points = own.map((weighing) => [daysBetween(settings.startDate, weighing.date), weighing.weight - participant.startWeight]);
  const n = points.length;
  const sx = points.reduce((sum, [x]) => sum + x, 0);
  const sy = points.reduce((sum, [, y]) => sum + y, 0);
  const sxx = points.reduce((sum, [x]) => sum + x * x, 0);
  const sxy = points.reduce((sum, [x, y]) => sum + x * y, 0);
  const denominator = n * sxx - sx * sx;
  if (denominator === 0) return null;
  const slope = (n * sxy - sx * sy) / denominator;
  const intercept = (sy - slope * sx) / n;
  const span = participant.goalWeight - participant.startWeight;
  let goalDate: string | null = null;
  if (slope !== 0 && Math.sign(slope) === Math.sign(span) && Math.abs(slope * 7) >= 0.05) {
    const day = Math.round((span - intercept) / slope);
    if (day >= points[n - 1][0] && day < 3 * 365) goalDate = addDays(settings.startDate, day);
  }
  return { slope, intercept, fromDay: points[0][0], goalDate };
}

export function standingOf(participant: Participant, weighings: Weighing[], settings: Settings): Standing {
  const own = weighingsOf(weighings, participant.id);
  const last = own[own.length - 1];
  const current = last?.weight ?? participant.startWeight;
  const change = current - participant.startWeight;
  const span = participant.goalWeight - participant.startWeight;
  const percent = span === 0 ? 100 : Math.max(0, Math.min(100, Math.round((change / span) * 100)));
  const lastBodyFat = [...own].reverse().find((weighing) => weighing.bodyFat !== null);
  return {
    participant,
    current,
    lastDate: last?.date ?? null,
    change,
    span,
    percent,
    onTrack: Math.abs(change) >= 0.05 && Math.sign(change) === Math.sign(span),
    bodyFat: lastBodyFat?.bodyFat ?? null,
    trend: trendOf(participant, own, settings),
  };
}

// Ranked by the share of the own goal that is done, then by name.
export function ranking(participants: Participant[], weighings: Weighing[], settings: Settings) {
  return participants
    .map((participant) => standingOf(participant, weighings, settings))
    .sort((a, b) => b.percent - a.percent || a.participant.name.localeCompare(b.participant.name));
}

// --- Weekly table ---------------------------------------------------------------

export type WeekRow = {
  // 1 = the week (Monday–Sunday) the challenge starts in.
  number: number;
  // The latest weighing date of the week.
  date: string;
  cells: Record<string, { weight: number; change: number | null } | undefined>;
};

// One row per week with weighings, newest first: each person's last weight
// of that week and the change to their previous week with a weight.
export function weekRows(participants: Participant[], weighings: Weighing[], settings: Settings): WeekRow[] {
  const firstMonday = mondayOf(settings.startDate);
  const weeks = new Map<number, WeekRow>();
  for (const participant of participants) {
    let previous: number | null = null;
    const byWeek = new Map<number, Weighing>();
    for (const weighing of weighingsOf(weighings, participant.id)) {
      byWeek.set(Math.floor(daysBetween(firstMonday, weighing.date) / 7) + 1, weighing);
    }
    for (const [number, weighing] of [...byWeek].sort(([a], [b]) => a - b)) {
      const row = weeks.get(number) ?? { number, date: weighing.date, cells: {} };
      if (weighing.date > row.date) row.date = weighing.date;
      row.cells[participant.id] = { weight: weighing.weight, change: previous === null ? null : weighing.weight - previous };
      previous = weighing.weight;
      weeks.set(number, row);
    }
  }
  return [...weeks.values()].sort((a, b) => b.number - a.number);
}

// --- Body and circumferences ----------------------------------------------------

export type BodyMetric = "bodyFat" | "muscleMass" | "fatFreeMass";

// First and last value of a body metric, for the change since the first
// measurement.
export function metricOf(own: Weighing[], metric: BodyMetric) {
  const values = own.filter((weighing) => weighing[metric] !== null);
  if (values.length === 0) return null;
  const first = values[0][metric] as number;
  const last = values[values.length - 1][metric] as number;
  return { first, last, change: last - first, date: values[values.length - 1].date };
}

// Weighings with a full body analysis, for the stacked bars.
export function compositions(own: Weighing[]) {
  return own
    .filter((weighing) => weighing.bodyFat !== null && weighing.muscleMass !== null && weighing.fatFreeMass !== null)
    .map((weighing) => {
      const fat = (weighing.weight * (weighing.bodyFat as number)) / 100;
      const muscle = weighing.muscleMass as number;
      const rest = Math.max(0, (weighing.fatFreeMass as number) - muscle);
      return { date: weighing.date, fat, rest, muscle };
    });
}

// The participant's circumference sets, oldest first.
export function circumferencesOf(sets: Circumference[], participantId: string) {
  return sets
    .filter((set) => set.participantId === participantId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// The last value of a key before the given date (for the grey hints).
export function lastValueBefore(sets: Circumference[], key: string, date: string) {
  for (let index = sets.length - 1; index >= 0; index--) {
    if (sets[index].date < date && sets[index].values[key] !== undefined) return sets[index].values[key];
  }
  return null;
}
