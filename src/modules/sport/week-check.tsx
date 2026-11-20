"use client";

import { cn } from "@/lib/utils";
import { addDays, average, daysBetween, easyPercent, formatDate, formatMinutes, formatNumber, mondayOf, runWeeks, trainingDays } from "./calc";
import { PLAN_START, planWeekOf, planWeeks, type PlanWeek } from "./plan";
import { useSportData } from "./store";
import { Note, Panel } from "./ui";

type Actual = {
  runs: number;
  longestMinutes: number;
  easy: number | null;
  gym: number;
  restingHr: number | null;
  hrv: number | null;
};

export function WeekCheckTab({ today }: { today: string }) {
  const data = useSportData();
  const current = planWeekOf(today);
  const days = trainingDays(data.activities, data.workouts);

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

  // Hero: the running plan week, or the first one before the plan starts.
  const focus = current ?? (today < PLAN_START ? planWeeks[0] : null);
  const started = focus ? today >= focus.start : false;
  const actual = focus && started ? actualOf(focus) : null;
  const daysLeft = focus ? Math.max(0, daysBetween(today, addDays(focus.start, 6))) : 0;

  // Every week up to this one, plus the next two.
  const lastIndex = current ? current.number - 1 : today < PLAN_START ? -1 : planWeeks.length - 1;
  const rows = planWeeks.slice(0, Math.min(planWeeks.length, lastIndex + 3)).reverse();

  return (
    <div className="space-y-4">
      {focus ? (
        <section className="space-y-4 rounded-2xl bg-hero p-5 text-hero-foreground">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              Woche {focus.number} · ab {formatDate(focus.start)} · {focus.phase}
            </h2>
            <span className="text-sm text-hero-muted">
              {started ? (daysLeft > 0 ? `noch ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tage"}` : "letzter Tag") : `startet in ${daysBetween(today, focus.start)} Tagen`}
            </span>
          </div>
          {focus.note && <p className="text-sm text-hero-muted">{focus.note}</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Goal label="Läufe" value={actual ? `${actual.runs} von ${focus.runs}` : `0 von ${focus.runs}`} sub={focus.runs === 2 ? "Mo + Fr" : "Mo, Fr + langer Lauf So"} ratio={(actual?.runs ?? 0) / focus.runs} />
            <Goal
              label="Längste Einheit"
              value={actual?.longestMinutes ? formatMinutes(actual.longestMinutes) : "–"}
              sub={`Plan ≈ ${formatMinutes(focus.longestMinutes)}`}
              ratio={(actual?.longestMinutes ?? 0) / focus.longestMinutes}
            />
            <Goal
              label="Zone 1"
              value={actual?.easy != null ? `${formatNumber(actual.easy)} %` : "–"}
              sub={focus.number <= 18 ? "Ziel: fast alles locker" : "locker bis auf die Qualitätseinheit"}
              ratio={(actual?.easy ?? 0) / 100}
            />
            <Goal label="Gym" value={`${actual?.gym ?? 0} von ${focus.gym}`} sub={focus.gym === 3 ? "Di A · Do B · Sa C" : "nur 1×, leicht"} ratio={(actual?.gym ?? 0) / focus.gym} />
          </div>
        </section>
      ) : (
        <Panel title="Plan beendet">
          <p className="text-sm">Der Laufplan bis zum Halbmarathon ist vorbei.</p>
        </Panel>
      )}

      <Panel title="Alle Wochen">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 pr-2 font-medium">Woche</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Läufe</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Längste Einheit (Plan / Ist)</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Zone 1</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Gym</th>
                <th scope="col" className="py-1.5 pl-2 font-medium">Ø Ruhepuls / HRV</th>
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
                      <span className="block text-xs font-normal text-muted-foreground">{week.phase}</span>
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
                    <td className="py-2.5 pl-2">
                      {done?.restingHr || done?.hrv
                        ? `${done.restingHr ? `${formatNumber(done.restingHr)} bpm` : "–"} · ${done.hrv ? `${formatNumber(done.hrv)} ms` : "–"}`
                        : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Note>Grün: Plan erfüllt · Orange: weniger als geplant (nur abgeschlossene Wochen) · zukünftige Wochen zeigen den Plan.</Note>
      </Panel>
    </div>
  );
}

function Goal({ label, value, sub, ratio }: { label: string; value: string; sub: string; ratio: number }) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm text-hero-muted">{label}</span>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-hero-track">
        <div className="h-full bg-hero-bar" style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%` }} />
      </div>
      <span className="text-xs text-hero-muted">{sub}</span>
    </div>
  );
}

function Count({ done, planned, finished }: { done: number | null; planned: number; finished: boolean }) {
  if (done == null) return <span className="text-muted-foreground">– / {planned}</span>;
  const ok = done >= planned;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-semibold",
        ok ? "bg-good text-good-foreground" : finished ? "bg-bad text-bad-foreground" : "text-foreground",
      )}
    >
      {done} / {planned}
    </span>
  );
}
