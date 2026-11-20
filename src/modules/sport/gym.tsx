"use client";

import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, TrophyIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { progressionHint, records, routineCheck, sessionE1rm, setsPerMuscle } from "./analytics";
import { addDays, weekday, exerciseSummaries, formatDate, formatDayDate, formatMinutes, formatSet, formatTonnes, gymWeeks, lastWeeks } from "./calc";
import { LineChart, StackedBars } from "./charts";
import { routine, sameExercise } from "./plan";
import { useSportData } from "./store";
import { Note, Panel } from "./ui";

const kg = (value: number) => `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value)} kg`;

export function GymTab({ today, weeks: count }: { today: string; weeks: number }) {
  const data = useSportData();
  const weeks = lastWeeks(today, count);
  const from = weeks[0];
  const perWeek = gymWeeks(data.exercises, data.workouts, weeks);
  const summaries = exerciseSummaries(data.exercises, from, today);
  const [picked, setPicked] = useState<string | null>(null);
  const [metric, setMetric] = useState<"top" | "e1rm">("top");
  // Phones show one routine day: the next one by weekday (Di A, Do B, Sa C).
  const dayIndex = weekday(today);
  const [routineDay, setRoutineDay] = useState<"A" | "B" | "C">(dayIndex <= 1 ? "A" : dayIndex <= 3 ? "B" : dayIndex <= 5 ? "C" : "A");
  const selected = summaries.find((summary) => summary.name === picked) ?? summaries[0];
  const sessions = selected?.sessions.filter((session) => session.day >= from) ?? [];
  const bestE1rm = selected ? Math.max(0, ...selected.sessions.map((session) => sessionE1rm(session) ?? 0)) : 0;
  const workouts = data.workouts.filter((workout) => workout.day >= from).reverse().slice(0, 8);
  const volumeByWorkout = new Map<string, { sets: number; volume: number }>();
  for (const session of data.exercises) {
    const entry = volumeByWorkout.get(session.workoutId) ?? { sets: 0, volume: 0 };
    entry.sets += session.sets;
    if (!session.assisted) entry.volume += session.volumeKg;
    volumeByWorkout.set(session.workoutId, entry);
  }
  const muscles7 = setsPerMuscle(data.exercises, data.templates, addDays(today, -6), today);
  const musclesRange = setsPerMuscle(data.exercises, data.templates, from, today);
  const weekCount = Math.max(1, count);
  const recent = records(data.exercises).filter((record) => record.day >= addDays(today, -90)).slice(0, 10);
  const lastByName = (name: string) => [...data.exercises].reverse().find((session) => sameExercise(name, session.exercise)) ?? null;

  return (
    <div className="space-y-4">
      <Panel title="Volumen pro Woche" aside={<span className="text-xs text-muted-foreground">kg × Wiederholungen, Arbeitssätze · Zahl: Einheiten</span>}>
        <StackedBars
          ariaLabel={`Gym-Volumen pro Woche der letzten ${count} Wochen`}
          height={180}
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

      <Panel title="Nächstes Mal" aside={<span className="text-xs text-muted-foreground">doppelte Progression aus deiner Routine</span>}>
        <div role="group" aria-label="Trainingstag" className="flex w-fit gap-1 rounded-lg bg-muted p-1 lg:hidden">
          {routine.map((day) => (
            <button
              key={day.id}
              type="button"
              aria-pressed={routineDay === day.id}
              onClick={() => setRoutineDay(day.id)}
              className={cn("h-9 cursor-pointer rounded-md px-4 text-sm", routineDay === day.id ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
            >
              Tag {day.id}
            </button>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {routine.map((day) => (
            <div key={day.id} className={cn("min-w-0 space-y-2", routineDay !== day.id && "hidden lg:block")}>
              <h3 className="text-sm font-semibold">
                Tag {day.id} <span className="font-normal text-muted-foreground">· {day.weekday}</span>
              </h3>
              <ul className="space-y-2">
                {day.exercises.map((exercise) => {
                  const last = lastByName(exercise.name);
                  const hint = last ? progressionHint(last) : null;
                  const Icon = hint?.tone === "up" ? ArrowUpIcon : hint?.tone === "down" ? ArrowDownIcon : ArrowRightIcon;
                  return (
                    <li key={exercise.name} className="rounded-lg border p-2.5">
                      <p className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 font-medium">{exercise.name}</span>
                        <span className="flex-none text-xs text-muted-foreground tabular-nums">
                          {exercise.sets} × {exercise.repsMin}–{exercise.repsMax}
                        </span>
                      </p>
                      {last ? (
                        <>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            Zuletzt {formatDate(last.day)}: {last.setList.map(([w, r]) => `${w ?? "–"} × ${r ?? "–"}`).join(", ")}
                          </p>
                          {hint && (
                            <p className={cn("mt-1 flex gap-1.5 text-sm", hint.tone === "up" ? "text-good-foreground" : hint.tone === "down" ? "text-bad-foreground" : "")}>
                              <Icon className="mt-0.5 size-4 flex-none" aria-hidden="true" />
                              {hint.text}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Noch nicht in Hevy. Startgewicht aus der Routine nehmen.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Sätze pro Muskelgruppe" aside={<span className="text-xs text-muted-foreground">letzte 7 Tage · Ø pro Woche im Zeitraum</span>}>
          <MuscleBars week={muscles7} range={musclesRange} weeks={weekCount} />
          <Note>Hauptmuskel zählt 1 Satz, Hilfsmuskeln ½ (Muskelgruppen aus Hevy). Grün hinterlegt: 10–20 Sätze pro Woche, ein üblicher Bereich für Muskelaufbau.</Note>
        </Panel>
        <Panel title="Bestwerte, letzte 90 Tage">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine neuen Bestwerte in den letzten 90 Tagen.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((record, index) => (
                <li key={`${record.exercise}-${record.day}-${record.kind}-${index}`} className="flex items-baseline gap-2 py-2">
                  <TrophyIcon className="size-4 flex-none translate-y-0.5 text-debt" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{record.exercise}</span>
                    <span className="block text-xs text-muted-foreground">
                      {record.kind === "e1rm" ? `geschätztes Maximum ${kg(record.value)} (${record.detail})` : `schwerster Satz ${record.detail}`}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDate(record.day)}</span>
                </li>
              ))}
            </ul>
          )}
          <Note>Hevy gibt Bestwerte nicht über die API heraus; sie sind hier aus deinen Sätzen berechnet.</Note>
        </Panel>
      </div>

      <Panel title="Übung im Verlauf" aside={<span className="text-xs text-muted-foreground">Übungen aus dem Zeitraum, die häufigsten zuerst</span>}>
        {!selected ? (
          <p className="text-sm text-muted-foreground">Keine Übungen im Zeitraum.</p>
        ) : (
          <>
            <div role="group" aria-label="Übung wählen" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap">
              {summaries.slice(0, 18).map((summary) => (
                <button
                  key={summary.name}
                  type="button"
                  aria-pressed={summary.name === selected.name}
                  onClick={() => setPicked(summary.name)}
                  className={cn(
                    "min-h-9 flex-none cursor-pointer rounded-full border px-3 text-sm whitespace-nowrap transition-colors",
                    summary.name === selected.name ? "border-brand bg-brand text-brand-foreground" : "bg-card hover:bg-muted",
                  )}
                >
                  {summary.name}
                </button>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-2">
                {!selected.assisted && (
                  <div role="group" aria-label="Kennzahl" className="flex w-fit gap-1 rounded-lg bg-muted p-1">
                    {(["top", "e1rm"] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={metric === key}
                        onClick={() => setMetric(key)}
                        className={cn("h-8 cursor-pointer rounded-md px-3 text-sm", metric === key ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
                      >
                        {key === "top" ? "Top-Satz" : "Geschätztes Maximum"}
                      </button>
                    ))}
                  </div>
                )}
                <LineChart
                  ariaLabel={`${selected.name}: ${metric === "e1rm" ? "geschätztes Maximalgewicht" : "Top-Satz"} im Verlauf`}
                  values={sessions.map(() => null)}
                  smooth={sessions.map((session) => (metric === "e1rm" && !selected.assisted ? sessionE1rm(session) : session.topWeightKg))}
                  dots
                  height={200}
                  format={kg}
                  startLabel={sessions[0] ? formatDate(sessions[0].day) : undefined}
                  endLabel={sessions.at(-1) ? formatDate(sessions.at(-1)!.day) : undefined}
                />
                <Note>
                  {selected.assisted
                    ? "Hilfe in kg pro Einheit, weniger ist besser."
                    : metric === "e1rm"
                      ? "Geschätztes Gewicht für 1 Wiederholung nach Epley (Gewicht × (1 + Wdh./30)), aus dem besten Satz bis 12 Wiederholungen."
                      : "Schwerster Arbeitssatz pro Einheit."}
                </Note>
              </div>
              <dl className="grid grid-cols-2 content-start gap-3">
                <Fact label="Letzter Top-Satz" value={formatSet(selected.last)} sub={formatDate(selected.last.day)} />
                <Fact label="Bestwert" value={formatSet(selected.best)} sub={selected.best ? formatDate(selected.best.day) : undefined} />
                <Fact label="Geschätztes Maximum" value={bestE1rm ? kg(bestE1rm) : "–"} sub={bestE1rm ? "bisher am höchsten" : undefined} />
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
            const check = routineCheck(workout, data.exercises);
            return (
              <li key={workout.id} className="space-y-0.5 py-2.5">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
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
                </p>
                {check && (
                  <p className="text-xs text-muted-foreground">
                    Routine Tag {check.day.id}: {check.done.length} von {check.day.exercises.length} Übungen
                    {check.missing.length > 0 ? `, fehlt: ${check.missing.join(", ")}` : ", komplett"}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

function MuscleBars({ week, range, weeks }: { week: { muscle: string; label: string; sets: number }[]; range: { muscle: string; label: string; sets: number }[]; weeks: number }) {
  const byMuscle = new Map(range.map((entry) => [entry.muscle, entry]));
  const rows = [...new Set([...week.map((entry) => entry.muscle), ...range.map((entry) => entry.muscle)])]
    .map((muscle) => ({
      muscle,
      label: week.find((entry) => entry.muscle === muscle)?.label ?? byMuscle.get(muscle)!.label,
      week: week.find((entry) => entry.muscle === muscle)?.sets ?? 0,
      avg: (byMuscle.get(muscle)?.sets ?? 0) / weeks,
    }))
    .sort((a, b) => b.week - a.week || b.avg - a.avg)
    .slice(0, 14);
  const max = Math.max(24, ...rows.map((row) => Math.max(row.week, row.avg)));
  const x = (value: number) => `${(value / max) * 100}%`;
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.muscle} className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-2 text-sm">
          <span className="truncate">{row.label}</span>
          <span className="relative h-4 rounded-sm bg-muted">
            <span className="absolute inset-y-0 bg-good" style={{ left: x(10), width: `calc(${x(20)} - ${x(10)})` }} />
            <span className="absolute inset-y-[3px] left-0 rounded-sm bg-chart-2" style={{ width: x(row.week) }} />
            <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: x(row.avg) }} title={`Ø ${row.avg.toFixed(1)} pro Woche`} />
          </span>
          <span className="text-right text-xs text-muted-foreground tabular-nums">
            {String(Math.round(row.week * 10) / 10).replace(".", ",")} · Ø {String(Math.round(row.avg * 10) / 10).replace(".", ",")}
          </span>
        </li>
      ))}
    </ul>
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
