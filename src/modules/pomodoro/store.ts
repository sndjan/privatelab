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
};

export type Timer = {
  phase: Phase;
  // Focus rounds finished.
  round: number;
  running: boolean;
  // While running: when the phase ends (ms).
  endsAt: number | null;
  // While paused: what is left (ms). null = the phase has not started yet.
  left: number | null;
};

export const freshTimer: Timer = { phase: "focus", round: 0, running: false, endsAt: null, left: null };

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
    ? { phase, round, running: true, endsAt: now + durationMs(settings, phase), left: null }
    : { phase, round, running: false, endsAt: null, left: null };
}

export function clock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
