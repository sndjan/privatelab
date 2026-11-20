"use client";

import {
  BellIcon,
  ChevronDownIcon,
  DropletIcon,
  EyeIcon,
  PauseIcon,
  PictureInPicture2Icon,
  PlayIcon,
  RotateCcwIcon,
  SkipForwardIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { stationName, stations, stationVideo, YoutubePlayer } from "./music";
import { usePopout } from "./popout";
import { notify, playBell, playDrink, playEyes, playEyesDone, playTick, ticker, unlockSound } from "./sound";
import {
  adjustTimer,
  clock,
  nextTimer,
  phaseNames,
  remaining,
  restartTimer,
  settingsStore,
  timerStore,
  totalMs,
  type Music,
  type Phase,
  type Reminder,
  type Settings,
  type Timer,
} from "./store";

// 20-20-20: a short countdown first, so there is time to look up.
const LEAD_IN_MS = 5_000;
const LOOK_AWAY_MS = 20_000;
const DRINK_BANNER_MS = 12_000;
const RING = 2 * Math.PI * 140;

// The phase colors on the dark timer card.
const phaseColor: Record<Phase, string> = { focus: "#ef6a4c", short: "#5cc398", long: "#7cb8e8" };
const EYES_COLOR = "#8cc7ee";

type Elapsed = { eyes: number; drink: number };
// The 20-20-20 break: the countdown runs until `start`, looking away until `end`.
type Look = { start: number; end: number };

const setSettings = (change: Partial<Settings>) => settingsStore.write({ ...settingsStore.read(), ...change });
const setMusic = (change: Partial<Music>) => setSettings({ music: { ...settingsStore.read().music, ...change } });
const setTitle = (win: Window, title: string) => {
  win.document.title = title;
};
const timeOfDay = (ms: number) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

// Keys belong to the control the user is on: typing and a slider's arrows,
// and the space bar also on buttons, which it presses.
function ownsKey(target: EventTarget | null, key: string) {
  const el = target as HTMLElement | null;
  const typing = "input, textarea, select, [role=slider], [contenteditable=true]";
  return Boolean(el?.closest?.(key === " " ? `${typing}, button` : typing));
}

function buttonLabel(timer: Timer) {
  return timer.running ? "Pause" : timer.started ? "Weiter" : "Start";
}

// Where the look-away break is at `now`: counting down, looking away, or over.
function lookState(look: Look | null, now: number | null) {
  if (!look || now === null) return null;
  if (now < look.start) return { stage: "countdown" as const, seconds: Math.ceil((look.start - now) / 1000), progress: 0 };
  return {
    stage: "away" as const,
    seconds: Math.max(0, Math.ceil((look.end - now) / 1000)),
    progress: Math.min(1, (now - look.start) / (look.end - look.start)),
  };
}
type LookState = ReturnType<typeof lookState>;

export function PomodoroApp() {
  const settings = settingsStore.use();
  const timer = timerStore.use();
  // null until the page runs in the browser, so server and first render match.
  const [now, setNow] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<Elapsed>({ eyes: 0, drink: 0 });
  const [look, setLook] = useState<Look | null>(null);
  const [drinkUntil, setDrinkUntil] = useState<number | null>(null);
  const [musicOn, setMusicOn] = useState(false);
  const popout = usePopout();

  const latest = useRef({ elapsed, look, drinkUntil, popoutOpen: false, lastTick: 0 });
  useEffect(() => {
    latest.current = { ...latest.current, elapsed, look, drinkUntil, popoutOpen: Boolean(popout.win) };
  });

  // One clock for everything: the end of a phase, the reminders and the
  // 20-20-20 break. Runs in a worker, so it keeps time in a background tab.
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
      else if (counting && state.look === null) {
        next.eyes += dt;
        if (next.eyes >= settings.eyes.every * 60_000) {
          next.eyes = 0;
          eyesFired = true;
          playEyes(settings.eyes.volume);
          state.look = { start: t + LEAD_IN_MS, end: t + LEAD_IN_MS + LOOK_AWAY_MS };
          state.lastTick = Math.ceil(LEAD_IN_MS / 1000) + 1;
          setLook(state.look);
          tell("20-20-20", "Gleich 20 Sekunden in die Ferne schauen, etwa 6 Meter weit.");
        }
      }
      if (!settings.drink.on) next.drink = 0;
      else if (counting) {
        next.drink += dt;
        const due = settings.drink.every * 60_000;
        // Both due at once (every 20 and every 10 minutes): drink a moment later.
        if (next.drink >= due && (eyesFired || state.look !== null)) next.drink = due;
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

      // The 20-20-20 break: tick 5…1, a higher tone to look away, a chime when it is over.
      if (state.look !== null && !eyesFired) {
        if (t < state.look.start) {
          const second = Math.ceil((state.look.start - t) / 1000);
          if (second < state.lastTick) {
            state.lastTick = second;
            playTick(settings.eyes.volume);
          }
        } else if (state.lastTick > 0) {
          state.lastTick = 0;
          playTick(settings.eyes.volume, true);
        }
        if (t >= state.look.end) {
          state.look = null;
          setLook(null);
          playEyesDone(settings.eyes.volume);
        }
      }
      if (state.drinkUntil !== null && t >= state.drinkUntil) {
        state.drinkUntil = null;
        setDrinkUntil(null);
      }
    });
  }, []);

  const left = now === null ? (timer.left ?? totalMs(timer, settings)) : remaining(timer, settings, now);
  const total = totalMs(timer, settings);
  const progress = Math.min(1, Math.max(0, 1 - left / total));
  const lookNow = lookState(look, now);

  const toggle = useCallback(() => {
    unlockSound();
    const t = Date.now();
    const current = timerStore.read();
    const s = settingsStore.read();
    if (current.running && current.endsAt !== null) {
      timerStore.write({ ...current, running: false, endsAt: null, left: Math.max(1000, current.endsAt - t) });
    } else {
      timerStore.write({ ...current, running: true, endsAt: t + remaining(current, s, t), left: null, started: true });
    }
  }, []);

  const skip = useCallback(() => {
    unlockSound();
    const s = settingsStore.read();
    timerStore.write(nextTimer(timerStore.read(), s, Date.now(), s.autoStart));
  }, []);

  const adjust = useCallback((minutes: number) => {
    timerStore.write(adjustTimer(timerStore.read(), settingsStore.read(), Date.now(), minutes * 60_000));
  }, []);

  const reset = () => timerStore.write(restartTimer(timerStore.read()));
  const switchPhase = (phase: Phase) => timerStore.write(restartTimer(timerStore.read(), phase));

  const endLook = useCallback(() => {
    latest.current.look = null;
    setLook(null);
  }, []);
  const endDrink = useCallback(() => {
    latest.current.drinkUntil = null;
    setDrinkUntil(null);
  }, []);

  // Space starts and pauses, ← / → take away or add a minute; in the page and the mini window.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || ownsKey(event.target, event.key)) return;
      if (event.code === "Space") toggle();
      else if (event.key === "ArrowLeft") adjust(-1);
      else if (event.key === "ArrowRight") adjust(1);
      else return;
      event.preventDefault();
    };
    const targets = [window, popout.win].filter((w): w is Window => w !== null);
    for (const target of targets) target.addEventListener("keydown", onKey);
    return () => {
      for (const target of targets) target.removeEventListener("keydown", onKey);
    };
  }, [toggle, adjust, popout.win]);

  // The time in the tab title (and the mini window's title).
  const title = timer.started ? `${clock(left)} · ${phaseNames[timer.phase]}` : null;
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

  // Music plays while switched on, but not in breaks if so set.
  const music = settings.music;
  const video = stationVideo(music.station, music.custom);
  const musicHeld = music.pauseInBreaks && timer.phase !== "focus";
  const musicPlaying = musicOn && !musicHeld && video !== null;

  const openMini = async () => {
    unlockSound();
    if (!(await popout.open())) toast.error("Das Mini-Fenster wurde blockiert. Erlaube Pop-ups für diese Seite.");
  };

  const endsAt = timer.running && timer.endsAt !== null ? timer.endsAt : null;
  const nextLong = Math.ceil((timer.round + (timer.phase === "focus" ? 1 : 0)) / settings.longEvery) * settings.longEvery;
  const timerProps = { timer, settings, left, progress, endsAt, onToggle: toggle, onSkip: skip, onAdjust: adjust };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Runde {Math.max(1, timer.round + (timer.phase === "focus" ? 1 : 0))} · lange Pause nach Runde {Math.max(settings.longEvery, nextLong)}
          {timer.round > 0 && (
            <>
              {" · "}
              <button type="button" className="cursor-pointer underline-offset-2 hover:text-foreground hover:underline" onClick={() => timerStore.write({ ...timerStore.read(), round: 0 })}>
                Runden zurücksetzen
              </button>
            </>
          )}
        </p>
        <Button variant="outline" className="hidden bg-card sm:inline-flex" onClick={popout.win ? popout.close : openMini}>
          <PictureInPicture2Icon />
          {popout.win ? "Mini schließen" : "Mini-Fenster"}
        </Button>
      </div>

      {lookNow && <LookBanner look={lookNow} onClose={endLook} />}
      {drinkUntil !== null && (
        <Banner icon={<DropletIcon />} onClose={endDrink}>
          Zeit für einen Schluck Wasser.
        </Banner>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <TimerCard {...timerProps} onSwitchPhase={switchPhase} onReset={reset} />

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <MusicCard music={music} on={musicOn} playing={musicPlaying} held={musicOn && musicHeld} video={video} onToggle={() => setMusicOn((on) => !on)} />
          <RemindersCard settings={settings} timer={timer} elapsed={elapsed} looking={look !== null} />
          <TimesCard settings={settings} />
        </div>
      </div>

      {popout.win &&
        createPortal(
          <MiniTimer {...timerProps} look={lookNow} drinking={drinkUntil !== null} music={musicPlaying ? stationName(music.station) : null} onEndLook={endLook} onEndDrink={endDrink} />,
          popout.win.document.body,
        )}
    </div>
  );
}

type TimerProps = {
  timer: Timer;
  settings: Settings;
  left: number;
  progress: number;
  endsAt: number | null;
  onToggle: () => void;
  onSkip: () => void;
  onAdjust: (minutes: number) => void;
};

function RoundDots({ timer, settings, size }: { timer: Timer; settings: Settings; size: "sm" | "md" }) {
  const count = Math.min(settings.longEvery, 12);
  let done = timer.round % settings.longEvery;
  if (timer.phase === "long" && timer.round > 0 && done === 0) done = settings.longEvery;
  const color = phaseColor.focus;
  return (
    <div className="flex items-center gap-1.5" aria-label={`${done} von ${settings.longEvery} Runden bis zur langen Pause`}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn("rounded-full", size === "sm" ? "size-2" : "size-2.5")}
          style={
            i < done
              ? { background: color }
              : i === done && timer.phase === "focus"
                ? { boxShadow: `inset 0 0 0 2px ${color}` }
                : { background: "#2c3832" }
          }
        />
      ))}
    </div>
  );
}

function TimerCard({ timer, settings, left, progress, endsAt, onToggle, onSkip, onAdjust, onSwitchPhase, onReset }: TimerProps & { onSwitchPhase: (phase: Phase) => void; onReset: () => void }) {
  const color = phaseColor[timer.phase];
  return (
    <section
      aria-label="Timer"
      className="flex min-w-0 flex-[999_1_560px] flex-col items-center gap-7 rounded-3xl bg-[#16201c] px-5 pt-6 pb-7 text-[#f3f4f1] sm:px-8 dark:bg-[#0d1210] dark:ring-1 dark:ring-white/10"
      style={{ "--phase": color } as CSSProperties}
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Phase" className="flex gap-1 rounded-xl bg-[#2c3832] p-1">
          {(Object.keys(phaseNames) as Phase[]).map((phase) => (
            <button
              key={phase}
              type="button"
              role="tab"
              aria-selected={timer.phase === phase}
              onClick={() => onSwitchPhase(phase)}
              className={cn(
                "h-8 cursor-pointer rounded-lg px-3 text-sm font-medium transition-colors sm:px-3.5",
                timer.phase === phase ? "bg-[#f3f4f1] font-semibold text-[#16201c]" : "text-[#b9c2bd] hover:text-[#f3f4f1]",
              )}
            >
              {phaseNames[phase]}
            </button>
          ))}
        </div>
        <RoundDots timer={timer} settings={settings} size="md" />
      </div>

      <div className="relative aspect-square w-full max-w-80">
        <svg aria-hidden="true" viewBox="0 0 320 320" className="absolute inset-0 size-full -rotate-90">
          <circle cx="160" cy="160" r="140" fill="none" stroke="#2c3832" strokeWidth="10" />
          <circle
            cx="160"
            cy="160"
            r="140"
            fill="none"
            stroke={color}
            opacity={progress > 0 ? 1 : 0}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <span className="text-sm font-medium tracking-[0.06em] text-[var(--phase)] uppercase">{phaseNames[timer.phase]}</span>
          <span className="text-7xl leading-none font-semibold tracking-tight tabular-nums sm:text-[84px]" aria-live="off">
            {clock(left)}
          </span>
          <span className="text-sm text-[#b9c2bd]">{endsAt !== null ? `fertig um ${timeOfDay(endsAt)}` : timer.started ? "pausiert" : "bereit"}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <AdjustButton minutes={-1} onAdjust={onAdjust} />
        <IconButton label="Zurücksetzen" onClick={onReset}>
          <RotateCcwIcon className="size-5" />
        </IconButton>
        <PlayButton timer={timer} onToggle={onToggle} />
        <IconButton label="Nächste Phase" onClick={onSkip}>
          <SkipForwardIcon className="size-5" />
        </IconButton>
        <AdjustButton minutes={1} onAdjust={onAdjust} />
      </div>
      <p className="-mt-3 hidden text-xs text-[#9aa39e] sm:block">Leertaste: Start/Pause · ← / →: eine Minute weniger/mehr</p>
    </section>
  );
}

function PlayButton({ timer, onToggle, small }: { timer: Timer; onToggle: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--phase)] font-semibold text-[#16201c] transition-[filter] hover:brightness-110 focus-visible:ring-[3px] focus-visible:ring-white/40 focus-visible:outline-none",
        small ? "h-10 px-4 text-sm" : "h-11 px-5 text-[15px]",
      )}
    >
      {timer.running ? <PauseIcon className="size-4 fill-current" /> : <PlayIcon className="size-4 fill-current" />}
      {buttonLabel(timer)}
    </button>
  );
}

function AdjustButton({ minutes, onAdjust, small }: { minutes: number; onAdjust: (minutes: number) => void; small?: boolean }) {
  return (
    <button
      type="button"
      aria-label={minutes > 0 ? "Eine Minute mehr" : "Eine Minute weniger"}
      title={minutes > 0 ? "Eine Minute mehr" : "Eine Minute weniger"}
      onClick={() => onAdjust(minutes)}
      className={cn(
        "cursor-pointer rounded-[10px] border border-[#3a4741] font-semibold tabular-nums transition-colors hover:bg-white/5 focus-visible:ring-[3px] focus-visible:ring-white/30 focus-visible:outline-none",
        small ? "h-9 min-w-11 text-[13px]" : "h-10 min-w-12 px-3 text-sm sm:min-w-14",
      )}
    >
      {minutes > 0 ? `+${minutes}` : `−${-minutes}`}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-11 cursor-pointer items-center justify-center rounded-full text-[#b9c2bd] transition-colors hover:bg-white/5 hover:text-[#f3f4f1] focus-visible:ring-[3px] focus-visible:ring-white/30 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

// The mini window: fixed rows, so a reminder never moves the clock.
function MiniTimer({
  timer,
  settings,
  left,
  progress,
  endsAt,
  onToggle,
  onSkip,
  onAdjust,
  look,
  drinking,
  music,
  onEndLook,
  onEndDrink,
}: TimerProps & { look: LookState; drinking: boolean; music: string | null; onEndLook: () => void; onEndDrink: () => void }) {
  const color = look ? EYES_COLOR : phaseColor[timer.phase];
  return (
    <div
      className="grid h-screen grid-rows-[24px_1fr_6px_52px_28px] gap-2.5 bg-[#16201c] px-[18px] py-4 text-[#f3f4f1] select-none"
      style={{ "--phase": color, fontFamily: "var(--font-instrument-sans), system-ui, sans-serif" } as CSSProperties}
    >
      {look ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-[0.06em] text-[var(--phase)] uppercase">20-20-20</span>
            <span className="text-xs text-[#9aa39e] tabular-nums">
              {phaseNames[timer.phase]} {clock(left)}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 text-center">
            <EyeIcon className="size-7 text-[var(--phase)]" />
            <span className="text-lg font-semibold">{look.stage === "countdown" ? "Gleich in die Ferne schauen" : "In die Ferne schauen"}</span>
            <span className="text-[13px] text-[#b9c2bd]">etwa 6 Meter weit, 20 Sekunden</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#2c3832]">
            <div className="h-1.5 rounded-full bg-[var(--phase)] transition-[width] duration-300" style={{ width: `${look.progress * 100}%` }} />
          </div>
          <div className="flex items-center justify-center text-[40px] font-semibold tabular-nums">{look.stage === "countdown" ? look.seconds : `${look.seconds} s`}</div>
          <button
            type="button"
            onClick={onEndLook}
            className="h-7 cursor-pointer justify-self-center rounded-full border border-[#3a4741] px-3 text-xs font-medium text-[#b9c2bd] hover:text-[#f3f4f1]"
          >
            Überspringen
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-[0.06em] text-[var(--phase)] uppercase">{phaseNames[timer.phase]}</span>
            <RoundDots timer={timer} settings={settings} size="sm" />
          </div>
          <div className="flex items-center justify-center text-[min(24vw,34vh)] leading-none font-semibold tracking-tight tabular-nums">{clock(left)}</div>
          <div className="h-1.5 rounded-full bg-[#2c3832]">
            <div className="h-1.5 rounded-full bg-[var(--phase)] transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="flex items-center justify-center gap-2">
            <AdjustButton minutes={-1} onAdjust={onAdjust} small />
            <PlayButton timer={timer} onToggle={onToggle} small />
            <IconButton label="Nächste Phase" onClick={onSkip}>
              <SkipForwardIcon className="size-[18px]" />
            </IconButton>
            <AdjustButton minutes={1} onAdjust={onAdjust} small />
          </div>
          {drinking ? (
            <button
              type="button"
              onClick={onEndDrink}
              className="flex h-7 cursor-pointer items-center gap-1.5 justify-self-center rounded-full bg-[#1f3a4a] px-3 text-xs font-medium text-[#cfe6f5]"
            >
              <DropletIcon className="size-3.5" /> Schluck Wasser trinken · ok
            </button>
          ) : (
            <div className="flex items-center justify-center truncate text-xs text-[#9aa39e]">
              {[endsAt !== null ? `fertig um ${timeOfDay(endsAt)}` : timer.started ? "pausiert" : "Leertaste startet", music && `♪ ${music}`]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LookBanner({ look, onClose }: { look: NonNullable<LookState>; onClose: () => void }) {
  return (
    <Banner icon={<EyeIcon />} onClose={onClose}>
      {look.stage === "countdown" ? (
        <>
          <strong>20-20-20:</strong> Gleich in die Ferne schauen … <span className="text-base font-semibold tabular-nums">{look.seconds}</span>
        </>
      ) : (
        <>
          <strong>20-20-20:</strong> Schau in die Ferne, etwa 6 Meter weit. <span className="tabular-nums">Noch {look.seconds} s</span>
        </>
      )}
    </Banner>
  );
}

function Banner({ icon, children, onClose }: { icon: ReactNode; children: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-900 dark:text-sky-100 [&>svg]:size-5 [&>svg]:shrink-0">
      {icon}
      <div className="flex-1">{children}</div>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Schließen">
        <XIcon />
      </Button>
    </div>
  );
}

function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-4 rounded-[20px] border bg-card p-5 text-card-foreground", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MusicCard({ music, on, playing, held, video, onToggle }: { music: Music; on: boolean; playing: boolean; held: boolean; video: string | null; onToggle: () => void }) {
  const status = !on ? "aus" : video === null ? "kein gültiger YouTube-Link" : held ? "pausiert bis zum nächsten Fokus" : `läuft · ${stationName(music.station)}`;
  return (
    <Panel
      title="Lo-Fi"
      action={
        <button
          type="button"
          onClick={onToggle}
          aria-label={on ? "Musik aus" : "Musik an"}
          title={on ? "Musik aus" : "Musik an"}
          className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {on ? <PauseIcon className="size-4 fill-current" /> : <PlayIcon className="size-4 fill-current" />}
        </button>
      }
    >
      <p className="-mt-3 flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <span className={cn("size-[7px] rounded-full", playing ? "bg-brand" : "bg-muted-foreground/40")} />
        {status}
      </p>
      <div role="radiogroup" aria-label="Sender" className="flex flex-wrap gap-1.5">
        {[...stations.map((s) => ({ id: s.id as string, name: s.name as string })), { id: "custom", name: "Eigener Link" }].map((station) => (
          <button
            key={station.id}
            type="button"
            role="radio"
            aria-checked={music.station === station.id}
            onClick={() => setMusic({ station: station.id })}
            className={cn(
              "h-8 cursor-pointer rounded-full border px-3 text-[13px] font-medium transition-colors",
              music.station === station.id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
            )}
          >
            {station.name}
          </button>
        ))}
      </div>
      {music.station === "custom" && (
        <Input
          aria-label="YouTube-Link"
          placeholder="YouTube-Link einfügen"
          value={music.custom}
          onChange={(event) => setMusic({ custom: event.target.value })}
        />
      )}
      <VolumeSlider label="Lautstärke Musik" value={music.volume} onChange={(volume) => setMusic({ volume })} />
      <SwitchRow label="In den Pausen anhalten" checked={music.pauseInBreaks} onChange={(pauseInBreaks) => setMusic({ pauseInBreaks })} />
      {playing && video && <YoutubePlayer video={video} volume={music.volume} className="aspect-video w-full rounded-xl border-0 bg-black" />}
    </Panel>
  );
}

function RemindersCard({ settings, timer, elapsed, looking }: { settings: Settings; timer: Timer; elapsed: Elapsed; looking: boolean }) {
  const quiet = settings.remindersWithTimer && !timer.running;
  return (
    <Panel title="Erinnerungen" className="gap-1">
      <ReminderRow
        icon={<EyeIcon />}
        tile="bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200"
        label="20-20-20-Regel"
        hint="20 Sekunden in die Ferne schauen, mit 5 Sekunden Vorlauf"
        reminder={settings.eyes}
        leftMs={settings.eyes.every * 60_000 - elapsed.eyes}
        paused={looking || quiet}
        onChange={(eyes) => setSettings({ eyes })}
        onTest={() => playEyes(settings.eyes.volume)}
      />
      <ReminderRow
        icon={<DropletIcon />}
        tile="bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200"
        label="Trinken"
        hint="Ein Schluck Wasser zwischendurch"
        reminder={settings.drink}
        leftMs={settings.drink.every * 60_000 - elapsed.drink}
        paused={quiet}
        onChange={(drink) => setSettings({ drink })}
        onTest={() => playDrink(settings.drink.volume)}
      />
      <div className="mt-2 border-t pt-3">
        <SwitchRow
          label="Nur während der Timer läuft"
          hint="Ist der Timer pausiert, bleiben die Erinnerungen still."
          checked={settings.remindersWithTimer}
          onChange={(remindersWithTimer) => setSettings({ remindersWithTimer })}
        />
      </div>
    </Panel>
  );
}

function ReminderRow({
  icon,
  tile,
  label,
  hint,
  reminder,
  leftMs,
  paused,
  onChange,
  onTest,
}: {
  icon: ReactNode;
  tile: string;
  label: string;
  hint: string;
  reminder: Reminder;
  leftMs: number;
  paused: boolean;
  onChange: (reminder: Reminder) => void;
  onTest: () => void;
}) {
  const [open, setOpen] = useState(false);
  const id = label.replace(/\W+/g, "-").toLowerCase();
  const summary = reminder.on
    ? `alle ${reminder.every} Min · ${paused ? "pausiert" : "nächste"} in ${clock(Math.max(0, leftMs))} · ${reminder.volume} %`
    : `aus · alle ${reminder.every} Min`;
  return (
    <div className="border-b last-of-type:border-b-0">
      <div className="flex items-center gap-3 py-2.5">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px] [&>svg]:size-[18px]", tile)}>{icon}</span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={`${id}-details`}
          className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 text-left"
        >
          <span className="flex items-center gap-1 text-sm font-medium">
            {label}
            <ChevronDownIcon className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
          </span>
          <span className="truncate text-xs text-muted-foreground tabular-nums">{summary}</span>
        </button>
        <Switch
          label={label}
          checked={reminder.on}
          onChange={(on) => {
            unlockSound();
            onChange({ ...reminder, on });
          }}
        />
      </div>
      {open && (
        <div id={`${id}-details`} className="space-y-3 pb-3 pl-12">
          <p className="text-xs text-muted-foreground">{hint}</p>
          <div className="flex items-center gap-2">
            <Label htmlFor={`${id}-every`} className="text-sm font-normal text-muted-foreground">
              alle
            </Label>
            <MinutesInput id={`${id}-every`} value={reminder.every} max={240} onChange={(every) => onChange({ ...reminder, every })} className="w-16" />
            <span className="text-sm text-muted-foreground">Min.</span>
          </div>
          <VolumeSlider label={`Lautstärke ${label}`} value={reminder.volume} onChange={(volume) => onChange({ ...reminder, volume })} onTest={onTest} />
        </div>
      )}
    </div>
  );
}

function TimesCard({ settings }: { settings: Settings }) {
  const [more, setMore] = useState(false);
  return (
    <Panel
      title="Zeiten"
      action={
        <button type="button" onClick={() => setMore((value) => !value)} aria-expanded={more} className="cursor-pointer text-[13px] font-medium text-brand hover:underline">
          {more ? "Weniger" : "Alle Einstellungen"}
        </button>
      }
    >
      <div className="grid grid-cols-4 gap-2">
        <NumberField id="focus" label="Fokus" value={settings.focus} max={240} onChange={(focus) => setSettings({ focus })} />
        <NumberField id="short" label="Kurz" value={settings.short} max={120} onChange={(short) => setSettings({ short })} />
        <NumberField id="long" label="Lang" value={settings.long} max={120} onChange={(long) => setSettings({ long })} />
        <NumberField id="long-every" label="Runden" value={settings.longEvery} max={12} onChange={(longEvery) => setSettings({ longEvery })} />
      </div>
      {more && (
        <div className="space-y-4 border-t pt-4">
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium [&>svg]:size-4">
              <BellIcon /> Lautstärke Timer-Ende
            </p>
            <VolumeSlider label="Lautstärke Timer-Ende" value={settings.timerVolume} onChange={(timerVolume) => setSettings({ timerVolume })} onTest={() => playBell(settings.timerVolume)} />
          </div>
          <SwitchRow
            label="Nächste Phase automatisch starten"
            hint="Nach dem Fokus läuft die Pause gleich los und umgekehrt."
            checked={settings.autoStart}
            onChange={(autoStart) => setSettings({ autoStart })}
          />
          <SwitchRow
            label="Benachrichtigung im Hintergrund"
            hint="Zusätzlich zum Ton, wenn du in einem anderen Fenster bist."
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
          />
        </div>
      )}
    </Panel>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        checked ? "bg-brand" : "bg-input",
      )}
    >
      <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform", checked && "translate-x-4")} />
    </button>
  );
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

function VolumeSlider({ label, value, onChange, onTest }: { label: string; value: number; onChange: (value: number) => void; onTest?: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <Volume2Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Slider aria-label={label} value={[value]} min={0} max={100} step={5} onValueChange={([v]) => onChange(v)} className="flex-1" />
      <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{value} %</span>
      {onTest && (
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => {
            unlockSound();
            onTest();
          }}
        >
          Test
        </Button>
      )}
    </div>
  );
}

function NumberField({ id, label, value, max, onChange }: { id: string; label: string; value: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
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
