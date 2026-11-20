"use client";

import { CheckIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useViewNavigate } from "@/lib/query/view-link";
import { yearReview } from "./wrapped";
import { WrappedBanner } from "./wrapped-story";
import { ViewLink as Link } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import { useSportData } from "./store";
import {
  addDays,
  average,
  easyPercent,
  feed,
  formatDate,
  formatKm,
  formatMinutes,
  formatNumber,
  formatSleep,
  formatTonnes,
  gymWeeks,
  isoWeek,
  lastWeeks,
  mondayOf,
  readiness,
  runWeeks,
  series,
  trainingDays,
  WEEKDAYS,
  weekday,
} from "./calc";
import { Sparkline } from "./charts";
import { runLoad, streaks } from "./analytics";
import { planFromSettings, planWeekOf, plannedDay } from "./plan";
import { kindColor, Panel, Stat } from "./ui";

export function OverviewTab({ today }: { today: string }) {
  const data = useSportData();
  const ready = readiness(data.health, today);
  const monday = mondayOf(today);
  const fullPlan = planFromSettings(data.settings);
  const planStart = fullPlan[0].start;
  const plan = planWeekOf(fullPlan, today);
  const days = trainingDays(data.activities, data.workouts);
  const todayPlan = plannedDay(weekday(today), plan);

  const [thisRun] = runWeeks(data.runs, [monday]);
  const [thisGym] = gymWeeks(data.exercises, data.workouts, [monday]);
  const weeks12 = lastWeeks(today, 12);
  const runs12 = runWeeks(data.runs, weeks12);
  const gym12 = gymWeeks(data.exercises, data.workouts, weeks12);
  const from12 = weeks12[0];
  const rhrDaily = series(data.health, from12, today, (day) => day.restingHr);
  const rhrWeekly = weeks12.map((week) => average(rhrDaily.filter((point) => mondayOf(point.day) === week).map((point) => point.value)));
  const recentRuns = runs12.slice(-4);

  const weekDays = WEEKDAYS.map((label, index) => {
    const day = addDays(monday, index);
    const done = days.get(day);
    const planned = plannedDay(index, plan);
    return { label, day, done, planned, isToday: day === today, future: day > today };
  });
  const doneSessions = weekDays.filter((entry) => entry.done).length;
  const plannedSessions = plan ? weekDays.filter((entry) => entry.planned.kind !== "free").length : null;
  const lastSync = data.syncRuns[0];
  const load = runLoad(data.runs, today);
  const gymByWeek = new Map<string, number>();
  for (const workout of data.workouts) gymByWeek.set(mondayOf(workout.day), (gymByWeek.get(mondayOf(workout.day)) ?? 0) + 1);
  const runsByWeek = new Map<string, number>();
  for (const run of data.runs) runsByWeek.set(mondayOf(run.day), (runsByWeek.get(mondayOf(run.day)) ?? 0) + 1);
  const streak = streaks(data, today, gymByWeek, runsByWeek, fullPlan);
  const lastWeight = data.weight.at(-1);
  const firstWeight = data.weight[0];

  return (
    <div className="space-y-4">
      <ReviewBanner today={today} />
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl bg-hero p-5 text-hero-foreground">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Heute</h2>
            <span className="text-sm text-hero-muted">
              {plan ? `Plan: ${todayPlan.label}` : today < planStart ? `Plan startet am ${formatDate(planStart)}` : "Plan beendet"}
            </span>
          </div>
          <p className="text-xl font-semibold text-balance">{ready.headline}</p>
          {ready.detail && <p className="text-sm text-hero-muted">{ready.detail}.</p>}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              hero
              label="HRV letzte Nacht"
              value={ready.hrv ? `${ready.hrv.value} ms` : "–"}
              sub={ready.hrv?.entry.hrvLow && ready.hrv.entry.hrvHigh ? `Bereich ${ready.hrv.entry.hrvLow}–${ready.hrv.entry.hrvHigh}` : undefined}
            />
            <Stat hero label="Ruhepuls" value={ready.rhr ? `${ready.rhr.value} bpm` : "–"} sub={ready.monthRhr ? `Schnitt ${formatNumber(ready.monthRhr)}` : undefined} />
            <Stat
              hero
              label="Schlaf"
              value={ready.sleep ? formatSleep(ready.sleep.value) : "–"}
              sub={ready.sleep?.entry.sleepScore ? `Score ${ready.sleep.entry.sleepScore}` : undefined}
            />
          </div>
        </section>

        <Panel
          title={plan ? `Diese Woche · Plan-Woche ${plan.number}` : `Diese Woche · KW ${isoWeek(today)}`}
          aside={
            <span className="text-sm text-muted-foreground">
              {plannedSessions ? `${doneSessions} von ${plannedSessions} Einheiten` : `${doneSessions} Trainingstage`}
            </span>
          }
        >
          <ol className="grid grid-cols-7 gap-1.5">
            {weekDays.map((entry) => {
              const kind = entry.done ? (entry.done.run ? "run" : entry.done.gym ? "gym" : "other") : null;
              return (
                <li
                  key={entry.day}
                  className={cn("flex flex-col items-center gap-1.5 rounded-lg border px-0.5 py-2", entry.isToday && "border-brand bg-good")}
                >
                  <span className="text-xs font-semibold text-muted-foreground">{entry.label}</span>
                  <span
                    className={cn("flex size-7 items-center justify-center rounded-full text-white", kind ? kindColor[kind] : "bg-muted")}
                    title={entry.done?.labels.join(", ")}
                  >
                    {kind && <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden="true" />}
                    <span className="sr-only">{entry.done ? `erledigt: ${entry.done.labels.join(", ")}` : entry.future ? "noch offen" : "nichts"}</span>
                  </span>
                  <span className="text-center text-[11px] leading-tight">
                    {plan ? entry.planned.label : (entry.done?.labels.join(", ") ?? "–")}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Laufen</span>
              <br />
              <strong className="text-lg tabular-nums">
                {thisRun.runs ? `${formatKm(thisRun.km)} · ${formatMinutes(thisRun.minutes)}` : "–"}
              </strong>
            </div>
            <div>
              <span className="text-muted-foreground">Zone 1</span>
              <br />
              <strong className="text-lg tabular-nums">{thisRun.runs && easyPercent([thisRun]) != null ? `${formatNumber(easyPercent([thisRun])!)} %` : "–"}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Gym-Volumen</span>
              <br />
              <strong className="text-lg tabular-nums">{thisGym.volumeKg ? formatTonnes(thisGym.volumeKg) : "–"}</strong>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/m/sport?tab=laufen" className={cn("flex min-w-0 flex-col gap-0.5 rounded-xl border p-4", load.level === "spike" || load.level === "high" ? "border-debt bg-bad" : "bg-card")}>
          <span className="text-xs text-muted-foreground">Belastung Laufen</span>
          <span className="font-semibold">{load.label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatMinutes(load.acute)} in 7 Tagen{load.ratio != null ? ` · ${formatNumber(load.ratio * 100)} % vom Schnitt` : ""}
          </span>
        </Link>
        <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">Serien</span>
          <span className="text-sm">
            <strong className="tabular-nums">{streak.gym}</strong> Wo. Gym-Ziel · <strong className="tabular-nums">{streak.runs}</strong> Wo. Läufe
          </span>
          <span className="text-sm">
            <strong className="tabular-nums">{streak.sleep}</strong> Nächte im Schlafbereich · <strong className="tabular-nums">{streak.steps}</strong> Tage Schritte
          </span>
        </div>
        <Link href="/m/sport?tab=erholung" className="flex min-w-0 flex-col gap-0.5 rounded-xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">Gewicht</span>
          <span className="text-xl font-bold tabular-nums">{lastWeight ? `${String(lastWeight.kg).replace(".", ",")} kg` : "–"}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {lastWeight && firstWeight && lastWeight !== firstWeight
              ? `${lastWeight.kg - firstWeight.kg > 0 ? "+" : ""}${String(Math.round((lastWeight.kg - firstWeight.kg) * 10) / 10).replace(".", ",")} kg seit ${formatDate(firstWeight.day)}`
              : lastWeight
                ? formatDate(lastWeight.day)
                : "aus der Gewicht-Challenge"}
          </span>
        </Link>
        <Link href="/m/sport?tab=erholung" className="flex min-w-0 flex-col gap-0.5 rounded-xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">Schritte heute</span>
          <span className="text-xl font-bold tabular-nums">{formatNumber(data.health.at(-1)?.day === today ? (data.health.at(-1)?.steps ?? 0) : 0)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">Ziel {formatNumber(data.settings.stepsGoal ?? data.health.at(-1)?.stepsGoal ?? 7000)}</span>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          href="/m/sport?tab=laufen"
          title="Laufkilometer"
          value={formatKm(recentRuns.reduce((sum, week) => sum + week.km, 0) / 4)}
          sub="pro Woche, Schnitt 4 Wochen"
          values={runs12.map((week) => week.km)}
        />
        <Tile
          href="/m/sport?tab=laufen"
          title="Zone 1"
          value={easyPercent(recentRuns) != null ? `${formatNumber(easyPercent(recentRuns)!)} %` : "–"}
          sub="der Laufzeit, letzte 4 Wochen"
          values={runs12.map((week) => (week.easyMinutes + week.hardMinutes > 0 ? easyPercent([week]) : null))}
        />
        <Tile
          href="/m/sport?tab=erholung"
          title="Ruhepuls"
          value={rhrWeekly.at(-1) != null ? `${formatNumber(rhrWeekly.at(-1)!)} bpm` : "–"}
          sub="Schnitt dieser Woche"
          values={rhrWeekly}
          className="stroke-chart-2"
        />
        <Tile
          href="/m/sport?tab=gym"
          title="Gym-Volumen"
          value={formatTonnes(gym12.slice(-4).reduce((sum, week) => sum + week.volumeKg, 0) / 4)}
          sub="pro Woche, Schnitt 4 Wochen"
          values={gym12.map((week) => week.volumeKg)}
          className="stroke-debt"
        />
      </div>

      <Panel title="Letzte Einheiten">
        <ul className="divide-y">
          {feed(data, 6).map((item) => (
            <li key={item.key} className="flex items-baseline gap-3 py-2.5">
              <span className={cn("size-2.5 flex-none translate-y-[-1px] rounded-full", kindColor[item.kind])} aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <span className="truncate">{item.title}</span>
                <span className="text-sm text-muted-foreground tabular-nums sm:text-right">{item.meta}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      {lastSync && <SyncLog runs={data.syncRuns} />}
    </div>
  );
}

function Tile({ href, title, value, sub, values, className }: { href: string; title: string; value: string; sub: string; values: (number | null)[]; className?: string }) {
  return (
    <Link href={href} className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">12 Wochen</span>
      </span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <Sparkline values={values} className={className} />
      <span className="text-xs text-muted-foreground">{sub}</span>
    </Link>
  );
}

function SyncLog({ runs }: { runs: { startedAt: string; ok: boolean | null; errors: Record<string, string> | null }[] }) {
  const time = (value: string) => new Date(value).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" });
  const last = runs[0];
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="flex min-h-11 cursor-pointer items-center">
        Zuletzt synchronisiert {time(last.startedAt)}
        {last.ok === false ? " · mit Fehlern" : ""} · Garmin und Hevy, alle 6 Stunden
      </summary>
      <ul className="space-y-1 pb-2">
        {runs.map((run) => (
          <li key={run.startedAt}>
            {time(run.startedAt)} · {run.ok === null ? "läuft" : run.ok ? "ok" : "Fehler"}
            {run.errors && Object.keys(run.errors).length > 0 && (
              <span className="block break-words">{Object.entries(run.errors).map(([key, value]) => `${key}: ${value}`).join(" · ")}</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

// From 1 December (and until 15 January for the year before) the year review
// is offered at the top; "Später" hides it on this device.
const DISMISS_KEY = "sport-review-dismissed";
const listeners = new Set<() => void>();
const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) ?? "";
  } catch {
    return "";
  }
};

function ReviewBanner({ today }: { today: string }) {
  const data = useSportData();
  const navigate = useViewNavigate();
  const dismissed = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readDismissed,
    () => "server",
  );
  const month = Number(today.slice(5, 7));
  const year = month === 12 ? Number(today.slice(0, 4)) : month === 1 && Number(today.slice(8, 10)) <= 15 ? Number(today.slice(0, 4)) - 1 : null;
  if (!year || dismissed === "server" || dismissed === String(year)) return null;
  const review = yearReview(data, year, today);
  if (review.activeDays === 0) return null;
  return (
    <WrappedBanner
      review={review}
      onOpen={() => navigate(`/m/sport?rueckblick=${year}`, { scroll: false })}
      onLater={() => {
        try {
          localStorage.setItem(DISMISS_KEY, String(year));
        } catch {
          // storage blocked: the banner stays
        }
        listeners.forEach((listener) => listener());
      }}
    />
  );
}
