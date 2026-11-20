"use client";

import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { planProgress, routineCheck } from "./analytics";
import { addDays, average, daysBetween, easyPercent, formatDate, formatMinutes, formatNumber, mondayOf, runWeeks, trainingDays } from "./calc";
import { StackedBars } from "./charts";
import { BASE_WEEKS, planFromSettings, planWeekOf, type PlanWeek } from "./plan";
import { useSaveSettings, useSportData } from "./store";
import type { PlanChange } from "./types";
import { Note, Panel } from "./ui";

type Actual = { runs: number; longestMinutes: number; easy: number | null; gym: number; restingHr: number | null; hrv: number | null };

export function PlanTab({ today }: { today: string }) {
  const data = useSportData();
  const save = useSaveSettings();
  const plan = planFromSettings(data.settings);
  const current = planWeekOf(plan, today);
  const days = trainingDays(data.activities, data.workouts);
  const changes = data.settings.planChanges;

  const actualOf = (week: PlanWeek): Actual => {
    const [summary] = runWeeks(data.runs, [week.start]);
    const end = addDays(week.start, 6);
    const runs = data.runs.filter((run) => run.day >= week.start && run.day <= end);
    let gym = 0;
    for (let day = week.start; day <= end; day = addDays(day, 1)) if (days.get(day)?.gym) gym += 1;
    const health = data.health.filter((day) => day.day >= week.start && day.day <= end);
    return {
      runs: summary.runs,
      longestMinutes: Math.max(0, ...runs.map((run) => (run.durationS ?? 0) / 60)),
      easy: easyPercent([summary]),
      gym,
      restingHr: average(health.map((day) => day.restingHr)),
      hrv: average(health.map((day) => day.hrv)),
    };
  };

  const focus = current ?? (today < plan[0].start ? plan[0] : null);
  const started = focus ? today >= focus.start : false;
  const actual = focus && started ? actualOf(focus) : null;
  const daysLeft = focus ? Math.max(0, daysBetween(today, addDays(focus.start, 6))) : 0;

  const lastIndex = current ? current.number - 1 : today < plan[0].start ? -1 : plan.length - 1;
  const rows = plan.slice(0, Math.min(plan.length, lastIndex + 4)).reverse();
  const progress = planProgress(plan, data.runs, today);
  const goalWeek = plan.find((week) => week.base === 12 && !week.repeat);
  const chartWeeks = plan.slice(0, Math.min(plan.length, Math.max(12, lastIndex + 4)));

  const change = (next: PlanChange[], message: string) => save({ planChanges: next }, message);
  const canChange = (week: PlanWeek) => !week.repeat && week.start >= mondayOf(today);

  // This week's gym sessions against the routine.
  const weekStart = mondayOf(today);
  const gymChecks = data.workouts
    .filter((workout) => workout.day >= weekStart && workout.day <= addDays(weekStart, 6))
    .map((workout) => routineCheck(workout, data.exercises))
    .filter((check) => check != null);

  return (
    <div className="space-y-4">
      {focus ? (
        <section className="space-y-4 rounded-2xl bg-hero p-5 text-hero-foreground">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              Woche {focus.number}
              {focus.repeat ? ` (Wiederholung von ${focus.base})` : ""} · ab {formatDate(focus.start)} · {focus.phase}
            </h2>
            <span className="text-sm text-hero-muted">
              {started ? (daysLeft > 0 ? `noch ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tage"}` : "letzter Tag") : `startet in ${daysBetween(today, focus.start)} Tagen`}
            </span>
          </div>
          <ul className="space-y-1 text-sm">
            {focus.sessions.map((session, index) => (
              <li key={index} className="flex gap-2">
                <span className="w-6 flex-none font-semibold text-hero-bar">{["Mo", "Fr", "So"][index]}</span>
                <span>{session}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Goal label="Läufe" value={`${actual?.runs ?? 0} von ${focus.runs}`} ratio={(actual?.runs ?? 0) / focus.runs} />
            <Goal
              label="Längste Einheit"
              value={actual?.longestMinutes ? formatMinutes(actual.longestMinutes) : "–"}
              sub={`Plan ≈ ${formatMinutes(focus.longestMinutes)}`}
              ratio={(actual?.longestMinutes ?? 0) / focus.longestMinutes}
            />
            <Goal label="Zone 1" value={actual?.easy != null ? `${formatNumber(actual.easy)} %` : "–"} sub={`Ziel ${data.settings.zone1GoalPct} %`} ratio={(actual?.easy ?? 0) / 100} />
            <Goal label="Gym" value={`${actual?.gym ?? 0} von ${focus.gym}`} sub={focus.gym === 3 ? "Di A · Do B · Sa C" : "nur 1×, leicht"} ratio={(actual?.gym ?? 0) / focus.gym} />
          </div>
          {today < plan[0].start && data.runs.some((run) => run.day >= mondayOf(today)) && (
            <p className="rounded-lg bg-hero-track px-3 py-2 text-sm">
              Du bist diese Woche schon gelaufen, obwohl der Plan erst am {formatDate(plan[0].start)} startet.{" "}
              <button type="button" className="cursor-pointer font-semibold text-hero-bar underline" onClick={() => save({ planStart: mondayOf(today) }, `Plan beginnt jetzt am ${formatDate(mondayOf(today))}`)}>
                Plan schon diese Woche starten
              </button>
            </p>
          )}
        </section>
      ) : (
        <Panel title="Plan beendet">
          <p className="text-sm">Der Laufplan bis zum Halbmarathon ist vorbei.</p>
        </Panel>
      )}

      <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
        <Panel title="Längste Einheit: Plan und Ist">
          <StackedBars
            ariaLabel="Längste Einheit pro Planwoche, gemessen und geplant"
            height={180}
            bars={chartWeeks.map((week) => {
              const done = week.start <= today ? progress.rows.find((row) => row.week.number === week.number)?.longest ?? 0 : 0;
              return {
                key: String(week.number),
                title: `W${week.number}: Plan ${formatMinutes(week.longestMinutes)}${done ? `, gelaufen ${formatMinutes(done)}` : ""}`,
                segments: [{ value: done, className: done >= week.longestMinutes ? "bg-brand" : "bg-chart-2" }],
              };
            })}
            line={chartWeeks.map((week) => week.longestMinutes)}
            lineOnBarScale
            lineClassName="stroke-debt"
            startLabel="W1"
            endLabel={`W${chartWeeks.at(-1)?.number}`}
          />
          <Note>Balken: dein längster Lauf der Woche · gestrichelt: der Plan.</Note>
        </Panel>
        <Panel title="Prognose 10 km am Stück">
          {goalWeek ? (
            <>
              <p className="text-sm">
                Ziel laut Plan: Woche {goalWeek.number}, ab <strong>{formatDate(goalWeek.start)}</strong> (≈ 70 min).
              </p>
              {progress.last ? (
                <p className="text-sm">
                  Zuletzt (W{progress.last.week.number}) {formatMinutes(progress.last.longest)} am Stück, Plan {formatMinutes(progress.last.week.longestMinutes)}:{" "}
                  <strong>
                    {Math.abs(progress.diff ?? 0) < 2
                      ? "genau im Plan."
                      : (progress.diff ?? 0) > 0
                        ? `${formatMinutes(progress.diff!)} vor dem Plan.`
                        : `${formatMinutes(-progress.diff!)} hinter dem Plan.`}
                  </strong>{" "}
                  {(progress.diff ?? 0) < -5 && "Wiederhol lieber eine Woche, statt zu springen."}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Noch kein Lauf im Plan. Die Prognose kommt nach der ersten Woche.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Woche 12 wurde übersprungen.</p>
          )}
          <Note>Der Plan steigert höchstens 10 % pro Woche; wer vorne liegt, sollte trotzdem nicht schneller steigern.</Note>
        </Panel>
      </div>

      {gymChecks.length > 0 && (
        <Panel title="Gym diese Woche gegen die Routine">
          <ul className="divide-y">
            {gymChecks.map((check) => (
              <li key={check.workout.id} className="space-y-0.5 py-2.5">
                <p>
                  <strong className="font-semibold">{check.workout.title}</strong>{" "}
                  <span className="text-sm text-muted-foreground">
                    {formatDate(check.workout.day)} · passt zu Tag {check.day.id}: {check.done.length} von {check.day.exercises.length} Übungen
                  </span>
                </p>
                {check.missing.length > 0 && <p className="text-sm text-bad-foreground">Fehlt: {check.missing.join(", ")}</p>}
                {check.extra.length > 0 && <p className="text-sm text-muted-foreground">Zusätzlich: {check.extra.join(", ")}</p>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Alle Wochen"
        aside={
          changes.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => change([], "Änderungen zurückgesetzt")}>
              <RotateCcwIcon /> {changes.length} Änderung{changes.length === 1 ? "" : "en"} zurücksetzen
            </Button>
          ) : undefined
        }
      >
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 pr-2 font-medium">Woche</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Läufe</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Längste (Plan / Ist)</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Zone 1</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Gym</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Ruhepuls / HRV</th>
                <th scope="col" className="py-1.5 pl-2 font-medium">
                  <span className="sr-only">Umplanen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((week) => {
                const future = week.start > today;
                const isCurrent = week.start === mondayOf(today);
                const done = future ? null : actualOf(week);
                const finished = !future && !isCurrent;
                return (
                  <tr key={week.number} className={cn("border-t", isCurrent && "bg-good/50")}>
                    <th scope="row" className="py-2.5 pr-2 text-left font-semibold">
                      W{week.number} <span className="text-xs font-normal text-muted-foreground">ab {formatDate(week.start)}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {week.repeat ? `Wiederholung von W${week.base}` : week.phase}
                      </span>
                    </th>
                    <td className="px-2 py-2.5">
                      <Count done={done?.runs ?? null} planned={week.runs} finished={finished} />
                    </td>
                    <td className="px-2 py-2.5">
                      {formatMinutes(week.longestMinutes)}
                      {done?.longestMinutes ? ` / ${formatMinutes(done.longestMinutes)}` : ""}
                    </td>
                    <td className="px-2 py-2.5">{done?.easy != null ? `${formatNumber(done.easy)} %` : "–"}</td>
                    <td className="px-2 py-2.5">
                      <Count done={done?.gym ?? null} planned={week.gym} finished={finished} />
                    </td>
                    <td className="px-2 py-2.5">
                      {done?.restingHr || done?.hrv ? `${done.restingHr ? formatNumber(done.restingHr) : "–"} · ${done.hrv ? `${formatNumber(done.hrv)} ms` : "–"}` : "–"}
                    </td>
                    <td className="py-2 pl-2 text-right whitespace-nowrap">
                      {canChange(week) && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => change([...changes, { week: week.base, action: "repeat" }], `W${week.number} wird wiederholt, alles danach rückt eine Woche nach hinten`)}
                          >
                            Wiederholen
                          </Button>
                          {week.base < BASE_WEEKS && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => change([...changes, { week: week.base, action: "skip" }], `W${week.number} übersprungen`)}
                            >
                              Überspringen
                            </Button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Note>
          Grün: Plan erfüllt · Orange: weniger als geplant (abgeschlossene Wochen). Wiederholen schiebt alles danach eine Woche nach hinten, Überspringen eine Woche nach vorne. Den Start legst du in den Einstellungen fest.
        </Note>
      </Panel>
    </div>
  );
}

function Goal({ label, value, sub, ratio }: { label: string; value: string; sub?: string; ratio: number }) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm text-hero-muted">{label}</span>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-hero-track">
        <div className="h-full bg-hero-bar" style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%` }} />
      </div>
      {sub && <span className="text-xs text-hero-muted">{sub}</span>}
    </div>
  );
}

function Count({ done, planned, finished }: { done: number | null; planned: number; finished: boolean }) {
  if (done == null) return <span className="text-muted-foreground">– / {planned}</span>;
  const ok = done >= planned;
  return (
    <span className={cn("rounded-full px-2 py-0.5 font-semibold", ok ? "bg-good text-good-foreground" : finished ? "bg-bad text-bad-foreground" : "text-foreground")}>
      {done} / {planned}
    </span>
  );
}
