"use client";

import {
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleIcon,
  CoffeeIcon,
  FlagIcon,
  FlagTriangleRightIcon,
  GraduationCapIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ViewLink as Link } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import { addDays, breakOn, byWhen, formatShortDate, mondayOf, phaseOn } from "./data";
import { EventDialog } from "./event-dialog";
import { useThesis } from "./use-thesis";

const PATH = "/m/thesis";

type EntryKind = "appointment" | "deadline" | "todo" | "milestone" | "start" | "end";
type Entry = { key: string; kind: EntryKind; title: string; detail?: string; done?: boolean; href: string };

const kindStyle: Record<EntryKind, { dot: string; icon: typeof CircleIcon; label: string }> = {
  appointment: { dot: "bg-brand", icon: CalendarClockIcon, label: "Termin" },
  deadline: { dot: "bg-debt", icon: FlagIcon, label: "Deadline" },
  todo: { dot: "bg-muted-foreground", icon: CircleIcon, label: "To-do fällig" },
  milestone: { dot: "bg-foreground", icon: FlagTriangleRightIcon, label: "Meilenstein" },
  start: { dot: "bg-foreground", icon: GraduationCapIcon, label: "Beginn" },
  end: { dot: "bg-debt", icon: GraduationCapIcon, label: "Abgabe" },
};

// Phases get colors in their order (a thin bar under the days).
const phaseColors = ["bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500", "bg-rose-500", "bg-teal-500"];

const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

function shiftMonth(month: string, by: number) {
  const [year, index] = month.split("-").map(Number);
  const value = new Date(Date.UTC(year, index - 1 + by, 1));
  return value.toISOString().slice(0, 7);
}

// Everything with a date in one month view: appointments and deadlines,
// to-dos by their deadline, milestones, start and hand-in, phases (colored
// bars) and free days (shaded). A day shows its details below the grid.
export function CalendarTab({ today }: { today: string }) {
  const [settings, events, todos, phases, milestones, breaks, people] = useThesis(
    "settings",
    "events",
    "todos",
    "phases",
    "milestones",
    "breaks",
    "people",
  );
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);

  const entries = new Map<string, Entry[]>();
  const add = (day: string, entry: Entry) => entries.set(day, [...(entries.get(day) ?? []), entry]);
  if (settings.startDate) add(settings.startDate, { key: "start", kind: "start", title: "Beginn der Bachelorarbeit", href: PATH });
  if (settings.endDate) add(settings.endDate, { key: "end", kind: "end", title: "Abgabe", href: PATH });
  for (const milestone of milestones) {
    add(milestone.date, { key: milestone.id, kind: "milestone", title: milestone.name, done: milestone.done, href: `${PATH}?tab=events` });
  }
  for (const event of [...events].sort(byWhen)) {
    add(event.date, {
      key: event.id,
      kind: event.kind,
      title: event.title,
      detail: [event.time, event.location].filter(Boolean).join(" · ") || undefined,
      href: `${PATH}?tab=events`,
    });
  }
  for (const todo of todos) {
    if (todo.deadline) add(todo.deadline, { key: todo.id, kind: "todo", title: todo.title, done: todo.doneOn !== null, href: `${PATH}?tab=todos` });
  }

  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const days: string[] = [];
  for (let day = mondayOf(first); day <= last || days.length % 7 !== 0; day = addDays(day, 1)) days.push(day);
  const visiblePhases = phases.filter((phase) => phase.startDate <= days.at(-1)! && phase.endDate >= days[0]);
  const colorOf = (phaseId: string) => phaseColors[phases.findIndex((phase) => phase.id === phaseId) % phaseColors.length];

  const selectedEntries = entries.get(selected) ?? [];
  const selectedPhase = phaseOn(phases, selected);
  const selectedBreak = breakOn(breaks, selected);

  function go(by: number) {
    const next = shiftMonth(month, by);
    setMonth(next);
    setSelected(next === today.slice(0, 7) ? today : `${next}-01`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-xl font-semibold tracking-tight capitalize">{monthLabel(month)}</h2>
        {month !== today.slice(0, 7) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMonth(today.slice(0, 7));
              setSelected(today);
            }}
          >
            Heute
          </Button>
        )}
        <Button variant="outline" size="icon" onClick={() => go(-1)} aria-label="Voriger Monat">
          <ChevronLeftIcon />
        </Button>
        <Button variant="outline" size="icon" onClick={() => go(1)} aria-label="Nächster Monat">
          <ChevronRightIcon />
        </Button>
      </div>

      <div role="grid" aria-label={monthLabel(month)} className="overflow-hidden rounded-xl border bg-card">
        <div role="row" className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs text-muted-foreground">
          {weekdays.map((weekday) => (
            <div key={weekday} role="columnheader" className="py-1.5">
              {weekday}
            </div>
          ))}
        </div>
        {Array.from({ length: days.length / 7 }, (_, week) => (
          <div key={week} role="row" className="grid grid-cols-7 divide-x border-b last:border-b-0">
            {days.slice(week * 7, week * 7 + 7).map((day) => {
              const list = entries.get(day) ?? [];
              const phase = phaseOn(phases, day);
              const pause = breakOn(breaks, day);
              const outside = day.slice(0, 7) !== month;
              return (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  aria-selected={day === selected}
                  aria-label={`${formatShortDate(day)}${list.length ? `, ${list.length} Einträge` : ""}${pause ? ", frei" : ""}`}
                  onClick={() => {
                    setSelected(day);
                    if (outside) setMonth(day.slice(0, 7));
                  }}
                  className={cn(
                    "relative flex min-h-16 cursor-pointer flex-col gap-1 p-1 pb-2 text-left transition-colors hover:bg-accent/60 sm:min-h-24 sm:p-1.5 sm:pb-2.5",
                    pause && "bg-[repeating-linear-gradient(135deg,var(--color-muted)_0_6px,transparent_6px_12px)]",
                    day === selected && "bg-accent",
                    outside && "text-muted-foreground/60",
                  )}
                >
                  <span className="flex items-center gap-1">
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full font-mono text-xs",
                        day === today && "bg-foreground font-semibold text-background",
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {pause && <CoffeeIcon className="size-3 text-muted-foreground" aria-hidden />}
                  </span>
                  {/* Phone: dots; wider: the first entries by name. */}
                  {list.length > 0 && (
                    <span className="flex flex-wrap gap-0.5 sm:hidden">
                      {list.slice(0, 4).map((entry) => (
                        <span key={entry.key} className={cn("size-1.5 rounded-full", kindStyle[entry.kind].dot, entry.done && "opacity-40")} />
                      ))}
                    </span>
                  )}
                  <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                    {list.slice(0, 3).map((entry) => (
                      <span
                        key={entry.key}
                        className={cn("flex items-center gap-1 truncate text-[11px] leading-tight", entry.done && "text-muted-foreground line-through")}
                      >
                        <span className={cn("size-1.5 shrink-0 rounded-full", kindStyle[entry.kind].dot)} />
                        <span className="truncate">{entry.title}</span>
                      </span>
                    ))}
                    {list.length > 3 && <span className="text-[11px] text-muted-foreground">+{list.length - 3} weitere</span>}
                  </span>
                  {phase && <span aria-hidden className={cn("absolute inset-x-0 bottom-0 h-1 opacity-70", colorOf(phase.id))} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(["appointment", "deadline", "todo", "milestone"] as const).map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", kindStyle[kind].dot)} /> {kindStyle[kind].label}
          </span>
        ))}
        {breaks.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <CoffeeIcon className="size-3" /> Freie Tage
          </span>
        )}
        {visiblePhases.map((phase) => (
          <span key={phase.id} className="inline-flex items-center gap-1.5">
            <span className={cn("h-1 w-4 rounded-full opacity-70", colorOf(phase.id))} /> {phase.name}
          </span>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="font-semibold">{formatShortDate(selected)}</h3>
            {selectedPhase && <span className="text-sm text-muted-foreground">Phase {selectedPhase.name}</span>}
            {selectedBreak && (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <CoffeeIcon className="size-3.5" /> {selectedBreak.name || "Frei"}
              </span>
            )}
          </div>
          {selectedEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nichts eingetragen.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {selectedEntries.map((entry) => {
                const Icon = entry.done ? CircleCheckIcon : kindStyle[entry.kind].icon;
                return (
                  <li key={entry.key}>
                    <Link href={entry.href} className="flex items-start gap-3 py-2 hover:text-brand">
                      <Icon
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          entry.kind === "deadline" || entry.kind === "end" ? "text-debt" : entry.kind === "appointment" ? "text-brand" : "text-muted-foreground",
                        )}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className={cn("font-medium", entry.done && "text-muted-foreground line-through")}>{entry.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {kindStyle[entry.kind].label}
                          {entry.detail && ` · ${entry.detail}`}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <EventDialog key={`a-${selected}`} people={people} today={selected} />
            <EventDialog key={`d-${selected}`} people={people} today={selected} defaultKind="deadline" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
