"use client";

import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatNumber, formatShortDate, monthName } from "./calc";
import { useOpenSheet, useWeightData } from "./store";
import { Dot, Panel } from "./ui";

type Item = {
  kind: "weight" | "measures";
  participantId: string;
  date: string;
  value: string;
  details: string[];
  createdBy: string | null;
};

// Every weighing and set of circumferences, newest first, grouped by month.
export function LogTab() {
  const { participants, weighings, circumferences } = useWeightData();
  const openSheet = useOpenSheet();
  const [filter, setFilter] = useState<string | null>(null);

  const items: Item[] = [
    ...weighings.map((weighing) => ({
      kind: "weight" as const,
      participantId: weighing.participantId,
      date: weighing.date,
      value: `${formatNumber(weighing.weight)} kg`,
      details: weighing.bodyFat !== null ? [`KFA ${formatNumber(weighing.bodyFat)}`] : [],
      createdBy: weighing.createdBy,
    })),
    ...circumferences.map((set) => ({
      kind: "measures" as const,
      participantId: set.participantId,
      date: set.date,
      value: `${Object.keys(set.values).length} Maße`,
      details: [],
      createdBy: set.createdBy,
    })),
  ]
    .filter((item) => !filter || item.participantId === filter)
    .sort((a, b) => b.date.localeCompare(a.date) || (a.kind === "weight" ? -1 : 1));

  const months: { key: string; items: Item[] }[] = [];
  for (const item of items) {
    const key = item.date.slice(0, 7);
    if (months[months.length - 1]?.key !== key) months.push({ key, items: [] });
    months[months.length - 1].items.push(item);
  }
  const thisYear = new Date().getFullYear().toString();

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {[{ id: null, name: "Alle", color: null }, ...participants.map((participant) => ({ ...participant }))].map((option) => (
          <button
            key={option.id ?? "all"}
            type="button"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={cn(
              "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm",
              filter === option.id ? "border-brand bg-good font-semibold text-good-foreground" : "bg-card",
            )}
          >
            {option.color && <Dot color={option.color} className="size-2" />}
            {option.name}
          </button>
        ))}
      </div>

      {months.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted-foreground">Noch nichts eingetragen.</p>
        </Panel>
      ) : (
        months.map((month) => (
          <Panel
            key={month.key}
            title={`${monthName(`${month.key}-01`)}${month.key.slice(0, 4) === thisYear ? "" : ` ${month.key.slice(0, 4)}`}`}
            className="space-y-0 pb-1"
          >
            <ul className="-mx-1 pt-1">
              {month.items.map((item) => {
                const participant = participants.find((other) => other.id === item.participantId);
                if (!participant) return null;
                // "von Jan" when someone else entered it.
                const author =
                  item.createdBy && item.createdBy !== participant.userId
                    ? participants.find((other) => other.userId === item.createdBy)
                    : undefined;
                const details = [formatShortDate(item.date), ...item.details, author ? `von ${author.name}` : null].filter(Boolean);
                return (
                  <li key={`${item.kind}-${item.participantId}-${item.date}`} className="border-t first:border-t-0">
                    <button
                      type="button"
                      onClick={() => openSheet({ kind: item.kind, edit: { participantId: item.participantId, date: item.date } })}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-1 py-2.5 text-left hover:bg-muted/60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Dot color={participant.color} />
                          <span className="truncate">{participant.name}</span>
                        </span>
                        <span className="block text-xs text-muted-foreground tabular-nums">{details.join(" · ")}</span>
                      </span>
                      <span className={cn("font-semibold tabular-nums", item.kind === "measures" && "text-sm text-muted-foreground")}>
                        {item.value}
                      </span>
                      <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))
      )}
    </div>
  );
}
