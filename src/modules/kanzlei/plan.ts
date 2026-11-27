// Shared by server and browser: capacity, the day plan without AI, the
// forecast of the next weeks and the periods of recurring orders. The AI plan
// (ai.ts) starts from this one, and the app falls back to it without a key.
import { addDays, holidayName, weekday } from "@/modules/worktime/calc";
import {
  formatDate,
  isWaitingStatus,
  type Absence,
  type DayPlan,
  type Item,
  type PlanEntry,
  type Recurring,
  type Rhythm,
  type Settings,
  type TypeDef,
} from "./data";

export { addDays, weekday };

export type PlanData = {
  settings: Settings;
  types: TypeDef[];
  items: Item[];
  recurring: Recurring[];
  absences: Absence[];
};

// --- Days and capacity ----------------------------------------------------------

export function absenceOn(date: string, absences: Absence[]) {
  return absences.find((absence) => absence.startDate <= date && absence.endDate >= date) ?? null;
}

// Net minutes of work on a day: 0 on weekends, holidays and absences.
export function dayMinutes(date: string, settings: Settings, absences: Absence[]) {
  if (holidayName(date, settings.holidayState)) return 0;
  if (absenceOn(date, absences)) return 0;
  return settings.dayMinutes[weekday(date)] ?? 0;
}

export function dayCapacity(date: string, settings: Settings, absences: Absence[]) {
  const total = dayMinutes(date, settings, absences);
  const sum = settings.shareOrders + settings.shareDaily + settings.shareBuffer || 100;
  const orders = Math.round((total * settings.shareOrders) / sum);
  const daily = Math.round((total * settings.shareDaily) / sum);
  return { total, orders, daily, buffer: total - orders - daily };
}

export function isWorkday(date: string, settings: Settings, absences: Absence[]) {
  return dayMinutes(date, settings, absences) > 0;
}

export function addWorkdays(date: string, count: number, settings: Settings, absences: Absence[]) {
  let day = date;
  let left = count;
  // Fall back to plain weekdays if nothing is a workday (all hours at 0).
  const anyWorkday = settings.dayMinutes.some((value) => value > 0);
  for (let guard = 0; left > 0 && guard < 1000; guard++) {
    day = addDays(day, 1);
    if (anyWorkday ? isWorkday(day, settings, absences) : weekday(day) < 5) left--;
  }
  return day;
}

// Workdays from today up to and including the date (today counts).
export function workdaysUntil(today: string, date: string, settings: Settings, absences: Absence[]) {
  if (date < today) return 0;
  let count = 0;
  for (let day = today, guard = 0; day <= date && guard < 800; day = addDays(day, 1), guard++) {
    if (isWorkday(day, settings, absences)) count++;
  }
  return count;
}

// Order capacity (minutes) from today up to and including the date.
export function orderCapacityUntil(today: string, date: string, settings: Settings, absences: Absence[]) {
  let minutes = 0;
  for (let day = today, guard = 0; day <= date && guard < 800; day = addDays(day, 1), guard++) {
    minutes += dayCapacity(day, settings, absences).orders;
  }
  return minutes;
}

// --- Items ------------------------------------------------------------------------

export const deadlineOf = (item: Pick<Item, "deadlineLegal" | "deadlineInternal">) =>
  [item.deadlineInternal, item.deadlineLegal].filter(Boolean).sort()[0] ?? null;

export const isOpen = (item: Item) => item.status !== "erledigt";

// Waiting, and its Wiedervorlage is due: then it needs a short look today.
export const followUpDue = (item: Item, today: string) =>
  isOpen(item) && item.followUp !== null && item.followUp <= today;

export function isBlocked(item: Item, byId: Map<string, Item>) {
  if (!item.dependsOn) return false;
  const other = byId.get(item.dependsOn);
  return other ? isOpen(other) : false;
}

// Can be worked on today: open, not waiting (unless its Wiedervorlage is due),
// not pushed to a later Wiedervorlage, not blocked by an open order.
export function isActionable(item: Item, today: string, byId: Map<string, Item>) {
  if (!isOpen(item)) return false;
  if (item.followUp && item.followUp > today) return false;
  if (isWaitingStatus(item.status) && !followUpDue(item, today)) return false;
  return !isBlocked(item, byId);
}

// What an item takes today: the remaining effort, a short look for a due
// Wiedervorlage, the default for a task without an estimate.
export function effortOf(item: Item, today: string, settings: Settings) {
  if (isWaitingStatus(item.status) && followUpDue(item, today)) return settings.taskMinutes;
  if (item.remaining > 0) return item.remaining;
  if (item.estimate > 0) return item.estimate;
  return item.kind === "aufgabe" ? settings.taskMinutes : 60;
}

export function itemLabel(item: Item, types: TypeDef[]) {
  const type = types.find((entry) => entry.id === item.typeId);
  const parts = [type?.name, item.period, item.client].filter(Boolean);
  const head = parts.join(" · ");
  if (!item.title) return head || "Ohne Titel";
  return head ? `${head} – ${item.title}` : item.title;
}

// --- Recurring periods ------------------------------------------------------------

const pad = (value: number) => String(value).padStart(2, "0");

export function periodOf(start: string, rhythm: Rhythm) {
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7));
  const months = rhythm === "monthly" ? 1 : rhythm === "quarterly" ? 3 : 12;
  const firstMonth = rhythm === "yearly" ? 1 : rhythm === "quarterly" ? Math.floor((month - 1) / 3) * 3 + 1 : month;
  const from = `${year}-${pad(firstMonth)}-01`;
  const endMonth = firstMonth + months;
  const next = endMonth > 12 ? `${year + 1}-${pad(endMonth - 12)}-01` : `${year}-${pad(endMonth)}-01`;
  const label =
    rhythm === "monthly" ? `${pad(firstMonth)}/${year}` : rhythm === "quarterly" ? `Q${(firstMonth + 2) / 3}/${year}` : String(year);
  return { from, end: addDays(next, -1), next, label };
}

export type Occurrence = {
  recurringId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  deadlineInternal: string | null;
  deadlineLegal: string | null;
};

// Periods of a template from its next one on, while they start on or before `until`.
export function occurrences(template: Recurring, until: string, max = 60): Occurrence[] {
  const result: Occurrence[] = [];
  let start = template.nextPeriod;
  for (let index = 0; index < max; index++) {
    const period = periodOf(start, template.rhythm);
    if (period.from > until) break;
    result.push({
      recurringId: template.id,
      period: period.label,
      periodStart: period.from,
      periodEnd: period.end,
      deadlineInternal: template.internalOffsetDays === null ? null : addDays(period.end, template.internalOffsetDays),
      deadlineLegal: template.legalOffsetDays === null ? null : addDays(period.end, template.legalOffsetDays),
    });
    start = period.next;
  }
  return result;
}

// --- Forecast -----------------------------------------------------------------------

export type WeekLoad = {
  monday: string;
  capacity: number;
  // Orders that exist (planned or waiting) and recurring ones not created yet.
  open: number;
  waiting: number;
  forecast: number;
  load: number;
};

export type DeadlineRisk = { deadline: string; missing: number; work: number; capacity: number; itemIds: string[] };

type Work = { id: string; minutes: number; start: string; end: string; kind: "open" | "waiting" | "forecast" };

const HORIZON_DAYS = 7 * 26;

// Every piece of order work still to do: existing open orders and the orders
// recurring templates will create within the horizon.
function workList(data: PlanData, today: string): Work[] {
  const byId = new Map(data.items.map((item) => [item.id, item]));
  const fallbackEnd = addDays(today, 28);
  const work: Work[] = [];
  for (const item of data.items) {
    if (!isOpen(item) || item.kind !== "auftrag") continue;
    const minutes = item.remaining || item.estimate;
    if (minutes <= 0) continue;
    const start = item.followUp && item.followUp > today ? item.followUp : today;
    const deadline = deadlineOf(item) ?? fallbackEnd;
    work.push({
      id: item.id,
      minutes,
      start,
      end: deadline < start ? start : deadline,
      kind: isWaitingStatus(item.status) || isBlocked(item, byId) ? "waiting" : "open",
    });
  }
  const until = addDays(today, HORIZON_DAYS);
  for (const template of data.recurring) {
    if (!template.active || template.estimate <= 0) continue;
    for (const occurrence of occurrences(template, until)) {
      // Documents come after the period, so the work starts after its end.
      const start = occurrence.periodEnd >= today ? addDays(occurrence.periodEnd, 1) : today;
      const deadline = [occurrence.deadlineInternal, occurrence.deadlineLegal].filter(Boolean).sort()[0] ?? addDays(start, 28);
      work.push({
        id: `${template.id}:${occurrence.period}`,
        minutes: template.estimate,
        start,
        end: deadline < start ? start : deadline,
        kind: "forecast",
      });
    }
  }
  return work;
}

// Load per week: each piece of work is spread evenly over the workdays
// between its start and its deadline.
export function weekLoads(data: PlanData, today: string, weeks = 12): WeekLoad[] {
  const { settings, absences } = data;
  const firstMonday = addDays(today, -weekday(today));
  const result: WeekLoad[] = Array.from({ length: weeks }, (_, index) => {
    const monday = addDays(firstMonday, index * 7);
    let capacity = 0;
    for (let day = 0; day < 7; day++) {
      const date = addDays(monday, day);
      if (date >= today) capacity += dayCapacity(date, settings, absences).orders;
    }
    return { monday, capacity, open: 0, waiting: 0, forecast: 0, load: 0 };
  });
  const lastDay = addDays(firstMonday, weeks * 7 - 1);
  for (const piece of workList(data, today)) {
    const days: string[] = [];
    for (let day = piece.start, guard = 0; day <= piece.end && guard < 800; day = addDays(day, 1), guard++) {
      if (dayCapacity(day, settings, absences).orders > 0) days.push(day);
    }
    if (days.length === 0) days.push(piece.end < today ? today : piece.end);
    const share = piece.minutes / days.length;
    for (const day of days) {
      if (day > lastDay) continue;
      const week = result[Math.floor(daysBetweenDates(firstMonday, day) / 7)];
      if (week) week[piece.kind] += share;
    }
  }
  for (const week of result) {
    week.open = Math.round(week.open);
    week.waiting = Math.round(week.waiting);
    week.forecast = Math.round(week.forecast);
    week.load = week.open + week.waiting + week.forecast;
  }
  return result;
}

function daysBetweenDates(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

// Deadlines that can't all be met: sorted by deadline, the work due by each
// deadline is compared with the order capacity until then.
export function deadlineRisks(data: PlanData, today: string): DeadlineRisk[] {
  const work = workList(data, today).sort((a, b) => a.end.localeCompare(b.end));
  const risks: DeadlineRisk[] = [];
  let sum = 0;
  const ids: string[] = [];
  for (let index = 0; index < work.length; index++) {
    sum += work[index].minutes;
    ids.push(work[index].id);
    const deadline = work[index].end;
    if (work[index + 1]?.end === deadline) continue;
    const capacity = orderCapacityUntil(today, deadline, data.settings, data.absences);
    if (sum > capacity + 30) {
      const last = risks[risks.length - 1];
      // Keep only the worst gap of a run of consecutive risky deadlines.
      if (last && sum - capacity <= last.missing) continue;
      risks.push({ deadline, missing: sum - capacity, work: sum, capacity, itemIds: ids.filter((id) => !id.includes(":")) });
    }
  }
  return risks.slice(0, 5);
}

// --- Day plan without AI -------------------------------------------------------------

type Candidate = { item: Item; minutes: number; reason: string; score: number };

const CHUNK = 150;

export function basePlan(data: PlanData, today: string): DayPlan {
  const { settings, absences, types } = data;
  const byId = new Map(data.items.map((item) => [item.id, item]));
  const capacity = dayCapacity(today, settings, absences);
  const overloaded = new Set(
    weekLoads(data, today, 8)
      .filter((week) => week.load > week.capacity && week.capacity > 0)
      .map((week) => week.monday),
  );
  const nextWorkday = addWorkdays(today, 1, settings, absences);

  const must: Candidate[] = [];
  const orders: Candidate[] = [];
  const tasks: Candidate[] = [];

  for (const item of data.items) {
    if (!isActionable(item, today, byId)) continue;
    const minutes = effortOf(item, today, settings);
    const deadline = deadlineOf(item);
    const due = deadline !== null && deadline <= nextWorkday;
    const followUp = isWaitingStatus(item.status) && followUpDue(item, today);
    const pinned = item.plannedFor === today;
    const urgentTask = item.kind === "aufgabe" && item.priority === 1;
    if (pinned || due || followUp || urgentTask) {
      const reason = pinned
        ? "Von dir fest für heute eingeplant."
        : followUp
          ? `Wiedervorlage fällig (${formatDate(item.followUp)}): nachfassen.`
          : due
            ? deadline! < today
              ? `Frist ${formatDate(deadline)} ist überschritten.`
              : `Frist ${formatDate(deadline)}${deadline === today ? " ist heute" : " ist morgen"}.`
            : "Als dringend markiert.";
      const chunk = item.kind === "auftrag" && !due && !pinned ? Math.min(minutes, CHUNK) : minutes;
      must.push({ item, minutes: chunk, reason, score: 1000 - (deadline ? daysBetweenDates(today, deadline) : 0) });
      continue;
    }
    const daysLeft = deadline ? Math.max(1, workdaysUntil(today, deadline, settings, absences)) : 40;
    let score = minutes / daysLeft / 60;
    if (item.status === "in_bearbeitung" || item.status === "nachbearbeitung") score *= 1.6;
    if (item.priority === 1) score *= 2;
    if (item.priority === 3) score *= 0.5;
    let reason = deadline ? `Frist ${formatDate(deadline)}, noch ${daysLeft} Arbeitstage.` : "Ohne Frist.";
    if (deadline && [...overloaded].some((monday) => deadline >= monday)) {
      score *= 1.5;
      reason = `Vorgezogen: bis zur Frist ${formatDate(deadline)} wird es eng.`;
    }
    if (item.status === "in_bearbeitung") reason = `Schon begonnen. ${reason}`;
    (item.kind === "auftrag" ? orders : tasks).push({ item, minutes, reason, score });
  }

  must.sort((a, b) => b.score - a.score);
  orders.sort((a, b) => b.score - a.score);
  tasks.sort((a, b) => b.score - a.score);

  // Tasks use the daily-business share, orders the orders share; whatever
  // the must-list takes comes off the matching budget first.
  let orderBudget = capacity.orders;
  let dailyBudget = capacity.daily;
  for (const entry of must) {
    if (entry.item.kind === "auftrag") orderBudget -= entry.minutes;
    else dailyBudget -= entry.minutes;
  }
  if (dailyBudget < 0) {
    orderBudget += dailyBudget;
    dailyBudget = 0;
  }

  const focus: Candidate[] = [];
  const optional: Candidate[] = [];
  for (const entry of orders) {
    const chunk = Math.min(entry.minutes, CHUNK);
    if (orderBudget >= Math.min(chunk, 45) && focus.filter((other) => other.item.kind === "auftrag").length < 3) {
      const minutes = Math.min(chunk, Math.max(45, orderBudget));
      focus.push({ ...entry, minutes });
      orderBudget -= minutes;
    } else if (optional.length < 4) {
      optional.push({ ...entry, minutes: Math.min(entry.minutes, 90) });
    }
  }
  for (const entry of tasks) {
    if (dailyBudget >= entry.minutes) {
      focus.push(entry);
      dailyBudget -= entry.minutes;
    } else if (optional.length < 6) {
      optional.push(entry);
    }
  }

  const warnings: string[] = [];
  const mustMinutes = must.reduce((sum, entry) => sum + entry.minutes, 0);
  if (capacity.total === 0) warnings.push("Heute ist laut deinen Einstellungen kein Arbeitstag.");
  else if (mustMinutes > capacity.orders + capacity.daily)
    warnings.push(`„Muss heute“ braucht ${Math.round(mustMinutes / 60)} h, mehr als heute planbar ist. Etwas davon verschieben oder abgeben.`);
  for (const risk of deadlineRisks(data, today).slice(0, 2)) {
    warnings.push(
      `Bis ${formatDate(risk.deadline, true)} fehlen rund ${Math.round(risk.missing / 60)} h Kapazität (${Math.round(risk.work / 60)} h Arbeit, ${Math.round(risk.capacity / 60)} h Zeit).`,
    );
  }

  const toEntries = (list: Candidate[]): PlanEntry[] =>
    bundle(list, types).map((entry) => ({ id: entry.item.id, minutes: Math.round(entry.minutes), reason: entry.reason }));

  return {
    day: today,
    createdAt: new Date().toISOString(),
    source: "auto",
    summary: "",
    must: toEntries(must),
    focus: toEntries(focus),
    optional: toEntries(optional),
    warnings,
  };
}

// Keeps entries of the same type together (e.g. three Lohn in a row), in the
// order of each type's best entry.
function bundle(list: Candidate[], types: TypeDef[]) {
  const groups = new Map<string, Candidate[]>();
  for (const entry of list) {
    const key = entry.item.typeId ?? entry.item.id;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const result: Candidate[] = [];
  for (const group of groups.values()) {
    if (group.length > 1) {
      const name = types.find((type) => type.id === group[0].item.typeId)?.name;
      for (const entry of group) {
        if (name && !entry.reason.includes("Gebündelt")) entry.reason = `${entry.reason} Gebündelt mit ${group.length - 1} weiteren ${name}.`;
      }
    }
    result.push(...group);
  }
  return result;
}

// The plan shown today: the saved plan without what is done or now waits,
// plus what became due since it was made. A new item doesn't reshuffle the
// rest of the day.
export function currentPlan(saved: DayPlan | null, data: PlanData, today: string): DayPlan {
  const base = basePlan(data, today);
  if (!saved || saved.day !== today) return base;
  const byId = new Map(data.items.map((item) => [item.id, item]));
  const keep = (entry: PlanEntry) => {
    const item = byId.get(entry.id);
    return item !== undefined && isActionable(item, today, byId);
  };
  const plan: DayPlan = {
    ...saved,
    must: saved.must.filter(keep),
    focus: saved.focus.filter(keep),
    optional: saved.optional.filter(keep),
  };
  const planned = new Set([...plan.must, ...plan.focus, ...plan.optional].map((entry) => entry.id));
  const added = base.must.filter((entry) => !planned.has(entry.id));
  if (added.length > 0) plan.must = [...plan.must, ...added.map((entry) => ({ ...entry, reason: `Neu: ${entry.reason}` }))];
  return plan;
}

// Approximate start times: from the start of the day, with the break at
// noon and the unplanned share spread between the blocks.
export function timeBlocks(plan: DayPlan, settings: Settings, capacity: { total: number }) {
  const entries = [...plan.must, ...plan.focus];
  const planned = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const gap = entries.length > 0 ? Math.min(30, Math.max(0, (capacity.total - planned) / entries.length)) : 0;
  const [hours, mins] = settings.startTime.split(":").map(Number);
  let clock = hours * 60 + mins;
  let hadBreak = false;
  const result = new Map<string, string>();
  for (const entry of entries) {
    if (!hadBreak && clock >= 12 * 60) {
      clock += settings.breakMinutes;
      hadBreak = true;
    }
    result.set(entry.id, `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(Math.round(clock % 60)).padStart(2, "0")}`);
    clock += entry.minutes + gap;
  }
  return result;
}
