"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { exerciseSummaries, formatDate, formatDayDate, formatMinutes, formatSet, formatTonnes, gymWeeks, lastWeeks } from "./calc";
import { LineChart, StackedBars } from "./charts";
import { useSportData } from "./store";
import { Note, Panel } from "./ui";

// Targets from the gym routine (old levels to get back to).
const goals: Record<string, string> = {
  "Squat (Langhantel)": "85 kg × 8",
  "Rumänisches Kreuzheben (Langhantel)": "85 kg × 10",
  "Klimmzüge (Unterstützt)": "0 kg Hilfe",
};

export function GymTab({ today, weeks: count }: { today: string; weeks: number }) {
  const data = useSportData();
  const weeks = lastWeeks(today, count);
  const from = weeks[0];
  const perWeek = gymWeeks(data.exercises, data.workouts, weeks);
  const summaries = exerciseSummaries(data.exercises, from, today);
  const [picked, setPicked] = useState<string | null>(null);
  const selected = summaries.find((summary) => summary.name === picked) ?? summaries[0];
  const sessions = selected?.sessions.filter((session) => session.day >= from) ?? [];
  const workouts = data.workouts.filter((workout) => workout.day >= from).reverse().slice(0, 8);
  const volumeByWorkout = new Map<string, { sets: number; volume: number }>();
  for (const session of data.exercises) {
    const entry = volumeByWorkout.get(session.workoutId) ?? { sets: 0, volume: 0 };
    entry.sets += session.sets;
    if (!session.assisted) entry.volume += session.volumeKg;
    volumeByWorkout.set(session.workoutId, entry);
  }

  return (
    <div className="space-y-4">
      <Panel title="Volumen pro Woche" aside={<span className="text-xs text-muted-foreground">kg × Wiederholungen, Arbeitssätze · Zahl: Einheiten</span>}>
        <StackedBars
          ariaLabel={`Gym-Volumen pro Woche der letzten ${count} Wochen`}
          height={200}
          bars={perWeek.map((week) => ({
            key: week.week,
            title: `Woche ab ${formatDate(week.week)}: ${week.sessions} Einheiten, ${formatTonnes(week.volumeKg)}`,
            label: count <= 26 && week.sessions ? String(week.sessions) : undefined,
            segments: [{ value: week.volumeKg, className: "bg-chart-2" }],
          }))}
          startLabel={formatDate(from)}
          endLabel="diese Woche"
        />
        <Note>Unterstützte Übungen (z. B. Klimmzüge mit Hilfe) zählen nicht zum Volumen, weil Hevy dort die Hilfe als Gewicht speichert.</Note>
      </Panel>

      <Panel title="Übung im Verlauf" aside={<span className="text-xs text-muted-foreground">Übungen aus dem Zeitraum, die häufigsten zuerst</span>}>
        {!selected ? (
          <p className="text-sm text-muted-foreground">Keine Übungen im Zeitraum.</p>
        ) : (
          <>
            <div role="group" aria-label="Übung wählen" className="flex flex-wrap gap-1.5">
              {summaries.slice(0, 16).map((summary) => (
                <button
                  key={summary.name}
                  type="button"
                  aria-pressed={summary.name === selected.name}
                  onClick={() => setPicked(summary.name)}
                  className={cn(
                    "min-h-9 cursor-pointer rounded-full border px-3 text-sm transition-colors",
                    summary.name === selected.name ? "border-brand bg-brand text-brand-foreground" : "bg-card hover:bg-muted",
                  )}
                >
                  {summary.name}
                </button>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  Top-Satz pro Einheit{selected.assisted ? " (Hilfe in kg, weniger ist besser)" : " in kg"}
                </span>
                <LineChart
                  ariaLabel={`${selected.name}: Top-Satz im Verlauf`}
                  values={sessions.map(() => null)}
                  smooth={sessions.map((session) => session.topWeightKg)}
                  height={200}
                  format={(value) => `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value)} kg`}
                  startLabel={sessions[0] ? formatDate(sessions[0].day) : undefined}
                  endLabel={sessions.at(-1) ? formatDate(sessions.at(-1)!.day) : undefined}
                />
              </div>
              <dl className="grid grid-cols-2 content-start gap-3">
                <Fact label="Letzter Top-Satz" value={formatSet(selected.last)} sub={formatDate(selected.last.day)} />
                <Fact label="Bestwert" value={formatSet(selected.best)} sub={selected.best ? formatDate(selected.best.day) : undefined} />
                <Fact label="Ziel" value={goals[selected.name] ?? "–"} sub={goals[selected.name] ? "aus der Routine" : undefined} />
                <Fact label="Volumen 4 Wochen" value={selected.assisted ? "–" : formatTonnes(selected.recentVolume)} />
              </dl>
            </div>
          </>
        )}
      </Panel>

      <Panel title="Letzte Einheiten">
        <ul className="divide-y">
          {workouts.map((workout) => {
            const stats = volumeByWorkout.get(workout.id);
            return (
              <li key={workout.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5">
                <strong className="font-semibold">{workout.title || "Gym"}</strong>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {[
                    formatDayDate(workout.day),
                    workout.durationS ? formatMinutes(workout.durationS / 60) : null,
                    stats ? `${stats.sets} Sätze` : null,
                    stats?.volume ? formatTonnes(stats.volume) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-bold tabular-nums">{value}</dd>
      {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}
