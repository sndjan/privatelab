"use client";

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ViewLink as Link } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import { addDays, addMonths, daysBetween, entryCovers, formatDate, formatMonth, mondayOf, monthEnd, spanEnd, weekday } from "./calc";
import { colorHex, type Entry, type EventType } from "./data";
import { useDialogs, useEventsData } from "./store";
import { EntryRow } from "./ui";

const PATH = "/m/events?tab=calendar";
const weekdayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// A month grid: spans as coloured bars across their days, moments as their
// emoji. Tapping a day lists its entries below and adds one for that day.
export function CalendarTab({ today, month: monthParam }: { today: string; month?: string }) {
  const { types, entries } = useEventsData();
  const { openEntry } = useDialogs();
  const month = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : today.slice(0, 7);
  const [selected, setSelected] = useState(today.startsWith(month) ? today : `${month}-01`);
  const day = selected.startsWith(month) ? selected : `${month}-01`;

  const first = `${month}-01`;
  const gridStart = mondayOf(first);
  const gridEnd = addDays(mondayOf(monthEnd(first)), 6);
  const days = Array.from({ length: daysBetween(gridStart, gridEnd) + 1 }, (_, index) => addDays(gridStart, index));
  const typeById = new Map(types.map((type) => [type.id, type]));
  const spanTypes = types.filter((type) => type.kind === "span");

  // Only what can show in the grid.
  const visible = entries.filter(
    (entry) => entry.startDate <= gridEnd && (typeById.get(entry.typeId)?.kind === "moment" ? true : spanEnd(entry, today) >= gridStart),
  );
  const on = (date: string) =>
    visible.filter((entry) => {
      const type = typeById.get(entry.typeId);
      return type ? entryCovers(entry, type, date, today) : false;
    });
  const dayEntries = on(day);

  const href = (target: string) => (target === today.slice(0, 7) ? PATH : `${PATH}&month=${target}`);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-3 sm:p-5">
        <div className="mb-3 flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="size-9">
            <Link href={href(addMonths(month, -1))} aria-label="Voriger Monat" replace scroll={false}>
              <ChevronLeftIcon />
            </Link>
          </Button>
          <h2 className="flex-1 text-center font-semibold">{formatMonth(month)}</h2>
          <Button asChild variant="ghost" size="icon" className="size-9">
            <Link href={href(addMonths(month, 1))} aria-label="Nächster Monat" replace scroll={false}>
              <ChevronRightIcon />
            </Link>
          </Button>
        </div>
        <div aria-hidden="true" className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] text-muted-foreground">
          {weekdayNames.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div role="grid" aria-label={formatMonth(month)} className="grid grid-cols-7 gap-1">
          {days.map((date) => (
            <DayCell
              key={date}
              date={date}
              today={today}
              inMonth={date.startsWith(month)}
              selected={date === day}
              entries={on(date)}
              spanTypes={spanTypes}
              typeById={typeById}
              onSelect={() => setSelected(date)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3 sm:p-5">
        <div className="mb-1 flex items-center gap-2 px-2">
          <h3 className="flex-1 font-semibold">{formatDate(day, today)}</h3>
          <Button size="sm" variant="outline" disabled={types.length === 0} onClick={() => openEntry({ date: day })}>
            <PlusIcon /> Eintrag
          </Button>
        </div>
        {dayEntries.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">Nichts eingetragen.</p>
        ) : (
          <ul>
            {dayEntries.map((entry) => (
              <li key={entry.id}>
                <EntryRow
                  entry={entry}
                  type={typeById.get(entry.typeId)!}
                  today={today}
                  showDate={false}
                  onOpen={() => openEntry({ entry })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DayCell({
  date,
  today,
  inMonth,
  selected,
  entries,
  spanTypes,
  typeById,
  onSelect,
}: {
  date: string;
  today: string;
  inMonth: boolean;
  selected: boolean;
  entries: Entry[];
  spanTypes: EventType[];
  typeById: Map<string, EventType>;
  onSelect: () => void;
}) {
  // One bar per span type that covers the day, rounded where it starts / ends.
  const spans = spanTypes
    .map((type) => ({ type, entry: entries.find((entry) => entry.typeId === type.id) }))
    .filter((span): span is { type: EventType; entry: Entry } => Boolean(span.entry));
  const moments = entries.filter((entry) => typeById.get(entry.typeId)?.kind === "moment");
  const shown = moments.slice(0, 3);
  const label = [
    formatDate(date, today),
    ...entries.map((entry) => typeById.get(entry.typeId)?.name).filter(Boolean),
  ].join(", ");

  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={selected}
      aria-label={label}
      onClick={onSelect}
      className={cn(
        "flex min-h-16 cursor-pointer flex-col items-stretch gap-0.5 rounded-md border border-transparent pt-1 pb-1 text-left transition-colors hover:bg-muted/60 sm:min-h-20",
        !inMonth && "opacity-40",
        selected && "border-foreground/40 bg-muted/60",
      )}
    >
      <span
        className={cn(
          "mx-auto flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
          date === today && "bg-brand font-semibold text-brand-foreground",
        )}
      >
        {Number(date.slice(8))}
      </span>
      {spans.slice(0, 3).map(({ type, entry }) => {
        const starts = entry.startDate === date || weekday(date) === 0;
        const ends = spanEnd(entry, today) === date || weekday(date) === 6;
        return (
          <span
            key={type.id}
            className={cn("h-1.5", starts ? "ml-0.5 rounded-l-full" : "-ml-1", ends ? "mr-0.5 rounded-r-full" : "-mr-1")}
            style={{ backgroundColor: colorHex(type.color) }}
          />
        );
      })}
      {shown.length > 0 && (
        <span className="flex flex-wrap justify-center text-[11px] leading-tight sm:text-sm">
          {shown.map((entry) => (
            <span key={entry.id}>{typeById.get(entry.typeId)?.emoji}</span>
          ))}
          {moments.length > shown.length && <span className="text-muted-foreground">+{moments.length - shown.length}</span>}
        </span>
      )}
    </button>
  );
}
