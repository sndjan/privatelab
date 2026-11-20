"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { activityLabel, addDays, formatDuration, formatKm, formatMinutes, formatNumber, formatSleep, mondayOf, trainingDays, WEEKDAYS, weekday } from "./calc";
import { planFromSettings, planWeekOf, plannedDay } from "./plan";
import { useSportData } from "./store";
import type { HealthDay } from "./types";
import { kindColor, Note, Panel } from "./ui";

const monthName = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const addMonths = (first: string, months: number) => {
  const date = toDate(first);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
};

type Metric = "training" | "sleep" | "hrv" | "run" | "steps";
const metrics: { id: Metric; label: string }[] = [
  { id: "training", label: "Training" },
  { id: "sleep", label: "Schlaf" },
  { id: "hrv", label: "HRV" },
  { id: "run", label: "Laufminuten" },
  { id: "steps", label: "Schritte" },
];

export function CalendarTab({ today }: { today: string }) {
  const data = useSportData();
  const [view, setView] = useState<"month" | "year">("month");
  const [month, setMonth] = useState(monthStart(today));
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [metric, setMetric] = useState<Metric>("training");
  const [selected, setSelected] = useState<string>(today);
  const days = trainingDays(data.activities, data.workouts);
  const health = new Map(data.health.map((day) => [day.day, day]));
  const runMinutes = new Map<string, number>();
  for (const run of data.runs) runMinutes.set(run.day, (runMinutes.get(run.day) ?? 0) + (run.durationS ?? 0) / 60);
  const plan = planFromSettings(data.settings);
  const settings = data.settings;

  const pick = (day: string) => {
    setSelected(day);
    if (view === "year") {
      setMonth(monthStart(day));
      setView("month");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Ansicht" className="flex gap-1 rounded-lg bg-muted p-1">
          {(["month", "year"] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={cn("h-9 cursor-pointer rounded-md px-3 text-sm", view === id ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
            >
              {id === "month" ? "Monat" : "Jahr"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Zurück" onClick={() => (view === "month" ? setMonth(addMonths(month, -1)) : setYear(year - 1))}>
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-36 text-center font-semibold">{view === "month" ? monthName.format(toDate(month)) : year}</span>
          <Button variant="ghost" size="icon" aria-label="Weiter" onClick={() => (view === "month" ? setMonth(addMonths(month, 1)) : setYear(year + 1))}>
            <ChevronRightIcon />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setMonth(monthStart(today)); setYear(Number(today.slice(0, 4))); setSelected(today); }}>
            Heute
          </Button>
        </div>
      </div>

      {view === "month" ? (
        <Panel>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
            {WEEKDAYS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }, (_, index) => addDays(mondayOf(month), index))
              .filter((day, index) => index < 35 || day.slice(0, 7) === month.slice(0, 7))
              .map((day) => {
                const done = days.get(day);
                const h = health.get(day);
                const planned = plannedDay(weekday(day), planWeekOf(plan, day));
                const inMonth = day.slice(0, 7) === month.slice(0, 7);
                const sleepH = h?.sleepS ? h.sleepS / 3600 : null;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => pick(day)}
                    aria-pressed={selected === day}
                    aria-label={`${longDay.format(toDate(day))}${done ? `: ${done.labels.join(", ")}` : ""}`}
                    className={cn(
                      "flex min-h-16 cursor-pointer flex-col gap-1 rounded-lg border p-1 text-left transition-colors sm:min-h-24 sm:p-1.5",
                      inMonth ? "bg-card" : "bg-muted/40 text-muted-foreground",
                      day === today && "border-brand",
                      selected === day && "ring-2 ring-brand",
                    )}
                  >
                    <span className="flex items-center justify-between text-xs font-semibold tabular-nums">
                      {Number(day.slice(8))}
                      {planned.kind !== "free" && !done && day >= today && (
                        <span className={cn("size-2 rounded-full border-2", planned.kind === "run" ? "border-brand" : "border-chart-2")} title={`Plan: ${planned.label}`} />
                      )}
                    </span>
                    <span className="flex flex-wrap gap-0.5">
                      {done?.labels.slice(0, 3).map((label) => (
                        <span
                          key={label}
                          className={cn(
                            "rounded px-1 text-[10px] leading-4 text-white",
                            label === "Lauf" ? kindColor.run : label === "Gym" ? kindColor.gym : kindColor.other,
                          )}
                        >
                          <span className="sm:hidden">{label.slice(0, 1)}</span>
                          <span className="hidden sm:inline">{label}</span>
                        </span>
                      ))}
                    </span>
                    {sleepH != null && (
                      <span className="mt-auto flex items-center gap-1" title={`Schlaf ${formatSleep(h!.sleepS!)}`}>
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn("block h-full", sleepH >= settings.sleepMinH && sleepH <= settings.sleepMaxH ? "bg-brand" : "bg-debt")}
                            style={{ width: `${Math.min(100, (sleepH / 10) * 100)}%` }}
                          />
                        </span>
                        <span className="hidden text-[10px] text-muted-foreground tabular-nums sm:inline">{formatSleep(h!.sleepS!).replace(" h", "")}</span>
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
          <Note>Farbige Felder: erledigte Einheiten · Kreis: geplante Einheit · Balken: Schlaf (grün im Bereich, orange außerhalb). Tippe einen Tag an für Details.</Note>
        </Panel>
      ) : (
        <Panel aside={<MetricPicker metric={metric} setMetric={setMetric} />} title="Jahresübersicht">
          <YearGrid year={year} today={today} onPick={pick} color={(day) => colorFor(metric, day, days.get(day), health.get(day), runMinutes.get(day), settings)} />
          <YearLegend metric={metric} />
        </Panel>
      )}

      <DayDetail day={selected} />
    </div>
  );
}

function MetricPicker({ metric, setMetric }: { metric: Metric; setMetric: (metric: Metric) => void }) {
  return (
    <div role="group" aria-label="Kennzahl" className="flex flex-wrap gap-1">
      {metrics.map((entry) => (
        <button
          key={entry.id}
          type="button"
          aria-pressed={metric === entry.id}
          onClick={() => setMetric(entry.id)}
          className={cn("h-8 cursor-pointer rounded-full border px-3 text-xs", metric === entry.id ? "border-brand bg-brand text-brand-foreground" : "bg-card")}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

function colorFor(
  metric: Metric,
  _day: string,
  done: { run: boolean; gym: boolean; other: boolean } | undefined,
  h: HealthDay | undefined,
  runMinutes: number | undefined,
  settings: { sleepMinH: number; sleepMaxH: number; stepsGoal: number | null },
): string | null {
  switch (metric) {
    case "training":
      return done ? (done.run ? "var(--brand)" : done.gym ? "var(--chart-2)" : "var(--debt)") : null;
    case "sleep": {
      if (!h?.sleepS) return null;
      const value = h.sleepS / 3600;
      return value < settings.sleepMinH - 1 ? "var(--debt)" : value < settings.sleepMinH ? "var(--chart-5)" : value <= settings.sleepMaxH ? "var(--brand)" : "var(--chart-2)";
    }
    case "hrv":
      if (!h?.hrv) return null;
      if (h.hrvLow && h.hrv < h.hrvLow) return "var(--debt)";
      if (h.hrvHigh && h.hrv > h.hrvHigh) return "var(--chart-2)";
      return "var(--brand)";
    case "run":
      if (!runMinutes) return null;
      return runMinutes >= 45 ? "var(--hero)" : runMinutes >= 25 ? "var(--brand)" : "var(--chart-2)";
    case "steps": {
      if (h?.steps == null) return null;
      const goal = settings.stepsGoal ?? h.stepsGoal ?? 7000;
      return h.steps >= goal * 1.5 ? "var(--hero)" : h.steps >= goal ? "var(--brand)" : h.steps >= goal * 0.6 ? "var(--chart-3)" : "var(--chart-4)";
    }
  }
}

function YearLegend({ metric }: { metric: Metric }) {
  const items: Record<Metric, [string, string][]> = {
    training: [["var(--brand)", "Lauf"], ["var(--chart-2)", "Gym"], ["var(--debt)", "Sonstiges"]],
    sleep: [["var(--debt)", "1 h+ zu kurz"], ["var(--chart-5)", "zu kurz"], ["var(--brand)", "im Bereich"], ["var(--chart-2)", "länger"]],
    hrv: [["var(--debt)", "unter Normalbereich"], ["var(--brand)", "im Bereich"], ["var(--chart-2)", "darüber"]],
    run: [["var(--chart-2)", "< 25 min"], ["var(--brand)", "25–45 min"], ["var(--hero)", "45 min +"]],
    steps: [["var(--chart-4)", "< 60 % Ziel"], ["var(--chart-3)", "60–100 %"], ["var(--brand)", "Ziel"], ["var(--hero)", "150 % +"]],
  };
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items[metric].map(([color, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden="true" />
          {label}
        </span>
      ))}
    </span>
  );
}

// 12 rows of months, one square per day; on phones the squares shrink with the width.
function YearGrid({ year, today, onPick, color }: { year: number; today: string; onPick: (day: string) => void; color: (day: string) => string | null }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: 12 }, (_, monthIndex) => {
        const first = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
        const length = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
        return (
          <div key={monthIndex} className="grid grid-cols-[2.25rem_1fr] items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{shortMonth.format(toDate(first))}</span>
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(31, minmax(0, 1fr))" }}>
              {Array.from({ length }, (_, dayIndex) => {
                const day = addDays(first, dayIndex);
                const fill = day <= today ? color(day) : null;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onPick(day)}
                    aria-label={longDay.format(toDate(day))}
                    title={longDay.format(toDate(day))}
                    className={cn("aspect-square cursor-pointer rounded-[2px] sm:rounded-[3px]", day === today && "ring-1 ring-foreground", weekday(day) >= 5 && !fill && "opacity-70")}
                    style={{ background: fill ?? "var(--muted)" }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayDetail({ day }: { day: string }) {
  const data = useSportData();
  const plan = planFromSettings(data.settings);
  const week = planWeekOf(plan, day);
  const planned = plannedDay(weekday(day), week);
  const activities = data.activities.filter((activity) => activity.day === day);
  const workouts = data.workouts.filter((workout) => workout.day === day);
  const h = data.health.find((entry) => entry.day === day);
  const weighing = data.weight.find((entry) => entry.day === day);

  return (
    <Panel title={longDay.format(toDate(day))} aside={week ? <span className="text-xs text-muted-foreground">Plan-Woche {week.number} · {planned.label}{planned.detail ? `: ${planned.detail}` : ""}</span> : undefined}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Training</h3>
          {activities.length === 0 && workouts.length === 0 && <p className="text-sm text-muted-foreground">Nichts aufgezeichnet.</p>}
          <ul className="space-y-1.5">
            {activities
              .filter((activity) => !(activity.type === "strength_training" && workouts.length > 0))
              .map((activity) => {
                const label = activityLabel(activity.type);
                return (
                  <li key={activity.id} className="flex items-baseline gap-2 text-sm">
                    <span className={cn("size-2.5 flex-none translate-y-[-1px] rounded-full", label === "Lauf" ? kindColor.run : label === "Gym" ? kindColor.gym : kindColor.other)} />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{activity.name || label}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {[
                          activity.durationS ? formatDuration(activity.durationS) : null,
                          activity.km && activity.km > 0.2 ? formatKm(activity.km) : null,
                          activity.avgHr ? `Ø ${activity.avgHr} bpm` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </li>
                );
              })}
            {workouts.map((workout) => {
              const sessions = data.exercises.filter((session) => session.workoutId === workout.id);
              return (
                <li key={workout.id} className="flex items-baseline gap-2 text-sm">
                  <span className={cn("size-2.5 flex-none translate-y-[-1px] rounded-full", kindColor.gym)} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{workout.title || "Gym"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {workout.durationS ? `${formatMinutes(workout.durationS / 60)} · ` : ""}
                      {sessions.map((session) => `${session.exercise} ${session.topWeightKg ?? "–"} × ${session.topReps ?? "–"}`).join(" · ")}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Körper</h3>
          {h || weighing ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <Item label="Schlaf" value={h?.sleepS ? formatSleep(h.sleepS) : "–"} sub={h?.sleepScore ? `Score ${h.sleepScore}` : undefined} />
              <Item
                label="Schlafenszeit"
                value={h?.bed && h.wake ? `${h.bed.slice(11, 16)}–${h.wake.slice(11, 16)}` : "–"}
                sub={h?.deepS && h.remS ? `Tief ${formatMinutes(h.deepS / 60)}, REM ${formatMinutes(h.remS / 60)}` : undefined}
              />
              <Item label="HRV" value={h?.hrv ? `${h.hrv} ms` : "–"} sub={h?.hrvLow ? `Bereich ${h.hrvLow}–${h.hrvHigh}` : undefined} />
              <Item label="Ruhepuls" value={h?.restingHr ? `${h.restingHr} bpm` : "–"} />
              <Item label="Schritte" value={h?.steps != null ? formatNumber(h.steps) : "–"} sub={h?.stepsGoal ? `Ziel ${formatNumber(h.stepsGoal)}` : undefined} />
              {weighing && <Item label="Gewicht" value={`${String(weighing.kg).replace(".", ",")} kg`} sub={weighing.bodyFat ? `${String(weighing.bodyFat).replace(".", ",")} % Fett` : undefined} />}
              {h?.vo2max && <Item label="VO2max" value={String(h.vo2max).replace(".", ",")} sub="neu an diesem Tag" />}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Werte.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Item({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
      {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}
