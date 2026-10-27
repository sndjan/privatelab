// Pure calculations for the work time module: targets per day, the overtime
// balance and vacation per year. Dates are "YYYY-MM-DD" strings and times are
// minutes, so nothing here depends on the time zone of the server or browser.

export type DayKind = "work" | "sick" | "overtime_off";
export type ChristmasMode = "work" | "half" | "off";

export type Settings = {
  employer: string | null;
  // Overtime balance at the end of openingDate, in minutes.
  openingBalance: number;
  openingDate: string | null;
  defaultStart: number;
  defaultBreak: number;
  christmasMode: ChristmasMode;
};

export const defaultSettings: Settings = {
  employer: null,
  openingBalance: 0,
  openingDate: null,
  defaultStart: 7 * 60 + 30,
  defaultBreak: 60,
  christmasMode: "work",
};

export type Period = {
  id: string;
  validFrom: string;
  label: string;
  // Target minutes for Monday to Sunday.
  weekdayMinutes: number[];
  vacationPerMonth: number;
};

export type DayEntry = {
  day: string;
  kind: DayKind;
  start: number | null;
  end: number | null;
  breakMinutes: number;
};

export type VacationBlock = {
  id: string;
  startDate: string;
  endDate: string;
  note: string | null;
  inCalendar: boolean;
};

export const dayKinds: { value: DayKind; label: string }[] = [
  { value: "work", label: "Arbeit" },
  { value: "sick", label: "Krank" },
  { value: "overtime_off", label: "Überstundenabbau" },
];

export const christmasModes: { value: ChristmasMode; label: string }[] = [
  { value: "work", label: "Normale Arbeitstage" },
  { value: "half", label: "Halbe Tage" },
  { value: "off", label: "Frei" },
];

export const weekdayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// --- Dates ------------------------------------------------------------------

function toDate(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

function toString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const result = toDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return toString(result);
}

// 0 = Monday … 6 = Sunday.
export function weekday(date: string) {
  return (toDate(date).getUTCDay() + 6) % 7;
}

export function mondayOf(date: string) {
  return addDays(date, -weekday(date));
}

export function daysBetween(from: string, to: string) {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}

export function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toDate(value).getTime()) && toString(toDate(value)) === value;
}

// Today in Germany, so the day doesn't flip at midnight UTC.
export function todayInGermany() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

// --- Public holidays (Baden-Württemberg) ------------------------------------

// Easter Sunday (anonymous Gregorian algorithm).
function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const holidayCache = new Map<number, Map<string, string>>();

export function holidays(year: number) {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const sunday = easter(year);
  const map = new Map<string, string>([
    [`${year}-01-01`, "Neujahr"],
    [`${year}-01-06`, "Heilige Drei Könige"],
    [addDays(sunday, -2), "Karfreitag"],
    [addDays(sunday, 1), "Ostermontag"],
    [`${year}-05-01`, "Tag der Arbeit"],
    [addDays(sunday, 39), "Christi Himmelfahrt"],
    [addDays(sunday, 50), "Pfingstmontag"],
    [addDays(sunday, 60), "Fronleichnam"],
    [`${year}-10-03`, "Tag der Deutschen Einheit"],
    [`${year}-11-01`, "Allerheiligen"],
    [`${year}-12-25`, "1. Weihnachtstag"],
    [`${year}-12-26`, "2. Weihnachtstag"],
  ]);
  holidayCache.set(year, map);
  return map;
}

export function holidayName(date: string) {
  return holidays(Number(date.slice(0, 4))).get(date) ?? null;
}

function isChristmasDay(date: string) {
  const monthDay = date.slice(5);
  return monthDay === "12-24" || monthDay === "12-31";
}

// --- Days -------------------------------------------------------------------

// Periods sorted by validFrom, ascending.
export function periodOn(periods: Period[], date: string) {
  let found: Period | null = null;
  for (const period of periods) {
    if (period.validFrom <= date) found = period;
    else break;
  }
  return found;
}

export function targetMinutes(date: string, periods: Period[], settings: Settings) {
  if (holidayName(date)) return 0;
  const base = periodOn(periods, date)?.weekdayMinutes[weekday(date)] ?? 0;
  if (!isChristmasDay(date) || settings.christmasMode === "work") return base;
  return settings.christmasMode === "half" ? Math.round(base / 2) : 0;
}

export function workedMinutes(entry: Pick<DayEntry, "start" | "end" | "breakMinutes">) {
  if (entry.start === null || entry.end === null) return 0;
  return Math.max(0, entry.end - entry.start - entry.breakMinutes);
}

// The times a day counts with when nothing was entered.
export function standardTimes(target: number, settings: Settings) {
  const breakMinutes = target > 6 * 60 ? settings.defaultBreak : 0;
  const start = settings.defaultStart;
  return { start, end: Math.min(24 * 60, start + (target > 0 ? target : 4 * 60) + breakMinutes), breakMinutes };
}

export type DayStatus = "standard" | "work" | "sick" | "overtime_off" | "vacation" | "holiday" | "free";

export type DayInfo = {
  date: string;
  target: number;
  actual: number;
  status: DayStatus;
  holiday: string | null;
  entry: DayEntry | null;
  vacation: VacationBlock | null;
  // Vacation days this day uses (0, 0.5 or 1).
  vacationDays: number;
};

export type Context = {
  periods: Period[];
  settings: Settings;
  entries: Map<string, DayEntry>;
  vacationByDay: Map<string, VacationBlock>;
};

export function buildContext(
  periods: Period[],
  settings: Settings,
  entries: DayEntry[],
  vacations: VacationBlock[],
): Context {
  const vacationByDay = new Map<string, VacationBlock>();
  for (const block of vacations) {
    for (let day = block.startDate; day <= block.endDate; day = addDays(day, 1)) vacationByDay.set(day, block);
  }
  return {
    periods: [...periods].sort((a, b) => a.validFrom.localeCompare(b.validFrom)),
    settings,
    entries: new Map(entries.map((entry) => [entry.day, entry])),
    vacationByDay,
  };
}

// An entered day wins over vacation (worked or sick during vacation doesn't
// use a vacation day); vacation on a day without target hours uses none.
export function dayInfo(date: string, context: Context): DayInfo {
  const { periods, settings } = context;
  const target = targetMinutes(date, periods, settings);
  const holiday = holidayName(date);
  const entry = context.entries.get(date) ?? null;
  const block = context.vacationByDay.get(date) ?? null;
  const base = { date, target, holiday, entry, vacation: block, vacationDays: 0 };

  if (entry) {
    const actual = entry.kind === "work" ? workedMinutes(entry) : entry.kind === "sick" ? target : 0;
    return { ...base, actual, status: entry.kind };
  }
  if (block && target > 0) {
    const fullTarget = periodOn(periods, date)?.weekdayMinutes[weekday(date)] ?? 0;
    return { ...base, actual: target, status: "vacation", vacationDays: target < fullTarget ? 0.5 : 1 };
  }
  if (holiday) return { ...base, actual: 0, status: "holiday" };
  return { ...base, actual: target, status: target > 0 ? "standard" : "free" };
}

// The first day counted on top of the opening balance.
export function firstCountedDay(context: Context) {
  if (context.settings.openingDate) return addDays(context.settings.openingDate, 1);
  return context.periods[0]?.validFrom ?? null;
}

// Overtime in minutes at the end of `until`.
export function overtimeBalance(context: Context, until: string) {
  let balance = context.settings.openingBalance;
  const first = firstCountedDay(context);
  if (!first) return balance;
  for (let day = first; day <= until; day = addDays(day, 1)) {
    const info = dayInfo(day, context);
    balance += info.actual - info.target;
  }
  return balance;
}

// --- Vacation ---------------------------------------------------------------

export function vacationEntitlement(year: number, periods: Period[]) {
  let total = 0;
  for (let month = 1; month <= 12; month++) {
    total += periodOn(periods, `${year}-${String(month).padStart(2, "0")}-01`)?.vacationPerMonth ?? 0;
  }
  return total;
}

function vacationUsed(year: number, context: Context, today: string) {
  let taken = 0;
  let planned = 0;
  for (const [day] of context.vacationByDay) {
    if (!day.startsWith(`${year}-`)) continue;
    const used = dayInfo(day, context).vacationDays;
    if (day <= today) taken += used;
    else planned += used;
  }
  return { taken, planned };
}

export type VacationYear = {
  entitlement: number;
  carryOver: number;
  taken: number;
  planned: number;
  // Not yet taken or planned.
  left: number;
};

// Unused days carry over into the next year (negative if too many were used).
export function vacationYear(year: number, context: Context, today: string): VacationYear {
  const firstYear = context.periods[0] ? Number(context.periods[0].validFrom.slice(0, 4)) : year;
  let carryOver = 0;
  for (let y = firstYear; y < year; y++) {
    const { taken, planned } = vacationUsed(y, context, today);
    carryOver += vacationEntitlement(y, context.periods) - taken - planned;
  }
  const entitlement = vacationEntitlement(year, context.periods);
  const { taken, planned } = vacationUsed(year, context, today);
  return { entitlement, carryOver, taken, planned, left: entitlement + carryOver - taken - planned };
}

export function blockDays(block: Pick<VacationBlock, "startDate" | "endDate">, context: Context) {
  let total = 0;
  for (let day = block.startDate; day <= block.endDate; day = addDays(day, 1)) {
    const info = dayInfo(day, context);
    // Count the block's own days, even before it is saved.
    if (!info.entry && info.target > 0) {
      const fullTarget = periodOn(context.periods, day)?.weekdayMinutes[weekday(day)] ?? 0;
      total += info.target < fullTarget ? 0.5 : 1;
    }
  }
  return total;
}

export function blockState(block: VacationBlock, today: string) {
  if (block.endDate < today) return "taken" as const;
  if (block.startDate > today) return "planned" as const;
  return "running" as const;
}

// --- Formatting -------------------------------------------------------------

const hourFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

// 2010 → "33,5 h", with a sign: "+33,5 h". Uses a real minus sign.
export function formatHours(minutes: number, { signed = false } = {}) {
  const value = hourFormat.format(Math.abs(minutes) / 60);
  const sign = minutes < 0 ? "−" : signed && minutes > 0 ? "+" : signed ? "±" : "";
  return `${sign}${value} h`;
}

// 450 → "7:30"
export function formatTime(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

export function formatBreak(minutes: number) {
  if (minutes === 0) return "ohne Pause";
  if (minutes % 60 === 0) return `${minutes / 60} h Pause`;
  return `${minutes} min Pause`;
}

export function formatDays(days: number) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(days);
}

// "Mo 26.10."
export function formatDay(date: string) {
  return `${weekdayNames[weekday(date)]} ${date.slice(8, 10)}.${date.slice(5, 7)}.`;
}

// "26.10.2026"
export function formatDate(date: string) {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
}

export function formatRange(start: string, end: string) {
  if (start === end) return formatDate(start);
  if (start.slice(0, 4) === end.slice(0, 4)) return `${formatDay(start).slice(3)} – ${formatDate(end)}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}
