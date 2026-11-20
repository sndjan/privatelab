"use client";

import { ActivityIcon, CheckIcon, DumbbellIcon, FootprintsIcon, GaugeIcon, HeartPulseIcon, ScaleIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { ViewLink as Link, useViewNavigate } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import { runLoad, streaks } from "./analytics";
import {
  addDays,
  feed,
  formatDate,
  formatMinutes,
  formatNumber,
  formatSleep,
  isoWeek,
  mondayOf,
  recoveryScore,
  sessionBlocks,
  sessionMinutes,
  trainingDays,
  WEEKDAYS,
  weekday,
} from "./calc";
import { planFromSettings, planWeekOf, plannedDay, routine } from "./plan";
import { useSportData } from "./store";
import { kindColor, ListRow, Panel, Rings, SessionBar } from "./ui";
import { yearReview } from "./wrapped";
import { WrappedBanner } from "./wrapped-story";

const de1 = (value: number) => String(Math.round(value * 10) / 10).replace(".", ",");

export function OverviewTab({ today }: { today: string }) {
  const data = useSportData();
  const settings = data.settings;
  const ready = recoveryScore(data.health, today, settings.sleepGoalH);
  const monday = mondayOf(today);
  const fullPlan = planFromSettings(settings);
  const plan = planWeekOf(fullPlan, today);
  const days = trainingDays(data.activities, data.workouts);

  const weekDays = WEEKDAYS.map((label, index) => {
    const day = addDays(monday, index);
    const done = days.get(day);
    const planned = plannedDay(index, plan);
    return { label, day, done, planned, isToday: day === today, future: day > today };
  });
  const doneSessions = weekDays.filter((entry) => entry.done).length;
  const plannedSessions = plan ? weekDays.filter((entry) => entry.planned.kind !== "free").length : null;
  const weekGoal = plannedSessions ?? settings.gymPerWeek + 2;

  // Last night's sleep only counts when it is from last night.
  const sleepRecent = ready.sleep && ready.sleep.entry.day >= addDays(today, -1) ? ready.sleep : null;
  const sleepRatio = sleepRecent ? sleepRecent.value / 3600 / settings.sleepGoalH : null;
  const score = ready.score;
  const verdict = score == null ? "keine Werte" : score >= 67 ? "bereit" : score >= 40 ? "mittel" : "erholen";

  const load = runLoad(data.runs, today);
  const gymByWeek = new Map<string, number>();
  for (const workout of data.workouts) gymByWeek.set(mondayOf(workout.day), (gymByWeek.get(mondayOf(workout.day)) ?? 0) + 1);
  const runsByWeek = new Map<string, number>();
  for (const run of data.runs) runsByWeek.set(mondayOf(run.day), (runsByWeek.get(mondayOf(run.day)) ?? 0) + 1);
  const streak = streaks(data, today, gymByWeek, runsByWeek, fullPlan);
  const lastWeight = data.weight.at(-1);
  const firstWeight = data.weight[0];
  const todayHealth = data.health.at(-1)?.day === today ? data.health.at(-1) : undefined;
  const stepsGoal = settings.stepsGoal ?? data.health.at(-1)?.stepsGoal ?? 7000;
  const rhrDiff = ready.rhr && ready.monthRhr ? ready.rhr.value - ready.monthRhr : null;
  const lastSync = data.syncRuns[0];

  return (
    <div className="space-y-4">
      <ReviewBanner today={today} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col items-center gap-4 rounded-3xl border bg-card p-5" aria-label="Bereitschaft">
          <Rings
            label={`Erholung ${score ?? "unbekannt"} von 100, Schlaf ${sleepRecent ? formatSleep(sleepRecent.value) : "unbekannt"}, Woche ${doneSessions} von ${weekGoal} Einheiten`}
            rings={[
              { value: score != null ? score / 100 : null, className: "text-brand" },
              { value: sleepRatio, className: "text-chart-2" },
              { value: doneSessions / weekGoal, className: "text-foreground" },
            ]}
          >
            <span className="text-5xl font-extrabold tracking-tight tabular-nums">{score ?? "–"}</span>
            <span className="text-sm font-semibold text-muted-foreground">{verdict}</span>
          </Rings>
          <dl className="grid w-full grid-cols-3 text-center">
            <Legend dot="bg-brand" label="Erholung" value={score != null ? `${score} %` : "–"} />
            <Legend dot="bg-chart-2" label="Schlaf" value={sleepRecent ? formatSleep(sleepRecent.value) : "–"} />
            <Legend dot="bg-foreground" label="Woche" value={`${doneSessions} / ${weekGoal}`} />
          </dl>
          <p className="text-center text-sm text-balance text-muted-foreground">
            <strong className="font-semibold text-foreground">{ready.headline}</strong> {ready.detail && `${ready.detail}.`}
          </p>
        </section>

        <div className="space-y-3">
          <TodayCard today={today} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <ListRow
              href="/m/sport?tab=erholung"
              icon={ActivityIcon}
              value={ready.hrv ? `${ready.hrv.value} ms` : "–"}
              sub={ready.hrv?.entry.hrvLow && ready.hrv.entry.hrvHigh ? `HRV · Bereich ${ready.hrv.entry.hrvLow}–${ready.hrv.entry.hrvHigh}` : "HRV letzte Nacht"}
              tone={ready.hrv && ready.hrv.entry.hrvLow && ready.hrv.value < ready.hrv.entry.hrvLow ? "bad" : "good"}
            />
            <ListRow
              href="/m/sport?tab=erholung"
              icon={HeartPulseIcon}
              value={ready.rhr ? `${ready.rhr.value} bpm` : "–"}
              sub={ready.monthRhr ? `Ruhepuls · Schnitt ${formatNumber(ready.monthRhr)}` : "Ruhepuls"}
              tone={rhrDiff != null && rhrDiff >= 5 ? "bad" : "good"}
            />
            <ListRow
              href="/m/sport?tab=laufen"
              icon={GaugeIcon}
              value={load.label}
              sub={`Belastung · ${formatMinutes(load.acute)} in 7 Tagen${load.ratio != null ? `, ${formatNumber(load.ratio * 100)} %` : ""}`}
              tone={load.level === "spike" || load.level === "high" ? "bad" : load.level === "build" ? "neutral" : "good"}
            />
            <ListRow
              href="/m/sport?tab=erholung"
              icon={FootprintsIcon}
              value={formatNumber(todayHealth?.steps ?? 0)}
              sub={`Schritte heute · Ziel ${formatNumber(stepsGoal)}`}
              tone={(todayHealth?.steps ?? 0) >= stepsGoal ? "good" : "neutral"}
            />
            {lastWeight && (
              <ListRow
                href="/m/sport?tab=erholung"
                icon={ScaleIcon}
                value={`${de1(lastWeight.kg)} kg`}
                sub={
                  firstWeight && lastWeight !== firstWeight
                    ? `Gewicht · ${lastWeight.kg - firstWeight.kg > 0 ? "+" : ""}${de1(lastWeight.kg - firstWeight.kg)} kg seit ${formatDate(firstWeight.day)}`
                    : `Gewicht · ${formatDate(lastWeight.day)}`
                }
                tone="neutral"
              />
            )}
          </div>
        </div>
      </div>

      <Panel
        title={plan ? `Diese Woche · Plan-Woche ${plan.number}` : `Diese Woche · KW ${isoWeek(today)}`}
        aside={<span className="text-sm text-muted-foreground">{plannedSessions ? `${doneSessions} von ${plannedSessions} Einheiten` : `${doneSessions} Trainingstage`}</span>}
      >
        <ol className="grid grid-cols-7 gap-1">
          {weekDays.map((entry) => {
            const kind = entry.done ? (entry.done.run ? "run" : entry.done.gym ? "gym" : "other") : null;
            const planned = entry.planned.kind !== "free";
            return (
              <li key={entry.day} className="flex min-w-0 flex-col items-center gap-1.5">
                <span className={cn("text-xs", entry.isToday ? "font-extrabold" : "font-semibold text-muted-foreground")}>{entry.label}</span>
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-white",
                    kind
                      ? kindColor[kind]
                      : entry.isToday
                        ? "border-[3px] border-brand bg-good"
                        : planned && entry.future
                          ? "border-2 border-dashed border-chart-4"
                          : "bg-muted",
                    kind && entry.isToday && "ring-2 ring-brand ring-offset-2 ring-offset-card",
                  )}
                  title={entry.done?.labels.join(", ")}
                >
                  {kind && <CheckIcon className="size-4" strokeWidth={3} aria-hidden="true" />}
                  <span className="sr-only">{entry.done ? `erledigt: ${entry.done.labels.join(", ")}` : entry.future ? "noch offen" : "nichts"}</span>
                </span>
                <span className="w-full truncate text-center text-[11px] leading-tight text-muted-foreground">
                  {plan ? entry.planned.label : (entry.done?.labels.join(", ") ?? "–")}
                </span>
              </li>
            );
          })}
        </ol>
        <ul className="flex flex-wrap gap-1.5 text-xs" aria-label="Serien">
          {streak.gym > 0 && <Chip>{streak.gym} Wo. Gym-Ziel</Chip>}
          {streak.runs > 0 && <Chip>{streak.runs} Wo. Läufe</Chip>}
          {streak.sleep > 0 && <Chip>{streak.sleep} Nächte im Schlafbereich</Chip>}
          {streak.steps > 0 && <Chip>{streak.steps} Tage Schrittziel</Chip>}
        </ul>
      </Panel>

      <Panel title="Letzte Einheiten">
        <ul className="divide-y">
          {feed(data, 6).map((item) => (
            <li key={item.key} className="flex items-center gap-3 py-2.5">
              <span className={cn("flex size-8 flex-none items-center justify-center rounded-lg text-white", kindColor[item.kind])} aria-hidden="true">
                {item.kind === "gym" ? <DumbbellIcon className="size-4" /> : item.kind === "run" ? <FootprintsIcon className="size-4" /> : <ActivityIcon className="size-4" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <span className="truncate font-medium">{item.title}</span>
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

function Legend({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <span className={cn("size-2 rounded-full", dot)} aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <li className="rounded-full bg-good px-2.5 py-1 font-semibold text-good-foreground tabular-nums">{children}</li>;
}

// What the plan has for today, with the session as run/walk blocks.
function TodayCard({ today }: { today: string }) {
  const data = useSportData();
  const fullPlan = planFromSettings(data.settings);
  const week = planWeekOf(fullPlan, today);
  const done = trainingDays(data.activities, data.workouts).get(today);
  const planned = plannedDay(weekday(today), week);

  let title: string;
  let detail: string | undefined;
  let aside: string | undefined;
  let href = "/m/sport?tab=plan";
  let blocks = null as ReturnType<typeof sessionBlocks>;
  if (!week) {
    const before = today < fullPlan[0].start;
    title = before ? `Plan startet am ${formatDate(fullPlan[0].start)}` : "Plan beendet";
    detail = before ? `Erster Lauf: ${fullPlan[0].sessions[0]}` : "Der Laufplan bis zum Halbmarathon ist vorbei.";
    if (before) blocks = sessionBlocks(fullPlan[0].sessions[0]);
  } else if (planned.kind === "run") {
    title = planned.detail ?? planned.label;
    blocks = sessionBlocks(planned.detail);
    const minutes = sessionMinutes(blocks);
    detail = planned.label;
    aside = [minutes ? `${minutes} min` : null, /locker|Laufen|min \//.test(planned.detail ?? "") ? "unter 145 bpm" : null].filter(Boolean).join(" · ");
  } else if (planned.kind === "gym") {
    const day = routine.find((entry) => planned.label.endsWith(entry.id));
    title = `Ganzkörper ${planned.label.replace("Gym ", "Tag ")}`;
    detail = day ? `${day.exercises.length} Übungen · ${day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0)} Sätze` : undefined;
    href = "/m/sport?tab=plan-gym";
  } else {
    const next = [1, 2, 3, 4, 5, 6].map((offset) => addDays(today, offset)).find((day) => day <= addDays(week.start, 6) && plannedDay(weekday(day), week).kind !== "free");
    title = "Ruhetag";
    detail = next ? `Als Nächstes: ${plannedDay(weekday(next), week).label} am ${WEEKDAYS[weekday(next)]}` : "Erholung, nächste Woche geht es weiter.";
  }

  return (
    <Link href={href} className="block space-y-3 rounded-3xl bg-hero p-5 text-hero-foreground transition-opacity hover:opacity-95">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-wider text-hero-muted uppercase">Heute im Plan</span>
        {done ? (
          <span className="flex items-center gap-1 rounded-full bg-hero-bar px-2.5 py-1 text-xs font-bold text-hero">
            <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden="true" /> {done.labels.join(", ")}
          </span>
        ) : (
          aside && <span className="text-xs text-hero-muted">{aside}</span>
        )}
      </div>
      <div className="space-y-0.5">
        <p className="text-lg leading-snug font-bold text-balance">{title}</p>
        {detail && <p className="text-sm text-hero-muted">{detail}</p>}
      </div>
      {blocks && (
        <>
          <SessionBar blocks={blocks} hero />
          {blocks.some((block) => block.kind === "walk") && (
            <p className="flex gap-4 text-xs text-hero-muted">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-hero-bar" aria-hidden="true" />Laufen, Zone 1</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-hero-track" aria-hidden="true" />Gehen</span>
            </p>
          )}
        </>
      )}
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
