// Types and date helpers of the thesis module. Dates are "YYYY-MM-DD" strings.

export type Settings = {
  title: string;
  researchQuestion: string;
  supervisors: string;
  university: string;
  company: string;
  startDate: string | null;
  endDate: string | null;
};

export const emptySettings: Settings = {
  title: "",
  researchQuestion: "",
  supervisors: "",
  university: "",
  company: "",
  startDate: null,
  endDate: null,
};

export type Phase = { id: string; name: string; startDate: string; endDate: string };

export type Todo = {
  id: string;
  title: string;
  note: string;
  deadline: string | null;
  phaseId: string | null;
  protocolId: string | null;
  doneOn: string | null;
};

export type LogEntry = { id: string; day: string; hours: number; text: string; phaseId: string | null };

export type Protocol = { id: string; date: string; title: string; participants: string; body: string };

export const tabs = [
  { id: "overview", label: "Überblick" },
  { id: "todos", label: "To-dos" },
  { id: "log", label: "Arbeitslog" },
  { id: "sources", label: "Quellen" },
  { id: "protocols", label: "Protokolle" },
] as const;

export type TabId = (typeof tabs)[number]["id"];

export function todayInGermany() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

export function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Days from `from` to `to` (0 when equal).
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function mondayOf(date: string) {
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(date, -weekday);
}

// The phase that contains the day; the latest one if several overlap.
export function phaseOn(phases: Phase[], day: string) {
  return phases.findLast((phase) => phase.startDate <= day && day <= phase.endDate) ?? null;
}

// 15.12.2026
export function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

// "Di., 15.12." (with the year if it isn't the current one)
export function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: date.slice(0, 4) === todayInGermany().slice(0, 4) ? undefined : "numeric",
    timeZone: "UTC",
  });
}

// 1.5 → "1,5 h"
export function formatHours(hours: number) {
  return `${hours.toLocaleString("de-DE", { maximumFractionDigits: 2 })} h`;
}

// "1,5" or "1.5" → 1.5
export function parseDecimal(value: string) {
  return Number(value.trim().replace(",", "."));
}

// "heute", "morgen", "in 3 Tagen", "vor 2 Tagen"
export function relativeDays(date: string, today: string) {
  const days = daysBetween(today, date);
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  if (days === -1) return "gestern";
  return days > 0 ? `in ${days} Tagen` : `vor ${-days} Tagen`;
}

// ISO 8601 calendar week.
export function isoWeek(date: string) {
  const thursday = addDays(mondayOf(date), 3);
  const firstThursday = addDays(mondayOf(`${thursday.slice(0, 4)}-01-04`), 3);
  return daysBetween(firstThursday, thursday) / 7 + 1;
}

// Open to-dos by deadline (without deadline last), then in the order they were added.
export function byDeadline(a: Todo, b: Todo) {
  if (a.deadline === b.deadline) return 0;
  if (!a.deadline) return 1;
  if (!b.deadline) return -1;
  return a.deadline < b.deadline ? -1 : 1;
}
