"use client";

import { CrosshairIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Chip } from "./exercise-form";
import { areaOf, findTeilziel, teilzielAreas } from "./teilziele";

// Picks the one Teilziel of an exercise: from the BTV catalog by area, or
// written by the coach. With `defaultLabel`, a tick saves it as the
// exercise's own Teilziel too ("Als Standard merken").
export function TeilzielPicker({
  open,
  onOpenChange,
  title,
  value,
  defaultLabel,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The exercise's name.
  title: string;
  value: string;
  defaultLabel?: string;
  onPick: (value: string, asDefault: boolean) => void;
}) {
  const [area, setArea] = useState(0);
  const [chosen, setChosen] = useState(value);
  const [own, setOwn] = useState("");
  const [asDefault, setAsDefault] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // Each opening starts on the current Teilziel.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setArea(areaOf(value));
      setChosen(value);
      setOwn(value && !findTeilziel(value) ? value : "");
      setAsDefault(false);
    }
  }

  const current = teilzielAreas[area];
  const result = own.trim() || chosen;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col">
        <DialogHeader>
          <DialogTitle>Teilziel</DialogTitle>
          <DialogDescription>
            {title}: ein Punkt, den du beobachtest und korrigierst. Die Aufgabe der Kinder steht in der Übung.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-6 flex gap-1.5 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {teilzielAreas.map((entry, index) => (
            <Chip key={entry.name} active={index === area} onClick={() => setArea(index)}>
              {entry.name}
            </Chip>
          ))}
        </div>
        <div className="-mx-6 min-h-0 flex-1 space-y-1 overflow-y-auto px-6">
          {current.note && <p className="text-xs text-muted-foreground">{current.note}</p>}
          <ul className="space-y-1" role="radiogroup" aria-label={current.name}>
            {current.points.map((point) => {
              const selected = !own.trim() && chosen === point.label;
              return (
                <li key={point.label} className={cn("rounded-lg", selected && "bg-good")}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setChosen(point.label);
                      setOwn("");
                    }}
                    className="flex w-full cursor-pointer items-start gap-3 rounded-lg p-2 text-left hover:bg-accent/60"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-card",
                        selected ? "border-brand" : "border-muted-foreground/50",
                      )}
                    >
                      {selected && <span className="size-2.5 rounded-full bg-brand" />}
                    </span>
                    <span className="min-w-0 space-y-0.5">
                      <span className="block leading-tight font-medium">{point.label}</span>
                      <span className="block text-sm text-muted-foreground">„{point.say}“</span>
                    </span>
                  </button>
                  {selected && point.fix && (
                    <p className="px-2 pb-2 pl-10 text-sm">
                      <span className="block font-medium text-good-foreground">Wenn’s nicht klappt</span>
                      {point.fix}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="space-y-1.5 pt-3">
            <label htmlFor="teilziel-own" className="text-sm text-muted-foreground">
              Oder eigenes Teilziel
            </label>
            <Input
              id="teilziel-own"
              maxLength={120}
              value={own}
              onChange={(event) => setOwn(event.target.value)}
              placeholder="z. B. Ball hoch übers Netz"
            />
          </div>
          <p className="pt-2 text-xs text-muted-foreground">
            Teilziele nach BTV-Technikskript (CP1) und „Planung von Trainingseinheiten“, Korrekturhilfen aus CP2 „Methodische
            Maßnahmen zur Technikkorrektur“.
          </p>
        </div>
        {defaultLabel !== undefined && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={asDefault}
              onChange={(event) => setAsDefault(event.target.checked)}
              className="mt-0.5 size-4 accent-brand"
            />
            <span>
              Als Standard für diese Übung merken
              {defaultLabel && <span className="block text-xs text-muted-foreground">Bisher: {defaultLabel}</span>}
            </span>
          </label>
        )}
        <DialogFooter className="gap-2">
          {value && (
            <Button variant="ghost" className="text-muted-foreground" onClick={() => onPick("", asDefault)}>
              Ohne Teilziel
            </Button>
          )}
          <Button onClick={() => onPick(result, asDefault)} disabled={!result}>
            <CrosshairIcon /> Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// The Teilziel as one line: crosshair, label and, if known, how to say it.
export function TeilzielLine({ value, className, withSay = false }: { value: string; className?: string; withSay?: boolean }) {
  if (!value) return null;
  const known = findTeilziel(value);
  return (
    <span className={cn("flex items-start gap-1.5", className)}>
      <CrosshairIcon className="mt-0.5 size-4 shrink-0" aria-label="Teilziel" />
      <span className="min-w-0">
        <span className="font-medium">{value}</span>
        {withSay && known && <span className="block text-xs font-normal opacity-80">„{known.say}“</span>}
      </span>
    </span>
  );
}
