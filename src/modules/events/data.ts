// Shared by server and browser: the shapes of the Ereignis-Tracker's data,
// the colours, the starter types and the checks every write goes through.

export type Kind = "moment" | "span";
export type GoalKind = "max" | "min";
export type GoalPeriod = "week" | "month" | "year";

export type EventType = {
  id: string;
  name: string;
  emoji: string;
  color: ColorId;
  kind: Kind;
  trackAmount: boolean;
  amountUnit: string;
  trackRating: boolean;
  goal: { kind: GoalKind; count: number; period: GoalPeriod } | null;
  position: number;
};

export type Entry = {
  id: string;
  typeId: string;
  // YYYY-MM-DD. Moments only have a start date.
  startDate: string;
  // Spans only: the last day, or null while the span is still going on.
  endDate: string | null;
  note: string;
  amount: number | null;
  rating: number | null;
};

// Mid-tone colours that read on light and dark backgrounds.
export const colors = [
  { id: "red", name: "Rot", hex: "#e5484d" },
  { id: "orange", name: "Orange", hex: "#f76b15" },
  { id: "yellow", name: "Gelb", hex: "#e2a336" },
  { id: "green", name: "Grün", hex: "#30a46c" },
  { id: "teal", name: "Türkis", hex: "#12a594" },
  { id: "blue", name: "Blau", hex: "#3e63dd" },
  { id: "violet", name: "Lila", hex: "#8e4ec6" },
  { id: "pink", name: "Pink", hex: "#d6409f" },
  { id: "gray", name: "Grau", hex: "#8b8d98" },
] as const;

export type ColorId = (typeof colors)[number]["id"];

export const colorHex = (id: string) => colors.find((color) => color.id === id)?.hex ?? colors[5].hex;

export const periodNames: Record<GoalPeriod, { per: string; this: string }> = {
  week: { per: "pro Woche", this: "diese Woche" },
  month: { per: "pro Monat", this: "diesen Monat" },
  year: { per: "pro Jahr", this: "dieses Jahr" },
};

// "Mal" for moments, "Tage" for spans.
export const unitName = (kind: Kind, count: number) =>
  kind === "span" ? (count === 1 ? "Tag" : "Tage") : "Mal";

export type TypeInput = Omit<EventType, "id" | "position">;

// Offered when the module is still empty.
export const starterTypes: TypeInput[] = [
  { name: "Krank", emoji: "🤒", color: "red", kind: "span", trackAmount: false, amountUnit: "", trackRating: true, goal: null },
  { name: "Fleisch gegessen", emoji: "🥩", color: "orange", kind: "moment", trackAmount: false, amountUnit: "", trackRating: false, goal: null },
  { name: "Alkohol", emoji: "🍺", color: "yellow", kind: "moment", trackAmount: true, amountUnit: "Gläser", trackRating: false, goal: null },
  { name: "Sport", emoji: "🏃", color: "green", kind: "moment", trackAmount: false, amountUnit: "", trackRating: false, goal: { kind: "min", count: 3, period: "week" } },
  { name: "Kopfschmerzen", emoji: "🤕", color: "violet", kind: "moment", trackAmount: false, amountUnit: "", trackRating: true, goal: null },
];

// --- Checks ---------------------------------------------------------------

export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// Cleans a type from a form or the client before it is written.
export function cleanTypeInput(input: Partial<Record<keyof TypeInput, unknown>>): TypeInput {
  const kind: Kind = input.kind === "span" ? "span" : "moment";
  const goal = input.goal as { kind?: unknown; count?: unknown; period?: unknown } | null | undefined;
  const count = Math.round(Number(goal?.count));
  const cleanGoal =
    goal && (goal.kind === "max" || goal.kind === "min") && Number.isFinite(count) && count >= 0
      ? {
          kind: goal.kind as GoalKind,
          count: Math.min(count, 1000),
          period: (["week", "month", "year"] as const).find((period) => period === goal.period) ?? "week",
        }
      : null;
  const trackAmount = input.trackAmount === true;
  return {
    name: str(input.name, 40) || "Ereignis",
    // Emojis are often several code points; 16 is plenty for one.
    emoji: str(input.emoji, 16) || "📌",
    color: colors.find((color) => color.id === input.color)?.id ?? "blue",
    kind,
    trackAmount,
    amountUnit: trackAmount ? str(input.amountUnit, 16) : "",
    trackRating: input.trackRating === true,
    goal: cleanGoal,
  };
}

export type EntryInput = Omit<Entry, "id">;

// Cleans an entry for its type: moments drop the end, unused fields are emptied.
export function cleanEntryInput(input: Partial<Record<keyof EntryInput, unknown>>, type: Pick<EventType, "kind" | "trackAmount" | "trackRating">): EntryInput {
  if (!isDate(input.startDate)) throw new Error("Invalid start date");
  let endDate: string | null = null;
  if (type.kind === "span" && input.endDate) {
    if (!isDate(input.endDate)) throw new Error("Invalid end date");
    endDate = input.endDate < input.startDate ? input.startDate : input.endDate;
  }
  const amount = typeof input.amount === "number" ? input.amount : Number(String(input.amount ?? "").replace(",", "."));
  const rating = Math.round(Number(input.rating));
  return {
    typeId: String(input.typeId ?? ""),
    startDate: input.startDate,
    endDate,
    note: str(input.note, 1000),
    amount:
      type.trackAmount && input.amount !== null && input.amount !== "" && Number.isFinite(amount)
        ? Math.max(-1e9, Math.min(1e9, Math.round(amount * 100) / 100))
        : null,
    rating: type.trackRating && rating >= 1 && rating <= 5 ? rating : null,
  };
}

// --- Database rows ----------------------------------------------------------

export type TypeRow = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: string;
  track_amount: boolean;
  amount_unit: string;
  track_rating: boolean;
  goal_kind: string | null;
  goal_count: number | null;
  goal_period: string | null;
  position: number;
};

export type EntryRow = {
  id: string;
  type_id: string;
  start_date: string;
  end_date: string | null;
  note: string;
  amount: number | string | null;
  rating: number | null;
};

export const typeColumns =
  "id, name, emoji, color, kind, track_amount, amount_unit, track_rating, goal_kind, goal_count, goal_period, position";
export const entryColumns = "id, type_id, start_date, end_date, note, amount, rating";

export function typeFromRow(row: TypeRow): EventType {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    color: colors.find((color) => color.id === row.color)?.id ?? "blue",
    kind: row.kind === "span" ? "span" : "moment",
    trackAmount: row.track_amount,
    amountUnit: row.amount_unit,
    trackRating: row.track_rating,
    goal:
      row.goal_kind && row.goal_count !== null && row.goal_period
        ? { kind: row.goal_kind as GoalKind, count: row.goal_count, period: row.goal_period as GoalPeriod }
        : null,
    position: row.position,
  };
}

export function typeToRow(type: TypeInput) {
  return {
    name: type.name,
    emoji: type.emoji,
    color: type.color,
    kind: type.kind,
    track_amount: type.trackAmount,
    amount_unit: type.amountUnit,
    track_rating: type.trackRating,
    goal_kind: type.goal?.kind ?? null,
    goal_count: type.goal?.count ?? null,
    goal_period: type.goal?.period ?? null,
  };
}

export function entryFromRow(row: EntryRow): Entry {
  return {
    id: row.id,
    typeId: row.type_id,
    startDate: row.start_date,
    endDate: row.end_date,
    note: row.note,
    // numeric comes back as a string from PostgREST.
    amount: row.amount === null ? null : Number(row.amount),
    rating: row.rating,
  };
}

export function entryToRow(entry: EntryInput) {
  return {
    type_id: entry.typeId,
    start_date: entry.startDate,
    end_date: entry.endDate,
    note: entry.note,
    amount: entry.amount,
    rating: entry.rating,
  };
}
