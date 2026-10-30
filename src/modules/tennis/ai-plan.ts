import Anthropic from "@anthropic-ai/sdk";
import {
  agesLabel,
  arrowTypes,
  focusTags,
  hasVariations,
  phaseName,
  phases,
  pieceTypes,
  playersLabel,
  principlesForPrompt,
  slotsFor,
  stageLabel,
  weekdayNames,
  type Exercise,
  type Group,
  type Player,
} from "./data";

// Plans a session from a sentence in plain German ("Vorhandfokus für die U10,
// zum Aufwärmen Tic Tac Toe und zwei Spiele"): Claude picks exercises from
// the collection and may invent missing ones, which the caller saves. Also
// invents exercises for the collection (askForExercises).

const MODEL = "claude-opus-5-5";

const diagramItem = {
  type: "object",
  properties: {
    type: { type: "string", enum: [...pieceTypes, ...arrowTypes] },
    x: { type: "number" },
    y: { type: "number" },
    x2: { type: "number", description: "arrow end; 0 for pieces" },
    y2: { type: "number", description: "arrow end; 0 for pieces" },
    label: { type: "string", description: "player label, empty if none" },
  },
  required: ["type", "x", "y", "x2", "y2", "label"],
  additionalProperties: false,
} as const;

const newExercise = {
  type: "object",
  properties: {
    name: { type: "string" },
    phase: { type: "string", enum: phases.map((phase) => phase.id) },
    minutes: { type: "integer" },
    summary: { type: "string" },
    description: { type: "string" },
    tips: { type: "array", items: { type: "string" } },
    focus: { type: "array", items: { type: "string", enum: [...focusTags] } },
    players_min: { type: "integer", description: "0 if any number" },
    players_max: { type: "integer", description: "0 if any number" },
    variations: {
      type: "object",
      description: "One short German sentence each, empty if there is nothing to say",
      properties: {
        easier: { type: "string" },
        harder: { type: "string" },
        fewer: { type: "string", description: "for fewer kids" },
        more: { type: "string", description: "for more kids" },
      },
      required: ["easier", "harder", "fewer", "more"],
      additionalProperties: false,
    },
    diagram: { type: "array", items: diagramItem },
  },
  required: ["name", "phase", "minutes", "summary", "description", "tips", "focus", "players_min", "players_max", "variations", "diagram"],
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
          exercise_id: { type: "string", description: "id from the collection, or empty for a new exercise" },
          new_exercise_index: { type: "integer", description: "index into new_exercises when exercise_id is empty, otherwise -1" },
          minutes: { type: "integer" },
        },
        required: ["exercise_id", "new_exercise_index", "minutes"],
        additionalProperties: false,
      },
    },
    new_exercises: {
      type: "array",
      description: "Only exercises the coach asked for that are not in the collection",
      items: newExercise,
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
  items: { exercise_id: string; new_exercise_index: number; minutes: number }[];
  new_exercises: Record<string, unknown>[];
  note: string;
};

// How a good exercise for the collection looks; shared by both requests.
const exerciseGuide = `A new exercise is kid-friendly and in German: a catchy name, a one-sentence summary, a 2-5 sentence description (setup, rules, points, rotation), 2-3 short cues to call out, the variations (easier, harder, for fewer and for more kids; this is what keeps a block from getting boring), and a court sketch with 3-12 items (coordinates in meters from the net center: x across from -8 to 8, doubles sidelines at ±5.49, singles sidelines at ±4.12; y along from -14.5 to 14.5, service lines at ±6.4, baselines at ±11.89; the coach's half is y < 0; "run" and "shot" arrows go from x,y to x2,y2; pieces use 0 for x2/y2; player labels 1-3 characters, empty for other pieces). Prefer game forms (with or against each other, points, records, team contests) over plain drills, and forms that run without the coach feeding every ball.`;

const system = `You plan tennis training sessions for a club coach in Bavaria (BTV C-Trainer training) who trains groups of children and teenagers (beginners to intermediate). The coach writes a short request in German; you answer with the session as JSON.

How to build a session (BTV "Planung von Trainingseinheiten"):
- Use exercises from the coach's collection by their id. Follow the usual shape unless the request says otherwise: about 10 minutes of playful warm-up, a main part of 2-4 short blocks that build on each other (coordination before technique before tactics before fitness), and a closing game. The minutes add up to the session length.
- Keep blocks short: 5-10 minutes for kids, at most 15. Kids keep their focus with quick changes.
- Do exactly what the request asks: a focus ("Vorhandfokus") means technique blocks and games that train it; named exercises are used in the named part; "zwei Spiele" means two game items.
- Match named exercises generously ("tic tac toe" matches "Tic-Tac-Toe-Staffel"). Only if nothing in the collection fits, add it to new_exercises.
- Respect the number of kids: never pick an exercise whose player range excludes them. Fit the kids' age and Play+Stay stage (red: small court, orange: midcourt, green: full court).
- Prefer the group's favorites and avoid what it played in its last sessions, unless asked for.
- Pick the group the request names (names can be partial or misspelled); otherwise keep the preselected one. Resolve dates like "heute", "morgen" or "Mittwoch" from today's date; otherwise use null.
- Write the note in German, addressed to the coach with "du", only when something could not be done as asked.

${exerciseGuide}`;

const exerciseSystem = `You invent tennis exercises for a club coach in Bavaria (BTV C-Trainer training) who trains groups of children and teenagers (beginners to intermediate). The coach writes in German what they need; you answer with the exercises as JSON. Unless asked for a number, write 3-5. Don't repeat exercises the collection already has.

${exerciseGuide}`;

function exerciseLine(exercise: Exercise) {
  return [
    exercise.id,
    exercise.name,
    phaseName(exercise.phase),
    `${exercise.minutes} Min.`,
    exercise.focus.join("/") || "-",
    playersLabel(exercise) ?? "beliebig viele Kinder",
    exercise.summary,
    hasVariations(exercise.variations) ? "has variations" : "",
  ].join(" | ");
}

function groupLine(group: Group, players: Player[], today: string) {
  const kids = players.filter((player) => player.groupId === group.id);
  return [
    `- id ${group.id}: ${group.name}`,
    group.weekday ? `trains ${weekdayNames[group.weekday - 1]} ${group.startTime}` : `starts ${group.startTime}`,
    group.coach ? `usually coached by ${group.coach}, I only stand in on some dates` : null,
    `${group.minutes} min`,
    kids.length ? `${kids.length} kids` : "number of kids unknown",
    agesLabel(kids, today) ? `aged ${agesLabel(kids, today)}` : null,
    group.stage ? `Play+Stay ${stageLabel(group.stage)}` : null,
    group.note ? `note: ${group.note}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

const client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Sends the request with a JSON schema and parses the answer, or says in
// German what went wrong.
async function ask<T>(system: string, content: string, format: Record<string, unknown>): Promise<T | { error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: "Für den KI-Assistenten braucht es einen ANTHROPIC_API_KEY." };
  try {
    const response = await client().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: format } },
      system: [{ type: "text", text: system }],
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") return { error: "Die KI hat die Anfrage abgelehnt. Formulier sie bitte anders." };
    if (response.stop_reason !== "end_turn") return { error: "Die KI hat keine vollständige Antwort geliefert." };
    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") return { error: "Die KI hat keine Antwort geliefert." };
    return JSON.parse(text.text) as T;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { error: "Die KI ist gerade ausgelastet. Versuch es gleich noch einmal." };
    if (error instanceof Anthropic.BadRequestError) {
      console.error("AI request rejected:", error.message);
      return { error: `Die KI hat die Anfrage abgelehnt (400: ${error.message.slice(0, 200)}).` };
    }
    if (error instanceof Anthropic.APIError) return { error: `Die KI ist nicht erreichbar (${error.status ?? "Fehler"}).` };
    if (error instanceof SyntaxError) return { error: "Die Antwort der KI war unvollständig." };
    return { error: "Die KI ist nicht erreichbar." };
  }
}

// Exercises as the AI writes them, with the diagram as a plain list.
function fromAi(entry: Record<string, unknown>) {
  return {
    ...entry,
    playersMin: Number(entry.players_min) || null,
    playersMax: Number(entry.players_max) || null,
    diagram: {
      items: (Array.isArray(entry.diagram) ? entry.diagram : []).map((item: Record<string, unknown>) => ({ ...item, label: item.label || undefined })),
    },
  };
}

export async function askForExercises({
  request,
  today,
  exercises,
  groups,
  players,
  principles,
}: {
  request: string;
  today: string;
  exercises: Exercise[];
  groups: Group[];
  players: Player[];
  principles: string;
}): Promise<{ exercises: Record<string, unknown>[] } | { error: string }> {
  const context = `${principlesForPrompt(principles)}

The coach's groups (for context):
${groups.map((group) => groupLine(group, players, today)).join("\n") || "(no groups)"}

Exercises already in the collection:
${exercises.map((exercise) => `- ${exercise.name} (${phaseName(exercise.phase)})`).join("\n") || "(none)"}`;
  const answer = await ask<{ exercises: Record<string, unknown>[] }>(exerciseSystem, `${context}\n\nWhat the coach needs:\n${request}`, {
    type: "object",
    properties: { exercises: { type: "array", items: newExercise } },
    required: ["exercises"],
    additionalProperties: false,
  });
  if ("error" in answer) return answer;
  return { exercises: answer.exercises.map(fromAi) };
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
  players,
  principles,
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
  players: Player[];
  principles: string;
}): Promise<AiPlanAnswer | { error: string }> {
  const name = (id: string) => exercises.find((exercise) => exercise.id === id)?.name ?? id;
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();

  const context = `Today: ${weekdayNames[(weekday + 6) % 7]}, ${today}.
Preselected: group ${groupId ?? "none"}, date ${date}.

${principlesForPrompt(principles)}

Groups:
${groups
  .map((group) =>
    [
      groupLine(group, players, today),
      favorites[group.id]?.length ? `favorites: ${favorites[group.id].map(name).join(", ")}` : null,
      recent[group.id]?.length ? `played lately: ${recent[group.id].map(name).join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("; "),
  )
  .join("\n") || "(no groups)"}

Usual shape for the preselected group: ${slotsFor(groups.find((group) => group.id === groupId)?.minutes ?? 60)
    .map((slot) => `${phaseName(slot.phase)} ${slot.minutes}`)
    .join(" + ")}

Collection (id | name | part | minutes | focus | kids | summary | variations):
${exercises.map(exerciseLine).join("\n")}`;

  const answer = await ask<AiPlanAnswer>(system, `${context}\n\nRequest from the coach:\n${request}`, schema);
  if ("error" in answer) return answer;
  return { ...answer, new_exercises: answer.new_exercises.map(fromAi) };
}
