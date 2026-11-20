// The gym routine from plan.ts as Hevy routines (one per day A/B/C), for the
// upload in the Gym tab. Pure: the edge function sport-sync (?push=routines)
// finds templates for exercises not yet done in Hevy and writes the routines.
import { progressionHint } from "./analytics";
import { routine, sameExercise } from "./plan";
import type { ExerciseSession } from "./types";

export type RoutineUploadExercise = {
  name: string;
  // From the workouts where this exercise was last done, if any.
  templateId: string | null;
  sets: number;
  repsMin: number;
  repsMax: number;
  // Start weight from the "Nächstes Mal" hint (for assisted exercises: the help).
  weightKg: number | null;
  restSeconds: number;
  notes: string;
};

export type RoutineUpload = { title: string; notes: string; exercises: RoutineUploadExercise[] };

// What sport-sync answers: per routine whether it is new or replaces one with
// the same title, the template each exercise got, and the ones without one.
export type RoutinePreview = {
  title: string;
  action: "create" | "update";
  exercises: { name: string; templateId: string; templateTitle: string | null }[];
  missing: string[];
  error?: string;
};

export const routineTitle = (id: string) => `Ganzkörper ${id}`;

// Heavy compound lifts get more rest than isolation work.
const restFor = (repsMax: number) => (repsMax <= 10 ? 150 : repsMax <= 12 ? 120 : 90);

export function routineUploads(exercises: ExerciseSession[]): RoutineUpload[] {
  const lastByName = (name: string) => [...exercises].reverse().find((session) => sameExercise(name, session.exercise)) ?? null;
  return routine.map((day) => ({
    title: routineTitle(day.id),
    notes: `${day.weekday} · aus dem Sport-Dashboard (Privatlab). Doppelte Progression: Wiederholungen bis zur Obergrenze, dann +2,5–5 %.`,
    exercises: day.exercises.map((exercise) => {
      const last = lastByName(exercise.name);
      const hint = last ? progressionHint(last) : null;
      const notes = [`${exercise.sets} × ${exercise.repsMin}–${exercise.repsMax} Wdh.`, exercise.goal ? `Ziel: ${exercise.goal}` : null, hint?.text ?? null]
        .filter(Boolean)
        .join(" · ");
      return {
        name: exercise.name,
        templateId: last?.templateId ?? null,
        sets: exercise.sets,
        repsMin: exercise.repsMin,
        repsMax: exercise.repsMax,
        weightKg: hint?.kg ?? null,
        restSeconds: restFor(exercise.repsMax),
        notes,
      };
    }),
  }));
}
