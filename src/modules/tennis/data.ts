// Shared by server and client components of the tennis trainer module:
// types, the court diagram format, the session generator and the JSON format
// for exercises written by an AI chat.

export const phases = [
  { id: "warmup", name: "Aufwärmen" },
  { id: "technique", name: "Technik" },
  { id: "game", name: "Spiel" },
  { id: "cooldown", name: "Abschluss" },
] as const;

export type Phase = (typeof phases)[number]["id"];

export const phaseName = (phase: Phase) => phases.find((entry) => entry.id === phase)?.name ?? phase;

export const focusTags = [
  "Vorhand",
  "Rückhand",
  "Volley",
  "Aufschlag",
  "Beinarbeit",
  "Koordination",
  "Ballgefühl",
  "Taktik",
] as const;

export type Exercise = {
  id: string;
  name: string;
  phase: Phase;
  minutes: number;
  summary: string;
  description: string;
  // Short cues to call out while the kids play.
  tips: string[];
  focus: string[];
  diagram: Diagram;
  notes: string;
  // How many kids the exercise works for; null = no limit.
  playersMin: number | null;
  playersMax: number | null;
  // How to make it easier or harder, or fit fewer or more kids ("" = none).
  variations: Variations;
};

export const variationKinds = [
  { id: "easier", name: "Leichter" },
  { id: "harder", name: "Schwerer" },
  { id: "fewer", name: "Weniger Kinder" },
  { id: "more", name: "Mehr Kinder" },
] as const;

export type VariationKind = (typeof variationKinds)[number]["id"];
export type Variations = Record<VariationKind, string>;

export const noVariations: Variations = { easier: "", harder: "", fewer: "", more: "" };

export const hasVariations = (variations: Variations) => variationKinds.some((kind) => variations[kind.id]);

// Reads variations from the database or an AI's JSON.
export function parseVariations(value: unknown): Variations {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    variationKinds.map((kind) => [kind.id, typeof raw[kind.id] === "string" ? (raw[kind.id] as string).trim().slice(0, 300) : ""]),
  ) as Variations;
}

export type Group = {
  id: string;
  name: string;
  note: string;
  startTime: string; // "16:00"
  minutes: number;
  // ISO weekday the group trains on: 1 = Monday … 7 = Sunday.
  weekday: number | null;
  // Who usually coaches it; "" = me. For someone else's group only the
  // stand-in dates are my training days.
  coach: string;
  // Play+Stay stage: ball, racket and court size; null = not set.
  stage: Stage | null;
};

// The DTB/BTV Play+Stay stages, by age (6-13 years over 3-4 years).
export const stages = [
  { id: "red", name: "Rot", court: "Kleinfeld", ages: "bis ca. 8 Jahre" },
  { id: "orange", name: "Orange", court: "Midcourt", ages: "ca. 8–10 Jahre" },
  { id: "green", name: "Grün", court: "Großfeld", ages: "ca. 9–11 Jahre" },
  { id: "yellow", name: "Gelb", court: "Großfeld", ages: "ab ca. 11 Jahren" },
] as const;

export type Stage = (typeof stages)[number]["id"];

export const isStage = (value: unknown): value is Stage => stages.some((stage) => stage.id === value);
export const stageLabel = (stage: Stage) => {
  const entry = stages.find((candidate) => candidate.id === stage)!;
  return `${entry.name} (${entry.court})`;
};

// A date I stand in for a group's regular coach.
export type StandIn = { id: string; groupId: string; date: string; note: string };

export type Gender = "m" | "f";

export type Player = { id: string; groupId: string; name: string; gender: Gender | null; birthYear: number | null };

// The age a kid turns this year: what clubs go by ("Jahrgang").
export const ageOf = (birthYear: number, today: string) => Number(today.slice(0, 4)) - birthYear;

// "7–9 Jahre" for the kids whose year is known, null if none is.
export function agesLabel(players: Pick<Player, "birthYear">[], today: string) {
  const ages = players.flatMap((player) => (player.birthYear ? [ageOf(player.birthYear, today)] : []));
  if (ages.length === 0) return null;
  const min = Math.min(...ages);
  const max = Math.max(...ages);
  return min === max ? `${min} Jahre` : `${min}–${max} Jahre`;
}

export const genderName = { m: "Junge", f: "Mädchen" } as const;

// Days without training, e.g. school holidays.
export type Holiday = { id: string; name: string; startDate: string; endDate: string };

export type PlanItem = { exerciseId: string; minutes: number };

export type Session = {
  id: string;
  groupId: string | null;
  date: string; // "2026-10-27"
  startTime: string; // "16:00"
  minutes: number;
  focus: string | null;
  plan: PlanItem[];
  notes: string;
  // Players of the group who cancelled.
  absent: string[];
};

// --- Court diagram ------------------------------------------------------------
//
// Coordinates are meters from the center of the net: x runs across the court
// (doubles sidelines at ±5.49, singles sidelines at ±4.12), y along it (net at
// 0, service lines at ±6.40, baselines at ±11.89). The trainer's half is
// y < 0 (top of the picture), the kids' half y > 0. Arrows go from (x, y) to
// (x2, y2): "run" is a running path, "shot" the flight of the ball.

export const court = {
  minX: -8,
  maxX: 8,
  minY: -14.5,
  maxY: 14.5,
  doubles: 5.485,
  singles: 4.115,
  service: 6.4,
  baseline: 11.885,
};

export const pieceTypes = ["coach", "player", "cone", "target", "basket", "ball"] as const;
export const arrowTypes = ["run", "shot"] as const;

export type PieceType = (typeof pieceTypes)[number];
export type ArrowType = (typeof arrowTypes)[number];
export type Piece = { type: PieceType; x: number; y: number; label?: string };
export type Arrow = { type: ArrowType; x: number; y: number; x2: number; y2: number };
export type DiagramItem = Piece | Arrow;
export type Diagram = { items: DiagramItem[] };

export const emptyDiagram: Diagram = { items: [] };

export const isArrow = (item: DiagramItem): item is Arrow => (arrowTypes as readonly string[]).includes(item.type);

const round = (value: number) => Math.round(value * 100) / 100;
export const clampX = (x: number) => round(Math.min(court.maxX, Math.max(court.minX, x)));
export const clampY = (y: number) => round(Math.min(court.maxY, Math.max(court.minY, y)));

// Reads a diagram from the database or an AI's JSON, dropping anything unknown.
export function parseDiagram(value: unknown): Diagram {
  const raw = value && typeof value === "object" && "items" in value ? (value as { items: unknown }).items : value;
  if (!Array.isArray(raw)) return { items: [] };
  const items: DiagramItem[] = [];
  for (const entry of raw.slice(0, 60)) {
    if (!entry || typeof entry !== "object") continue;
    const { type, x, y, x2, y2, label } = entry as Record<string, unknown>;
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    if ((arrowTypes as readonly unknown[]).includes(type)) {
      if (typeof x2 !== "number" || typeof y2 !== "number" || !Number.isFinite(x2) || !Number.isFinite(y2)) continue;
      items.push({ type: type as ArrowType, x: clampX(x), y: clampY(y), x2: clampX(x2), y2: clampY(y2) });
    } else if ((pieceTypes as readonly unknown[]).includes(type)) {
      const piece: Piece = { type: type as PieceType, x: clampX(x), y: clampY(y) };
      if (typeof label === "string" || typeof label === "number") piece.label = String(label).slice(0, 3);
      items.push(piece);
    }
  }
  return { items };
}

// --- Session generator -------------------------------------------------------

export type Slot = { phase: Phase; minutes: number };

const round5 = (value: number) => Math.max(5, Math.round(value / 5) * 5);

// The shape of a session: warm-up, one technique block per ~10 minutes (kids
// keep their focus better with short blocks), a game and (from 45 minutes on)
// a short finish. 60 minutes = 10 + 10 + 10 + 10 + 15 + 5.
export function slotsFor(total: number): Slot[] {
  const warmup = round5(total * 0.17);
  const game = round5(total * 0.25);
  const cooldown = total >= 90 ? 10 : total >= 45 ? 5 : 0;
  const rest = Math.max(5, total - warmup - game - cooldown);
  const blocks = Math.max(1, Math.floor(rest / 10));
  const each = round5(rest / blocks);
  const technique = Array.from({ length: blocks }, (_, index) =>
    index === blocks - 1 ? Math.max(5, rest - each * (blocks - 1)) : each,
  );
  return [
    { phase: "warmup", minutes: warmup },
    ...technique.map((minutes) => ({ phase: "technique" as const, minutes })),
    { phase: "game", minutes: game },
    ...(cooldown ? [{ phase: "cooldown" as const, minutes: cooldown }] : []),
  ];
}

export type PickContext = {
  exercises: Exercise[];
  // Favorites of the group: picked about four times as often.
  favorites: Set<string>;
  // Played in the group's last sessions: picked less often.
  recent: Set<string>;
  focus: string | null;
  // Kids who are there; exercises that don't work for that many are skipped.
  players: number | null;
};

// Whether an exercise works for this many kids (always, if unknown).
export function fitsPlayers(exercise: Pick<Exercise, "playersMin" | "playersMax">, players: number | null) {
  if (players === null) return true;
  return (exercise.playersMin === null || players >= exercise.playersMin) && (exercise.playersMax === null || players <= exercise.playersMax);
}

export function playersLabel(exercise: Pick<Exercise, "playersMin" | "playersMax">) {
  const { playersMin: min, playersMax: max } = exercise;
  if (min === null && max === null) return null;
  if (min !== null && max !== null) return min === max ? `${min} Kinder` : `${min}–${max} Kinder`;
  return min !== null ? `ab ${min} Kindern` : `bis ${max} Kinder`;
}

// A phase without own exercises borrows from the closest one.
const fallback: Record<Phase, Phase[]> = {
  warmup: ["game", "technique"],
  technique: ["game", "warmup"],
  game: ["technique", "cooldown"],
  cooldown: ["game", "warmup"],
};

function weight(exercise: Exercise, context: PickContext) {
  let value = 1;
  if (context.favorites.has(exercise.id)) value *= 4;
  if (context.recent.has(exercise.id)) value *= 0.25;
  if (context.focus && exercise.focus.includes(context.focus)) value *= 3;
  return value;
}

// Picks a random exercise for the phase, weighted by favorites, focus and
// what the group played lately. Never one of `taken`. Prefers exercises that
// work for the number of kids; only if none does, any will do.
export function pickExercise(phase: Phase, context: PickContext, taken: Set<string>, random = Math.random) {
  const candidates = [true, false].flatMap((fitting) =>
    [phase, ...fallback[phase]].map((candidatePhase) => ({ candidatePhase, fitting })),
  );
  for (const { candidatePhase, fitting } of candidates) {
    const pool = context.exercises.filter(
      (exercise) =>
        exercise.phase === candidatePhase &&
        !taken.has(exercise.id) &&
        (!fitting || fitsPlayers(exercise, context.players)),
    );
    if (pool.length === 0) continue;
    const weights = pool.map((exercise) => weight(exercise, context));
    let target = random() * weights.reduce((sum, value) => sum + value, 0);
    for (let index = 0; index < pool.length; index++) {
      target -= weights[index];
      if (target <= 0) return pool[index];
    }
    return pool[pool.length - 1];
  }
  return undefined;
}

export function generatePlan(total: number, context: PickContext, random = Math.random): PlanItem[] {
  const taken = new Set<string>();
  const plan: PlanItem[] = [];
  for (const slot of slotsFor(total)) {
    const exercise = pickExercise(slot.phase, context, taken, random);
    if (!exercise) continue;
    taken.add(exercise.id);
    plan.push({ exerciseId: exercise.id, minutes: slot.minutes });
  }
  return plan;
}

// Re-plans a session for the kids who are there: from item `from` on (earlier
// ones already happened), exercises that don't work for that many kids are
// swapped for one of the same phase, or with `all` every one of them is.
// Minutes and order stay. Returns the new plan and how many items changed.
export function replan(
  plan: PlanItem[],
  context: PickContext,
  { from = 0, all = false }: { from?: number; all?: boolean } = {},
  random = Math.random,
) {
  const byId = new Map(context.exercises.map((exercise) => [exercise.id, exercise]));
  const taken = new Set(plan.map((item) => item.exerciseId));
  let changed = 0;
  const next = plan.map((item, index) => {
    const exercise = byId.get(item.exerciseId);
    if (index < from || !exercise) return item;
    if (!all && fitsPlayers(exercise, context.players)) return item;
    const replacement = pickExercise(exercise.phase, context, taken, random);
    if (!replacement || (!all && !fitsPlayers(replacement, context.players))) return item;
    taken.add(replacement.id);
    changed++;
    return { ...item, exerciseId: replacement.id };
  });
  return { plan: next, changed };
}

// --- Training days -------------------------------------------------------------

export const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;
export const weekdayNames = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"] as const;

// ISO weekday (1 = Monday) of "2026-10-28".
export function isoWeekday(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export const holidayOn = (date: string, holidays: Holiday[]) =>
  holidays.find((holiday) => holiday.startDate <= date && date <= holiday.endDate) ?? null;

// The group's training days from `from` on (that day included), skipping
// holidays, up to `count` of them within the next half year.
export function trainingDates(weekday: number, from: string, holidays: Holiday[], count = 1) {
  const dates: string[] = [];
  let date = addDays(from, (weekday - isoWeekday(from) + 7) % 7);
  for (let week = 0; week < 26 && dates.length < count; week++, date = addDays(date, 7)) {
    if (!holidayOn(date, holidays)) dates.push(date);
  }
  return dates;
}

// My training days of a group from `from` to `until` (both included): its
// weekly day when I coach it, otherwise the dates I stand in.
export function myTrainingDates(group: Group, from: string, until: string, holidays: Holiday[], standIns: StandIn[]) {
  if (group.coach) {
    return standIns
      .filter((standIn) => standIn.groupId === group.id && standIn.date >= from && standIn.date <= until)
      .map((standIn) => standIn.date)
      .sort();
  }
  if (!group.weekday) return [];
  return trainingDates(group.weekday, from, holidays, 30).filter((date) => date <= until);
}

// The next day to plan a session for the group, or null if none is known.
export const nextTrainingDate = (group: Group, from: string, holidays: Holiday[], standIns: StandIn[]) =>
  myTrainingDates(group, from, addDays(from, 182), holidays, standIns)[0] ?? null;

// --- Times -------------------------------------------------------------------

export function todayInGermany() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const formatClock = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// Start and end of every item, as minutes of the day.
export function timeline(startTime: string, plan: { minutes: number }[]) {
  let start = toMinutes(startTime);
  return plan.map((item) => {
    const range = { start, end: start + item.minutes };
    start = range.end;
    return range;
  });
}

export function formatSessionDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: date.slice(0, 4) === todayInGermany().slice(0, 4) ? undefined : "numeric",
  });
}

// Where a session is at `now` (in the device's time zone, which is where the
// trainer stands): before it, during item `index`, or over.
export type LiveState =
  | { kind: "before"; minutesUntil: number }
  | { kind: "running"; index: number; minutesLeft: number; progress: number }
  | { kind: "over" };

export function liveState(
  session: { date: string; startTime: string; plan: { minutes: number }[] },
  now: Date,
): LiveState | null {
  const start = new Date(`${session.date}T${session.startTime}:00`);
  const minutesSinceStart = (now.getTime() - start.getTime()) / 60000;
  const ranges = timeline("00:00", session.plan);
  const total = ranges.at(-1)?.end ?? 0;
  if (minutesSinceStart < 0) {
    // Only counts down on the day itself.
    return minutesSinceStart > -12 * 60 ? { kind: "before", minutesUntil: Math.ceil(-minutesSinceStart) } : null;
  }
  if (minutesSinceStart >= total) return minutesSinceStart < 12 * 60 ? { kind: "over" } : null;
  const index = ranges.findIndex((range) => minutesSinceStart < range.end);
  const range = ranges[index];
  return {
    kind: "running",
    index,
    minutesLeft: Math.ceil(range.end - minutesSinceStart),
    progress: (minutesSinceStart - range.start) / (range.end - range.start),
  };
}

// --- Exercises written elsewhere (e.g. by an AI chat) ------------------------

export type ExerciseInput = Omit<Exercise, "id" | "notes">;

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export function cleanExercise(value: Record<string, unknown>): ExerciseInput | null {
  const name = text(value.name, 80);
  if (!name) return null;
  const phase = phases.some((entry) => entry.id === value.phase) ? (value.phase as Phase) : "technique";
  const minutes = Math.min(60, Math.max(5, Math.round(Number(value.minutes) || 10)));
  const tips = (Array.isArray(value.tips) ? value.tips : typeof value.tips === "string" ? value.tips.split("\n") : [])
    .map((tip) => text(tip, 120))
    .filter(Boolean)
    .slice(0, 6);
  const focus = (Array.isArray(value.focus) ? value.focus : []).filter((tag): tag is string =>
    (focusTags as readonly unknown[]).includes(tag),
  );
  const playersMin = players(value.playersMin ?? value.players_min);
  const playersMax = players(value.playersMax ?? value.players_max);
  return {
    name,
    phase,
    minutes,
    summary: text(value.summary, 200),
    description: text(value.description, 2000),
    tips,
    focus,
    diagram: parseDiagram(value.diagram),
    playersMin,
    playersMax: playersMin !== null && playersMax !== null && playersMax < playersMin ? null : playersMax,
    variations: parseVariations(value.variations),
  };
}

function players(value: unknown) {
  const number = Math.round(Number(value));
  return value !== null && value !== undefined && value !== "" && number >= 1 && number <= 30 ? number : null;
}

// Accepts one exercise, a list of them or { "exercises": [...] }, also inside
// a ```json block or with text around it, as chats like to answer.
export function parseExercises(input: string): { exercises: ExerciseInput[]; error: string | null } {
  const start = input.search(/[[{]/);
  const end = Math.max(input.lastIndexOf("]"), input.lastIndexOf("}"));
  if (start < 0 || end < start) return { exercises: [], error: "Kein JSON gefunden." };
  let data: unknown;
  try {
    data = JSON.parse(input.slice(start, end + 1));
  } catch {
    return { exercises: [], error: "Das JSON ist nicht vollständig oder fehlerhaft." };
  }
  if (data && typeof data === "object" && !Array.isArray(data) && "exercises" in data) {
    data = (data as { exercises: unknown }).exercises;
  }
  const list = Array.isArray(data) ? data : [data];
  const exercises = list
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map(cleanExercise)
    .filter((entry): entry is ExerciseInput => entry !== null)
    .slice(0, 50);
  return { exercises, error: exercises.length === 0 ? "Keine Übung mit Namen gefunden." : null };
}

// A prompt for any AI chat (free Claude or ChatGPT is enough). The answer is
// pasted back into the import dialog.
export function aiPrompt(wish: string, existing: string[], principles: string) {
  return `Du bist ein erfahrener Tennistrainer für Kinder und Jugendliche (Anfänger bis Mittelstufe, Verein, C-Trainer-Niveau). Erfinde Übungen, die vor allem Spaß machen und nebenbei besser machen. Der Trainer steht meist mit dem Ballkorb auf der einen Seite und spielt zu; Übungen, die ohne ständiges Zuspiel laufen (Stationen, Spiele untereinander), sind besonders willkommen.

Wunsch: ${wish.trim() || "5 abwechslungsreiche, lustige Übungen für eine Gruppe von 4–8 Kindern"}

${existing.length > 0 ? `Diese Übungen habe ich schon, bitte nichts Gleiches:\n${existing.map((name) => `- ${name}`).join("\n")}\n\n` : ""}Antworte NUR mit JSON in diesem Format (ein Array, Texte auf Deutsch):

[
  {
    "name": "Kurzer, einprägsamer Name",
    "phase": "warmup" | "technique" | "game" | "cooldown",
    "minutes": 10,
    "summary": "Ein Satz: worum geht es?",
    "description": "Ablauf in 2–5 Sätzen: Aufbau, Regeln, Punkte, Wechsel.",
    "tips": ["Kurzer Zuruf für die Kinder", "Noch einer"],
    "focus": ["Vorhand"],
    "playersMin": 2,
    "playersMax": null,
    "variations": {
      "easier": "Wie es leichter wird, z. B. zuwerfen statt zuspielen, größeres Ziel",
      "harder": "Wie es schwerer wird, z. B. kleineres Ziel, nur Rückhand, auf Zeit",
      "fewer": "Anpassung für weniger Kinder",
      "more": "Anpassung für mehr Kinder, z. B. zweite Station"
    },
    "diagram": { "items": [ ... ] }
  }
]

"focus" nur aus: ${focusTags.join(", ")}.
"playersMin"/"playersMax": für wie viele Kinder die Übung mindestens/höchstens funktioniert (z. B. 4 für Teams 2 gegen 2), null wenn egal.
"variations": je ein Satz, damit die Übung über 10 Minuten nicht langweilig wird und zu jeder Gruppe passt; "" wenn es nichts gibt.

${principlesForPrompt(principles)}

Das Diagramm zeigt den Platz von oben, Koordinaten in Metern ab der Netzmitte:
- x quer zum Platz: Doppel-Seitenlinien bei -5.49 und 5.49, Einzel-Seitenlinien bei -4.12 und 4.12, Mittellinie bei 0. Erlaubt: -8 bis 8.
- y längs: Netz bei 0, Aufschlaglinien bei -6.4 und 6.4, Grundlinien bei -11.89 und 11.89. Erlaubt: -14.5 bis 14.5.
- Die Trainerseite ist oben (y negativ), die Kinder stehen meist unten (y positiv).
Elemente:
- {"type": "coach", "x": 0, "y": -9}  Trainer
- {"type": "player", "x": -2, "y": 10, "label": "1"}  Kind, label 1–3 Zeichen
- {"type": "cone", "x": 3, "y": 4}  Hütchen
- {"type": "target", "x": -3, "y": -9}  Ziel/Reifen
- {"type": "basket", "x": 1, "y": -9}  Ballkorb
- {"type": "ball", "x": 0, "y": 2}  Ball
- {"type": "run", "x": -2, "y": 10, "x2": 2, "y2": 8}  Laufweg (gestrichelter Pfeil)
- {"type": "shot", "x": 0, "y": -9, "x2": -2, "y2": 8}  Ballweg (Pfeil)
Nimm 3–12 Elemente, so dass man die Übung auf einen Blick versteht.`;
}

// --- Principles ----------------------------------------------------------------

// Rules every plan and every new exercise should follow, from the BTV
// C-Trainer training (Lehrgangsskripte CP1/CP2, Planung von
// Trainingseinheiten, Aufwärmen). The coach can change them; the AI reads them.
export const defaultPrinciples = `Niemand steht lange: spätestens nach ca. 8 Sekunden ist jedes Kind wieder dran. Höchstens 2–3 Kinder pro Reihe, sonst Zusatzaufgabe auf dem Rückweg (Ball sammeln, Koordinationsleiter, Netzpfosten berühren) oder zweite Station.
Kleine Kinder (bis ca. 8 Jahre) sind immer in Bewegung: kurze, einfache Aufgaben, schnelle Wechsel, in kleine Geschichten verpackt, Ballspiele statt Erklärungen.
Kurze Blöcke: eine Übungsform dauert 5–10 Minuten; was länger läuft, bekommt nach ein paar Minuten eine Variation oder Steigerung.
Aufwärmen bei Kindern: spielerisch, ca. 5–10 Minuten, Bewegungsdrang abbauen und Koordination schulen (kleine Ballspiele, Fang- und Abwurfspiele, Staffeln). Staffeln erst nach den Ballspielen, Teams immer gleich stark einteilen. Keine feste Aufwärmroutine bis ca. 10 Jahre.
Aufbau einer Stunde: ca. 10 Min. Einstimmen/Aufwärmen, Hauptteil mit 2–4 aufeinander aufbauenden Übungsblöcken (Koordination vor Technik vor Taktik vor Kondition), ca. 10 Min. Abschlussspiel oder spielerischer Ausklang.
Jede Übungsform hat ein konkretes Teilziel (z. B. „Treffpunkt vor dem Körper“), das zum Stundenziel passt.
Spielformen statt reines Üben: Ballwechsel, miteinander oder gegeneinander, mit Punkten, Rekorden oder Teamwettkampf. Einfache, lösbare Aufgaben schaffen Erfolgserlebnisse.
Feld, Schläger und Bälle passen zur Play+Stay-Stufe: Rot im Kleinfeld, Orange im Midcourt, Grün im Großfeld.
Viele Übungen ohne ständiges Zuspiel des Trainers (Stationen, Spiele untereinander), damit der Trainer beobachten und korrigieren kann.`;

export function principlesForPrompt(principles: string) {
  const text = principles.trim() || defaultPrinciples;
  return `Grundsätze des Trainers (immer beachten):\n${text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n")}`;
}
