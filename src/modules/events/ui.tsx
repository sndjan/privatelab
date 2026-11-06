"use client";

import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatRange, spanDays, formatDays, formatDate } from "./calc";
import { colorHex, type Entry, type EventType } from "./data";

// The type's emoji on a soft circle of its colour.
export function TypeIcon({ type, className }: { type: Pick<EventType, "emoji" | "color">; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-lg", className)}
      style={{ backgroundColor: `${colorHex(type.color)}26` }}
    >
      {type.emoji}
    </span>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-px", className)} aria-label={`Bewertung ${value} von 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          aria-hidden="true"
          className={cn("size-3.5", star <= value ? "fill-current text-amber-500" : "text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}

// One entry as a row: icon, name, date or range, amount, rating and note.
// The whole row is a button that opens it.
export function EntryRow({
  entry,
  type,
  today,
  onOpen,
  showDate = true,
}: {
  entry: Entry;
  type: EventType;
  today: string;
  onOpen: () => void;
  showDate?: boolean;
}) {
  const details = [
    showDate || type.kind === "span"
      ? type.kind === "span"
        ? `${formatRange(entry, today)} · ${formatDays(spanDays(entry, today))}`
        : formatDate(entry.startDate, today)
      : null,
    type.trackAmount && entry.amount !== null ? `${formatNumber(entry.amount)} ${type.amountUnit}`.trim() : null,
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/60"
    >
      <TypeIcon type={type} className="size-8 text-base" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2">
          <span className="font-medium">{type.name}</span>
          {entry.endDate === null && type.kind === "span" && (
            <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">läuft</span>
          )}
          {type.trackRating && entry.rating !== null && <Stars value={entry.rating} />}
        </span>
        {details.length > 0 && <span className="block text-sm text-muted-foreground">{details.join(" · ")}</span>}
        {entry.note && <span className="block text-sm whitespace-pre-line text-muted-foreground">{entry.note}</span>}
      </span>
    </button>
  );
}
