"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { resetDay, saveDay } from "./actions";
import { dayKinds, formatHours, formatTime, workedMinutes, type DayEntry, type DayKind } from "./calc";

type Props = {
  date: string;
  title: string;
  // What the day is without an entry, e.g. "Standard" or "Urlaub".
  note: string;
  target: number;
  entry: DayEntry | null;
  standard: { start: number; end: number; breakMinutes: number };
  children: ReactNode;
};

const breaks = [0, 15, 30, 45, 60, 90];

// Edit one day: work times on a 15-minute slider, or sick / overtime off.
export function DayDialog({ date, title, note, target, entry, standard, children }: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<DayKind>(entry?.kind ?? "work");
  const [range, setRange] = useState<[number, number]>([
    entry?.start ?? standard.start,
    entry?.end ?? standard.end,
  ]);
  const [breakMinutes, setBreakMinutes] = useState(entry?.kind === "work" ? entry.breakMinutes : standard.breakMinutes);

  const min = Math.min(5 * 60, range[0] - (range[0] % 15));
  const max = Math.max(22 * 60, range[1]);
  const worked = workedMinutes({ start: range[0], end: range[1], breakMinutes });
  const actual = kind === "work" ? worked : kind === "sick" ? target : 0;

  function closingAfter(action: (formData: FormData) => Promise<void>) {
    return async (formData: FormData) => {
      await action(formData);
      setOpen(false);
    };
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={closingAfter(saveDay)} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {entry ? "Geänderter Tag" : note} · Soll {formatHours(target)}
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="day" value={date} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="start" value={range[0]} />
          <input type="hidden" name="end" value={range[1]} />
          <input type="hidden" name="break" value={breakMinutes} />

          <ToggleGroup
            type="single"
            variant="outline"
            aria-label="Art des Tages"
            value={kind}
            onValueChange={(value) => value && setKind(value as DayKind)}
            className="w-full"
          >
            {dayKinds.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value} className="flex-1 px-2 text-[13px]">
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {kind === "work" && (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span id={`range-${date}`} className="text-sm text-muted-foreground">
                    Arbeitszeit
                  </span>
                  <strong className="font-mono text-2xl font-medium">
                    {formatTime(range[0])} – {formatTime(range[1])}
                  </strong>
                </div>
                <Slider
                  aria-labelledby={`range-${date}`}
                  min={min}
                  max={max}
                  step={15}
                  minStepsBetweenThumbs={1}
                  value={range}
                  onValueChange={(value) => setRange([value[0], value[1]])}
                  className="py-3"
                />
                <div aria-hidden="true" className="flex justify-between font-mono text-[11px] text-muted-foreground">
                  <span>{formatTime(min)}</span>
                  <span>{formatTime(Math.round((min + max) / 120) * 60)}</span>
                  <span>{formatTime(max)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span id={`break-${date}`} className="text-sm text-muted-foreground">
                  Pause
                </span>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  aria-labelledby={`break-${date}`}
                  value={String(breakMinutes)}
                  onValueChange={(value) => value && setBreakMinutes(Number(value))}
                  className="w-full"
                >
                  {breaks.map((minutes) => (
                    <ToggleGroupItem key={minutes} value={String(minutes)} className="flex-1 font-mono">
                      {minutes}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
          )}

          {kind === "sick" && (
            <p className="text-sm text-muted-foreground">Ein Krankheitstag zählt wie ein erfüllter Arbeitstag.</p>
          )}
          {kind === "overtime_off" && (
            <p className="text-sm text-muted-foreground">Freier Tag, der von deinen Überstunden abgezogen wird.</p>
          )}

          <dl aria-live="polite" className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
              <dt className="text-[13px] text-muted-foreground">Gearbeitet</dt>
              <dd className="font-mono text-lg font-medium">{formatHours(actual)}</dd>
            </div>
            <div
              className={`flex flex-col gap-1 rounded-lg p-3 ${
                actual > target ? "bg-good text-good-foreground" : actual < target ? "bg-bad text-bad-foreground" : "bg-muted"
              }`}
            >
              <dt className="text-[13px] opacity-80">Überstunden</dt>
              <dd className="font-mono text-lg font-medium">{formatHours(actual - target, { signed: true })}</dd>
            </div>
          </dl>

          <DialogFooter className="gap-2">
            {entry && (
              <Button type="submit" variant="ghost" formAction={closingAfter(resetDay)} className="sm:mr-auto">
                Zurück auf Standard
              </Button>
            )}
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <Button variant="brand">Speichern</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
