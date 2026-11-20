"use client";

import { BellIcon, DropletIcon, EyeIcon, PauseIcon, PictureInPicture2Icon, PlayIcon, RotateCcwIcon, SkipForwardIcon, Volume2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { usePopout } from "./popout";
import { notify, playBell, playDrink, playEyes, playEyesDone, ticker, unlockSound } from "./sound";
import {
  clock,
  durationMs,
  nextTimer,
  phaseNames,
  remaining,
  settingsStore,
  timerStore,
  type Phase,
  type Reminder,
  type Settings,
  type Timer,
} from "./store";

const LOOK_AWAY_MS = 20_000;
const DRINK_BANNER_MS = 12_000;

const phaseLook: Record<Phase, { tint: string; text: string; bar: string; button: string }> = {
  focus: {
    tint: "bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-300",
    bar: "bg-rose-500",
    button: "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600",
  },
  short: {
    tint: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
    button: "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600",
  },
  long: {
    tint: "bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
    button: "bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600",
  },
};

type Elapsed = { eyes: number; drink: number };

const setTitle = (win: Window, title: string) => {
  win.document.title = title;
};

const setSettings = (change: Partial<Settings>) => settingsStore.write({ ...settingsStore.read(), ...change });

// Space starts and pauses, unless the user is typing or on a control.
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el?.closest?.("input, textarea, select, button, [role=slider], [role=checkbox], [contenteditable=true]"));
}

export function PomodoroApp() {
  const settings = settingsStore.use();
  const timer = timerStore.use();
  // null until the page runs in the browser, so server and first render match.
  const [now, setNow] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<Elapsed>({ eyes: 0, drink: 0 });
  const [lookAwayUntil, setLookAwayUntil] = useState<number | null>(null);
  const [drinkUntil, setDrinkUntil] = useState<number | null>(null);
  const popout = usePopout();

  const latest = useRef({ elapsed, lookAwayUntil, drinkUntil, popoutOpen: false });
  useEffect(() => {
    latest.current = { elapsed, lookAwayUntil, drinkUntil, popoutOpen: Boolean(popout.win) };
  });

  // One clock for everything: the end of a phase, the reminders and the
  // 20 seconds of looking away. Runs in a worker, so it keeps time in a
  // background tab (see sound.ts).
  useEffect(() => {
    let last: number | null = null;
    return ticker(250, () => {
      const t = Date.now();
      // A sleeping computer must not count as hours of work.
      const dt = last === null ? 0 : Math.min(t - last, 5000);
      last = t;
      setNow(t);

      const settings = settingsStore.read();
      let timer = timerStore.read();
      const state = latest.current;
      const tell = (title: string, body: string) => {
        if (settings.notify && document.visibilityState === "hidden" && !state.popoutOpen) void notify(title, body);
      };

      if (timer.running && timer.endsAt !== null && t >= timer.endsAt) {
        const ended = timer.phase;
        timer = nextTimer(timer, settings, t, settings.autoStart);
        timerStore.write(timer);
        playBell(settings.timerVolume);
        const title = ended === "focus" ? "Fokuszeit vorbei" : "Pause vorbei";
        const body = ended === "focus" ? `Zeit für die ${phaseNames[timer.phase]}.` : "Weiter geht's mit dem Fokus.";
        tell(title, body);
        toast(title, { description: body });
      }

      // Reminders count only while they are on (and the timer runs, if so set).
      const counting = !settings.remindersWithTimer || timer.running;
      const next: Elapsed = { ...state.elapsed };
      let eyesFired = false;
      if (!settings.eyes.on) next.eyes = 0;
      else if (counting && state.lookAwayUntil === null) {
        next.eyes += dt;
        if (next.eyes >= settings.eyes.every * 60_000) {
          next.eyes = 0;
          eyesFired = true;
          playEyes(settings.eyes.volume);
          state.lookAwayUntil = t + LOOK_AWAY_MS;
          setLookAwayUntil(state.lookAwayUntil);
          tell("20-20-20", "Schau 20 Sekunden lang in die Ferne, etwa 6 Meter weit.");
        }
      }
      if (!settings.drink.on) next.drink = 0;
      else if (counting) {
        next.drink += dt;
        const due = settings.drink.every * 60_000;
        // Both due at once (every 20 and every 10 minutes): drink a moment later.
        if (next.drink >= due && eyesFired) next.drink = due - 2500;
        else if (next.drink >= due) {
          next.drink = 0;
          playDrink(settings.drink.volume);
          state.drinkUntil = t + DRINK_BANNER_MS;
          setDrinkUntil(state.drinkUntil);
          tell("Trinken", "Zeit für einen Schluck Wasser.");
        }
      }
      if (next.eyes !== state.elapsed.eyes || next.drink !== state.elapsed.drink) {
        state.elapsed = next;
        setElapsed(next);
      }

      if (state.lookAwayUntil !== null && t >= state.lookAwayUntil) {
        state.lookAwayUntil = null;
        setLookAwayUntil(null);
        playEyesDone(settings.eyes.volume);
      }
      if (state.drinkUntil !== null && t >= state.drinkUntil) {
        state.drinkUntil = null;
        setDrinkUntil(null);
      }
    });
  }, []);

  const left = now === null ? (timer.left ?? durationMs(settings, timer.phase)) : remaining(timer, settings, now);
  const total = durationMs(settings, timer.phase);
  const progress = Math.min(1, Math.max(0, 1 - left / total));

  const toggle = useCallback(() => {
    unlockSound();
    const t = Date.now();
    const current = timerStore.read();
    const s = settingsStore.read();
    if (current.running && current.endsAt !== null) {
      timerStore.write({ ...current, running: false, endsAt: null, left: Math.max(1000, current.endsAt - t) });
    } else {
      timerStore.write({ ...current, running: true, endsAt: t + remaining(current, s, t), left: null });
    }
  }, []);

  const skip = useCallback(() => {
    unlockSound();
    const s = settingsStore.read();
    timerStore.write(nextTimer(timerStore.read(), s, Date.now(), s.autoStart));
  }, []);

  const reset = () => timerStore.write({ ...timerStore.read(), running: false, endsAt: null, left: null });
  const switchPhase = (phase: Phase) => timerStore.write({ ...timerStore.read(), phase, running: false, endsAt: null, left: null });

  const endLookAway = useCallback(() => {
    latest.current.lookAwayUntil = null;
    setLookAwayUntil(null);
  }, []);
  const endDrink = useCallback(() => {
    latest.current.drinkUntil = null;
    setDrinkUntil(null);
  }, []);

  // Space bar, in the page and in the mini window.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isTyping(event.target)) return;
      event.preventDefault();
      toggle();
    };
    const targets = [window, popout.win].filter((w): w is Window => w !== null);
    for (const target of targets) target.addEventListener("keydown", onKey);
    return () => {
      for (const target of targets) target.removeEventListener("keydown", onKey);
    };
  }, [toggle, popout.win]);

  // The time in the tab title (and the mini window's title).
  const title = timer.running || timer.left !== null ? `${clock(left)} · ${phaseNames[timer.phase]}` : null;
  const miniWin = popout.win;
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    setTitle(window, title);
    if (miniWin) setTitle(miniWin, title);
    return () => {
      setTitle(window, before);
      if (miniWin) setTitle(miniWin, "Pomodoro");
    };
  }, [title, miniWin]);

  const lookAwayLeft = lookAwayUntil !== null && now !== null ? Math.max(0, lookAwayUntil - now) : null;
  const look = phaseLook[timer.phase];

  const openMini = async () => {
    unlockSound();
    if (!(await popout.open())) toast.error("Das Mini-Fenster wurde blockiert. Erlaube Pop-ups für diese Seite.");
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {lookAwayLeft !== null && (
        <Banner icon={<EyeIcon />} onClose={endLookAway}>
          <strong>20-20-20:</strong> Schau in die Ferne, etwa 6 Meter weit.{" "}
          <span className="tabular-nums">Noch {Math.ceil(lookAwayLeft / 1000)} s</span>
        </Banner>
      )}
      {drinkUntil !== null && (
        <Banner icon={<DropletIcon />} onClose={endDrink}>
          Zeit für einen Schluck Wasser.
        </Banner>
      )}

      <Card className={cn("gap-0 overflow-hidden py-0 transition-colors", look.tint)}>
        <CardContent className="space-y-6 px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Phase">
              {(Object.keys(phaseNames) as Phase[]).map((phase) => (
                <button
                  key={phase}
                  type="button"
                  role="tab"
                  aria-selected={timer.phase === phase}
                  onClick={() => switchPhase(phase)}
                  className={cn(
                    "cursor-pointer rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                    timer.phase === phase ? cn("bg-background shadow-sm", look.text) : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {phaseNames[phase]}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="hidden shrink-0 sm:inline-flex"
              onClick={popout.win ? popout.close : openMini}
              title="Kleines Fenster nur mit dem Timer"
            >
              <PictureInPicture2Icon />
              {popout.win ? "Mini schließen" : "Mini-Fenster"}
            </Button>
          </div>

          <div className="text-center">
            <div className={cn("text-7xl font-semibold tracking-tight tabular-nums sm:text-8xl", look.text)} aria-live="off">
              {clock(left)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Runde {timer.round + (timer.phase === "focus" ? 1 : 0)}
              {" · "}lange Pause nach {settings.longEvery}
              {timer.round > 0 && (
                <>
                  {" · "}
                  <button type="button" className="cursor-pointer underline-offset-2 hover:underline" onClick={() => timerStore.write({ ...timerStore.read(), round: 0 })}>
                    Runden zurücksetzen
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
            <div className={cn("h-full rounded-full transition-[width] duration-300", look.bar)} style={{ width: `${progress * 100}%` }} />
          </div>

          <div>
            <div className="flex items-center justify-center gap-3">
              <Button variant="ghost" size="icon" onClick={reset} aria-label="Zurücksetzen" title="Zurücksetzen">
                <RotateCcwIcon />
              </Button>
              <Button size="lg" className={cn("h-12 min-w-36 text-base", look.button)} onClick={toggle}>
                {timer.running ? <PauseIcon /> : <PlayIcon />}
                {timer.running ? "Pause" : timer.left !== null ? "Weiter" : "Start"}
              </Button>
              <Button variant="ghost" size="icon" onClick={skip} aria-label="Nächste Phase" title="Nächste Phase">
                <SkipForwardIcon />
              </Button>
            </div>
            <p className="mt-4 hidden text-center text-xs text-muted-foreground sm:block">Leertaste startet und pausiert.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Erinnerungen</CardTitle>
          <CardDescription>Ein Ton (und auf Wunsch eine Benachrichtigung) in festen Abständen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ReminderRow
            id="eyes"
            icon={<EyeIcon />}
            label="20-20-20-Regel"
            hint="Alle 20 Minuten 20 Sekunden in die Ferne schauen."
            reminder={settings.eyes}
            leftMs={settings.eyes.every * 60_000 - elapsed.eyes}
            paused={lookAwayUntil !== null || (settings.remindersWithTimer && !timer.running)}
            onChange={(eyes) => setSettings({ eyes })}
            onTest={() => playEyes(settings.eyes.volume)}
          />
          <ReminderRow
            id="drink"
            icon={<DropletIcon />}
            label="Trinken"
            hint="Ein Schluck Wasser zwischendurch."
            reminder={settings.drink}
            leftMs={settings.drink.every * 60_000 - elapsed.drink}
            paused={settings.remindersWithTimer && !timer.running}
            onChange={(drink) => setSettings({ drink })}
            onTest={() => playDrink(settings.drink.volume)}
          />
          <CheckRow
            id="with-timer"
            checked={settings.remindersWithTimer}
            onChange={(remindersWithTimer) => setSettings({ remindersWithTimer })}
            label="Nur während der Timer läuft"
            hint="Ist der Timer pausiert, bleiben die Erinnerungen still."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Einstellungen</CardTitle>
          <CardDescription>Gilt auf diesem Gerät.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumberField id="focus" label="Fokus (Min.)" value={settings.focus} max={240} onChange={(focus) => setSettings({ focus })} />
            <NumberField id="short" label="Kurze Pause" value={settings.short} max={120} onChange={(short) => setSettings({ short })} />
            <NumberField id="long" label="Lange Pause" value={settings.long} max={120} onChange={(long) => setSettings({ long })} />
            <NumberField id="long-every" label="Lange nach … Runden" value={settings.longEvery} max={12} onChange={(longEvery) => setSettings({ longEvery })} />
          </div>
          <VolumeRow
            id="timer-volume"
            icon={<BellIcon />}
            label="Lautstärke Timer-Ende"
            value={settings.timerVolume}
            onChange={(timerVolume) => setSettings({ timerVolume })}
            onTest={() => playBell(settings.timerVolume)}
          />
          <CheckRow
            id="auto-start"
            checked={settings.autoStart}
            onChange={(autoStart) => setSettings({ autoStart })}
            label="Nächste Phase automatisch starten"
            hint="Nach dem Fokus läuft die Pause gleich los und umgekehrt."
          />
          <CheckRow
            id="notify"
            checked={settings.notify}
            onChange={async (on) => {
              if (on && typeof Notification !== "undefined" && Notification.permission !== "granted") {
                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                  toast.error("Benachrichtigungen sind für diese Seite blockiert.");
                  return;
                }
              }
              setSettings({ notify: on });
            }}
            label="Benachrichtigung, wenn der Tab im Hintergrund ist"
            hint="Zusätzlich zum Ton, falls du gerade in einem anderen Fenster bist."
          />
        </CardContent>
      </Card>

      {popout.win &&
        createPortal(
          <MiniTimer
            timer={timer}
            left={left}
            progress={progress}
            lookAwayLeft={lookAwayLeft}
            drinking={drinkUntil !== null}
            onToggle={toggle}
            onSkip={skip}
            onEndLookAway={endLookAway}
            onEndDrink={endDrink}
          />,
          popout.win.document.body,
        )}
    </div>
  );
}

// The mini window: only the clock, start/pause and skip.
function MiniTimer({
  timer,
  left,
  progress,
  lookAwayLeft,
  drinking,
  onToggle,
  onSkip,
  onEndLookAway,
  onEndDrink,
}: {
  timer: Timer;
  left: number;
  progress: number;
  lookAwayLeft: number | null;
  drinking: boolean;
  onToggle: () => void;
  onSkip: () => void;
  onEndLookAway: () => void;
  onEndDrink: () => void;
}) {
  const look = phaseLook[timer.phase];
  return (
    <div className={cn("flex h-screen flex-col items-center justify-center gap-3 p-4 select-none", look.tint)}>
      {lookAwayLeft !== null ? (
        <button type="button" onClick={onEndLookAway} className="flex cursor-pointer flex-col items-center gap-1 text-center">
          <EyeIcon className="size-8 text-sky-600 dark:text-sky-300" />
          <span className="text-lg font-semibold">In die Ferne schauen</span>
          <span className="text-4xl font-semibold tabular-nums">{Math.ceil(lookAwayLeft / 1000)} s</span>
        </button>
      ) : (
        <>
          <div className={cn("text-sm font-medium", look.text)}>{phaseNames[timer.phase]}</div>
          <div className={cn("text-[min(24vw,32vh)] leading-none font-semibold tracking-tight tabular-nums", look.text)}>{clock(left)}</div>
          <div className="h-1 w-3/4 overflow-hidden rounded-full bg-foreground/10">
            <div className={cn("h-full rounded-full", look.bar)} style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="flex items-center gap-2">
            <Button size="lg" className={cn("min-w-28", look.button)} onClick={onToggle}>
              {timer.running ? <PauseIcon /> : <PlayIcon />}
              {timer.running ? "Pause" : timer.left !== null ? "Weiter" : "Start"}
            </Button>
            <Button variant="ghost" size="icon" onClick={onSkip} aria-label="Nächste Phase" title="Nächste Phase">
              <SkipForwardIcon />
            </Button>
          </div>
        </>
      )}
      {drinking && (
        <button type="button" onClick={onEndDrink} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-sm text-sky-700 dark:text-sky-300">
          <DropletIcon className="size-4" /> Schluck Wasser trinken
        </button>
      )}
    </div>
  );
}

function Banner({ icon, children, onClose }: { icon: ReactNode; children: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-900 dark:text-sky-100 [&>svg]:size-5 [&>svg]:shrink-0">
      {icon}
      <div className="flex-1">{children}</div>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Schließen">
        <XIcon />
      </Button>
    </div>
  );
}

function ReminderRow({
  id,
  icon,
  label,
  hint,
  reminder,
  leftMs,
  paused,
  onChange,
  onTest,
}: {
  id: string;
  icon: ReactNode;
  label: string;
  hint: string;
  reminder: Reminder;
  leftMs: number;
  paused: boolean;
  onChange: (reminder: Reminder) => void;
  onTest: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${id}-on`}
          className="mt-0.5"
          checked={reminder.on}
          onCheckedChange={(checked) => {
            unlockSound();
            onChange({ ...reminder, on: checked === true });
          }}
        />
        <div className="flex-1 space-y-0.5">
          <Label htmlFor={`${id}-on`} className="flex items-center gap-1.5 [&>svg]:size-4">
            {icon}
            {label}
          </Label>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {reminder.on && (
          <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
            {paused ? "pausiert · " : ""}in {clock(Math.max(0, leftMs))}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pl-7">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-every`} className="text-sm font-normal text-muted-foreground">
            alle
          </Label>
          <MinutesInput id={`${id}-every`} value={reminder.every} max={240} onChange={(every) => onChange({ ...reminder, every })} className="w-16" />
          <span className="text-sm text-muted-foreground">Min.</span>
        </div>
        <VolumeSlider id={`${id}-volume`} value={reminder.volume} onChange={(volume) => onChange({ ...reminder, volume })} onTest={onTest} />
      </div>
    </div>
  );
}

function VolumeRow({ id, icon, label, value, onChange, onTest }: { id: string; icon: ReactNode; label: string; value: number; onChange: (value: number) => void; onTest: () => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1.5 [&>svg]:size-4">
        {icon}
        {label}
      </Label>
      <VolumeSlider id={id} value={value} onChange={onChange} onTest={onTest} />
    </div>
  );
}

function VolumeSlider({ id, value, onChange, onTest }: { id: string; value: number; onChange: (value: number) => void; onTest: () => void }) {
  return (
    <div className="flex min-w-48 flex-1 items-center gap-3">
      <Slider id={id} aria-label="Lautstärke" value={[value]} min={0} max={100} step={5} onValueChange={([v]) => onChange(v)} className="flex-1" />
      <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{value} %</span>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Ton testen"
        title="Ton testen"
        onClick={() => {
          unlockSound();
          onTest();
        }}
      >
        <Volume2Icon />
      </Button>
    </div>
  );
}

function CheckRow({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (checked: boolean) => void; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} className="mt-0.5" checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function NumberField({ id, label, value, max, onChange }: { id: string; label: string; value: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <MinutesInput id={id} value={value} max={max} onChange={onChange} />
    </div>
  );
}

// A number field that lets the user clear it while typing: only whole
// numbers in range are saved, and leaving the field shows the saved value.
function MinutesInput({ id, value, max, onChange, className }: { id: string; value: number; max: number; onChange: (value: number) => void; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      min={1}
      max={max}
      value={draft ?? String(value)}
      onChange={(event) => {
        setDraft(event.target.value);
        const n = Number(event.target.value);
        if (event.target.value !== "" && Number.isInteger(n) && n >= 1 && n <= max) onChange(n);
      }}
      onBlur={() => setDraft(null)}
      className={cn("tabular-nums", className)}
    />
  );
}
