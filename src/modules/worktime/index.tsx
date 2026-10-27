import { CalendarXIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/server";
import type { ModulePageProps } from "@/modules/registry";
import { saveSettings } from "./actions";
import { CalendarToggle } from "./calendar-toggle";
import {
  addDays,
  blockDays,
  blockState,
  buildContext,
  christmasModes,
  daysBetween,
  holidayStates,
  dayInfo,
  defaultSettings,
  firstCountedDay,
  formatDate,
  formatDays,
  formatHours,
  formatRange,
  formatTime,
  formatShortDate,
  isDate,
  mondayOf,
  overtimeBalance,
  periodOn,
  plannedOvertimeUse,
  standardTimes,
  todayInGermany,
  vacationYear,
  type ChristmasMode,
  type HolidayState,
  type DayEntry,
  type DayKind,
  type Period,
  type Settings,
  type VacationBlock,
} from "./calc";
import { MonthCalendar, type CalendarDay } from "./month-calendar";
import { PeriodDialog } from "./period-dialog";
import { VacationDialog } from "./vacation-dialog";

const PATH = "/m/worktime";

export default async function WorktimeModule({ user, hasAccess, searchParams }: ModulePageProps) {
  if (!user || !hasAccess) notFound();

  const params = await searchParams;
  const param = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);

  const supabase = await createClient();
  const [{ data: settingsRow }, { data: periodRows }, { data: dayRows }, { data: vacationRows }] = await Promise.all([
    supabase.from("worktime_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("worktime_periods")
      .select("id, valid_from, label, weekday_minutes, vacation_days_per_month")
      .order("valid_from"),
    supabase.from("worktime_days").select("day, kind, start_minute, end_minute, break_minutes"),
    supabase
      .from("worktime_vacations")
      .select("id, start_date, end_date, note, in_calendar, from_overtime")
      .order("start_date"),
  ]);

  const settings: Settings = settingsRow
    ? {
        employer: settingsRow.employer,
        openingBalance: settingsRow.opening_balance_minutes,
        openingDate: settingsRow.opening_date,
        defaultStart: settingsRow.default_start_minute,
        defaultBreak: settingsRow.default_break_minutes,
        christmasMode: settingsRow.christmas_mode as ChristmasMode,
        holidayState: (settingsRow.holiday_state ?? "BW") as HolidayState,
      }
    : defaultSettings;
  const periods: Period[] = (periodRows ?? []).map((row) => ({
    id: row.id,
    validFrom: row.valid_from,
    label: row.label,
    weekdayMinutes: row.weekday_minutes,
    vacationPerMonth: Number(row.vacation_days_per_month),
  }));
  const entries: DayEntry[] = (dayRows ?? []).map((row) => ({
    day: row.day,
    kind: row.kind as DayKind,
    start: row.start_minute,
    end: row.end_minute,
    breakMinutes: row.break_minutes,
  }));
  const vacations: VacationBlock[] = (vacationRows ?? []).map((row) => ({
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    note: row.note,
    inCalendar: row.in_calendar,
    fromOvertime: row.from_overtime ?? false,
  }));

  return (
    <WorktimeView
      settings={settings}
      periods={periods}
      entries={entries}
      vacations={vacations}
      today={todayInGermany()}
      month={param("month")}
      year={param("year")}
    />
  );
}

type ViewProps = {
  settings: Settings;
  periods: Period[];
  entries: DayEntry[];
  vacations: VacationBlock[];
  today: string;
  // Query parameters: the shown month (YYYY-MM) and vacation year.
  month?: string;
  year?: string;
};

export function WorktimeView({ settings, periods, entries, vacations, today, month: monthParam, year: yearValue }: ViewProps) {
  const context = buildContext(periods, settings, entries, vacations);

  if (periods.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>Leg dein Arbeitszeitmodell an</h2>
            </CardTitle>
            <CardDescription>
              Wie viele Stunden du an welchem Wochentag arbeitest und wie viele Urlaubstage du pro Monat bekommst. Wenn
              sich das ändert, legst du später einfach ein neues Modell ab dem Stichtag an.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PeriodDialog defaultFrom={`${today.slice(0, 4)}-01-01`} />
          </CardContent>
        </Card>
        <SettingsCard settings={settings} />
      </div>
    );
  }

  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) && isDate(`${monthParam}-01`) ? monthParam : today.slice(0, 7);
  const monthStart = `${month}-01`;
  const nextMonthStart = firstOfNextMonth(monthStart);
  const previousMonth = addDays(monthStart, -1).slice(0, 7);
  const yearParam = Number(yearValue);
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : Number(today.slice(0, 4));
  const href = (changes: { month?: string; year?: number }) => {
    const query = new URLSearchParams();
    const nextMonth = changes.month ?? (monthParam ? month : undefined);
    const nextYear = changes.year ?? (yearValue ? year : undefined);
    if (nextMonth && nextMonth !== today.slice(0, 7)) query.set("month", nextMonth);
    if (nextYear && nextYear !== Number(today.slice(0, 4))) query.set("year", String(nextYear));
    const search = query.toString();
    return search ? `${PATH}?${search}` : PATH;
  };

  const balance = overtimeBalance(context, today);
  const plannedUse = plannedOvertimeUse(context, today);
  const firstDay = firstCountedDay(context);
  const gridStart = mondayOf(monthStart);
  const gridDays = daysBetween(gridStart, addDays(mondayOf(addDays(nextMonthStart, -1)), 7));
  const calendarDays: CalendarDay[] = Array.from({ length: gridDays }, (_, index) => {
    const info = dayInfo(addDays(gridStart, index), context);
    return {
      info,
      standard: standardTimes(info.target, settings),
      counted: info.date <= today && (!firstDay || info.date >= firstDay),
      inMonth: info.date.startsWith(month),
    };
  });
  const monthDays = calendarDays.filter((day) => day.inMonth).map((day) => day.info);
  const monthTarget = monthDays.reduce((sum, day) => sum + day.target, 0);
  const monthActual = monthDays.reduce((sum, day) => sum + day.actual, 0);
  const initialDate = today.startsWith(month)
    ? today
    : (monthDays.find((day) => day.target > 0) ?? monthDays[0]).date;
  const thisWeek = Array.from({ length: 7 }, (_, index) => dayInfo(addDays(mondayOf(today), index), context)).filter(
    (day) => day.date <= today && (!firstDay || day.date >= firstDay),
  );
  const thisWeekDelta = thisWeek.reduce((sum, day) => sum + day.actual - day.target, 0);

  const currentYear = Number(today.slice(0, 4));
  const vacationNow = vacationYear(currentYear, context, today);
  const vacation = year === currentYear ? vacationNow : vacationYear(year, context, today);
  const yearBlocks = vacations.filter(
    (block) => block.startDate <= `${year}-12-31` && block.endDate >= `${year}-01-01`,
  );
  const notInCalendar = vacations.filter((block) => !block.inCalendar && block.endDate >= today);
  const currentPeriod = periodOn(context.periods, today) ?? context.periods[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section
            aria-label="Überstunden"
            className="flex flex-col gap-3 rounded-xl bg-hero p-5 text-hero-foreground sm:p-6"
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-hero-muted">
                Überstunden{settings.employer && ` · ${settings.employer}`}
              </span>
              <span className="shrink-0 font-mono text-hero-bar">
                {formatHours(thisWeekDelta, { signed: true })} Woche
              </span>
            </div>
            <div className="font-mono text-5xl leading-none font-medium tracking-tighter">
              {formatHours(balance, { signed: true })}
            </div>
            {plannedUse > 0 && (
              <p className="text-sm text-hero-muted">
                Nach Planung{" "}
                <span className="font-mono text-hero-foreground">
                  {formatHours(balance - plannedUse, { signed: true })}
                </span>
              </p>
            )}
          </section>

          <MonthCalendar
            key={month}
            days={calendarDays}
            initialDate={initialDate}
            today={today}
            header={
              <>
                <CardTitle className="text-lg">
                  <h2>{monthName(monthStart)}</h2>
                </CardTitle>
                <CardAction className="flex gap-1">
                  <Button asChild variant="ghost" size="icon" aria-label="Vorheriger Monat">
                    <Link href={href({ month: previousMonth })}>
                      <ChevronLeftIcon />
                    </Link>
                  </Button>
                  {month !== today.slice(0, 7) && (
                    <Button asChild variant="ghost" size="sm" className="h-9">
                      <Link href={href({ month: today.slice(0, 7) })}>Heute</Link>
                    </Button>
                  )}
                  <Button asChild variant="ghost" size="icon" aria-label="Nächster Monat">
                    <Link href={href({ month: nextMonthStart.slice(0, 7) })}>
                      <ChevronRightIcon />
                    </Link>
                  </Button>
                </CardAction>
              </>
            }
            summary={
              <dl className="grid grid-cols-3 gap-2 border-t px-1 pt-4 text-sm sm:px-0">
                <div>
                  <dt className="text-muted-foreground">Ist</dt>
                  <dd className="font-mono font-medium">{formatHours(monthActual)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Soll</dt>
                  <dd className="font-mono font-medium">{formatHours(monthTarget)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Differenz</dt>
                  <dd className={`font-mono font-medium ${deltaClass(monthActual - monthTarget)}`}>
                    {formatHours(monthActual - monthTarget, { signed: true })}
                  </dd>
                </div>
              </dl>
            }
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>Urlaub {year}</h2>
            </CardTitle>
            <CardAction className="flex gap-1">
              <Button asChild variant="ghost" size="icon" aria-label="Vorheriges Jahr">
                <Link href={href({ year: year - 1 })}>
                  <ChevronLeftIcon />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" aria-label="Nächstes Jahr">
                <Link href={href({ year: year + 1 })}>
                  <ChevronRightIcon />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5">
            <VacationBar vacation={vacation} />

            {notInCalendar.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-bad px-3 py-2.5 text-sm text-bad-foreground">
                <CalendarXIcon className="mt-0.5 size-4 shrink-0" />
                {notInCalendar.length === 1 ? "1 Urlaub" : `${notInCalendar.length} Urlaube`} noch nicht im Kalender
              </p>
            )}

            {yearBlocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kein Urlaub in {year}.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {yearBlocks.map((block) => {
                  const state = blockState(block, today);
                  const used = blockDays(block, context);
                  return (
                    <li key={block.id} className="flex items-center gap-3 py-2.5">
                      <CalendarToggle
                        id={block.id}
                        inCalendar={block.inCalendar}
                        label={`${formatRange(block.startDate, block.endDate)} im Kalender eingetragen`}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium whitespace-nowrap">
                          {formatShortDate(block.startDate)}
                          {block.endDate !== block.startDate && ` – ${formatShortDate(block.endDate)}`}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {block.fromOvertime
                            ? `${formatHours(-used.minutes, { signed: true })}`
                            : `${formatDays(used.days)} ${used.days === 1 ? "Tag" : "Tage"}`}
                          {` · ${state === "taken" ? "genommen" : state === "running" ? "läuft" : "geplant"}`}
                          {block.note && ` · ${block.note}`}
                        </span>
                        {!block.inCalendar && state !== "taken" && (
                          <span className="text-xs text-debt">nicht im Kalender</span>
                        )}
                      </span>
                      <VacationDialog
                        key={JSON.stringify(block)}
                        vacation={block}
                        today={today}
                        periods={context.periods}
                        settings={settings}
                        entries={entries}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
            <VacationDialog
              today={year === currentYear ? today : `${year}-01-01`}
              periods={context.periods}
              settings={settings}
              entries={entries}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>Arbeitszeitmodelle</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="flex flex-col divide-y">
              {[...context.periods].reverse().map((period) => (
                <li
                  key={period.id}
                  className={`flex items-center gap-3 py-2.5 ${period === currentPeriod ? "" : "text-muted-foreground"}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {period.label || "Ohne Namen"}
                      {period === currentPeriod && <span className="font-normal text-muted-foreground"> · aktuell</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ab {formatDate(period.validFrom)} ·{" "}
                      {formatHours(period.weekdayMinutes.reduce((sum, minutes) => sum + minutes, 0))}/Woche ·{" "}
                      {formatDays(period.vacationPerMonth)} Urlaub/Monat
                    </span>
                  </span>
                  <PeriodDialog
                    key={JSON.stringify(period)}
                    period={period}
                    defaultFrom={period.validFrom}
                    canDelete={context.periods.length > 1}
                  />
                </li>
              ))}
            </ul>
            <PeriodDialog defaultFrom={firstOfNextMonth(today)} />
          </CardContent>
        </Card>

        <SettingsCard settings={settings} />
      </div>
    </div>
  );
}

function deltaClass(minutes: number) {
  if (minutes > 0) return "text-good-foreground dark:text-brand";
  if (minutes < 0) return "text-debt";
  return "";
}

function VacationBar({ vacation }: { vacation: ReturnType<typeof vacationYear> }) {
  const total = vacation.entitlement + vacation.carryOver;
  const scale = Math.max(total, vacation.taken + vacation.planned);
  const parts = [
    { label: "Genommen", value: vacation.taken, color: "var(--chart-1)" },
    { label: "Geplant", value: vacation.planned, color: "var(--chart-2)" },
    { label: "Übrig", value: Math.max(0, vacation.left), color: "var(--muted)" },
  ];

  return (
    <div className="space-y-3">
      {scale > 0 && (
        <div
          role="img"
          aria-label={parts.map((part) => `${part.label} ${formatDays(part.value)}`).join(", ")}
          className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted"
        >
          {parts.map((part) =>
            part.value > 0 ? <div key={part.label} style={{ flex: part.value, background: part.color }} /> : null,
          )}
        </div>
      )}
      <dl className="flex justify-between gap-2">
        <div className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">Anspruch</dt>
          <dd className="font-mono font-medium">{formatDays(total)}</dd>
        </div>
        {parts.map((part) => (
          <div key={part.label} className="min-w-0">
            <dt className="truncate border-l-2 pl-1.5 text-xs text-muted-foreground" style={{ borderColor: part.color }}>
              {part.label}
            </dt>
            <dd className={`font-mono font-medium ${part.label === "Übrig" && vacation.left < 0 ? "text-debt" : ""}`}>
              {part.label === "Übrig" ? formatDays(vacation.left) : formatDays(part.value)}
            </dd>
          </div>
        ))}
      </dl>
      {vacation.carryOver !== 0 && (
        <p className="text-[13px] text-muted-foreground">
          Inkl. {formatDays(vacation.carryOver)} Resturlaub aus dem Vorjahr.
        </p>
      )}
    </div>
  );
}

function SettingsCard({ settings }: { settings: Settings }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          <h2>Einstellungen</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveSettings} className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] items-end gap-4">
          <Field id="setting-employer" label="Arbeitgeber">
            <Input
 id="setting-employer" name="employer" maxLength={60} defaultValue={settings.employer ?? ""} className="h-11" />
          </Field>
          <Field id="setting-defaultStart" label="Standard-Beginn">
            <Input
              id="setting-defaultStart"
              type="time"
              step={900}
              name="defaultStart"
              required
              defaultValue={formatTime(settings.defaultStart).padStart(5, "0")}
              className="h-11 font-mono"
            />
          </Field>
          <Field id="setting-defaultBreak" label="Standard-Pause (min)">
            <Input
              id="setting-defaultBreak"
              type="number"
              name="defaultBreak"
              min={0}
              max={240}
              step={15}
              required
              defaultValue={settings.defaultBreak}
              className="h-11 font-mono"
            />
          </Field>
          <Field id="setting-holidayState" label="Feiertage">
            <Select name="holidayState" defaultValue={settings.holidayState}>
              <SelectTrigger id="setting-holidayState" className="h-11! w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {holidayStates.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="setting-christmasMode" label="24. und 31.12.">
            <Select name="christmasMode" defaultValue={settings.christmasMode}>
              <SelectTrigger id="setting-christmasMode" className="h-11! w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {christmasModes.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="setting-openingBalance" label="Überstunden-Startwert (h)">
            <Input
              id="setting-openingBalance"
              name="openingBalance"
              inputMode="decimal"
              required
              defaultValue={String(settings.openingBalance / 60).replace(".", ",")}
              className="h-11 font-mono"
            />
          </Field>
          <Field id="setting-openingDate" label="Startwert gilt bis einschl.">
            <Input
              id="setting-openingDate"
              type="date"
              name="openingDate"
              defaultValue={settings.openingDate ?? ""}
              className="h-11 font-mono"
            />
          </Field>
          <div className="col-span-full">
            <SubmitButton variant="brand" size="lg">
              Einstellungen speichern
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function monthName(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
}

function firstOfNextMonth(today: string) {
  const [year, month] = today.split("-").map(Number);
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}
