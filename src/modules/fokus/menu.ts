import type { SceneId } from "./scene-data";

// The menu and the timer's arithmetic, without React or the database.
//
// An evening is three focus rounds of 45 minutes with 15 minutes of tea after
// the first and the second. The kitchen only cooks during focus: `focus`
// counts focus seconds (0–8100) and decides which step and scene is shown.

export const FOCUS = 45 * 60;
export const BREAK = 15 * 60;
export const ROUNDS = 3;
export const TOTAL = ROUNDS * FOCUS;

export type Step = { from: number; to: number; scene: SceneId; title: string; text: string; peek: string };
export type Course = { title: string; sub: string; scene: SceneId };

export const menu: { id: string; name: string; courses: Course[]; steps: Step[] } = {
  id: "italienischer-abend",
  name: "Italienischer Abend",
  courses: [
    { title: "Antipasti", sub: "Bruschetta, gegrillte Zucchini", scene: "antipasti" },
    { title: "Primo", sub: "Pilzrisotto", scene: "risotto" },
    { title: "Secondo und Dolce", sub: "Saltimbocca, Tiramisu", scene: "kakao" },
  ],
  // from/to in focus minutes.
  steps: [
    { from: 0, to: 8, scene: "tomaten", title: "Tomaten würfeln", text: "Erst in Scheiben, dann in kleine Würfel.", peek: "Schön reif, die Tomaten." },
    { from: 8, to: 12, scene: "marinieren", title: "Marinieren", text: "Knoblauch, Basilikum, Olivenöl, eine Prise Salz.", peek: "Riecht nach Sommer." },
    { from: 12, to: 17, scene: "roesten", title: "Brot rösten", text: "Ciabatta in die Grillpfanne, bis Streifen kommen.", peek: "Knuspert schon." },
    { from: 17, to: 20, scene: "bruschetta", title: "Bruschetta belegen", text: "Mit Knoblauch einreiben, Tomaten darauf.", peek: "Eine probieren? Später." },
    { from: 20, to: 26, scene: "zucchini", title: "Zucchini schneiden", text: "Gleichmäßige Scheiben, nicht zu dünn.", peek: "Schön gleichmäßig." },
    { from: 26, to: 38, scene: "grillen", title: "Zucchini grillen", text: "Erst wenden, wenn die Streifen dunkel sind.", peek: "Noch nicht wenden." },
    { from: 38, to: 45, scene: "antipasti", title: "Antipasti anrichten", text: "Zitrone, Minze, Salz. Der erste Gang steht.", peek: "Sieht aus wie in Rom." },
    { from: 45, to: 55, scene: "pilze", title: "Pilze schneiden", text: "Champignons in Scheiben, die Schalotte fein.", peek: "Pilze nie waschen, nur abreiben." },
    { from: 55, to: 62, scene: "pilzeBraten", title: "Pilze braten", text: "Heiß und mit wenig Rühren, bis sie golden sind.", peek: "Einmal wenden, dann warten." },
    { from: 62, to: 65, scene: "reis", title: "Reis anschwitzen", text: "Glasig rösten, dann mit Weißwein ablöschen.", peek: "Es zischt kurz, dann duftet es." },
    { from: 65, to: 85, scene: "bruehe", title: "Brühe angießen", text: "Kelle für Kelle, alle drei Minuten umrühren.", peek: "Einmal umgerührt. Alles gut." },
    { from: 85, to: 90, scene: "risotto", title: "Mantecare", text: "Butter und Parmesan unterziehen, Pilze darauf.", peek: "Cremig, wie es sein soll." },
    { from: 90, to: 100, scene: "plattieren", title: "Saltimbocca vorbereiten", text: "Flach klopfen, Schinken und Salbei darauf.", peek: "Sanft klopfen reicht." },
    { from: 100, to: 108, scene: "saltimbocca", title: "Saltimbocca braten", text: "In Butter, erst die Schinkenseite nach unten.", peek: "Der Salbei wird knusprig." },
    { from: 108, to: 112, scene: "sosse", title: "Ablöschen", text: "Weißwein dazu und sämig einkochen. Warm stellen.", peek: "Die Soße glänzt." },
    { from: 112, to: 120, scene: "creme", title: "Mascarponecreme", text: "Eigelb und Zucker schaumig, Mascarpone dazu.", peek: "Luftig und hell." },
    { from: 120, to: 128, scene: "schichten", title: "Tiramisu schichten", text: "Biskuits kurz in Espresso, dann Creme darüber.", peek: "Nicht zu lange tunken." },
    { from: 128, to: 135, scene: "kakao", title: "Kakao und kalt stellen", text: "Dick bestäuben. Ab in den Kühlschrank.", peek: "Dicker ist besser." },
  ],
};

// --- Timer ------------------------------------------------------------------

export type Phase = "focus" | "break" | "done";

// As stored: seconds counted up to `anchor`; while running, the time since
// `anchor` (ms since 1970) comes on top. So a reload or another device shows
// the same clock.
export type Timer = { phase: Phase; focus: number; pause: number; running: boolean; anchor: number | null };

export const freshTimer: Timer = { phase: "focus", focus: 0, pause: 0, running: false, anchor: null };

// End of the round that `focus` is in. Exactly on a boundary counts as the next round.
export const roundEnd = (focus: number) => Math.min(TOTAL, (Math.floor(focus / FOCUS + 1e-9) + 1) * FOCUS);

// The timer at `now`. A round stops at its end and becomes a break that waits
// to be started; a break stops when the cup is empty and waits for "weiter".
export function timerAt(timer: Timer, now: number, speed = 1): Timer {
  if (!timer.running || timer.anchor === null) return timer;
  const elapsed = Math.max(0, ((now - timer.anchor) / 1000) * speed);
  if (timer.phase === "focus") {
    const end = roundEnd(timer.focus);
    const focus = timer.focus + elapsed;
    if (focus < end) return { ...timer, focus, anchor: now };
    if (end >= TOTAL) return { phase: "done", focus: TOTAL, pause: 0, running: false, anchor: null };
    return { phase: "break", focus: end, pause: 0, running: false, anchor: null };
  }
  if (timer.phase === "break") {
    const pause = timer.pause + elapsed;
    if (pause < BREAK) return { ...timer, pause, anchor: now };
    return { ...timer, pause: BREAK, running: false, anchor: null };
  }
  return timer;
}

// Seconds until the running timer stops by itself, or null.
export function secondsUntilStop(timer: Timer, speed = 1) {
  if (!timer.running) return null;
  const left = timer.phase === "focus" ? roundEnd(timer.focus) - timer.focus : timer.phase === "break" ? BREAK - timer.pause : 0;
  return left / speed;
}

export function describe(timer: Timer) {
  const minutes = timer.focus / 60;
  // During a break and at the very end, the round is the one just finished.
  const round = timer.phase === "focus" ? Math.min(ROUNDS, Math.floor(timer.focus / FOCUS + 1e-9) + 1) : Math.round(timer.focus / FOCUS);
  let index = menu.steps.findIndex((step) => minutes < step.to - 1e-9);
  if (index < 0) index = menu.steps.length - 1;
  const step = menu.steps[index];
  const breaksDone = timer.phase === "focus" ? round - 1 : timer.phase === "break" ? round - 1 : ROUNDS - 1;
  return {
    round,
    index,
    step,
    stepProgress: Math.min(1, Math.max(0, (minutes - step.from) / (step.to - step.from))),
    roundLeft: Math.max(0, round * FOCUS - timer.focus),
    breakLeft: Math.max(0, BREAK - timer.pause),
    breakProgress: Math.min(1, timer.pause / BREAK),
    coursesDone: timer.phase === "focus" ? round - 1 : round,
    // Seconds of the whole evening (focus and tea) behind us and in total.
    wallDone: timer.focus + breaksDone * BREAK + (timer.phase === "break" ? timer.pause : 0),
    wallTotal: TOTAL + (ROUNDS - 1) * BREAK,
  };
}

// The tea has its own little timeline: 1 minute to pour, 8 to steep, 6 to drink.
export function teaMoment(seconds: number, started: boolean) {
  const minutes = (s: number) => {
    const m = Math.max(1, Math.ceil(s / 60 - 1e-9));
    return m === 1 ? "1 Minute" : `${m} Minuten`;
  };
  if (seconds >= BREAK) return { title: "Tasse leer", text: "Pünktlich zum letzten Schluck ist die Pause vorbei." };
  if (!started) return { title: "Zeit für Tee", text: "Die Küche wartet. Gieß dir in Ruhe einen Tee auf." };
  if (seconds < 60) return { title: "Wasser aufgießen", text: "Heißes Wasser in die Tasse, dann den Beutel hinein." };
  if (seconds < 540) return { title: "Der Tee zieht", text: `Noch ${minutes(540 - seconds)}. Lehn dich zurück.` };
  if (seconds < 570) return { title: "Beutel raus", text: "Ab auf die Untertasse. Jetzt ist er genau richtig." };
  return { title: "Schluck für Schluck", text: `Ganz langsam. Noch ${minutes(BREAK - seconds)} Pause.` };
}

export function clock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds - 1e-9));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
