// The gym routine from plan.ts as Hevy routines (one per day A/B/C), for the
// upload in the Gym tab. Pure: the edge function sport-sync (?push=routines)
// finds templates for exercises not yet done in Hevy and writes the routines.
import { progressionHint } from "./analytics";
import { routine, sameExercise, warmup, WARMUP_TEMPLATE } from "./plan";
import type { ExerciseSession } from "./types";

export type RoutineUploadSet = {
  type: "normal" | "warmup";
  weightKg: number | null;
  reps: number | null;
  repsMin: number | null;
  repsMax: number | null;
  durationS: number | null;
};

export type RoutineUploadExercise = {
  name: string;
  // From plan.ts (warm-up) or the workouts where this exercise was last done.
  templateId: string | null;
  restSeconds: number | null;
  notes: string;
  sets: RoutineUploadSet[];
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
const roundKg = (kg: number) => Math.round(kg / 2.5) * 2.5;
const letters = (name: string) => name.toLowerCase().replace(/[^a-zäöüß]+/g, "");
const set = (patch: Partial<RoutineUploadSet>): RoutineUploadSet => ({
  type: "normal",
  weightKg: null,
  reps: null,
  repsMin: null,
  repsMax: null,
  durationS: null,
  ...patch,
});

// The warm-up block: items with a Hevy template as their own exercises, the
// rest listed in the note of Hevy's "Warm Up".
function warmupExercises(): RoutineUploadExercise[] {
  const own = warmup.filter((item) => item.hevy);
  const rest = warmup.filter((item) => !item.hevy && !item.name.startsWith("Aufwärmsätze"));
  const [first, ...others] = own;
  const asExercise = (item: (typeof own)[number]): RoutineUploadExercise => ({
    name: item.name,
    templateId: item.hevy!.templateId,
    restSeconds: null,
    notes: `${item.amount} · ${item.note}`,
    sets: [set({ type: "warmup", reps: item.hevy!.reps ?? null, durationS: item.hevy!.durationS ?? null })],
  });
  return [
    ...(first ? [asExercise(first)] : []),
    {
      name: "Aufwärmen",
      templateId: WARMUP_TEMPLATE,
      restSeconds: null,
      notes: rest.map((item) => `${item.name}: ${item.amount} (${item.note})`).join("\n"),
      sets: [set({ type: "warmup", durationS: 300 })],
    },
    ...others.map(asExercise),
  ];
}

export function routineUploads(exercises: ExerciseSession[]): RoutineUpload[] {
  // The same name first (Bankdrücken (Kurzhantel) is not Bankdrücken (Langhantel)),
  // then the looser match that ignores equipment and gym names.
  const lastByName = (name: string) =>
    [...exercises].reverse().find((session) => letters(session.exercise) === letters(name)) ??
    [...exercises].reverse().find((session) => sameExercise(name, session.exercise)) ??
    null;
  return routine.map((day) => ({
    title: routineTitle(day.id),
    notes: `${day.weekday} · aus dem Sport-Dashboard (Privatlab). Erst Aufwärmen (10–12 min), dann doppelte Progression: Wiederholungen bis zur Obergrenze, dann +2,5–5 %.`,
    exercises: [
      ...warmupExercises(),
      ...day.exercises.map((exercise, index) => {
        const last = lastByName(exercise.name);
        const hint = last ? progressionHint(last) : null;
        const weightKg = hint?.kg ?? null;
        const notes = [`${exercise.sets} × ${exercise.repsMin}–${exercise.repsMax} Wdh.`, exercise.goal ? `Ziel: ${exercise.goal}` : null, hint?.text ?? null]
          .filter(Boolean)
          .join(" · ");
        // Warm-up sets (50 / 70 %) before the first exercise of the day; not for
        // assisted exercises, where the weight is the help.
        const ramp = index === 0 && weightKg && !last?.assisted ? [[0.5, 8], [0.7, 5]].map(([share, reps]) => set({ type: "warmup", weightKg: roundKg(weightKg * share), reps })) : [];
        return {
          name: exercise.name,
          templateId: last?.templateId ?? null,
          restSeconds: restFor(exercise.repsMax),
          notes,
          sets: [
            ...ramp,
            ...Array.from({ length: exercise.sets }, () => set({ weightKg, repsMin: exercise.repsMin, repsMax: exercise.repsMax })),
          ],
        };
      }),
    ],
  }));
}
