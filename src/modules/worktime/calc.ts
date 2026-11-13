// Pure calculations for the work time module: targets per day, the overtime
// balance and vacation per year. Dates are "YYYY-MM-DD" strings and times are
// minutes, so nothing here depends on the time zone of the server or browser.

export type DayKind = "work" | "sick" | "overtime_off";
export type ChristmasMode = "work" | "half" | "off";
export type HolidayState = "BW" | "BY";

export type Settings = {
  employer: string | null;
  // Overtime balance at the end of openingDate, in minutes.
  openingBalance: number;
  openingDate: string | null;
  defaultStart: number;
  defaultBreak: number;
  christmasMode: ChristmasMode;
  holidayState: HolidayState;
  // Unused vacation from the previous year expires after 31.03.
  carryoverExpires: boolean;
};

export const defaultSettings: Settings = {
  employer: null,
  openingBalance: 0,
  openingDate: null,
  defaultStart: 7 * 60 + 30,
  defaultBreak: 60,
  christmasMode: "work",
  holidayState: "BW",
  carryoverExpires: false,
};

export type Period = {
  id: string;
  validFrom: string;
  label: string;
  // Target minutes for Monday to Sunday.
  weekdayMinutes: number[];
  // Contract vacation days per year, for the vacation rule.
  vacationContractDays: number;
  // Fixed vacation minutes per month instead of the rule (null = rule).
  vacationPerMonth: number | null;
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
  // Paid with overtime instead of vacation days.
  fromOvertime: boolean;
};

export const dayKinds: { value: DayKind; label: string }[] = [
  { value: "work", label: "Arbeit" },
  { value: "sick", label: "Krank" },
  { value: "overtime_off", label: "Gleittag" },
];

export const christmasModes: { value: ChristmasMode; label: string }[] = [
  { value: "work", label: "Normale Arbeitstage" },
  { value: "half", label: "Halbe Tage" },
  { value: "off", label: "Frei" },
];

export const holidayStates: { value: HolidayState; label: string }[] = [
  { value: "BW", label: "Baden-Württemberg" },
  { value: "BY", label: "Bayern" },
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

// --- Public holidays (Baden-Württemberg or Bayern) ----------------------------

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

const holidayCache = new Map<string, Map<string, string>>();

// Bayern: Mariä Himmelfahrt as in predominantly Catholic municipalities
// (e.g. Bellenberg), without the Augsburger Friedensfest.
export function holidays(year: number, state: HolidayState) {
  const cached = holidayCache.get(`${state}${year}`);
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
  if (state === "BY") map.set(`${year}-08-15`, "Mariä Himmelfahrt");
  holidayCache.set(`${state}${year}`, map);
  return map;
}

export function holidayName(date: string, state: HolidayState) {
  return holidays(Number(date.slice(0, 4)), state).get(date) ?? null;
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
  if (holidayName(date, settings.holidayState)) return 0;
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
  // Vacation minutes this day uses (its target hours, unless paid with overtime).
  vacationMinutes: number;
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
  const holiday = holidayName(date, settings.holidayState);
  const entry = context.entries.get(date) ?? null;
  const block = context.vacationByDay.get(date) ?? null;
  const base = { date, target, holiday, entry, vacation: block, vacationMinutes: 0 };

  if (entry) {
    const actual = entry.kind === "work" ? workedMinutes(entry) : entry.kind === "sick" ? target : 0;
    return { ...base, actual, status: entry.kind };
  }
  if (block && target > 0) {
    if (block.fromOvertime) return { ...base, actual: 0, status: "vacation" };
    return { ...base, actual: target, status: "vacation", vacationMinutes: target };
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

// Overtime that days after `today` will use up: vacation paid with overtime
// and planned days off from overtime.
export function plannedOvertimeUse(context: Context, today: string) {
  const days = new Set([...context.vacationByDay.keys(), ...context.entries.keys()]);
  let total = 0;
  for (const day of days) {
    if (day <= today) continue;
    const info = dayInfo(day, context);
    if (info.status === "overtime_off" || (info.status === "vacation" && info.vacation?.fromOvertime)) {
      total += info.target - info.actual;
    }
  }
  return total;
}

// --- Vacation ---------------------------------------------------------------
// Vacation is counted in minutes. Every model earns vacation per month: a fixed
// amount, or by the rule max(contract, law) / 12 with
//   contract = contract days × hours per workday
//   law      = 4 weeks × weekly hours (BUrlG minimum).
// A month with a model change is split by calendar days, so earned vacation
// keeps its value. A vacation day uses the target hours of that day.

export function vacationRule(weekdayMinutes: number[], contractDays: number) {
  const weekly = weekdayMinutes.reduce((sum, minutes) => sum + minutes, 0);
  const workdays = weekdayMinutes.filter((minutes) => minutes > 0).length;
  const perDay = workdays ? weekly / workdays : 0;
  const contract = contractDays * perDay;
  const law = 4 * weekly;
  const perYear = Math.max(contract, law);
  return { weekly, workdays, perDay, contract, law, perYear, perMonth: perYear / 12 };
}

export function monthlyVacation(period: Period) {
  return period.vacationPerMonth ?? vacationRule(period.weekdayMinutes, period.vacationContractDays).perMonth;
}

function daysInMonth(date: string) {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Vacation minutes earned from `from` to `to` (inclusive), each day earning
// its share of the month.
export function vacationEarned(from: string, to: string, periods: Period[]) {
  let total = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const period = periodOn(periods, day);
    if (period) total += monthlyVacation(period) / daysInMonth(day);
  }
  return total;
}

export function vacationEntitlement(year: number, periods: Period[]) {
  return vacationEarned(`${year}-01-01`, `${year}-12-31`, periods);
}

function vacationUsed(from: string, to: string, context: Context, today: string) {
  let taken = 0;
  let planned = 0;
  for (const [day] of context.vacationByDay) {
    if (day < from || day > to) continue;
    const used = dayInfo(day, context).vacationMinutes;
    if (day <= today) taken += used;
    else planned += used;
  }
  return { taken, planned };
}

export type VacationYear = {
  // All values in minutes.
  entitlement: number;
  // Earned up to today (the whole year for past years).
  earned: number;
  carryOver: number;
  // Carry-over that expired on 31.03. (only with carryoverExpires).
  expired: number;
  // Carry-over that expires on 31.03. unless taken or planned before.
  expiring: number;
  taken: number;
  planned: number;
  // Not yet taken or planned.
  left: number;
};

function computeYear(year: number, carryOver: number, context: Context, today: string): VacationYear {
  const entitlement = vacationEntitlement(year, context.periods);
  const earnedUntil = today < `${year}-12-31` ? today : `${year}-12-31`;
  const earned = vacationEarned(`${year}-01-01`, earnedUntil, context.periods);
  const { taken, planned } = vacationUsed(`${year}-01-01`, `${year}-12-31`, context, today);
  let expired = 0;
  let expiring = 0;
  if (context.settings.carryoverExpires && carryOver > 0) {
    const deadline = `${year}-03-31`;
    const early = vacationUsed(`${year}-01-01`, deadline, context, today);
    const unused = Math.max(0, carryOver - early.taken - early.planned);
    if (today > deadline) expired = unused;
    else expiring = unused;
  }
  return {
    entitlement,
    earned,
    carryOver,
    expired,
    expiring,
    taken,
    planned,
    left: entitlement + carryOver - expired - taken - planned,
  };
}

// Unused vacation carries over into the next year (negative if too much was
// used); with carryoverExpires, carry-over not used by 31.03. expires.
export function vacationYear(year: number, context: Context, today: string): VacationYear {
  const firstYear = context.periods[0] ? Number(context.periods[0].validFrom.slice(0, 4)) : year;
  let carryOver = 0;
  for (let y = firstYear; y < year; y++) carryOver = computeYear(y, carryOver, context, today).left;
  return computeYear(year, carryOver, context, today);
}

// Workdays in a block and their target minutes (the vacation or overtime it
// uses). Works for blocks that aren't saved yet.
export function blockDays(block: Pick<VacationBlock, "startDate" | "endDate">, context: Context) {
  let days = 0;
  let minutes = 0;
  // Days without a work time model (they use no vacation, which is usually a mistake).
  let withoutModel = 0;
  for (let day = block.startDate; day <= block.endDate; day = addDays(day, 1)) {
    if (!periodOn(context.periods, day)) withoutModel++;
    const info = dayInfo(day, context);
    if (!info.entry && info.target > 0) {
      const fullTarget = periodOn(context.periods, day)?.weekdayMinutes[weekday(day)] ?? 0;
      days += info.target < fullTarget ? 0.5 : 1;
      minutes += info.target;
    }
  }
  return { days, minutes, withoutModel };
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

export function formatDays(days: number) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(days);
}

// "26.10."
export function formatShortDate(date: string) {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.`;
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
