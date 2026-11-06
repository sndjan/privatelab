"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMonth } from "./calc";
import { useDialogs, useEventsData } from "./store";
import { EntryRow } from "./ui";

// Every entry, newest first, by month. Tapping one edits or deletes it.
export function HistoryTab({ today }: { today: string }) {
  const { types, entries } = useEventsData();
  const { openEntry } = useDialogs();
  const typeById = new Map(types.map((type) => [type.id, type]));
  const months = new Map<string, typeof entries>();
  for (const entry of entries) {
    if (!typeById.has(entry.typeId)) continue;
    const month = entry.startDate.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), entry]);
  }
  const sorted = [...months.entries()].sort(([a], [b]) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" disabled={types.length === 0} onClick={() => openEntry({})}>
          <PlusIcon /> Eintrag nachtragen
        </Button>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch nichts eingetragen.</p>
      ) : (
        sorted.map(([month, list]) => (
          <section key={month} className="rounded-xl border bg-card p-3 sm:p-4">
            <h2 className="mb-1 flex items-baseline gap-2 px-2 font-semibold">
              {formatMonth(month)}
              <span className="text-xs font-normal text-muted-foreground">
                {list.length} {list.length === 1 ? "Eintrag" : "Einträge"}
              </span>
            </h2>
            <ul>
              {[...list]
                .sort((a, b) => b.startDate.localeCompare(a.startDate))
                .map((entry) => (
                  <li key={entry.id}>
                    <EntryRow entry={entry} type={typeById.get(entry.typeId)!} today={today} onOpen={() => openEntry({ entry })} />
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
