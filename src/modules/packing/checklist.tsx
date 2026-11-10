"use client";

import { ChevronRightIcon, MinusIcon, PlusIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { isShown, progress, type Chip, type Item, type Section, type Stock } from "./data";

const UNDO_MS = 6000;

// Tick mode: tap items while packing, reset the list for the next time.
export function Checklist({
  sections,
  items,
  chips,
  onTick,
  onReset,
  onRestore,
  onChip,
  onEdit,
  onAddOnce,
  onRemoveOnce,
  place,
  inventory,
  onStock,
  onAddStock,
}: {
  sections: Section[];
  items: Item[];
  chips: Chip[];
  onTick: (ids: string[], done: boolean) => void;
  onReset: () => void;
  onRestore: (ticked: Item[]) => void;
  onChip: (chip: Chip) => void;
  onEdit: () => void;
  onAddOnce: (name: string) => void;
  onRemoveOnce: (id: string) => void;
  place: { id: string; name: string } | null;
  inventory: Stock[];
  onStock: (id: string, quantity: number) => void;
  onAddStock: (name: string) => void;
}) {
  const [undo, setUndo] = useState<Item[] | null>(null);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const { done, total } = progress(items, chips);
  const ticked = items.filter((item) => item.done);
  const hidden = items.filter((item) => !item.once && !isShown(item, chips));
  const once = items.filter((item) => item.once);
  const chipName = (id: string | null) => chips.find((chip) => chip.id === id)?.name;

  if (items.filter((item) => !item.once).length === 0) {
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
        const shown = items.filter((item) => !item.once && item.sectionId === section.id && isShown(item, chips));
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

      <section aria-label="Nur diesmal" className="space-y-1.5">
        <h3 className={cn("px-1 text-sm font-medium text-muted-foreground", once.length > 0 && once.every((item) => item.done) && "text-brand")}>
          Nur diesmal
        </h3>
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {once.length > 0 && <ItemRows items={openFirst(once)} onTick={onTick} onRemove={onRemoveOnce} bare />}
          <AddRow
            label="Nur diesmal mitnehmen"
            placeholder="+ Nur diesmal, z. B. Geschenk für Oma"
            maxLength={80}
            onAdd={onAddOnce}
          />
        </div>
      </section>

      {hidden.length > 0 && (
        <details className="group">
          <summary className="flex h-10 cursor-pointer list-none items-center gap-1 px-1 text-sm text-muted-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
            Ausgeblendet ({hidden.length})
          </summary>
          <ItemRows items={hidden} onTick={onTick} muted label={(item) => chipName(item.chipId)} />
        </details>
      )}

      {place && <PlaceStock place={place} inventory={inventory} onStock={onStock} onAdd={onAddStock} />}

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
              onRestore(undo);
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
  onRemove,
  muted = false,
  bare = false,
  label,
}: {
  items: Item[];
  onTick: (ids: string[], done: boolean) => void;
  onRemove?: (id: string) => void;
  muted?: boolean;
  // Inside a card that has its own border.
  bare?: boolean;
  label?: (item: Item) => string | undefined;
}) {
  return (
    <ul className={cn("divide-y", !bare && "overflow-hidden rounded-xl border bg-card")}>
      {items.map((item) => (
        <li key={item.id} className="flex items-center">
          <label
            className={cn(
              "flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-2 select-none active:bg-accent",
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
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="mr-1 size-10 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`${item.name} entfernen`}
              disabled={item.id.startsWith("tmp-")}
              onClick={() => onRemove(item.id)}
            >
              <XIcon />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

// What is already at the destination, from its inventory. 0 = not there, so
// it has to come along. Changing a number changes the inventory itself.
function PlaceStock({
  place,
  inventory,
  onStock,
  onAdd,
}: {
  place: { id: string; name: string };
  inventory: Stock[];
  onStock: (id: string, quantity: number) => void;
  onAdd: (name: string) => void;
}) {
  const there = inventory.filter((entry) => entry.quantity > 0).length;
  return (
    <details className="group space-y-1.5">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-1 px-1 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
        <span className="flex-1">Schon in {place.name}</span>
        <span className="font-mono text-xs tabular-nums">
          {there}/{inventory.length}
        </span>
      </summary>
      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        {inventory.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">Noch nichts im Inventar von {place.name}.</p>
        )}
        {inventory.map((entry) => {
          const temp = entry.id.startsWith("tmp-");
          return (
            <div key={entry.id} className="flex min-h-12 items-center gap-2 pr-1 pl-4">
              <span className={cn("min-w-0 flex-1 truncate", entry.quantity === 0 && "text-muted-foreground")}>
                {entry.name}
                {entry.quantity === 0 && <span className="ml-2 text-xs">nicht da</span>}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 text-muted-foreground"
                aria-label={`${entry.name}: einer weniger`}
                disabled={temp || entry.quantity === 0}
                onClick={() => onStock(entry.id, entry.quantity - 1)}
              >
                <MinusIcon />
              </Button>
              <span aria-live="polite" className="w-6 text-center font-mono tabular-nums">
                {entry.quantity}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 text-muted-foreground"
                aria-label={`${entry.name}: einer mehr`}
                disabled={temp || entry.quantity >= 999}
                onClick={() => onStock(entry.id, entry.quantity + 1)}
              >
                <PlusIcon />
              </Button>
            </div>
          );
        })}
        <AddRow label={`Ins Inventar von ${place.name}`} placeholder={`+ In ${place.name}`} maxLength={80} onAdd={onAdd} />
      </div>
    </details>
  );
}

// One field: Enter adds and keeps the keyboard open for the next one.
function AddRow({
  label,
  placeholder,
  maxLength,
  onAdd,
}: {
  label: string;
  placeholder: string;
  maxLength: number;
  onAdd: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        const name = value.trim();
        if (!name) return;
        setValue("");
        onAdd(name);
      }}
    >
      <Input
        aria-label={label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        enterKeyHint="enter"
        className="h-12 rounded-none border-0 bg-card px-4 pr-10 shadow-none focus-visible:ring-0"
      />
      {value.trim() && (
        <button
          type="submit"
          aria-label={label}
          className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-brand"
        >
          <PlusIcon className="size-5" />
        </button>
      )}
    </form>
  );
}
