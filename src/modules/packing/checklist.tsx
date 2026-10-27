"use client";

import { ChevronRightIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { resetList, tickItems, updateChip } from "./actions";
import { isShown, progress, type Chip, type Item, type Section } from "./data";

type Patch = { type: "tick"; ids: string[]; done: boolean } | { type: "chip"; id: string; active: boolean };
type State = { items: Item[]; chips: Chip[] };

const UNDO_MS = 6000;

// Tick mode: tap items while packing, reset the list for the next time.
// Ticks, chips and resets update at once and save in the background.
export function Checklist({
  listId,
  sections,
  items: savedItems,
  chips: savedChips,
}: {
  listId: string;
  sections: Section[];
  items: Item[];
  chips: Chip[];
}) {
  const [{ items, chips }, apply] = useOptimistic<State, Patch>(
    { items: savedItems, chips: savedChips },
    (current, patch) =>
      patch.type === "tick"
        ? {
            ...current,
            items: current.items.map((item) => (patch.ids.includes(item.id) ? { ...item, done: patch.done } : item)),
          }
        : {
            ...current,
            chips: current.chips.map((chip) => (chip.id === patch.id ? { ...chip, active: patch.active } : chip)),
          },
  );
  const [, startTransition] = useTransition();
  const [undo, setUndo] = useState<{ ids: string[] } | null>(null);

  function tick(ids: string[], done: boolean) {
    startTransition(async () => {
      apply({ type: "tick", ids, done });
      await tickItems(ids, done);
    });
  }

  function toggleChip(chip: Chip) {
    startTransition(async () => {
      apply({ type: "chip", id: chip.id, active: !chip.active });
      await updateChip(chip.id, { active: !chip.active });
    });
  }

  function reset() {
    const ticked = items.filter((item) => item.done).map((item) => item.id);
    if (ticked.length === 0) return;
    startTransition(async () => {
      apply({ type: "tick", ids: ticked, done: false });
      const ids = await resetList(listId);
      setUndo({ ids });
    });
  }

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const { done, total } = progress(items, chips);
  const hidden = items.filter((item) => !isShown(item, chips));
  const chipName = (id: string | null) => chips.find((chip) => chip.id === id)?.name;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {done} von {total} erledigt
            {done === total && total > 0 && <span className="font-medium text-brand"> · Alles dabei</span>}
          </span>
          <Button variant="outline" size="sm" onClick={reset} disabled={!items.some((item) => item.done)}>
            <RotateCcwIcon /> Zurücksetzen
          </Button>
        </div>
        <Progress
          value={total ? (done / total) * 100 : 0}
          aria-label="Fortschritt"
          className="h-2 bg-muted"
          indicatorClassName="bg-brand"
        />
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Diesmal dabei">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={chip.active}
              onClick={() => toggleChip(chip)}
              className={cn(
                "min-h-10 cursor-pointer rounded-full border px-4 text-sm transition-colors",
                chip.active
                  ? "border-brand bg-good text-good-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {chip.name}
            </button>
          ))}
        </div>
      )}

      {total === 0 && hidden.length === 0 && (
        <p className="text-muted-foreground">Die Liste ist noch leer. Tippe auf „Bearbeiten“, um Einträge hinzuzufügen.</p>
      )}

      {sections.map((section) => {
        const shown = items.filter((item) => item.sectionId === section.id && isShown(item, chips));
        if (shown.length === 0) return null;
        const open = shown.filter((item) => !item.done).length;
        return (
          <Card key={section.id} className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardTitle className="flex items-baseline justify-between gap-2">
                <h2>{section.name}</h2>
                <span className="text-sm font-normal text-muted-foreground">
                  {open === 0 ? "erledigt" : `${open} offen`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <ItemRows items={openFirst(shown)} onTick={tick} />
            </CardContent>
          </Card>
        );
      })}

      {hidden.length > 0 && (
        <details className="group rounded-xl border bg-card px-4 py-3">
          <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
            Ausgeblendet ({hidden.length})
          </summary>
          <div className="pt-2">
            <ItemRows items={hidden} onTick={tick} muted label={(item) => chipName(item.chipId)} />
          </div>
        </details>
      )}

      {undo && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl border bg-popover px-4 py-2 text-popover-foreground shadow-lg"
        >
          <span className="text-sm">Liste zurückgesetzt</span>
          <Button
            variant="ghost"
            className="text-brand"
            onClick={() => {
              tick(undo.ids, true);
              setUndo(null);
            }}
          >
            Rückgängig
          </Button>
        </div>
      )}
    </div>
  );
}

// Open items first, so a section shrinks as you pack. Keeps the list order otherwise.
function openFirst(items: Item[]) {
  return [...items].sort((a, b) => Number(a.done) - Number(b.done));
}

function ItemRows({
  items,
  onTick,
  muted = false,
  label,
}: {
  items: Item[];
  onTick: (ids: string[], done: boolean) => void;
  muted?: boolean;
  label?: (item: Item) => string | undefined;
}) {
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li key={item.id}>
          <label
            className={cn(
              "flex min-h-12 cursor-pointer items-center gap-3 py-1",
              (item.done || muted) && "text-muted-foreground",
            )}
          >
            <Checkbox
              checked={item.done}
              onCheckedChange={(checked) => onTick([item.id], checked === true)}
              className="size-5"
            />
            <span className="flex min-w-0 flex-col">
              <span className={cn(item.done && "line-through")}>
                {item.name}
                {label?.(item) && <span className="ml-2 text-xs">({label(item)})</span>}
              </span>
              {item.note && <span className="text-xs text-muted-foreground">{item.note}</span>}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
