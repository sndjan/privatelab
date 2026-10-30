"use client";

import { ChevronRightIcon, PrinterIcon } from "lucide-react";
import { ViewLink as Link } from "@/lib/query/view-link";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Court } from "./court";
import { formatClock, hasVariations, liveState, phaseName, timeline, type Exercise, type LiveState } from "./data";
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

type Item = { exercise: Exercise; minutes: number };

// The session sheet: every exercise with its time, sketch and cues. While the
// session runs, the current exercise is highlighted with the minutes left.
export function SessionPlan({ date, startTime, items }: { date: string; startTime: string; items: Item[] }) {
  const live = useLive({ date, startTime, plan: items });
  const ranges = timeline(startTime, items);

  return (
    <div className="space-y-3">
      {live && <LiveBanner live={live} items={items} />}
      <ol className="space-y-3">
        {items.map(({ exercise, minutes }, index) => {
          const current = live?.kind === "running" && live.index === index;
          const past = (live?.kind === "running" && index < live.index) || live?.kind === "over";
          return (
            <li
              key={index}
              className={cn(
                "rounded-xl border bg-card p-4 shadow-xs",
                current && "border-brand ring-2 ring-brand/40",
                past && "opacity-60",
              )}
            >
              <div className="flex gap-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-mono">
                      {formatClock(ranges[index].start)}–{formatClock(ranges[index].end)}
                    </span>{" "}
                    · {phaseName(exercise.phase)} · {minutes} Min.
                  </p>
                  <h3 className="text-lg leading-tight font-semibold">{exercise.name}</h3>
                  {current && live?.kind === "running" && (
                    <div className="flex items-center gap-2">
                      <Progress value={live.progress * 100} className="h-1.5 flex-1 bg-muted" indicatorClassName="bg-brand" />
                      <span className="font-mono text-sm text-brand">noch {live.minutesLeft} Min.</span>
                    </div>
                  )}
                  {exercise.summary && <p className="text-sm">{exercise.summary}</p>}
                  {exercise.description && (
                    <details className="group text-sm">
                      <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground [&::-webkit-details-marker]:hidden">
                        <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
                        Ablauf
                      </summary>
                      <p className="mt-1 whitespace-pre-line">{exercise.description}</p>
                    </details>
                  )}
                  {hasVariations(exercise.variations) && (
                    <details className="group text-sm">
                      <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground [&::-webkit-details-marker]:hidden">
                        <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
                        Variationen
                      </summary>
                      <VariationList variations={exercise.variations} className="mt-1" />
                    </details>
                  )}
                  {exercise.tips.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5 pt-0.5">
                      {exercise.tips.map((tip) => (
                        <li key={tip} className="rounded-full bg-good px-2.5 py-0.5 text-xs text-good-foreground">
                          „{tip}“
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href={`${PATH}?exercise=${exercise.id}`} className="inline-block text-sm text-muted-foreground underline-offset-4 hover:underline">
                    Zur Übung
                  </Link>
                </div>
              </div>
              {exercise.diagram.items.length > 0 && <Court diagram={exercise.diagram} horizontal className="mt-3 w-full max-w-xl" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function LiveBanner({ live, items }: { live: LiveState; items: Item[] }) {
  if (live.kind === "over") {
    return (
      <p className="rounded-xl bg-muted px-4 py-3 text-sm">
        Die Stunde ist vorbei. Wie lief&apos;s? Unten ist Platz für Notizen.
      </p>
    );
  }
  if (live.kind === "before") {
    const hours = Math.floor(live.minutesUntil / 60);
    return (
      <p className="rounded-xl bg-muted px-4 py-3 text-sm">
        Beginnt in {hours > 0 ? `${hours} Std. ${live.minutesUntil % 60} Min.` : `${live.minutesUntil} Min.`}
      </p>
    );
  }
  const next = items[live.index + 1];
  return (
    <div role="status" className="rounded-xl bg-hero px-4 py-3 text-hero-foreground">
      <p className="flex items-center gap-2 text-xs tracking-wide text-hero-muted uppercase">
        <span className="size-2 animate-pulse rounded-full bg-hero-bar" /> Läuft gerade
      </p>
      <p className="text-lg font-semibold">
        {items[live.index].exercise.name} · noch {live.minutesLeft} Min.
      </p>
      {next && <p className="text-sm text-hero-muted">Danach: {next.exercise.name}</p>}
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
