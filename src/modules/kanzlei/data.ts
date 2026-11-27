// Shared by server and browser: the shapes of the Kanzlei-Planer's data, the
// statuses, the starter types and the checks every write goes through.
// Clients are only 5-digit numbers; names never enter the app.

export type Kind = "auftrag" | "aufgabe";

export type StatusId =
  | "warte_unterlagen"
  | "teilweise"
  | "bearbeitbar"
  | "in_bearbeitung"
  | "warte_rueckmeldung"
  | "kontrolle"
  | "nachbearbeitung"
  | "offen"
  | "wartet"
  | "erledigt";

type StatusDef = { id: StatusId; label: string; waiting: boolean };

// "waiting" statuses keep an item out of the day plan (until its Wiedervorlage),
// but its remaining effort still counts in the forecast.
export const orderStatuses: StatusDef[] = [
  { id: "warte_unterlagen", label: "Warte auf Unterlagen", waiting: true },
  { id: "teilweise", label: "Unterlagen teilweise", waiting: false },
  { id: "bearbeitbar", label: "Bearbeitbar", waiting: false },
  { id: "in_bearbeitung", label: "In Bearbeitung", waiting: false },
  { id: "warte_rueckmeldung", label: "Warte auf Rückmeldung", waiting: true },
  { id: "kontrolle", label: "Zur Kontrolle beim Chef", waiting: true },
  { id: "nachbearbeitung", label: "Nachbearbeitung", waiting: false },
  { id: "erledigt", label: "Erledigt", waiting: false },
];

export const taskStatuses: StatusDef[] = [
  { id: "offen", label: "Offen", waiting: false },
  { id: "wartet", label: "Wartet", waiting: true },
  { id: "erledigt", label: "Erledigt", waiting: false },
];

export const statusesFor = (kind: Kind) => (kind === "auftrag" ? orderStatuses : taskStatuses);
export const statusLabel = (id: string) =>
  [...orderStatuses, ...taskStatuses].find((status) => status.id === id)?.label ?? id;
export const isWaitingStatus = (id: string) =>
  [...orderStatuses, ...taskStatuses].some((status) => status.id === id && status.waiting);

export const priorities = [
  { id: 1, label: "Dringend" },
  { id: 2, label: "Normal" },
  { id: 3, label: "Niedrig" },
] as const;

export type Item = {
  id: string;
  kind: Kind;
  client: string;
  typeId: string | null;
  title: string;
  period: string;
  status: StatusId;
  priority: 1 | 2 | 3;
  deadlineLegal: string | null;
  deadlineInternal: string | null;
  estimate: number;
  remaining: number;
  docsAt: string | null;
  followUp: string | null;
  plannedFor: string | null;
  nextStep: string;
  note: string;
  parentId: string | null;
  dependsOn: string | null;
  recurringId: string | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TypeDef = {
  id: string;
  name: string;
  kind: Kind;
  defaultMinutes: number;
  color: string;
  position: number;
};

export type Settings = {
  // Net minutes Monday … Sunday.
  dayMinutes: number[];
  startTime: string;
  breakMinutes: number;
  shareOrders: number;
  shareDaily: number;
  shareBuffer: number;
  followupWorkdays: number;
  taskMinutes: number;
  holidayState: "BW" | "BY";
};

export const defaultSettings: Settings = {
  dayMinutes: [480, 480, 480, 450, 300, 0, 0],
  startTime: "08:00",
  breakMinutes: 30,
  shareOrders: 60,
  shareDaily: 30,
  shareBuffer: 10,
  followupWorkdays: 10,
  taskMinutes: 10,
  holidayState: "BW",
};

export type Rhythm = "monthly" | "quarterly" | "yearly";
export const rhythms: { id: Rhythm; label: string }[] = [
  { id: "monthly", label: "Monatlich" },
  { id: "quarterly", label: "Quartalsweise" },
  { id: "yearly", label: "Jährlich" },
];

export type Recurring = {
  id: string;
  client: string;
  typeId: string | null;
  title: string;
  rhythm: Rhythm;
  estimate: number;
  internalOffsetDays: number | null;
  legalOffsetDays: number | null;
  nextPeriod: string;
  active: boolean;
};

export type Absence = { id: string; startDate: string; endDate: string; label: string };

export type HistoryEntry = {
  id: string;
  itemId: string | null;
  source: "user" | "ki" | "auto";
  summary: string;
  undone: boolean;
  createdAt: string;
};

export type PlanEntry = { id: string; minutes: number; reason: string };

export type DayPlan = {
  day: string;
  createdAt: string;
  source: "ki" | "auto";
  summary: string;
  must: PlanEntry[];
  focus: PlanEntry[];
  optional: PlanEntry[];
  warnings: string[];
};

// Mid-tone colours for the types, told apart by their label too.
export const colors = [
  { id: "green", hex: "#1e6a4e" },
  { id: "blue", hex: "#2f6fb0" },
  { id: "orange", hex: "#a9471a" },
  { id: "violet", hex: "#6b4aa0" },
  { id: "teal", hex: "#11807a" },
  { id: "pink", hex: "#b03a78" },
  { id: "yellow", hex: "#a07400" },
  { id: "gray", hex: "#6b746f" },
] as const;

export const colorHex = (id: string) => colors.find((color) => color.id === id)?.hex ?? colors[7].hex;

export type TypeInput = Omit<TypeDef, "id" | "position">;

export const starterTypes: TypeInput[] = [
  { name: "FiBu", kind: "auftrag", defaultMinutes: 90, color: "green" },
  { name: "Lohn", kind: "auftrag", defaultMinutes: 25, color: "blue" },
  { name: "Jahresabschluss", kind: "auftrag", defaultMinutes: 600, color: "orange" },
  { name: "EÜR", kind: "auftrag", defaultMinutes: 240, color: "orange" },
  { name: "ESt", kind: "auftrag", defaultMinutes: 120, color: "violet" },
  { name: "Sonstiger Auftrag", kind: "auftrag", defaultMinutes: 60, color: "gray" },
  { name: "E-Mail", kind: "aufgabe", defaultMinutes: 10, color: "gray" },
  { name: "Rückfrage von Mandant", kind: "aufgabe", defaultMinutes: 10, color: "teal" },
  { name: "Rückfrage an Mandant", kind: "aufgabe", defaultMinutes: 10, color: "teal" },
  { name: "Abstimmung Chef", kind: "aufgabe", defaultMinutes: 10, color: "pink" },
  { name: "Telefonat / Rückruf", kind: "aufgabe", defaultMinutes: 10, color: "teal" },
  { name: "Intern", kind: "aufgabe", defaultMinutes: 10, color: "gray" },
  { name: "Spontan", kind: "aufgabe", defaultMinutes: 10, color: "yellow" },
  { name: "Wiedervorlage", kind: "aufgabe", defaultMinutes: 10, color: "gray" },
  { name: "Erinnerung", kind: "aufgabe", defaultMinutes: 10, color: "gray" },
];

// --- Formatting ---------------------------------------------------------------

export function formatMinutes(minutes: number) {
  const value = Math.max(0, Math.round(minutes));
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

export function formatDate(date: string | null, withYear = false) {
  if (!date) return "–";
  const [year, month, day] = date.split("-");
  return withYear ? `${day}.${month}.${year}` : `${day}.${month}.`;
}

// "1:30", "90", "1,5 h", "1.5" → minutes. Plain numbers below 10 are hours.
export function parseMinutes(input: string): number | null {
  const text = input.trim().toLowerCase().replace(",", ".");
  if (!text) return null;
  const clock = text.match(/^(\d+):(\d{1,2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const hm = text.match(/^(\d+(?:\.\d+)?)\s*h(?:\s*(\d+)\s*(?:m|min)?)?$/);
  if (hm) return Math.round(Number(hm[1]) * 60 + Number(hm[2] ?? 0));
  const min = text.match(/^(\d+)\s*(?:m|min)$/);
  if (min) return Number(min[1]);
  const plain = Number(text);
  if (Number.isFinite(plain) && plain >= 0) return plain < 10 ? Math.round(plain * 60) : Math.round(plain);
  return null;
}

// --- Checks -------------------------------------------------------------------

export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const dateOrNull = (value: unknown) => (isDate(value) ? value : null);
const minutes = (value: unknown, max = 100000) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(0, number)) : 0;
};
const uuidOrNull = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;

export const cleanClient = (value: unknown) => {
  const text = str(value, 10).replace(/\D/g, "");
  return /^\d{5}$/.test(text) ? text : "";
};

export type ItemInput = Omit<Item, "id" | "doneAt" | "createdAt" | "updatedAt" | "recurringId">;

export function cleanItemInput(input: Partial<ItemInput>): ItemInput {
  const kind: Kind = input.kind === "aufgabe" ? "aufgabe" : "auftrag";
  const statuses = statusesFor(kind);
  const status = statuses.find((entry) => entry.id === input.status)?.id ?? statuses[kind === "auftrag" ? 2 : 0].id;
  const priority = input.priority === 1 || input.priority === 3 ? input.priority : 2;
  return {
    kind,
    client: cleanClient(input.client),
    typeId: uuidOrNull(input.typeId),
    title: str(input.title, 200),
    period: str(input.period, 40),
    status,
    priority,
    deadlineLegal: dateOrNull(input.deadlineLegal),
    deadlineInternal: dateOrNull(input.deadlineInternal),
    estimate: minutes(input.estimate),
    remaining: minutes(input.remaining),
    docsAt: dateOrNull(input.docsAt),
    followUp: dateOrNull(input.followUp),
    plannedFor: dateOrNull(input.plannedFor),
    nextStep: str(input.nextStep, 300),
    note: str(input.note, 4000),
    parentId: uuidOrNull(input.parentId),
    dependsOn: uuidOrNull(input.dependsOn),
  };
}

export function cleanSettings(input: Partial<Settings>): Settings {
  const days = Array.isArray(input.dayMinutes) ? input.dayMinutes : defaultSettings.dayMinutes;
  const shares = [input.shareOrders, input.shareDaily, input.shareBuffer].map((value) => minutes(value, 100));
  return {
    dayMinutes: Array.from({ length: 7 }, (_, index) => minutes(days[index], 1440)),
    startTime: /^\d{2}:\d{2}$/.test(String(input.startTime)) ? String(input.startTime) : defaultSettings.startTime,
    breakMinutes: minutes(input.breakMinutes, 240),
    shareOrders: shares[0],
    shareDaily: shares[1],
    shareBuffer: shares[2],
    followupWorkdays: Math.max(1, minutes(input.followupWorkdays, 120)),
    taskMinutes: Math.max(1, minutes(input.taskMinutes, 600)),
    holidayState: input.holidayState === "BY" ? "BY" : "BW",
  };
}

export function cleanTypeInput(input: Partial<TypeInput>): TypeInput {
  return {
    name: str(input.name, 40) || "Neue Art",
    kind: input.kind === "aufgabe" ? "aufgabe" : "auftrag",
    defaultMinutes: minutes(input.defaultMinutes, 10000),
    color: colors.some((color) => color.id === input.color) ? String(input.color) : "gray",
  };
}

export type RecurringInput = Omit<Recurring, "id">;

export function cleanRecurringInput(input: Partial<RecurringInput>): RecurringInput {
  const offset = (value: unknown) =>
    value === null || value === undefined || value === "" ? null : Math.max(-366, Math.min(730, Math.round(Number(value)) || 0));
  return {
    client: cleanClient(input.client),
    typeId: uuidOrNull(input.typeId),
    title: str(input.title, 120),
    rhythm: rhythms.some((rhythm) => rhythm.id === input.rhythm) ? (input.rhythm as Rhythm) : "monthly",
    estimate: minutes(input.estimate, 10000),
    internalOffsetDays: offset(input.internalOffsetDays),
    legalOffsetDays: offset(input.legalOffsetDays),
    nextPeriod: isDate(input.nextPeriod) ? input.nextPeriod : new Date().toISOString().slice(0, 8) + "01",
    active: input.active !== false,
  };
}

// --- Rows ---------------------------------------------------------------------

export const itemColumns =
  "id, kind, client, type_id, title, period, status, priority, deadline_legal, deadline_internal, estimate_minutes, remaining_minutes, docs_at, follow_up, planned_for, next_step, note, parent_id, depends_on, recurring_id, done_at, created_at, updated_at";

export type ItemRow = {
  id: string;
  kind: Kind;
  client: string;
  type_id: string | null;
  title: string;
  period: string;
  status: StatusId;
  priority: number;
  deadline_legal: string | null;
  deadline_internal: string | null;
  estimate_minutes: number;
  remaining_minutes: number;
  docs_at: string | null;
  follow_up: string | null;
  planned_for: string | null;
  next_step: string;
  note: string;
  parent_id: string | null;
  depends_on: string | null;
  recurring_id: string | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
};

export function itemFromRow(row: ItemRow): Item {
  return {
    id: row.id,
    kind: row.kind,
    client: row.client,
    typeId: row.type_id,
    title: row.title,
    period: row.period,
    status: row.status,
    priority: (row.priority === 1 || row.priority === 3 ? row.priority : 2) as 1 | 2 | 3,
    deadlineLegal: row.deadline_legal,
    deadlineInternal: row.deadline_internal,
    estimate: row.estimate_minutes,
    remaining: row.remaining_minutes,
    docsAt: row.docs_at,
    followUp: row.follow_up,
    plannedFor: row.planned_for,
    nextStep: row.next_step,
    note: row.note,
    parentId: row.parent_id,
    dependsOn: row.depends_on,
    recurringId: row.recurring_id,
    doneAt: row.done_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function itemToRow(item: ItemInput) {
  return {
    kind: item.kind,
    client: item.client,
    type_id: item.typeId,
    title: item.title,
    period: item.period,
    status: item.status,
    priority: item.priority,
    deadline_legal: item.deadlineLegal,
    deadline_internal: item.deadlineInternal,
    estimate_minutes: item.estimate,
    remaining_minutes: item.remaining,
    docs_at: item.docsAt,
    follow_up: item.followUp,
    planned_for: item.plannedFor,
    next_step: item.nextStep,
    note: item.note,
    parent_id: item.parentId,
    depends_on: item.dependsOn,
  };
}

export const settingsColumns =
  "day_minutes, start_time, break_minutes, share_orders, share_daily, share_buffer, followup_workdays, task_minutes, holiday_state";

export type SettingsRow = {
  day_minutes: number[];
  start_time: string;
  break_minutes: number;
  share_orders: number;
  share_daily: number;
  share_buffer: number;
  followup_workdays: number;
  task_minutes: number;
  holiday_state: "BW" | "BY";
};

export function settingsFromRow(row: SettingsRow | null): Settings {
  if (!row) return defaultSettings;
  return cleanSettings({
    dayMinutes: row.day_minutes,
    startTime: row.start_time,
    breakMinutes: row.break_minutes,
    shareOrders: row.share_orders,
    shareDaily: row.share_daily,
    shareBuffer: row.share_buffer,
    followupWorkdays: row.followup_workdays,
    taskMinutes: row.task_minutes,
    holidayState: row.holiday_state,
  });
}

export function settingsToRow(settings: Settings) {
  return {
    day_minutes: settings.dayMinutes,
    start_time: settings.startTime,
    break_minutes: settings.breakMinutes,
    share_orders: settings.shareOrders,
    share_daily: settings.shareDaily,
    share_buffer: settings.shareBuffer,
    followup_workdays: settings.followupWorkdays,
    task_minutes: settings.taskMinutes,
    holiday_state: settings.holidayState,
  };
}

export const recurringColumns =
  "id, client, type_id, title, rhythm, estimate_minutes, internal_offset_days, legal_offset_days, next_period, active";

export type RecurringRow = {
  id: string;
  client: string;
  type_id: string | null;
  title: string;
  rhythm: Rhythm;
  estimate_minutes: number;
  internal_offset_days: number | null;
  legal_offset_days: number | null;
  next_period: string;
  active: boolean;
};

export function recurringFromRow(row: RecurringRow): Recurring {
  return {
    id: row.id,
    client: row.client,
    typeId: row.type_id,
    title: row.title,
    rhythm: row.rhythm,
    estimate: row.estimate_minutes,
    internalOffsetDays: row.internal_offset_days,
    legalOffsetDays: row.legal_offset_days,
    nextPeriod: row.next_period,
    active: row.active,
  };
}

export function recurringToRow(input: RecurringInput) {
  return {
    client: input.client,
    type_id: input.typeId,
    title: input.title,
    rhythm: input.rhythm,
    estimate_minutes: input.estimate,
    internal_offset_days: input.internalOffsetDays,
    legal_offset_days: input.legalOffsetDays,
    next_period: input.nextPeriod,
    active: input.active,
  };
}
