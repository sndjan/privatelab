"use client";

import { CheckIcon, ChevronDownIcon, FlagIcon, MoonIcon, PrinterIcon, StickyNoteIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ViewLink as Link } from "@/lib/query/view-link";
import { Fragment, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setSessionDone } from "./actions";
import { Court } from "./court";
import { formatClock, hasVariations, liveState, phaseName, showsMidcourt, timeline, type Exercise, type LiveState, type Stage } from "./data";
import { TeilzielBox } from "./exercise-details";
import { tennisQuery } from "./query";
import { TeilzielLine } from "./teilziel-picker";
import { VariationList } from "./variations";

const PATH = "/m/tennis";
const TICK_MS = 15_000;

// The current time, refreshed every 15 seconds. Null while rendering on the
// server, so the live parts only appear in the browser.
function subscribe(callback: () => void) {
  const timer = setInterval(callback, TICK_MS);
  document.addEventListener("visibilitychange", callback);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", callback);
  };
}

export function useNow() {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / TICK_MS) * TICK_MS,
    () => null,
  );
}

export function useLive(session: { date: string; startTime: string; plan: { minutes: number }[] }) {
  const now = useNow();
  return now === null ? null : liveState(session, new Date(now));
}

// `note`: the coach's reminder for this session; `teilziel`: the one point to
// watch in this exercise ("" = none).
type Item = { exercise: Exercise; minutes: number; note?: string; teilziel: string };

// What to tick off at the end: the group's lists, the day's only after the
// last session of the day.
export type Checklist = { sessionId: string; afterSession: string[]; dayEnd: string[]; done: string[] };

// The session at a glance: a timeline with only the exercise names and their
// Teilziel; each one opens for its details. While the session runs, the
// current exercise is the one big card, with the minutes left. At the end,
// the checklist for closing the session.
export function SessionPlan({
  date,
  startTime,
  items,
  stage = null,
  checklist,
}: {
  date: string;
  startTime: string;
  items: Item[];
  // The group's Play+Stay stage: Orange sketches show the midcourt line.
  stage?: Stage | null;
  checklist?: Checklist;
}) {
  const live = useLive({ date, startTime, plan: items });
  const now = useNow();
  const ranges = timeline(startTime, items);
  const end = ranges.at(-1)?.end ?? 0;
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const toggle = (index: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <div className="space-y-3">
      <Strip items={items} live={live} />
      {live && <LiveLine live={live} end={end} now={now} />}

      <ol className="flex flex-col">
        {items.map((item, index) => {
          const current = live?.kind === "running" && live.index === index;
          const past = (live?.kind === "running" && index < live.index) || live?.kind === "over";
          const newPhase = index === 0 || items[index - 1].exercise.phase !== item.exercise.phase;
          const expanded = open.has(index);
          return (
            <Fragment key={index}>
              {newPhase && (
                <li aria-hidden="true" className="grid h-7 grid-cols-[3rem_1.25rem_minmax(0,1fr)] items-center gap-2">
                  <span />
                  <span className="mx-auto h-full w-0.5 bg-border" />
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {phaseName(item.exercise.phase)}
                  </span>
                </li>
              )}
              <li className="grid grid-cols-[3rem_1.25rem_minmax(0,1fr)] gap-2">
                <span
                  className={cn(
                    "pt-3.5 font-mono text-sm",
                    past && "text-muted-foreground",
                    current && "pt-5 font-semibold",
                  )}
                >
                  {formatClock(ranges[index].start)}
                </span>
                <span className="relative flex justify-center" aria-hidden="true">
                  <span className="absolute inset-y-0 w-0.5 bg-border" />
                  <span
                    className={cn(
                      "relative mt-4 size-2.5 rounded-full border-2 border-muted-foreground/60 bg-background",
                      past && "border-brand bg-brand",
                      current && "mt-5.5 size-3.5 border-hero-bar bg-hero-bar ring-4 ring-hero",
                    )}
                  />
                </span>
                <div className="py-1">
                  <div
                    className={cn(
                      "overflow-hidden rounded-xl border bg-card",
                      past && !expanded && "bg-transparent text-muted-foreground",
                      current && "border-hero bg-hero text-hero-foreground shadow-md",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(index)}
                      aria-expanded={expanded}
                      className="flex min-h-12 w-full cursor-pointer flex-col gap-1.5 px-3.5 py-2.5 text-left"
                    >
                      {current && (
                        <span className="flex items-center gap-1.5 text-xs tracking-wide text-hero-muted uppercase">
                          <span className="size-2 animate-pulse rounded-full bg-hero-bar" /> Jetzt
                        </span>
                      )}
                      <span className="flex w-full items-center gap-2">
                        {past && <CheckIcon className="size-4 shrink-0 text-brand" aria-label="Vorbei" />}
                        <span className={cn("min-w-0 flex-1 leading-tight font-semibold", current && "text-xl")}>
                          {item.exercise.name}
                        </span>
                        {item.note && <StickyNoteIcon className="size-4 shrink-0 text-amber-500" aria-label="Mit Notiz" />}
                        <span className={cn("font-mono text-sm text-muted-foreground", current && "text-hero-muted")}>
                          {item.minutes}′
                        </span>
                        <ChevronDownIcon className={cn("size-4 shrink-0 opacity-60 transition-transform", expanded && "rotate-180")} />
                      </span>
                      {item.teilziel && (
                        <TeilzielLine
                          value={item.teilziel}
                          className={cn("text-sm text-brand", past && "text-muted-foreground", current && "text-base text-hero-bar")}
                        />
                      )}
                      {current && live?.kind === "running" && (
                        <span className="flex w-full items-center gap-2.5">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hero-track">
                            <span className="block h-full rounded-full bg-hero-bar" style={{ width: `${live.progress * 100}%` }} />
                          </span>
                          <span className="font-mono text-sm text-hero-bar">noch {live.minutesLeft} Min.</span>
                        </span>
                      )}
                    </button>
                    {expanded && <Details item={item} stage={stage} dark={current} />}
                  </div>
                </div>
              </li>
            </Fragment>
          );
        })}

        <li className="grid grid-cols-[3rem_1.25rem_minmax(0,1fr)] gap-2">
          <span className="pt-3.5 font-mono text-sm">{formatClock(end)}</span>
          <span className="flex justify-center pt-4" aria-hidden="true">
            <span className="size-3 rounded-sm border-2 border-foreground bg-background" />
          </span>
          <div className="py-1">
            {checklist && (checklist.afterSession.length > 0 || checklist.dayEnd.length > 0) ? (
              <ClosingChecklist {...checklist} />
            ) : (
              <p className="pt-2.5 text-sm text-muted-foreground">Ende</p>
            )}
          </div>
        </li>
      </ol>
    </div>
  );
}

// An exercise's details, opened in the timeline.
function Details({ item, stage, dark }: { item: Item; stage: Stage | null; dark: boolean }) {
  const { exercise, note, teilziel } = item;
  return (
    <div className="space-y-3 px-3.5 pb-3.5 text-sm">
      {note && (
        <p className="flex gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1.5 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100">
          <StickyNoteIcon className="mt-0.5 size-4 shrink-0" />
          <span className="whitespace-pre-line">{note}</span>
        </p>
      )}
      {teilziel && <TeilzielBox teilziel={teilziel} className={cn(dark && "bg-hero-track text-hero-foreground")} />}
      {exercise.summary && (
        <p>
          <span className="font-medium">Aufgabe: </span>
          {exercise.summary}
        </p>
      )}
      {exercise.diagram.items.length > 0 && (
        <Court diagram={exercise.diagram} horizontal midcourt={showsMidcourt(exercise, stage)} className="w-full max-w-xl" />
      )}
      {exercise.description && (
        <p className="whitespace-pre-line">
          <span className="font-medium">Ablauf: </span>
          {exercise.description}
        </p>
      )}
      {hasVariations(exercise.variations) && (
        <div className="space-y-1">
          <p className="font-medium">Variationen</p>
          <VariationList variations={exercise.variations} />
        </div>
      )}
      <Link
        href={`${PATH}?exercise=${exercise.id}`}
        className={cn("inline-block text-muted-foreground underline-offset-4 hover:underline", dark && "text-hero-muted")}
      >
        Zur Übung
      </Link>
    </div>
  );
}

// Every exercise as a block as long as its minutes, filled as far as the
// session has got.
function Strip({ items, live }: { items: Item[]; live: LiveState | null }) {
  if (items.length === 0) return null;
  return (
    <div className="flex h-2 gap-0.5" aria-hidden="true">
      {items.map((item, index) => {
        const fill =
          live?.kind === "over" || (live?.kind === "running" && index < live.index)
            ? 1
            : live?.kind === "running" && index === live.index
              ? live.progress
              : 0;
        const current = live?.kind === "running" && index === live.index;
        return (
          <div
            key={index}
            className={cn("overflow-hidden rounded-sm bg-border", current && "bg-chart-3")}
            style={{ flex: `${item.minutes} 1 0` }}
          >
            <div className="h-full bg-brand" style={{ width: `${fill * 100}%` }} />
          </div>
        );
      })}
    </div>
  );
}

function LiveLine({ live, end, now }: { live: LiveState; end: number; now: number | null }) {
  if (live.kind === "over") {
    return <p className="text-sm text-muted-foreground">Die Stunde ist vorbei. Unten noch abhaken, was zum Abschluss ansteht.</p>;
  }
  if (live.kind === "before") {
    const hours = Math.floor(live.minutesUntil / 60);
    return (
      <p className="text-sm text-muted-foreground">
        Beginnt in {hours > 0 ? `${hours} Std. ${live.minutesUntil % 60} Min.` : `${live.minutesUntil} Min.`}
      </p>
    );
  }
  const clock = now === null ? null : new Date(now);
  const nowMinutes = clock ? clock.getHours() * 60 + clock.getMinutes() : null;
  return (
    <p role="status" className="flex justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {nowMinutes !== null && <span className="font-mono text-foreground">{formatClock(nowMinutes)}</span>}
        {nowMinutes !== null && end > nowMinutes && ` · noch ${end - nowMinutes} Min. Stunde`}
      </span>
      <span>
        Ende <span className="font-mono">{formatClock(end)}</span>
      </span>
    </p>
  );
}

// "Stunde abschließen" and, after the last session of the day, "Tagesende":
// a plain to-do list. Taps show at once and are saved one after another
// (like the attendance).
function ClosingChecklist({ sessionId, afterSession, dayEnd, done: savedDone }: Checklist) {
  const queryClient = useQueryClient();
  const key = tennisQuery("sessions").queryKey;
  const saving = useRef(Promise.resolve());
  const done = new Set(savedDone);
  const all = [...afterSession, ...dayEnd];
  const count = all.filter((item) => done.has(item)).length;

  function flip(item: string) {
    const next = done.has(item) ? savedDone.filter((entry) => entry !== item) : [...savedDone, item];
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData(key, (sessions) =>
      sessions?.map((session) => (session.id === sessionId ? { ...session, done: next } : session)),
    );
    saving.current = saving.current
      .then(() => setSessionDone(sessionId, next))
      .catch(() => {
        toast.error("Konnte nicht gespeichert werden.");
        void queryClient.invalidateQueries({ queryKey: key });
      });
  }

  const sections = [
    { title: "Stunde abschließen", hint: null, items: afterSession, Icon: FlagIcon },
    { title: "Tagesende", hint: "letzte Stunde heute", items: dayEnd, Icon: MoonIcon },
  ].filter((section) => section.items.length > 0);

  return (
    <div className="space-y-2">
      {sections.map(({ title, hint, items, Icon }) => (
        <section key={title} aria-label={title} className="rounded-xl border bg-card px-1.5 pt-2.5 pb-1">
          <div className="flex items-center gap-2 px-2 pb-1">
            <Icon className="size-4 shrink-0" />
            <h3 className="flex-1 font-semibold">{title}</h3>
            {hint ? (
              <span className="text-xs text-muted-foreground">{hint}</span>
            ) : (
              <span className="font-mono text-sm text-muted-foreground">
                {count}/{all.length}
              </span>
            )}
          </div>
          <ul>
            {items.map((item) => {
              const ticked = done.has(item);
              return (
                <li key={item}>
                  <button
                    type="button"
                    aria-pressed={ticked}
                    onClick={() => flip(item)}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-accent/60"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-muted-foreground/50",
                        ticked && "border-brand bg-brand text-brand-foreground",
                      )}
                    >
                      {ticked && <CheckIcon className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className={cn(ticked && "text-muted-foreground line-through")}>{item}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function PrintButton() {
  return (
    <Button variant="ghost" size="icon" className="size-10" aria-label="Drucken" title="Drucken" onClick={() => window.print()}>
      <PrinterIcon />
    </Button>
  );
}

// "läuft · noch 7 Min." or "in 25 Min." next to a session in a list.
export function LiveBadge({ date, startTime, plan }: { date: string; startTime: string; plan: { minutes: number }[] }) {
  const live = useLive({ date, startTime, plan });
  if (!live || live.kind === "over") return null;
  if (live.kind === "before") {
    return live.minutesUntil <= 120 ? <span className="text-sm text-muted-foreground">in {live.minutesUntil} Min.</span> : null;
  }
  return (
    <span className="flex items-center gap-1.5 text-sm font-medium text-brand">
      <span className="size-2 animate-pulse rounded-full bg-brand" /> läuft
    </span>
  );
}
