"use client";

import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, CheckIcon, TrophyIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { progressionHint, records, routineCheck, setsPerMuscle, streaks } from "./analytics";
import { addDays, formatDate, formatMinutes, formatTonnes, gymWeeks, lastWeeks, mondayOf, weekday } from "./calc";
import { MuscleBars } from "./gym";
import { planFromSettings, planWeekOf, routine, sameExercise, type RoutineDay } from "./plan";
import { useSportData } from "./store";
import { Note, Panel, SmallRing } from "./ui";

const kg = (value: number) => `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value)} kg`;
const SHORT_DAY: Record<RoutineDay["id"], string> = { A: "Di", B: "Do", C: "Sa/So" };

export function GymPlanTab({ today }: { today: string }) {
  const data = useSportData();
  const monday = mondayOf(today);
  const end = addDays(monday, 6);
  const fullPlan = planFromSettings(data.settings);
  const planWeek = planWeekOf(fullPlan, today);
  const goal = planWeek?.gym ?? data.settings.gymPerWeek;

  const checks = data.workouts
    .filter((workout) => workout.day >= monday && workout.day <= end)
    .map((workout) => routineCheck(workout, data.exercises))
    .filter((check) => check != null);
  const doneDays = new Set(checks.map((check) => check.day.id));
  const sessions = data.workouts.filter((workout) => workout.day >= monday && workout.day <= end).length;

  const weeks4 = lastWeeks(today, 5);
  const volume = gymWeeks(data.exercises, data.workouts, weeks4);
  const thisVolume = volume.at(-1)?.volumeKg ?? 0;
  const avgVolume = volume.slice(0, 4).reduce((sum, week) => sum + week.volumeKg, 0) / 4;
  const best = records(data.exercises).find((record) => record.day >= addDays(today, -13)) ?? null;

  const gymByWeek = new Map<string, number>();
  for (const workout of data.workouts) gymByWeek.set(mondayOf(workout.day), (gymByWeek.get(mondayOf(workout.day)) ?? 0) + 1);
  const runsByWeek = new Map<string, number>();
  for (const run of data.runs) runsByWeek.set(mondayOf(run.day), (runsByWeek.get(mondayOf(run.day)) ?? 0) + 1);
  const streak = streaks(data, today, gymByWeek, runsByWeek, fullPlan);

  const muscles = setsPerMuscle(data.exercises, data.templates, monday, today);
  const muscles4 = setsPerMuscle(data.exercises, data.templates, addDays(monday, -28), addDays(monday, -1));

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">{planWeek ? `Gym · Plan-Woche ${planWeek.number}` : "Gym · diese Woche"}</p>
            <h2 className="text-2xl font-extrabold tracking-tight tabular-nums">
              {Math.min(sessions, goal)} von {goal} {goal === 1 ? "Tag" : "Tagen"}
            </h2>
          </div>
          {streak.gym > 0 && <span className="rounded-full bg-good px-2.5 py-1 text-xs font-bold text-good-foreground tabular-nums">{streak.gym} Wo. Serie</span>}
        </div>
        <ul className="grid grid-cols-3 gap-2">
          {routine.map((day) => {
            const check = checks.find((entry) => entry.day.id === day.id);
            const done = doneDays.has(day.id);
            return (
              <li key={day.id} className="flex min-w-0 flex-col items-center gap-1 text-center">
                <SmallRing value={done ? (check ? check.done.length / day.exercises.length : 1) : 0} size={84} className="text-brand" label={`Tag ${day.id} ${done ? "erledigt" : "offen"}`} dashed={!done && day.id === "C"}>
                  {done ? <CheckIcon className="size-7" strokeWidth={3} aria-hidden="true" /> : <span className="text-xl text-brand">{day.id}</span>}
                </SmallRing>
                <strong className="text-sm">Tag {day.id}</strong>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {check
                    ? `${formatDate(check.workout.day)}${check.workout.durationS ? ` · ${formatMinutes(check.workout.durationS / 60)}` : ""}`
                    : `${SHORT_DAY[day.id]} · offen`}
                </span>
                {check && check.missing.length > 0 && <span className="text-xs text-bad-foreground">{check.missing.length} Übung{check.missing.length === 1 ? "" : "en"} fehlt</span>}
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-2xl bg-brand p-4 text-brand-foreground">
          <span className="text-xs font-semibold opacity-85">Volumen diese Woche</span>
          <strong className="text-2xl font-extrabold tabular-nums">{formatTonnes(thisVolume)}</strong>
          <span className="text-xs opacity-85 tabular-nums">Ø {formatTonnes(avgVolume)} pro Woche</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <TrophyIcon className="size-3.5" aria-hidden="true" /> Neuer Bestwert
          </span>
          {best ? (
            <>
              <strong className="leading-tight font-bold text-balance">{best.exercise}</strong>
              <span className="text-xs text-muted-foreground tabular-nums">
                {best.kind === "e1rm" ? `Maximum ≈ ${kg(best.value)}` : best.detail} · {formatDate(best.day)}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">In den letzten 2 Wochen keiner.</span>
          )}
        </div>
      </div>

      <Panel title="Sätze pro Muskelgruppe" aside={<span className="text-xs text-muted-foreground">diese Woche · Strich: Ø der 4 Wochen davor</span>}>
        {muscles.length === 0 && muscles4.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Sätze aus Hevy.</p>
        ) : (
          <MuscleBars week={muscles} range={muscles4} weeks={4} />
        )}
        <Note>Hauptmuskel zählt 1 Satz, Hilfsmuskeln ½. Hell hinterlegt: 10–20 Sätze pro Woche.</Note>
      </Panel>

      <RoutineDays today={today} />
    </div>
  );
}

// The routine days with last sets and the next step (double progression).
function RoutineDays({ today }: { today: string }) {
  const data = useSportData();
  const dayIndex = weekday(today);
  const [picked, setPicked] = useState<RoutineDay["id"]>(dayIndex <= 1 ? "A" : dayIndex <= 3 ? "B" : dayIndex <= 5 ? "C" : "A");
  const day = routine.find((entry) => entry.id === picked)!;
  const lastByName = (name: string) => [...data.exercises].reverse().find((session) => sameExercise(name, session.exercise)) ?? null;
  const hints = day.exercises.map((exercise) => {
    const last = lastByName(exercise.name);
    return { exercise, last, hint: last ? progressionHint(last) : null };
  });
  const up = hints.filter((entry) => entry.hint?.tone === "up").length;

  return (
    <section className="space-y-3" aria-labelledby="routine-days">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 id="routine-days" className="text-base font-bold">
          Trainingstage
        </h2>
        <span className="text-xs text-muted-foreground">doppelte Progression aus deiner Routine</span>
      </div>
      <div role="group" aria-label="Trainingstag" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {routine.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={picked === entry.id}
            onClick={() => setPicked(entry.id)}
            className={cn("h-10 cursor-pointer rounded-lg text-sm", picked === entry.id ? "bg-brand font-bold text-brand-foreground shadow-sm" : "text-muted-foreground")}
          >
            {entry.id} · {SHORT_DAY[entry.id]}
          </button>
        ))}
      </div>
      <ul className="flex flex-wrap gap-1.5 text-xs font-semibold" aria-label="Zusammenfassung">
        <li className="rounded-full bg-muted px-2.5 py-1">{day.exercises.length} Übungen</li>
        <li className="rounded-full bg-muted px-2.5 py-1">{day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0)} Sätze</li>
        {up > 0 && <li className="rounded-full bg-good px-2.5 py-1 text-good-foreground">{up} × steigern</li>}
      </ul>
      <ul className="grid gap-2 lg:grid-cols-2">
        {hints.map(({ exercise, last, hint }) => {
          const Icon = hint?.tone === "up" ? ArrowUpIcon : hint?.tone === "down" ? ArrowDownIcon : ArrowRightIcon;
          const goalMatch = exercise.goal?.match(/([\d,.]+)\s*kg\s*×/);
          const goalKg = goalMatch && !last?.assisted ? Number(goalMatch[1].replace(",", ".")) : null;
          const ratio = goalKg && last?.topWeightKg ? last.topWeightKg / goalKg : null;
          return (
            <li key={exercise.name} className="space-y-2.5 rounded-2xl border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <strong className="min-w-0 font-bold">{exercise.name}</strong>
                <span className="flex-none text-xs text-muted-foreground tabular-nums">
                  {exercise.sets} × {exercise.repsMin}–{exercise.repsMax}
                </span>
              </div>
              {last ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {last.setList.map(([weight, reps], index) => (
                      <span key={index} className="rounded-lg bg-muted px-2.5 py-1 text-sm font-semibold tabular-nums">
                        {weight != null ? kg(weight) : "–"} × {reps ?? "–"}
                      </span>
                    ))}
                    <span className="text-xs text-muted-foreground">{formatDate(last.day)}</span>
                  </div>
                  {hint && (
                    <p
                      className={cn(
                        "flex gap-2 rounded-xl px-3 py-2 text-sm font-medium",
                        hint.tone === "up" ? "bg-good text-good-foreground" : hint.tone === "down" ? "bg-bad text-bad-foreground" : "bg-muted",
                      )}
                    >
                      <Icon className="mt-0.5 size-4 flex-none" aria-hidden="true" />
                      {hint.text}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Noch nicht in Hevy. Startgewicht aus der Routine nehmen.</p>
              )}
              {exercise.goal && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Ziel {exercise.goal}</span>
                    {ratio != null && <span className="tabular-nums">{Math.round(Math.min(1, ratio) * 100)} %</span>}
                  </div>
                  {ratio != null && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(1, ratio) * 100}%` }} />
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
