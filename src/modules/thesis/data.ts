// Types and date helpers of the thesis module. Dates are "YYYY-MM-DD" strings.

import type { CitationStyle } from "./cite";

export type Settings = {
  title: string;
  researchQuestion: string;
  supervisors: string;
  university: string;
  company: string;
  startDate: string | null;
  endDate: string | null;
  // Required length in pages, for the progress estimate.
  targetPages: number | null;
  wordsPerPage: number;
  // How the Überblick is arranged; null until it was changed.
  overviewLayout: OverviewLayout | null;
  // For the reference list and the LaTeX export.
  citationStyle: CitationStyle;
};

export const emptySettings: Settings = {
  title: "",
  researchQuestion: "",
  supervisors: "",
  university: "",
  company: "",
  startDate: null,
  endDate: null,
  targetPages: null,
  wordsPerPage: 300,
  overviewLayout: null,
  citationStyle: "apa",
};

// The cards of the Überblick. top spans the width, left and right are the
// two columns below it (one after the other on a phone).
export const overviewWidgets = [
  { id: "timeframe", label: "Zeitraum" },
  { id: "stats", label: "Kennzahlen" },
  { id: "todos", label: "Nächste Schritte" },
  { id: "events", label: "Termine & Deadlines" },
  { id: "comments", label: "Offene Kommentare" },
  { id: "infos", label: "Allgemeine Infos" },
  { id: "chapters", label: "Kapitel" },
  { id: "log", label: "Arbeitslog" },
  { id: "topic", label: "Thema" },
  { id: "people", label: "Personen" },
  { id: "phases", label: "Phasen & Meilensteine" },
] as const;

export type WidgetId = (typeof overviewWidgets)[number]["id"];
export type OverviewArea = "top" | "left" | "right" | "hidden";
export type OverviewLayout = Record<OverviewArea, WidgetId[]>;

export const overviewAreas: OverviewArea[] = ["top", "left", "right", "hidden"];

export const defaultOverviewLayout: OverviewLayout = {
  top: ["timeframe", "stats"],
  left: ["todos", "comments", "events", "infos"],
  right: ["chapters", "topic", "people", "phases"],
  hidden: ["log"],
};

// A stored layout without unknown cards or duplicates; cards it doesn't know
// yet go where the default layout has them.
export function normalizeOverviewLayout(raw: unknown): OverviewLayout {
  const stored = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<OverviewArea, unknown>>;
  const known = new Set<string>(overviewWidgets.map((widget) => widget.id));
  const seen = new Set<string>();
  const layout = Object.fromEntries(
    overviewAreas.map((area) => {
      const list = Array.isArray(stored[area]) ? (stored[area] as unknown[]) : [];
      return [area, list.filter((id): id is WidgetId => typeof id === "string" && known.has(id) && !seen.has(id) && !!seen.add(id))];
    }),
  ) as OverviewLayout;
  for (const area of overviewAreas) {
    for (const id of defaultOverviewLayout[area]) if (!seen.has(id)) layout[area].push(id);
  }
  return layout;
}

export type Phase = { id: string; name: string; startDate: string; endDate: string };

// Days off, e.g. "Weihnachten" from 23.12. to 1.1.
export type Break = { id: string; name: string; startDate: string; endDate: string };

// A date to reach, e.g. "Erster Entwurf".
export type Milestone = { id: string; name: string; date: string; done: boolean };

export type Todo = {
  id: string;
  title: string;
  note: string;
  deadline: string | null;
  phaseId: string | null;
  protocolId: string | null;
  doneOn: string | null;
  // 1 (highest) to 3, or null.
  priority: number | null;
  personId: string | null;
};

export type Person = { id: string; name: string };

export type EventKind = "appointment" | "deadline";

export const eventKinds: { value: EventKind; label: string }[] = [
  { value: "appointment", label: "Termin" },
  { value: "deadline", label: "Deadline" },
];

// An appointment (e.g. a meeting with the supervisor) or a deadline (e.g.
// Anmeldung, Abgabe), apart from the to-dos.
export type ThesisEvent = {
  id: string;
  kind: EventKind;
  title: string;
  date: string;
  time: string | null; // "14:30"
  location: string;
  note: string;
  personIds: string[];
  protocolId: string | null;
};

export type Info = { id: string; text: string };

export type LogEntry = { id: string; day: string; hours: number; text: string; phaseId: string | null };

// participants: free text from before people existed; personIds are the chips.
export type Protocol = { id: string; date: string; title: string; participants: string; personIds: string[]; body: string };

export type DocumentCategory = "literature" | "guideline" | "draft" | "other";

export const documentCategories: { value: DocumentCategory; label: string }[] = [
  { value: "literature", label: "Literatur" },
  { value: "guideline", label: "Vorlage / Richtlinie" },
  { value: "draft", label: "Entwurf" },
  { value: "other", label: "Sonstiges" },
];

export const categoryLabel = (category: DocumentCategory) =>
  documentCategories.find((entry) => entry.value === category)?.label ?? category;

export type ThesisDocument = {
  id: string;
  title: string;
  note: string;
  category: DocumentCategory;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sourceId: string | null;
  protocolId: string | null;
  createdAt: string;
  fileUpdatedAt: string;
};

export const DOCUMENT_BUCKET = "thesis-documents";

// The bucket's limit (Supabase free plan maximum).
export const maxDocumentBytes = 50 * 1024 * 1024;

// 1536000 → "1,5 MB"
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

export const isPdf = (document: Pick<ThesisDocument, "mimeType" | "fileName">) =>
  document.mimeType === "application/pdf" || /\.pdf$/i.test(document.fileName);

export const isImage = (document: Pick<ThesisDocument, "mimeType">) =>
  /^image\/(png|jpe?g|gif|webp|avif|svg\+xml)$/.test(document.mimeType);

export const tabs = [
  { id: "overview", label: "Überblick" },
  { id: "writing", label: "Schreiben" },
  { id: "todos", label: "To-dos" },
  { id: "events", label: "Termine" },
  { id: "calendar", label: "Kalender" },
  { id: "log", label: "Arbeitslog" },
  { id: "sources", label: "Quellen" },
  { id: "protocols", label: "Protokolle" },
  { id: "documents", label: "Dokumente" },
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

// The break that contains the day, if any.
export function breakOn(breaks: Break[], day: string) {
  return breaks.find((entry) => entry.startDate <= day && day <= entry.endDate) ?? null;
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

// Open to-dos by priority (!1 first, none last), then by deadline.
export function byPriority(a: Todo, b: Todo) {
  return (a.priority ?? 9) - (b.priority ?? 9) || byDeadline(a, b);
}

export function priorityClass(priority: number) {
  return priority === 1
    ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100"
    : priority === 2
      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
      : "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100";
}

// Appointments and deadlines in time order.
export function byWhen(a: ThesisEvent, b: ThesisEvent) {
  return a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "");
}

// Names of the people with these ids, in the given order.
export const peopleNames = (people: Person[], ids: string[]) =>
  ids.flatMap((id) => people.find((person) => person.id === id)?.name ?? []);

// --- Quick to-do entry ------------------------------------------------------
//
// One line, e.g. "Gliederung an Sandra schicken !1 @Sandra #Exposé bis Fr":
//   !1 … !3      priority
//   @Name        person (an existing one by the start of the name, else new)
//   #Phase       phase, by the start of its name
//   bis …        deadline: heute, morgen, übermorgen, a weekday (Mo … So,
//                the next one), 12.11., 12.11.2026 or 2026-11-12

const weekdayWords = ["montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag"];

export function parseDeadline(word: string, today: string): string | null {
  const value = word.toLowerCase().replace(/\.$/, "");
  if (value === "heute") return today;
  if (value === "morgen") return addDays(today, 1);
  if (value === "übermorgen") return addDays(today, 2);
  // "fr", "Fr.", "frei", "Freitag"
  const weekday = value.length >= 2 ? weekdayWords.findIndex((name) => name.startsWith(value)) : -1;
  if (weekday >= 0) {
    const current = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    return addDays(today, (weekday - current + 7) % 7);
  }
  if (isDate(value)) return value;
  const match = /^(\d{1,2})\.(\d{1,2})\.?(\d{2}|\d{4})?$/.exec(value);
  if (match) {
    const year = match[3] ? (match[3].length === 2 ? `20${match[3]}` : match[3]) : today.slice(0, 4);
    let date = `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    // "12.1." in December means next January.
    if (!match[3] && isDate(date) && date < today) date = `${Number(year) + 1}${date.slice(4)}`;
    return isDate(date) ? date : null;
  }
  return null;
}

export type QuickTodo = {
  title: string;
  priority: number | null;
  // An existing person, or the name of a new one.
  personId: string | null;
  newPerson: string | null;
  phaseId: string | null;
  deadline: string | null;
};

// Names compared without case and spaces, as "@Prof.Weber" stands for "Prof. Weber".
export const compact = (name: string) => name.toLowerCase().replace(/\s+/g, "");
const startsWith = (name: string, prefix: string) => compact(name).startsWith(compact(prefix));

export function parseQuickTodo(input: string, { people, phases, today }: { people: Person[]; phases: Phase[]; today: string }): QuickTodo {
  const result: QuickTodo = { title: "", priority: null, personId: null, newPerson: null, phaseId: null, deadline: null };
  const words = input.trim().split(/\s+/).filter(Boolean);
  const rest: string[] = [];
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    const priority = /^!([1-3])$/.exec(word);
    if (priority) {
      result.priority = Number(priority[1]);
    } else if (/^@\S+/.test(word)) {
      const name = word.slice(1).replace(/[,.;:]$/, "");
      const exact = people.find((person) => compact(person.name) === compact(name));
      const matches = people.filter((person) => startsWith(person.name, name));
      const person = exact ?? (matches.length === 1 ? matches[0] : undefined);
      if (person) {
        result.personId = person.id;
        result.newPerson = null;
      } else {
        result.personId = null;
        result.newPerson = name.slice(0, 80);
      }
    } else if (/^#\S+/.test(word) && phases.some((phase) => startsWith(phase.name, word.slice(1)))) {
      result.phaseId = phases.find((phase) => startsWith(phase.name, word.slice(1)))!.id;
    } else if (word.toLowerCase() === "bis" && index + 1 < words.length && parseDeadline(words[index + 1], today)) {
      result.deadline = parseDeadline(words[index + 1], today);
      index++;
    } else {
      rest.push(word);
    }
  }
  result.title = rest.join(" ").slice(0, 200);
  return result;
}
