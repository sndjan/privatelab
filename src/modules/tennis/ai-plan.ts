import Anthropic from "@anthropic-ai/sdk";
import {
  arrowTypes,
  focusTags,
  phaseName,
  phases,
  pieceTypes,
  playersLabel,
  slotsFor,
  weekdayNames,
  type Exercise,
  type Group,
} from "./data";

// Plans a session from a sentence in plain German ("Vorhandfokus für die U10,
// zum Aufwärmen Tic Tac Toe und zwei Spiele"): Claude picks exercises from
// the collection and may invent missing ones, which the caller saves.

const MODEL = "claude-opus-5-5";

const diagramItem = {
  type: "object",
  properties: {
    type: { type: "string", enum: [...pieceTypes, ...arrowTypes] },
    x: { type: "number" },
    y: { type: "number" },
    x2: { type: ["number", "null"] },
    y2: { type: ["number", "null"] },
    label: { type: ["string", "null"] },
  },
  required: ["type", "x", "y", "x2", "y2", "label"],
  additionalProperties: false,
} as const;

const schema = {
  type: "object",
  properties: {
    group_id: { type: ["string", "null"], description: "id of the group the session is for, null if none fits" },
    date: { type: ["string", "null"], description: "YYYY-MM-DD, null to keep the default" },
    start_time: { type: ["string", "null"], description: "HH:MM, null to use the group's time" },
    focus: { type: ["string", "null"], enum: [...focusTags, null] },
    items: {
      type: "array",
      description: "The session in order",
      items: {
        type: "object",
        properties: {
          exercise_id: { type: ["string", "null"], description: "id from the collection, or null for a new exercise" },
          new_exercise_index: { type: ["integer", "null"], description: "index into new_exercises when exercise_id is null" },
          minutes: { type: "integer" },
        },
        required: ["exercise_id", "new_exercise_index", "minutes"],
        additionalProperties: false,
      },
    },
    new_exercises: {
      type: "array",
      description: "Only exercises the coach asked for that are not in the collection",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          phase: { type: "string", enum: phases.map((phase) => phase.id) },
          minutes: { type: "integer" },
          summary: { type: "string" },
          description: { type: "string" },
          tips: { type: "array", items: { type: "string" } },
          focus: { type: "array", items: { type: "string", enum: [...focusTags] } },
          players_min: { type: ["integer", "null"] },
          players_max: { type: ["integer", "null"] },
          diagram: { type: "array", items: diagramItem },
        },
        required: ["name", "phase", "minutes", "summary", "description", "tips", "focus", "players_min", "players_max", "diagram"],
        additionalProperties: false,
      },
    },
    note: { type: "string", description: "One or two short German sentences for the coach, e.g. what couldn't be done. Empty if nothing to say." },
  },
  required: ["group_id", "date", "start_time", "focus", "items", "new_exercises", "note"],
  additionalProperties: false,
} as const;

export type AiPlanAnswer = {
  group_id: string | null;
  date: string | null;
  start_time: string | null;
  focus: string | null;
  items: { exercise_id: string | null; new_exercise_index: number | null; minutes: number }[];
  new_exercises: Record<string, unknown>[];
  note: string;
};

const system = `You plan tennis training sessions for a club coach who trains groups of children and teenagers (beginners to intermediate). The coach writes a short request in German; you answer with the session as JSON.

How to build a session:
- Use exercises from the coach's collection by their id. Follow the usual shape unless the request says otherwise: warm-up, one technique block per ~15 minutes, a game, and from 45 minutes on a short finish (60 minutes: 10 + 15 + 15 + 15 + 5). The minutes add up to the session length.
- Do exactly what the request asks: a focus ("Vorhandfokus") means technique blocks and games that train it; named exercises are used in the named part; "zwei Spiele" means two game items.
- Match named exercises generously ("tic tac toe" matches "Tic-Tac-Toe-Staffel"). Only if nothing in the collection fits, add it to new_exercises: a kid-friendly German exercise with a short summary, 2-5 sentence description, 2-3 short cues to call out, and a court sketch (coordinates in meters from the net center: x across from -8 to 8, doubles sidelines at ±5.49; y along from -14.5 to 14.5, service lines at ±6.4, baselines at ±11.89; the coach's half is y < 0; "run" and "shot" arrows go from x,y to x2,y2; pieces use null for x2/y2; player labels 1-3 characters).
- Respect the number of kids: never pick an exercise whose player range excludes them.
- Prefer the group's favorites and avoid what it played in its last sessions, unless asked for.
- Pick the group the request names (names can be partial or misspelled); otherwise keep the preselected one. Resolve dates like "heute", "morgen" or "Mittwoch" from today's date; otherwise use null.
- Write the note in German, addressed to the coach with "du", only when something could not be done as asked.`;

function exerciseLine(exercise: Exercise) {
  return [
    exercise.id,
    exercise.name,
    phaseName(exercise.phase),
    `${exercise.minutes} Min.`,
    exercise.focus.join("/") || "-",
    playersLabel(exercise) ?? "beliebig viele Kinder",
    exercise.summary,
  ].join(" | ");
}

export async function askForPlan({
  request,
  today,
  groups,
  groupId,
  date,
  exercises,
  favorites,
  recent,
  kids,
}: {
  request: string;
  today: string;
  groups: Group[];
  groupId: string | null;
  date: string;
  exercises: Exercise[];
  // Per group id: exercise ids.
  favorites: Record<string, string[]>;
  recent: Record<string, string[]>;
  kids: Record<string, number>;
}): Promise<AiPlanAnswer | { error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: "Für den KI-Assistenten braucht es einen ANTHROPIC_API_KEY." };
  const name = (id: string) => exercises.find((exercise) => exercise.id === id)?.name ?? id;
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();

  const context = `Today: ${weekdayNames[(weekday + 6) % 7]}, ${today}.
Preselected: group ${groupId ?? "none"}, date ${date}.

Groups:
${groups
  .map((group) =>
    [
      `- id ${group.id}: ${group.name}`,
      group.weekday ? `trains ${weekdayNames[group.weekday - 1]} ${group.startTime}` : `starts ${group.startTime}`,
      `${group.minutes} min`,
      kids[group.id] ? `${kids[group.id]} kids` : "number of kids unknown",
      favorites[group.id]?.length ? `favorites: ${favorites[group.id].map(name).join(", ")}` : null,
      recent[group.id]?.length ? `played lately: ${recent[group.id].map(name).join(", ")}` : null,
      group.note ? `note: ${group.note}` : null,
    ]
      .filter(Boolean)
      .join("; "),
  )
  .join("\n") || "(no groups)"}

Usual shape for the preselected group: ${slotsFor(groups.find((group) => group.id === groupId)?.minutes ?? 60)
    .map((slot) => `${phaseName(slot.phase)} ${slot.minutes}`)
    .join(" + ")}

Collection (id | name | part | minutes | focus | kids | summary):
${exercises.map(exerciseLine).join("\n")}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system: [{ type: "text", text: system }],
      messages: [{ role: "user", content: `${context}\n\nRequest from the coach:\n${request}` }],
    });
    if (response.stop_reason === "refusal") return { error: "Die KI hat die Anfrage abgelehnt. Formulier sie bitte anders." };
    if (response.stop_reason !== "end_turn") return { error: "Die KI hat keine vollständige Antwort geliefert." };
    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") return { error: "Die KI hat keine Antwort geliefert." };
    return JSON.parse(text.text) as AiPlanAnswer;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { error: "Die KI ist gerade ausgelastet. Versuch es gleich noch einmal." };
    if (error instanceof Anthropic.APIError) return { error: `Die KI ist nicht erreichbar (${error.status ?? "Fehler"}).` };
    if (error instanceof SyntaxError) return { error: "Die Antwort der KI war unvollständig." };
    return { error: "Die KI ist nicht erreichbar." };
  }
}
