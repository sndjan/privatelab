"use client";

import { Undo2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { undo } from "./actions";
import { useKanzleiData, useRun } from "./store";

const sources = { user: "du", ki: "KI, von dir bestätigt", auto: "automatisch" } as const;

// Every change with who made it. Changes to items can be undone.
export function HistoryView() {
  const { history } = useKanzleiData();
  const run = useRun();
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Änderungsverlauf</h1>
        <p className="text-sm text-muted-foreground">Die letzten {history.length} Änderungen. Rückgängig stellt den Stand davor wieder her.</p>
      </div>
      {history.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Änderungen.</p>}
      <ul className="divide-y rounded-xl border bg-card">
        {history.map((entry) => {
          const canUndo = !entry.undone && entry.itemId !== null && !entry.summary.startsWith("Rückgängig");
          return (
            <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-[1_1_280px]">
                <p className={`text-sm ${entry.undone ? "text-muted-foreground line-through" : ""}`}>{entry.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} ·{" "}
                  {sources[entry.source]}
                </p>
              </div>
              {canUndo && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === entry.id}
                  onClick={async () => {
                    setBusy(entry.id);
                    await run(() => undo(entry.id), "Rückgängig gemacht");
                    setBusy(null);
                  }}
                >
                  <Undo2Icon /> Rückgängig
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
