import { CalendarXIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
  dayInfo,
  defaultSettings,
  firstCountedDay,
  formatBreak,
  formatDate,
  formatDay,
  formatDays,
  formatHours,
  formatRange,
  formatTime,
  isDate,
  mondayOf,
  overtimeBalance,
  periodOn,
  standardTimes,
  todayInGermany,
  vacationYear,
  weekday,
  type ChristmasMode,
  type Context,
  type DayEntry,
  type DayInfo,
  type DayKind,
  type Period,
  type Settings,
  type VacationBlock,
} from "./calc";
import { DayDialog } from "./day-dialog";
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
    supabase.from("worktime_vacations").select("id, start_date, end_date, note, in_calendar").order("start_date"),
  ]);

  const settings: Settings = settingsRow
    ? {
        employer: settingsRow.employer,
        openingBalance: settingsRow.opening_balance_minutes,
        openingDate: settingsRow.opening_date,
        defaultStart: settingsRow.default_start_minute,
        defaultBreak: settingsRow.default_break_minutes,
        christmasMode: settingsRow.christmas_mode as ChristmasMode,
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
  }));

  const today = todayInGermany();
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

  const weekParam = param("week");
  const monday = mondayOf(weekParam && isDate(weekParam) ? weekParam : today);
  const yearParam = Number(param("year"));
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : Number(today.slice(0, 4));
  const href = (changes: { week?: string; year?: number }) => {
    const query = new URLSearchParams();
    const week = changes.week ?? (weekParam ? monday : undefined);
    const nextYear = changes.year ?? (param("year") ? year : undefined);
    if (week && week !== mondayOf(today)) query.set("week", week);
    if (nextYear && nextYear !== Number(today.slice(0, 4))) query.set("year", String(nextYear));
    const search = query.toString();
    return search ? `${PATH}?${search}` : PATH;
  };

  const balance = overtimeBalance(context, today);
  const firstDay = firstCountedDay(context);
  const week = Array.from({ length: 7 }, (_, index) => dayInfo(addDays(monday, index), context));
  const weekTarget = week.reduce((sum, day) => sum + day.target, 0);
  const weekActual = week.reduce((sum, day) => sum + day.actual, 0);
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
  const nextBlock = vacations.find((block) => block.endDate >= today);
  const notInCalendar = vacations.filter((block) => !block.inCalendar && block.endDate >= today);
  const currentPeriod = periodOn(context.periods, today) ?? context.periods[0];
  const weeklyHours = currentPeriod.weekdayMinutes.reduce((sum, minutes) => sum + minutes, 0);

  return (
    <div className="space-y-6">
      <section aria-label="Übersicht" className="flex flex-wrap items-stretch gap-4 sm:gap-6">
        <div className="flex min-w-0 flex-[999_1_420px] flex-col justify-between gap-5 rounded-xl bg-hero p-5 text-hero-foreground sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
            <span className="text-hero-muted">Überstunden{settings.employer && ` · ${settings.employer}`}</span>
            <span className="font-mono text-hero-bar">
              {formatHours(thisWeekDelta, { signed: true })} diese Woche
            </span>
          </div>
          <div className="font-mono text-5xl leading-none font-medium tracking-tighter sm:text-[64px]">
            {formatHours(balance, { signed: true })}
          </div>
          <p className="text-sm text-hero-muted">
            Stand heute
            {settings.openingDate &&
              `, ausgehend von ${formatHours(settings.openingBalance, { signed: true })} am ${formatDate(settings.openingDate)}`}
            . Tage ohne Eintrag zählen als Standardtag.
          </p>
        </div>

        <dl className="grid min-w-0 flex-[1_1_300px] grid-cols-2 gap-3">
          <Tile
            label="Urlaub übrig"
            value={`${formatDays(vacationNow.left)} Tage`}
            note={`${currentYear}, nach ${formatDays(vacationNow.planned)} geplanten`}
            tone={vacationNow.left < 0 ? "bad" : undefined}
          />
          <Tile
            label="Nächster Urlaub"
            value={nextBlock ? formatRange(nextBlock.startDate, nextBlock.endDate).replace(/\.\d{4}$/, ".") : "–"}
            note={
              nextBlock
                ? nextBlock.inCalendar
                  ? "im Kalender eingetragen"
                  : "noch nicht im Kalender"
                : "nichts geplant"
            }
            tone={nextBlock && !nextBlock.inCalendar ? "bad" : undefined}
          />
          <Tile
            label="Urlaub geplant"
            value={`${formatDays(vacationNow.planned)} Tage`}
            note={notInCalendar.length > 0 ? `${notInCalendar.length} nicht im Kalender` : "alles im Kalender"}
            tone={notInCalendar.length > 0 ? "bad" : undefined}
          />
          <Tile
            label="Soll pro Woche"
            value={formatHours(weeklyHours)}
            note={currentPeriod.label || `seit ${formatDate(currentPeriod.validFrom)}`}
          />
        </dl>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>
                Woche {formatDay(monday).slice(3)} – {formatDay(addDays(monday, 6)).slice(3)}
              </h2>
            </CardTitle>
            <CardDescription>Tippe auf einen Tag, um ihn zu ändern.</CardDescription>
            <CardAction className="flex gap-1">
              <Button asChild variant="ghost" size="icon" aria-label="Vorherige Woche">
                <Link href={href({ week: addDays(monday, -7) })}>
                  <ChevronLeftIcon />
                </Link>
              </Button>
              {monday !== mondayOf(today) && (
                <Button asChild variant="ghost" size="sm" className="h-9">
                  <Link href={href({ week: mondayOf(today) })}>Heute</Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="icon" aria-label="Nächste Woche">
                <Link href={href({ week: addDays(monday, 7) })}>
                  <ChevronRightIcon />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="-mx-2 flex flex-col">
              {week.map((day) => (
                <li key={day.date}>
                  <DayRow day={day} today={today} firstDay={firstDay} context={context} />
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-3 gap-2 border-t pt-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Ist</dt>
                <dd className="font-mono font-medium">{formatHours(weekActual)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Soll</dt>
                <dd className="font-mono font-medium">{formatHours(weekTarget)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Differenz</dt>
                <dd className={`font-mono font-medium ${deltaClass(weekActual - weekTarget)}`}>
                  {formatHours(weekActual - weekTarget, { signed: true })}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

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
                {notInCalendar.length === 1
                  ? "1 Urlaub ist noch nicht im Arbeitskalender eingetragen."
                  : `${notInCalendar.length} Urlaube sind noch nicht im Arbeitskalender eingetragen.`}
              </p>
            )}

            {yearBlocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kein Urlaub in {year}.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {yearBlocks.map((block) => {
                  const state = blockState(block, today);
                  return (
                    <li key={block.id} className="flex items-center gap-3 py-2.5">
                      <CalendarToggle
                        id={block.id}
                        inCalendar={block.inCalendar}
                        label={`${formatRange(block.startDate, block.endDate)} im Kalender eingetragen`}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">{formatRange(block.startDate, block.endDate)}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {formatDays(blockDays(block, context))}{" "}
                          {blockDays(block, context) === 1 ? "Tag" : "Tage"}
                          {block.note && ` · ${block.note}`}
                          {!block.inCalendar && state !== "taken" && (
                            <span className="text-bad-foreground"> · nicht im Kalender</span>
                          )}
                        </span>
                      </span>
                      <Badge variant={state === "taken" ? "secondary" : "outline"}>
                        {state === "taken" ? "Genommen" : state === "running" ? "Läuft" : "Geplant"}
                      </Badge>
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
            <p className="text-[13px] text-muted-foreground">
              Haken = im Arbeitskalender eingetragen. Vergangene Tage zählen als genommen, künftige als geplant.
            </p>
            <VacationDialog
              today={year === currentYear ? today : `${year}-01-01`}
              periods={context.periods}
              settings={settings}
              entries={entries}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>Arbeitszeitmodelle</h2>
            </CardTitle>
            <CardDescription>Ein Modell gilt ab seinem Datum, bis das nächste beginnt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="flex flex-col divide-y">
              {[...context.periods].reverse().map((period) => (
                <li
                  key={period.id}
                  className={`flex items-center gap-3 py-2.5 ${period === currentPeriod ? "" : "text-muted-foreground"}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">
                      ab {formatDate(period.validFrom)}
                      {period.label && ` · ${period.label}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatHours(period.weekdayMinutes.reduce((sum, minutes) => sum + minutes, 0))} pro Woche ·{" "}
                      {formatDays(period.vacationPerMonth)} Urlaubstage pro Monat
                    </span>
                  </span>
                  {period === currentPeriod && <Badge variant="secondary">Aktuell</Badge>}
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

function DayRow({ day, today, firstDay, context }: { day: DayInfo; today: string; firstDay: string | null; context: Context }) {
  const standard = standardTimes(day.target, context.settings);
  const weekend = weekday(day.date) >= 5;
  const counted = day.date <= today && (!firstDay || day.date >= firstDay);
  const delta = day.actual - day.target;
  const [label, detail] = describe(day, standard);

  return (
    <DayDialog
      key={JSON.stringify([day.entry, day.target])}
      date={day.date}
      title={formatDay(day.date)}
      note={day.status === "vacation" ? "Urlaub" : day.holiday ?? (day.target > 0 ? "Standardtag" : "Frei")}
      target={day.target}
      entry={day.entry}
      standard={standard}
    >
      <button
        type="button"
        className={`flex w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-muted ${weekend ? "py-1.5 text-sm" : "py-3"} ${
          day.date === today ? "bg-muted/60" : ""
        }`}
      >
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: statusColor[day.status] }} />
        <span className={`w-16 shrink-0 ${weekend ? "text-muted-foreground" : "font-medium"}`}>
          {formatDay(day.date)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`truncate ${day.status === "standard" || day.status === "free" ? "text-muted-foreground" : ""}`}>
            {label}
          </span>
          {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end font-mono text-sm">
          {(day.target > 0 || day.actual > 0) && <span>{formatHours(day.actual)}</span>}
          {(day.target > 0 || day.actual > 0) && delta !== 0 && (
            <span className={`text-xs ${counted ? deltaClass(delta) : "text-muted-foreground"}`}>
              {formatHours(delta, { signed: true })}
            </span>
          )}
        </span>
      </button>
    </DayDialog>
  );
}

const statusColor: Record<DayInfo["status"], string> = {
  standard: "var(--chart-3)",
  work: "var(--chart-1)",
  sick: "var(--chart-5)",
  overtime_off: "var(--chart-4)",
  vacation: "var(--chart-2)",
  holiday: "var(--chart-2)",
  free: "transparent",
};

function describe(day: DayInfo, standard: { start: number; end: number; breakMinutes: number }): [string, string | null] {
  switch (day.status) {
    case "work": {
      const entry = day.entry!;
      return [`${formatTime(entry.start ?? 0)} – ${formatTime(entry.end ?? 0)}`, formatBreak(entry.breakMinutes)];
    }
    case "standard":
      return [`${formatTime(standard.start)} – ${formatTime(standard.end)}`, `Standard · ${formatBreak(standard.breakMinutes)}`];
    case "vacation":
      return ["Urlaub", day.vacation?.note ?? null];
    case "holiday":
      return [day.holiday ?? "Feiertag", "Feiertag"];
    case "sick":
      return ["Krank", null];
    case "overtime_off":
      return ["Überstundenabbau", null];
    case "free":
      return [day.holiday ?? "Frei", null];
  }
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
      <dl className="grid grid-cols-4 gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Anspruch</dt>
          <dd className="font-mono font-medium">{formatDays(total)}</dd>
        </div>
        {parts.map((part) => (
          <div key={part.label}>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden="true" className="size-2 rounded-full border" style={{ background: part.color }} />
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
          {formatDays(vacation.entitlement)} Tage Anspruch + {formatDays(vacation.carryOver)} Resturlaub aus dem Vorjahr.
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
          <p className="col-span-full text-[13px] text-muted-foreground">
            Ohne Datum zählen alle Tage ab dem ersten Arbeitszeitmodell. Feiertage: Baden-Württemberg. Die Pause gilt
            für Standardtage über 6 Stunden.
          </p>
          <div className="col-span-full">
            <Button variant="brand" size="lg">
              Einstellungen speichern
            </Button>
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

function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "bad" }) {
  return (
    <Card className="min-w-0 gap-1.5 p-4 sm:p-[18px]">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className={`font-mono text-lg font-medium break-words sm:text-[22px] ${tone === "bad" ? "text-debt" : ""}`}>
        {value}
      </dd>
      <dd className="text-xs text-muted-foreground">{note}</dd>
    </Card>
  );
}

function firstOfNextMonth(today: string) {
  const [year, month] = today.split("-").map(Number);
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}
