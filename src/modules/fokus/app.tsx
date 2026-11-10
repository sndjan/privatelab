"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { BellIcon, CheckIcon, PauseIcon, PlayIcon, RotateCcwIcon, SkipForwardIcon, Volume2Icon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { dataQuery } from "@/lib/query/data";
import { cn } from "@/lib/utils";
import { discardSession, saveSettings, saveTimer } from "./actions";
import { fontVariables } from "./fonts";
import type { FokusState } from "./loaders";
import { BREAK, clock, describe, FOCUS, freshTimer, menu, ROUNDS, roundEnd, secondsUntilStop, teaMoment, timerAt, TOTAL, type Timer } from "./menu";
import { Scene } from "./scene";
import { sceneBackground } from "./scene-data";
import { alarm, ding, notify, unlockSound } from "./sound";

const INK = "#1c2b22";
const displayFont = "font-[family-name:var(--font-fokus-display)]";
const timeOfDay = (ms: number) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

// The module in the browser, from the query cache (see index.tsx).
export function FokusApp() {
  const { data } = useSuspenseQuery(dataQuery("fokus", "state"));
  // "?zeitraffer" runs the clock 60 times faster, to look at the animations.
  const speed = useSearchParams().has("zeitraffer") ? 60 : 1;
  return <FokusView data={data} speed={speed} />;
}

function FokusView({ data, speed }: { data: FokusState; speed: number }) {
  const queryClient = useQueryClient();
  const [timer, setTimer] = useState<Timer>(data.session?.timer ?? freshTimer);
  const [started, setStarted] = useState(Boolean(data.session));
  const [settings, setSettings] = useState(data.settings);
  // null until the page runs in the browser, so the server and the first
  // browser render show the same (stored) clock.
  const [now, setNow] = useState<number | null>(null);
  const [peek, setPeek] = useState(0);
  const [peeking, setPeeking] = useState(false);

  // Another device changed the evening: take over its clock, unless the
  // change is our own save coming back or a save of ours is still on its way.
  const serverStamp = data.session?.updatedAt ?? null;
  const [seenStamp, setSeenStamp] = useState(serverStamp);
  const [ownStamp, setOwnStamp] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  if (serverStamp !== seenStamp) {
    setSeenStamp(serverStamp);
    if (data.session && saving === 0 && (!ownStamp || new Date(data.session.updatedAt) > new Date(ownStamp))) {
      setTimer(data.session.timer);
      setStarted(true);
    }
  }

  const timerRef = useRef(timer);
  const settingsRef = useRef(settings);
  useEffect(() => {
    timerRef.current = timer;
    settingsRef.current = settings;
  });

  const commit = useCallback(
    (next: Timer) => {
      timerRef.current = next;
      setTimer(next);
      setSaving((count) => count + 1);
      saveTimer(next)
        .then(({ updatedAt }) => {
          setOwnStamp(updatedAt);
          if (next.phase === "done") void queryClient.invalidateQueries({ queryKey: ["fokus"] });
        })
        .catch(() => toast.error("Speichern hat nicht geklappt. Die Uhr läuft auf diesem Gerät weiter."))
        .finally(() => setSaving((count) => count - 1));
    },
    [queryClient],
  );

  // A round or a break ran out by itself: stop there, ring and tell.
  const settle = useCallback(() => {
    const before = timerRef.current;
    if (!before.running) return;
    const after = timerAt(before, Date.now(), speed);
    if (after.running) return;
    commit(after);
    if (settingsRef.current.sound) ding();
    if (settingsRef.current.notify) {
      if (after.phase === "done") void notify("Buon appetito", "Alle drei Gänge stehen auf dem Tisch.");
      else if (before.phase === "focus") void notify("Runde geschafft", `${menu.courses[describe(after).round - 1].title} ist fertig. Zeit für Tee.`);
      else void notify("Tasse leer", "Die Pause ist vorbei. Die Küche wartet.");
    }
  }, [commit, speed]);

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      settle();
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [settle]);

  // The same check on the second, also when the tab is in the background.
  useEffect(() => {
    const seconds = secondsUntilStop(timer, speed);
    if (seconds === null) return;
    return alarm(seconds * 1000 + 60, settle);
  }, [timer, speed, settle]);

  const view = now === null ? timer : timerAt(timer, now, speed);
  const info = describe(view);
  const { step, round } = info;
  const isMenu = !started;
  const isBreak = !isMenu && view.phase === "break";
  const isDone = !isMenu && view.phase === "done";
  const isFocus = !isMenu && view.phase === "focus";
  const breakOver = isBreak && view.pause >= BREAK;
  const teaStarted = view.running || view.pause > 0;
  const tea = teaMoment(view.pause, teaStarted);

  // The remaining time in the browser tab, for a glance while working.
  useEffect(() => {
    if (isMenu || now === null) return;
    const previous = document.title;
    document.title = isDone
      ? "Buon appetito · Fokusküche"
      : `${clock(isBreak ? info.breakLeft : info.roundLeft)} · ${isBreak ? "Teepause" : step.title}`;
    return () => {
      document.title = previous;
    };
  });

  const stamp = () => Date.now();
  const begin = () => {
    unlockSound();
    setStarted(true);
    commit({ ...freshTimer, running: true, anchor: stamp() });
  };
  const toggle = () => {
    unlockSound();
    const current = timerAt(timerRef.current, stamp(), speed);
    commit(current.running ? { ...current, running: false, anchor: null } : { ...current, running: true, anchor: stamp() });
  };
  const resume = () => {
    unlockSound();
    commit({ phase: "focus", focus: view.focus, pause: 0, running: true, anchor: stamp() });
  };
  const skip = () => {
    unlockSound();
    const end = roundEnd(view.focus);
    if (isBreak) resume();
    else if (end >= TOTAL) commit({ phase: "done", focus: TOTAL, pause: 0, running: false, anchor: null });
    else commit({ phase: "break", focus: end, pause: 0, running: false, anchor: null });
  };
  const restart = async () => {
    if (!isDone && !(await confirmDialog({ title: "Abend neu starten?", description: "Was bisher gekocht ist, geht verloren.", confirmLabel: "Neu starten" }))) return;
    const fresh = { ...freshTimer };
    timerRef.current = fresh;
    setTimer(fresh);
    setStarted(false);
    if (!isDone) discardSession().catch(() => toast.error("Zurücksetzen hat nicht geklappt."));
  };
  const look = () => {
    setPeek((count) => count + 1);
    setPeeking(true);
    setTimeout(() => setPeeking(false), 2200);
  };
  const change = async (key: "sound" | "notify") => {
    unlockSound();
    let value = !settings[key];
    if (key === "notify" && value) {
      if (typeof Notification === "undefined") {
        toast.error("Dieser Browser kann keine Mitteilungen zeigen.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Mitteilungen sind für diese Seite nicht erlaubt. Das lässt sich in den Website-Einstellungen ändern.");
        value = false;
      }
    }
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (key === "sound" && value) ding();
    saveSettings(next).catch(() => toast.error("Die Einstellung wurde nicht gespeichert."));
  };

  const sceneNow = isMenu || isDone ? "tisch" : isBreak ? "tee" : step.scene;
  const progressNow = isMenu || isDone ? 1 : isBreak ? info.breakProgress : info.stepProgress;
  const pageBg = sceneBackground(sceneNow, progressNow);
  const endsAt = now === null ? null : timeOfDay(now + ((isMenu ? info.wallTotal : info.wallTotal - info.wallDone) / speed) * 1000);

  const stageTitle = isMenu ? "Heute gibt es drei Gänge" : isDone ? "Buon appetito" : isBreak ? tea.title : step.title;
  const stageText = isMenu
    ? "Drei Gänge, während du arbeitest. Gekocht wird nur, solange du fokussiert bist."
    : isDone
      ? "2 Std. 15 Min. Fokus in drei Runden. Das Tiramisu zieht noch ein paar Stunden im Kühlschrank."
      : isBreak
        ? peeking && !breakOver ? "Geduld, er zieht noch." : tea.text
        : peeking ? step.peek : step.text;

  let primaryLabel = view.running ? "Anhalten" : view.focus > 0 ? "Weiter kochen" : "Herd an";
  let primary = toggle;
  if (isBreak) {
    primaryLabel = breakOver ? `Weiter mit ${step.title}` : view.running ? "Pause anhalten" : teaStarted ? "Pause fortsetzen" : "Tee aufgießen";
    if (breakOver) primary = resume;
  }

  return (
    <div
      className={cn("fokus-root -mx-2 rounded-[32px] p-4 sm:mx-0 sm:p-6", fontVariables)}
      style={{ background: pageBg, color: INK, fontFamily: "var(--font-fokus-body), ui-sans-serif, system-ui, sans-serif", transition: "background 1200ms linear" }}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Küche" className="flex min-w-0 flex-col gap-4 lg:min-h-[720px]">
          <header className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
            <div>
              <p className={cn(displayFont, "text-sm font-extrabold tracking-wide text-[#25613f] uppercase")}>Fokusküche</p>
              <p className={cn(displayFont, "text-xl font-black")}>{menu.name}</p>
            </div>
            <ol aria-label="Gänge" className="flex items-center gap-3 rounded-full bg-white/60 py-1 pr-4 pl-1">
              {menu.courses.map((course, index) => {
                const done = !isMenu && index < info.coursesDone;
                const current = isFocus && index === round - 1;
                return (
                  <li key={course.title} className="flex items-center gap-2">
                    <span className={cn("block size-10 transition-opacity duration-700", !done && "opacity-40 grayscale")}>
                      <Scene scene={course.scene} progress={1} playing={false} radius="999px" />
                    </span>
                    <span className={cn("hidden text-sm sm:inline", current ? "font-bold" : "font-medium", !done && !current && "text-[#63706a]")}>
                      {course.title}
                    </span>
                  </li>
                );
              })}
            </ol>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
            <button
              key={peek}
              type="button"
              onClick={look}
              aria-label={isBreak ? "An der Tasse nippen" : "In die Küche schauen"}
              className="w-full max-w-[min(300px,38vh)] cursor-pointer rounded-full sm:max-w-[min(520px,62vh)]"
              style={{ animation: peek ? "fk-nudge 700ms cubic-bezier(0.3, 0.7, 0.4, 1)" : undefined }}
            >
              <Scene scene={sceneNow} progress={progressNow} playing={view.running || isDone || isMenu} flat radius="0px" />
            </button>
            <div className="flex flex-col items-center gap-1 text-center sm:min-h-[84px]">
              <h2 className={cn(displayFont, "text-2xl leading-tight font-black sm:text-[34px]")}>{stageTitle}</h2>
              <p aria-live="polite" className="max-w-[460px] text-[15px] leading-normal text-[#4f5b55] sm:text-[17px]">
                {stageText}
              </p>
            </div>
          </div>

          {!isMenu && (
            <footer className="hidden flex-col gap-2 sm:flex">
              <div role="img" aria-label="Dein Abend: drei Runden zu 45 Minuten, dazwischen zweimal Tee" className="flex gap-1">
                {Array.from({ length: ROUNDS * 2 - 1 }, (_, index) => {
                  const isTea = index % 2 === 1;
                  const r = Math.floor(index / 2);
                  const filled = isTea
                    ? isDone || view.focus > (r + 1) * FOCUS + 1e-9
                      ? 1
                      : isBreak && round === r + 1
                        ? info.breakProgress
                        : 0
                    : Math.min(1, Math.max(0, (view.focus - r * FOCUS) / FOCUS));
                  return (
                    <span key={index} className="relative h-2 overflow-hidden rounded-full bg-[#1c2b22]/15" style={{ flex: isTea ? BREAK : FOCUS }}>
                      <span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ width: `${filled * 100}%`, background: isTea ? "#a8763f" : INK, transition: "width 300ms linear" }}
                      />
                    </span>
                  );
                })}
              </div>
              <div className="flex justify-between gap-3 text-sm text-[#4f5b55]">
                <span>{now === null ? "" : `Start ${timeOfDay(now - (info.wallDone / speed) * 1000)}`}</span>
                <span>{isDone || endsAt === null ? "" : `Essen um ${endsAt}`}</span>
              </div>
            </footer>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6 rounded-[28px] bg-white p-6 sm:p-7">
          {isMenu ? (
            <>
              <div className="flex flex-col gap-1">
                <p className={cn(displayFont, "text-sm font-extrabold tracking-wide text-[#2f7a52] uppercase")}>Heute Abend</p>
                <p className="text-[15px] text-[#63706a]">2 Std. 15 Min. Fokus in drei Runden, dazwischen zweimal Tee.</p>
              </div>
              <ol aria-label="Menü" className="flex flex-col">
                {menu.courses.map((course, index) => (
                  <li key={course.title} className="flex flex-col">
                    <div className="flex min-h-16 items-center gap-3.5">
                      <span aria-hidden className={cn(displayFont, "flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eaf3ec] text-[15px] font-black text-[#25613f]")}>
                        {index + 1}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cn(displayFont, "text-[17px] leading-snug font-extrabold")}>{course.title}</span>
                        <span className="text-sm text-[#4f5b55]">{course.sub}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-[#4f5b55] tabular-nums">45 Min.</span>
                    </div>
                    {index < ROUNDS - 1 && (
                      <div className="flex h-6 items-center gap-2.5 pl-[46px] text-[13px] text-[#63706a]">
                        <span aria-hidden className="h-px flex-1 bg-[#ebe8e2]" />
                        15 Min. Tee
                        <span aria-hidden className="h-px flex-1 bg-[#ebe8e2]" />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
              <div className="mt-auto flex flex-col items-center gap-3">
                {endsAt && <p className="text-sm text-[#4f5b55]">Wenn du jetzt anfängst: Essen um {endsAt}</p>}
                <button
                  type="button"
                  onClick={begin}
                  className={cn(displayFont, "h-[60px] w-full cursor-pointer rounded-full bg-[#2f7a52] text-[19px] font-extrabold text-white transition-colors hover:bg-[#25613f]")}
                >
                  Herd an
                </button>
              </div>
            </>
          ) : (
            <>
              <section aria-label="Timer" className="flex flex-col items-center gap-1.5 text-center">
                <p className={cn(displayFont, "text-sm font-extrabold tracking-wide text-[#2f7a52] uppercase")}>
                  {isDone ? menu.name : isBreak ? `Teepause nach Runde ${round}` : `Runde ${round} · ${menu.courses[round - 1].title}`}
                </p>
                <p role="timer" className={cn(displayFont, "text-[84px] leading-none font-black tracking-tight tabular-nums sm:text-[96px]")}>
                  {isDone ? "2:15" : clock(isBreak ? info.breakLeft : info.roundLeft)}
                </p>
                <p className="text-[15px] text-[#63706a]">
                  {isDone
                    ? "Stunden Fokus. Alle drei Gänge stehen auf dem Tisch."
                    : isBreak
                      ? "Die Küche steht still, bis du weitermachst."
                      : round === ROUNDS
                        ? "bis zum Essen"
                        : "bis zur Teepause"}
                </p>
              </section>

              {isBreak && (
                <div role="img" aria-label="Aufgießen, ziehen lassen, trinken" className="mx-auto -mt-2 flex w-60 gap-1">
                  {[[1, 0, 60], [8, 60, 540], [6, 540, 900]].map(([flex, from, to]) => (
                    <span key={from} className="relative h-2 overflow-hidden rounded-full bg-[#1c2b22]/15" style={{ flex }}>
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-[#a8763f]"
                        style={{ width: `${Math.min(1, Math.max(0, (view.pause - from) / (to - from))) * 100}%`, transition: "width 300ms linear" }}
                      />
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-col items-center gap-2.5">
                {isDone ? (
                  <button
                    type="button"
                    onClick={restart}
                    className={cn(displayFont, "h-[60px] w-full cursor-pointer rounded-full bg-[#2f7a52] text-[19px] font-extrabold text-white transition-colors hover:bg-[#25613f]")}
                  >
                    Neuer Abend
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-6">
                      <RoundButton label="Abend neu starten" onClick={restart}>
                        <RotateCcwIcon className="size-5" />
                      </RoundButton>
                      <button
                        type="button"
                        onClick={primary}
                        aria-label={primaryLabel}
                        className="flex size-20 cursor-pointer items-center justify-center rounded-full bg-[#2f7a52] text-white shadow-[0_10px_24px_rgba(47,122,82,0.28)] transition-colors hover:bg-[#25613f]"
                      >
                        {view.running ? <PauseIcon className="size-7 fill-current" /> : <PlayIcon className="ml-1 size-7 fill-current" />}
                      </button>
                      <RoundButton label={isBreak ? "Pause beenden" : "Runde beenden"} onClick={skip}>
                        <SkipForwardIcon className="size-5" />
                      </RoundButton>
                    </div>
                    <p aria-hidden className="text-sm font-semibold text-[#63706a]">
                      {primaryLabel}
                    </p>
                  </>
                )}
              </div>

              <ol aria-label="Ablauf" className="flex flex-col gap-0.5">
                {menu.courses.map((course, r) => {
                  const done = r < info.coursesDone;
                  const current = isFocus && r === round - 1;
                  const steps = menu.steps.map((entry, index) => ({ ...entry, index })).filter((entry) => entry.from >= r * 45 && entry.to <= (r + 1) * 45);
                  const teaReached = isDone || view.focus > (r + 1) * FOCUS + 1e-9 || (isBreak && round === r + 1);
                  return (
                    <li key={course.title} className="flex flex-col">
                      <div className="flex min-h-10 items-center gap-3">
                        <span
                          aria-hidden
                          className={cn(
                            displayFont,
                            "flex size-[26px] shrink-0 items-center justify-center rounded-full text-[13px] font-black",
                            done ? "bg-[#2f7a52] text-white" : current ? "bg-[#eaf3ec] text-[#25613f]" : "bg-[#f2f1ee] text-[#63706a]",
                          )}
                        >
                          {done ? <CheckIcon className="size-3.5" strokeWidth={3.5} /> : r + 1}
                        </span>
                        <span className={cn(displayFont, "min-w-0 flex-1 text-base font-extrabold", done && "text-[#63706a]")}>{course.title}</span>
                        <span className="shrink-0 text-sm text-[#63706a] tabular-nums">
                          {done ? "fertig" : current ? `noch ${Math.max(1, Math.ceil(info.roundLeft / 60))} Min.` : "45 Min."}
                        </span>
                      </div>
                      {current && (
                        <ol className="mb-1.5 ml-3 border-l-2 border-[#eaf3ec] pl-3">
                          {steps.map((entry) => {
                            const stepDone = entry.index < info.index;
                            const stepNow = entry.index === info.index;
                            return (
                              <li key={entry.title} className="flex min-h-[34px] items-center gap-3 pl-3">
                                <span
                                  aria-hidden
                                  className="size-2 shrink-0 rounded-full transition-colors duration-500"
                                  style={{ background: stepDone ? INK : stepNow ? "#2f7a52" : "rgba(28, 43, 34, 0.18)", boxShadow: stepNow ? "0 0 0 4px #eaf3ec" : "none" }}
                                />
                                <span className={cn("min-w-0 flex-1 text-[15px]", stepNow ? "font-bold" : "font-medium", stepDone && "text-[#63706a]")}>{entry.title}</span>
                                <span className="shrink-0 text-sm text-[#63706a] tabular-nums">
                                  {stepNow ? `noch ${Math.max(1, Math.ceil(entry.to - view.focus / 60 - 1e-9))} Min.` : `${entry.to - entry.from} Min.`}
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                      {r < ROUNDS - 1 && (
                        <div className="flex min-h-7 items-center gap-3 pl-[38px] text-[13px] text-[#63706a]">
                          <span aria-hidden className="size-2 rounded-full" style={{ background: teaReached ? "#a8763f" : "rgba(168, 118, 63, 0.3)" }} />
                          15 Min. Tee
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </>
          )}

          <section aria-label="Einstellungen" className={cn("flex flex-col gap-2", !isMenu && "mt-auto")}>
            <div className="grid grid-cols-2 gap-2">
              <Switch label="Ton" icon={<Volume2Icon className="size-4" />} on={settings.sound} onClick={() => change("sound")} />
              <Switch label="Mitteilung" icon={<BellIcon className="size-4" />} on={settings.notify} onClick={() => change("notify")} />
            </div>
            {data.history.length > 0 && (
              <p className="text-center text-sm text-[#63706a]">
                {data.history.length === 1 ? "1 Abend" : `${data.history.length} Abende`} gekocht, zuletzt am{" "}
                {new Date(data.history[0].finishedAt).toLocaleDateString("de-DE", { day: "numeric", month: "long" })}
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-[52px] cursor-pointer items-center justify-center rounded-full bg-[#f2f1ee] transition-colors hover:bg-[#e8e6e1]"
    >
      {children}
    </button>
  );
}

function Switch({ label, icon, on, onClick }: { label: string; icon: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="flex h-12 cursor-pointer items-center justify-between gap-2 rounded-[18px] bg-[#f7f6f3] px-3.5 text-[15px] transition-colors hover:bg-[#f0eeea]"
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span aria-hidden className="relative h-[22px] w-9 rounded-full transition-colors" style={{ background: on ? "#2f7a52" : "#d9dedb" }}>
        <span className="absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-[left]" style={{ left: on ? 17 : 3 }} />
      </span>
    </button>
  );
}
