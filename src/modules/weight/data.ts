// Shared by server and browser: the shapes of the Gewicht-Challenge's data,
// the colours, the row mapping and the checks every write goes through.

export type Settings = {
  title: string;
  // YYYY-MM-DD
  startDate: string;
  endDate: string;
};

export type Participant = {
  id: string;
  name: string;
  color: ColorId;
  startWeight: number;
  goalWeight: number;
  // The linked account, so the entry form preselects this person.
  userId: string | null;
  position: number;
};

// A circumference measuring point. Sided points take a left and a right
// value, stored as "<key>.l" and "<key>.r".
export type Site = {
  key: string;
  label: string;
  sided: boolean;
  active: boolean;
  position: number;
};

// A weighing; one per participant and day.
export type Weighing = {
  participantId: string;
  date: string;
  weight: number;
  bodyFat: number | null;
  muscleMass: number | null;
  fatFreeMass: number | null;
  createdBy: string | null;
};

// One set of circumferences per participant and day, in cm.
export type Circumference = {
  participantId: string;
  date: string;
  values: Record<string, number>;
  createdBy: string | null;
};

// Mid-tone colours that read on light and dark backgrounds (as in the
// Ereignis-Tracker).
export const colors = [
  { id: "red", name: "Rot", hex: "#e5484d" },
  { id: "orange", name: "Orange", hex: "#e8742c" },
  { id: "yellow", name: "Gelb", hex: "#d49a2a" },
  { id: "green", name: "Grün", hex: "#30a46c" },
  { id: "teal", name: "Türkis", hex: "#12a594" },
  { id: "blue", name: "Blau", hex: "#3e63dd" },
  { id: "violet", name: "Lila", hex: "#8e4ec6" },
  { id: "pink", name: "Pink", hex: "#d6409f" },
  { id: "gray", name: "Grau", hex: "#8b8d98" },
] as const;

export type ColorId = (typeof colors)[number]["id"];

export const colorHex = (id: string) => colors.find((color) => color.id === id)?.hex ?? colors[5].hex;

// The keys a site's values are stored under.
export const siteValueKeys = (site: Pick<Site, "key" | "sided">) =>
  site.sided ? [`${site.key}.l`, `${site.key}.r`] : [site.key];

// --- Rows -------------------------------------------------------------------

export const settingsColumns = "title, start_date, end_date";
export const participantColumns = "id, name, color, start_weight, goal_weight, user_id, position";
export const siteColumns = "key, label, sided, active, position";
export const weighingColumns = "participant_id, date, weight, body_fat, muscle_mass, fat_free_mass, created_by";
export const circumferenceColumns = 'participant_id, date, "values", created_by';

export type SettingsRow = { title: string; start_date: string; end_date: string };
export type ParticipantRow = {
  id: string;
  name: string;
  color: string;
  start_weight: number | string;
  goal_weight: number | string;
  user_id: string | null;
  position: number;
};
export type SiteRow = Site;
export type WeighingRow = {
  participant_id: string;
  date: string;
  weight: number | string;
  body_fat: number | string | null;
  muscle_mass: number | string | null;
  fat_free_mass: number | string | null;
  created_by: string | null;
};
export type CircumferenceRow = {
  participant_id: string;
  date: string;
  values: Record<string, unknown>;
  created_by: string | null;
};

// numeric columns may come back as strings.
const num = (value: number | string) => Number(value);
const numOrNull = (value: number | string | null) => (value === null ? null : Number(value));

export const settingsFromRow = (row: SettingsRow): Settings => ({
  title: row.title,
  startDate: row.start_date,
  endDate: row.end_date,
});

export const participantFromRow = (row: ParticipantRow): Participant => ({
  id: row.id,
  name: row.name,
  color: (colors.some((color) => color.id === row.color) ? row.color : "blue") as ColorId,
  startWeight: num(row.start_weight),
  goalWeight: num(row.goal_weight),
  userId: row.user_id,
  position: row.position,
});

export const weighingFromRow = (row: WeighingRow): Weighing => ({
  participantId: row.participant_id,
  date: row.date,
  weight: num(row.weight),
  bodyFat: numOrNull(row.body_fat),
  muscleMass: numOrNull(row.muscle_mass),
  fatFreeMass: numOrNull(row.fat_free_mass),
  createdBy: row.created_by,
});

export const circumferenceFromRow = (row: CircumferenceRow): Circumference => ({
  participantId: row.participant_id,
  date: row.date,
  values: Object.fromEntries(
    Object.entries(row.values ?? {})
      .map(([key, value]) => [key, Number(value)] as const)
      .filter(([, value]) => Number.isFinite(value)),
  ),
  createdBy: row.created_by,
});

// --- Checks -----------------------------------------------------------------

export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// "87,3", "87.3" or 87.3 → 87.3; anything outside min…max → null.
export function parseNumber(value: unknown, min: number, max: number, decimals = 2): number | null {
  const number = typeof value === "number" ? value : Number(String(value ?? "").trim().replace(",", "."));
  if (String(value ?? "").trim() === "" || !Number.isFinite(number) || number < min || number > max) return null;
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
}

export const WEIGHT_RANGE = [20, 400] as const;
export const BODY_FAT_RANGE = [1, 80] as const;
export const MASS_RANGE = [5, 300] as const;
export const CM_RANGE = [5, 300] as const;

export type WeighingInput = Omit<Weighing, "createdBy">;

export function cleanWeighingInput(input: Partial<Record<keyof WeighingInput, unknown>>): WeighingInput {
  const weight = parseNumber(input.weight, ...WEIGHT_RANGE);
  if (!isDate(input.date) || weight === null || typeof input.participantId !== "string") {
    throw new Error("Invalid weighing");
  }
  return {
    participantId: input.participantId,
    date: input.date,
    weight,
    bodyFat: parseNumber(input.bodyFat, ...BODY_FAT_RANGE, 1),
    muscleMass: parseNumber(input.muscleMass, ...MASS_RANGE),
    fatFreeMass: parseNumber(input.fatFreeMass, ...MASS_RANGE),
  };
}

export const weighingToRow = (weighing: WeighingInput) => ({
  participant_id: weighing.participantId,
  date: weighing.date,
  weight: weighing.weight,
  body_fat: weighing.bodyFat,
  muscle_mass: weighing.muscleMass,
  fat_free_mass: weighing.fatFreeMass,
});

export type CircumferenceInput = Omit<Circumference, "createdBy">;

export function cleanCircumferenceInput(input: {
  participantId?: unknown;
  date?: unknown;
  values?: unknown;
}): CircumferenceInput {
  if (!isDate(input.date) || typeof input.participantId !== "string") throw new Error("Invalid circumferences");
  const values: Record<string, number> = {};
  if (input.values && typeof input.values === "object") {
    for (const [key, value] of Object.entries(input.values as Record<string, unknown>).slice(0, 100)) {
      const cm = parseNumber(value, ...CM_RANGE, 1);
      if (/^[a-z0-9_-]{1,30}(\.[lr])?$/.test(key) && cm !== null) values[key] = cm;
    }
  }
  return { participantId: input.participantId, date: input.date, values };
}

export function cleanSettingsInput(input: Partial<Record<keyof Settings, unknown>>): Settings {
  const title = str(input.title, 60);
  if (!title || !isDate(input.startDate) || !isDate(input.endDate) || input.endDate <= input.startDate) {
    throw new Error("Invalid settings");
  }
  return { title, startDate: input.startDate, endDate: input.endDate };
}

export type ParticipantInput = Omit<Participant, "id" | "position">;

export function cleanParticipantInput(input: Partial<Record<keyof ParticipantInput, unknown>>): ParticipantInput {
  const name = str(input.name, 30);
  const startWeight = parseNumber(input.startWeight, ...WEIGHT_RANGE);
  const goalWeight = parseNumber(input.goalWeight, ...WEIGHT_RANGE);
  if (!name || startWeight === null || goalWeight === null) throw new Error("Invalid participant");
  return {
    name,
    color: (colors.some((color) => color.id === input.color) ? input.color : "blue") as ColorId,
    startWeight,
    goalWeight,
    userId: typeof input.userId === "string" && input.userId ? input.userId : null,
  };
}

export const participantToRow = (participant: ParticipantInput) => ({
  name: participant.name,
  color: participant.color,
  start_weight: participant.startWeight,
  goal_weight: participant.goalWeight,
  user_id: participant.userId,
});

// "Hüfte" → "huefte"; the key of a new measuring point.
export function siteKey(label: string) {
  return (
    label
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "stelle"
  );
}

export function cleanSiteInput(input: { label?: unknown; sided?: unknown }) {
  const label = str(input.label, 30);
  if (!label) throw new Error("Invalid site");
  return { label, sided: input.sided === true };
}
