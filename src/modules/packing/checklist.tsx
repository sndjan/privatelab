"use client";

import { ChevronRightIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { isShown, progress, type Chip, type Item, type Section } from "./data";

const UNDO_MS = 6000;

// Tick mode: tap items while packing, reset the list for the next time.
export function Checklist({
  sections,
  items,
  chips,
  onTick,
  onReset,
  onChip,
  onEdit,
}: {
  sections: Section[];
  items: Item[];
  chips: Chip[];
  onTick: (ids: string[], done: boolean) => void;
  onReset: () => void;
  onChip: (chip: Chip) => void;
  onEdit: () => void;
}) {
  const [undo, setUndo] = useState<string[] | null>(null);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const { done, total } = progress(items, chips);
  const ticked = items.filter((item) => item.done).map((item) => item.id);
  const hidden = items.filter((item) => !isShown(item, chips));
  const chipName = (id: string | null) => chips.find((chip) => chip.id === id)?.name;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <p>Noch leer.</p>
        <Button variant="outline" onClick={onEdit}>
          Einträge hinzufügen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center gap-3">
        <Progress
          value={total ? (done / total) * 100 : 0}
          aria-label="Fortschritt"
          className="h-2 flex-1 bg-muted"
          indicatorClassName="bg-brand"
        />
        <span className={cn("font-mono text-sm tabular-nums", done === total && total > 0 && "text-brand")}>
          {done}/{total}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 size-10 text-muted-foreground"
          aria-label="Alles zurücksetzen"
          disabled={ticked.length === 0}
          onClick={() => {
            setUndo(ticked);
            onReset();
          }}
        >
          <RotateCcwIcon />
        </Button>
      </div>

      {chips.length > 0 && (
        <div
          role="group"
          aria-label="Diesmal dabei"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={chip.active}
              onClick={() => onChip(chip)}
              className={cn(
                "h-9 shrink-0 cursor-pointer rounded-full border px-4 text-sm transition-colors",
                chip.active ? "border-brand bg-good text-good-foreground" : "text-muted-foreground line-through",
              )}
            >
              {chip.name}
            </button>
          ))}
        </div>
      )}

      {sections.map((section) => {
        const shown = items.filter((item) => item.sectionId === section.id && isShown(item, chips));
        if (shown.length === 0) return null;
        const complete = shown.every((item) => item.done);
        return (
          <section key={section.id} aria-label={section.name} className="space-y-1.5">
            <h3 className={cn("px-1 text-sm font-medium text-muted-foreground", complete && "text-brand")}>
              {section.name}
            </h3>
            <ItemRows items={openFirst(shown)} onTick={onTick} />
          </section>
        );
      })}

      {hidden.length > 0 && (
        <details className="group">
          <summary className="flex h-10 cursor-pointer list-none items-center gap-1 px-1 text-sm text-muted-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
            Ausgeblendet ({hidden.length})
          </summary>
          <ItemRows items={hidden} onTick={onTick} muted label={(item) => chipName(item.chipId)} />
        </details>
      )}

      {undo && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl border bg-popover py-1 pr-1 pl-4 text-popover-foreground shadow-lg"
        >
          <span className="text-sm">Zurückgesetzt</span>
          <Button
            variant="ghost"
            className="h-10 text-brand"
            onClick={() => {
              onTick(undo, true);
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
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {items.map((item) => (
        <li key={item.id}>
          <label
            className={cn(
              "flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 select-none active:bg-accent",
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
                {label?.(item) && <span className="ml-2 text-xs">{label(item)}</span>}
              </span>
              {item.note && !item.done && <span className="text-xs text-muted-foreground">{item.note}</span>}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
