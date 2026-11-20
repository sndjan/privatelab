"use client";

import { useSyncExternalStore } from "react";

// Settings and the running timer of the Pomodoro, kept in localStorage: every
// device has its own times and volumes, and a reload keeps the clock.

export type Phase = "focus" | "short" | "long";

export const phaseNames: Record<Phase, string> = {
  focus: "Fokus",
  short: "Kurze Pause",
  long: "Lange Pause",
};

export type Reminder = { on: boolean; every: number; volume: number };

export type Music = {
  // A station id from music.tsx, or "custom" for `custom`.
  station: string;
  // A YouTube link or video id the user pasted.
  custom: string;
  volume: number;
  // Quiet during breaks, back on with the next focus phase.
  pauseInBreaks: boolean;
};

export type Settings = {
  // Minutes.
  focus: number;
  short: number;
  long: number;
  // A long break after this many focus rounds.
  longEvery: number;
  // Start the next phase by itself when one ends.
  autoStart: boolean;
  timerVolume: number;
  // 20-20-20 rule: every 20 minutes look 20 seconds at something 20 feet (6 m) away.
  eyes: Reminder;
  drink: Reminder;
  // Reminders only count while the timer runs, so a paused timer stays quiet.
  remindersWithTimer: boolean;
  notify: boolean;
  music: Music;
};

export const defaultSettings: Settings = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  autoStart: false,
  timerVolume: 70,
  eyes: { on: false, every: 20, volume: 50 },
  drink: { on: false, every: 10, volume: 50 },
  remindersWithTimer: true,
  notify: false,
  music: { station: "lofi", custom: "", volume: 40, pauseInBreaks: true },
};

export type Timer = {
  phase: Phase;
  // Focus rounds finished.
  round: number;
  running: boolean;
  // While running: when the phase ends (ms).
  endsAt: number | null;
  // While paused: what is left (ms). null = the full phase.
  left: number | null;
  // The phase was started (so the button says "Weiter" after a pause).
  started: boolean;
  // Minutes added or taken away with +1 / −1 (ms), so the ring stays right.
  extra: number;
};

export const freshTimer: Timer = { phase: "focus", round: 0, running: false, endsAt: null, left: null, started: false, extra: 0 };

const num = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

function parseReminder(value: unknown, fallback: Reminder): Reminder {
  const r = (value ?? {}) as Partial<Reminder>;
  return {
    on: typeof r.on === "boolean" ? r.on : fallback.on,
    every: num(r.every, 1, 240, fallback.every),
    volume: num(r.volume, 0, 100, fallback.volume),
  };
}

function parseSettings(raw: unknown): Settings {
  const s = (raw ?? {}) as Partial<Settings>;
  const d = defaultSettings;
  return {
    focus: num(s.focus, 1, 240, d.focus),
    short: num(s.short, 1, 120, d.short),
    long: num(s.long, 1, 120, d.long),
    longEvery: num(s.longEvery, 1, 12, d.longEvery),
    autoStart: typeof s.autoStart === "boolean" ? s.autoStart : d.autoStart,
    timerVolume: num(s.timerVolume, 0, 100, d.timerVolume),
    eyes: parseReminder(s.eyes, d.eyes),
    drink: parseReminder(s.drink, d.drink),
    remindersWithTimer: typeof s.remindersWithTimer === "boolean" ? s.remindersWithTimer : d.remindersWithTimer,
    notify: typeof s.notify === "boolean" ? s.notify : d.notify,
    music: parseMusic(s.music),
  };
}

function parseMusic(value: unknown): Music {
  const m = (value ?? {}) as Partial<Music>;
  const d = defaultSettings.music;
  return {
    station: typeof m.station === "string" && m.station.length <= 40 ? m.station : d.station,
    custom: typeof m.custom === "string" ? m.custom.slice(0, 300) : d.custom,
    volume: num(m.volume, 0, 100, d.volume),
    pauseInBreaks: typeof m.pauseInBreaks === "boolean" ? m.pauseInBreaks : d.pauseInBreaks,
  };
}

function parseTimer(raw: unknown): Timer {
  const t = (raw ?? {}) as Partial<Timer>;
  const phase = t.phase && t.phase in phaseNames ? t.phase : "focus";
  const running = Boolean(t.running && typeof t.endsAt === "number");
  return {
    phase,
    round: num(t.round, 0, 999, 0),
    running,
    endsAt: running ? Number(t.endsAt) : null,
    left: !running && typeof t.left === "number" && t.left > 0 ? t.left : null,
    started: running || Boolean(t.started),
    extra: typeof t.extra === "number" && Number.isFinite(t.extra) ? t.extra : 0,
  };
}

// A value in localStorage as a React store. useSyncExternalStore needs the
// same object for the same stored string, so the parsed value is cached.
function storedValue<T>(key: string, parse: (raw: unknown) => T, fallback: T) {
  const event = `${key}-change`;
  let cachedRaw: string | null = null;
  let cached = fallback;

  const subscribe = (callback: () => void) => {
    window.addEventListener("storage", callback);
    window.addEventListener(event, callback);
    return () => {
      window.removeEventListener("storage", callback);
      window.removeEventListener(event, callback);
    };
  };
  const read = () => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {}
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try {
        cached = raw ? parse(JSON.parse(raw)) : fallback;
      } catch {
        cached = fallback;
      }
    }
    return cached;
  };
  const write = (next: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new Event(event));
  };
  return {
    read,
    write,
    use: () => useSyncExternalStore(subscribe, read, () => fallback),
  };
}

export const settingsStore = storedValue("pomodoro-settings", parseSettings, defaultSettings);
export const timerStore = storedValue("pomodoro-timer", parseTimer, freshTimer);

export const durationMs = (settings: Settings, phase: Phase) => settings[phase] * 60_000;

// What is left of the phase at `now` (ms).
export function remaining(timer: Timer, settings: Settings, now: number) {
  if (timer.running && timer.endsAt) return Math.max(0, timer.endsAt - now);
  return timer.left ?? durationMs(settings, timer.phase);
}

// The phase after this one: a long break after every `longEvery` focus rounds.
export function nextTimer(timer: Timer, settings: Settings, now: number, autoStart: boolean): Timer {
  const round = timer.phase === "focus" ? timer.round + 1 : timer.round;
  const phase: Phase = timer.phase !== "focus" ? "focus" : round % settings.longEvery === 0 ? "long" : "short";
  return autoStart
    ? { phase, round, running: true, endsAt: now + durationMs(settings, phase), left: null, started: true, extra: 0 }
    : { phase, round, running: false, endsAt: null, left: null, started: false, extra: 0 };
}

// The phase as it would start again, keeping the rounds.
export const restartTimer = (timer: Timer, phase: Phase = timer.phase): Timer => ({ ...freshTimer, phase, round: timer.round });

// +1 / −1 minute (or any `delta`), running or not. At least one second stays.
export function adjustTimer(timer: Timer, settings: Settings, now: number, delta: number): Timer {
  const left = remaining(timer, settings, now);
  const next = Math.max(1000, left + delta);
  const applied = next - left;
  if (applied === 0) return timer;
  const extra = timer.extra + applied;
  return timer.running && timer.endsAt !== null
    ? { ...timer, endsAt: timer.endsAt + applied, extra }
    : { ...timer, left: next, extra };
}

export const totalMs = (timer: Timer, settings: Settings) => Math.max(1000, durationMs(settings, timer.phase) + timer.extra);

export function clock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
