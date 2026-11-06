// Dates, counts, goals and "days since" for the Ereignis-Tracker. Pure
// functions on YYYY-MM-DD strings (UTC midnight internally, so no time zone
// or daylight saving surprises).
import type { Entry, EventType, GoalPeriod } from "./data";

const DAY = 24 * 60 * 60 * 1000;
const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromTime = (time: number) => new Date(time).toISOString().slice(0, 10);

export function todayInGermany() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

export const addDays = (date: string, days: number) => fromTime(toTime(date) + days * DAY);

// Days from a to b (b - a); 0 for the same day.
export const daysBetween = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / DAY);

// 0 = Monday … 6 = Sunday
export const weekday = (date: string) => (new Date(toTime(date)).getUTCDay() + 6) % 7;
export const mondayOf = (date: string) => addDays(date, -weekday(date));

export const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
export function monthEnd(date: string) {
  const [year, month] = date.split("-").map(Number);
  return fromTime(Date.UTC(year, month, 0));
}
export const addMonths = (month: string, count: number) => {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1 + count, 1)).toISOString().slice(0, 7);
};

export function periodRange(period: GoalPeriod, today: string): { from: string; to: string } {
  if (period === "week") return { from: mondayOf(today), to: addDays(mondayOf(today), 6) };
  if (period === "month") return { from: monthStart(today), to: monthEnd(today) };
  return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
}

// The last day a span covers: its end, or today while it is still going on
// (a running span that starts in the future covers only its start day).
export const spanEnd = (entry: Entry, today: string) =>
  entry.endDate ?? (entry.startDate > today ? entry.startDate : today);

export const entryCovers = (entry: Entry, type: EventType, date: string, today: string) =>
  type.kind === "moment" ? entry.startDate === date : entry.startDate <= date && date <= spanEnd(entry, today);

// How often (moments) or on how many days (spans) a type happened between
// two dates, both included. Overlapping spans count a day only once.
export function countIn(type: EventType, entries: Entry[], from: string, to: string, today: string) {
  const own = entries.filter((entry) => entry.typeId === type.id);
  if (type.kind === "moment") return own.filter((entry) => entry.startDate >= from && entry.startDate <= to).length;
  const days = new Set<string>();
  for (const entry of own) {
    const start = entry.startDate > from ? entry.startDate : from;
    const endDay = spanEnd(entry, today);
    const end = endDay < to ? endDay : to;
    for (let day = start; day <= end; day = addDays(day, 1)) days.add(day);
  }
  return days.size;
}

export type GoalState = {
  value: number;
  target: number;
  // max: "ok" below, "at" on the limit, "over" above it. min: "open" or "reached".
  status: "ok" | "at" | "over" | "open" | "reached";
};

export function goalState(type: EventType, entries: Entry[], today: string): GoalState | null {
  if (!type.goal) return null;
  const { from, to } = periodRange(type.goal.period, today);
  const value = countIn(type, entries, from, to, today);
  const target = type.goal.count;
  const status =
    type.goal.kind === "max"
      ? value > target
        ? "over"
        : value === target
          ? "at"
          : "ok"
      : value >= target
        ? "reached"
        : "open";
  return { value, target, status };
}

// The running span of a type, if there is one (the latest).
export function runningSpan(type: EventType, entries: Entry[]) {
  if (type.kind !== "span") return null;
  return (
    entries
      .filter((entry) => entry.typeId === type.id && entry.endDate === null)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null
  );
}

// The most recent entry up to today (spans by their end).
export function lastEntry(type: EventType, entries: Entry[], today: string) {
  const key = (entry: Entry) => (type.kind === "span" ? spanEnd(entry, today) : entry.startDate);
  return (
    entries
      .filter((entry) => entry.typeId === type.id && entry.startDate <= today)
      .sort((a, b) => key(b).localeCompare(key(a)))[0] ?? null
  );
}

// --- Formatting -------------------------------------------------------------

const dateFormat = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dateYearFormat = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
const shortMonthFormat = new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: "UTC" });
const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

export const formatNumber = (value: number) => numberFormat.format(value);

// "Mo., 3. Nov." (with the year when it is not this year)
export const formatDate = (date: string, today: string) =>
  (date.slice(0, 4) === today.slice(0, 4) ? dateFormat : dateYearFormat).format(new Date(toTime(date)));

export const formatMonth = (month: string) => monthFormat.format(new Date(toTime(`${month}-01`)));
export const formatShortMonth = (month: string) => shortMonthFormat.format(new Date(toTime(`${month}-01`)));

export function formatRange(entry: Entry, today: string) {
  if (entry.endDate === null) return `seit ${formatDate(entry.startDate, today)}`;
  if (entry.endDate === entry.startDate) return formatDate(entry.startDate, today);
  return `${formatDate(entry.startDate, today)} – ${formatDate(entry.endDate, today)}`;
}

// "heute", "gestern", "vor 12 Tagen" (or "in 3 Tagen")
export function relativeDay(date: string, today: string) {
  const days = daysBetween(date, today);
  if (days === 0) return "heute";
  if (days === 1) return "gestern";
  if (days === -1) return "morgen";
  return days > 0 ? `vor ${days} Tagen` : `in ${-days} Tagen`;
}

// "seit heute", "seit gestern", "seit 3 Tagen" (counting today, so a span
// that started the day before yesterday is on its 3rd day)
export function sinceDay(date: string, today: string) {
  const days = daysBetween(date, today);
  if (days <= 0) return days === 0 ? "seit heute" : `ab ${formatDate(date, today)}`;
  if (days === 1) return "seit gestern";
  return `seit ${days + 1} Tagen`;
}

export const spanDays = (entry: Entry, today: string) => daysBetween(entry.startDate, spanEnd(entry, today)) + 1;

export const formatDays = (days: number) => `${days} ${days === 1 ? "Tag" : "Tage"}`;
