"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { deleteVacation, saveVacation } from "./actions";
import {
  buildContext,
  formatDays,
  formatHours,
  formatRange,
  formatTime,
  isDate,
  splitBlock,
  standardBreak,
  standardTimes,
  targetMinutes,
  type DayEntry,
  type Period,
  type Settings,
  type VacationBlock,
} from "./calc";

type Props = {
  vacation?: VacationBlock;
  // YYYY-MM-DD, passed from the server so rendering doesn't depend on the client's clock.
  today: string;
  periods: Period[];
  settings: Settings;
  entries: DayEntry[];
};

// Adds a vacation block, or edits / deletes one when `vacation` is given.
// From a date and time to a date and time; each day counts the part of its
// standard work time (without the break) inside. Paid with vacation, overtime or both (a number of hours from overtime, the
// rest vacation). Shows the hours the dates use while typing.
export function VacationDialog({ vacation, today, periods, settings, entries }: Props) {
  const [open, setOpen] = useState(false);
  const context = useMemo(() => buildContext(periods, settings, entries, []), [periods, settings, entries]);
  // The standard work time of a day ("7:30"–"16:30"), or the defaults on a free day.
  const target = (date: string) => (isDate(date) ? targetMinutes(date, context.periods, settings) : 0);
  const standard = (date: string) => standardTimes(target(date), settings);
  const [startDate, setStartDate] = useState(vacation?.startDate ?? today);
  const [endDate, setEndDate] = useState(vacation?.endDate ?? today);
  const [startTime, setStartTime] = useState(
    clock(vacation?.startTime ?? standard(vacation?.startDate ?? today).start),
  );
  // Follows the standard end of the end date until changed by hand.
  const [endTimeInput, setEndTimeInput] = useState(vacation?.endTime != null ? clock(vacation.endTime) : null);
  const endTime = endTimeInput ?? clock(standard(endDate).end);
  const [paidWith, setPaidWith] = useState(
    vacation?.fromOvertime ? "overtime" : vacation?.overtimeMinutes ? "split" : "vacation",
  );
  const [overtimeHours, setOvertimeHours] = useState(
    vacation?.overtimeMinutes ? String(vacation.overtimeMinutes / 60).replace(".", ",") : "",
  );
  const requestedOvertime = Math.max(0, Math.round((Number(overtimeHours.replace(",", ".")) || 0) * 60));
  const startMinutes = minutes(startTime);
  const endMinutes = minutes(endTime) || 24 * 60;
  const valid =
    isDate(startDate) &&
    isDate(endDate) &&
    startMinutes !== null &&
    endMinutes !== null &&
    (endDate > startDate || (endDate === startDate && endMinutes > startMinutes));
  // Times covering the whole standard day are saved as "whole day", so they
  // still fit when the work time model changes.
  const savedStart = valid && startMinutes! > standard(startDate).start ? startMinutes : null;
  const savedEnd = valid && endMinutes! < standard(endDate).end ? endMinutes : null;
  const used = valid
    ? splitBlock(
        {
          startDate,
          endDate,
          startTime: savedStart,
          endTime: savedEnd,
          fromOvertime: paidWith === "overtime",
          overtimeMinutes: paidWith === "split" ? requestedOvertime : 0,
        },
        context,
      )
    : null;

  function closingAfter(action: (formData: FormData) => Promise<void>) {
    return async (formData: FormData) => {
      await action(formData);
      setOpen(false);
    };
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {vacation ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Urlaub ${formatRange(vacation.startDate, vacation.endDate)} bearbeiten`}
            className="text-muted-foreground"
          >
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline" className="w-fit">
            <PlusIcon /> Urlaub planen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form action={closingAfter(saveVacation)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{vacation ? "Urlaub bearbeiten" : "Urlaub planen"}</DialogTitle>
          </DialogHeader>
          {vacation && <input type="hidden" name="vacationId" value={vacation.id} />}
          <input type="hidden" name="startTime" value={savedStart === null ? "" : clock(savedStart)} />
          <input type="hidden" name="endTime" value={savedEnd === null ? "" : clock(savedEnd)} />
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Von</legend>
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <Input
                aria-label="Von Datum"
                type="date"
                name="startDate"
                required
                value={startDate}
                onChange={(event) => {
                  const next = event.target.value;
                  // A single day moves along; a range keeps its end unless it would end before.
                  if (endDate === startDate || next > endDate) setEndDate(next);
                  setStartDate(next);
                }}
              />
              <Input
                aria-label="Von Uhrzeit"
                type="time"
                step={900}
                required
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="font-mono"
              />
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Bis</legend>
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <Input
                aria-label="Bis Datum"
                type="date"
                name="endDate"
                required
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
              <Input
                aria-label="Bis Uhrzeit"
                type="time"
                step={900}
                required
                value={endTime}
                onChange={(event) => setEndTimeInput(event.target.value)}
                className="font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Arbeitszeit {standardLabel(target(startDate), settings)}. Gerechnet wird nur, was davon in den Urlaub
              fällt.
            </p>
          </fieldset>
          <div className="space-y-2">
            <span id="vacation-paid" className="text-sm font-medium">
              Bezahlt mit
            </span>
            <input type="hidden" name="paidWith" value={paidWith} />
            <ToggleGroup
              type="single"
              variant="outline"
              aria-labelledby="vacation-paid"
              value={paidWith}
              onValueChange={(value) => value && setPaidWith(value)}
              className="w-full"
            >
              <ToggleGroupItem value="vacation" className="flex-1">
                Urlaub
              </ToggleGroupItem>
              <ToggleGroupItem value="overtime" className="flex-1">
                Überstunden
              </ToggleGroupItem>
              <ToggleGroupItem value="split" className="flex-1">
                Beides
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {paidWith === "split" && (
            <div className="flex items-center gap-3">
              <Input
                id="vacation-overtime-hours"
                name="overtimeHours"
                inputMode="decimal"
                required
                value={overtimeHours}
                onChange={(event) => setOvertimeHours(event.target.value)}
                className="w-24 font-mono"
              />
              <Label htmlFor="vacation-overtime-hours" className="font-normal">
                Stunden aus Überstunden, der Rest vom Urlaub
              </Label>
            </div>
          )}
          <p aria-live="polite" className="rounded-lg bg-muted px-3 py-2.5 text-sm">
            {used === null ? (
              "Das Ende muss nach dem Beginn liegen."
            ) : (
              <>
                <strong className="font-mono font-medium">{formatDays(used.days)}</strong>{" "}
                {used.days === 1 ? "Arbeitstag" : "Arbeitstage"} ={" "}
                <strong className="font-mono font-medium">{formatHours(used.minutes)}</strong>
                {used.minutes > 0 && (
                  <span className="mt-1 block">
                    {used.vacation > 0 && (
                      <>
                        <strong className="font-mono font-medium">{formatHours(used.vacation)}</strong> Urlaub
                      </>
                    )}
                    {used.vacation > 0 && used.overtime > 0 && " + "}
                    {used.overtime > 0 && (
                      <>
                        <strong className="font-mono font-medium">{formatHours(used.overtime)}</strong> Überstunden
                      </>
                    )}
                  </span>
                )}
                {paidWith === "split" && requestedOvertime > used.minutes && (
                  <span className="mt-1 block text-debt">Mehr Überstunden als der Urlaub lang ist.</span>
                )}
                {used.withoutModel > 0 && (
                  <span className="mt-1 block text-debt">Für einige Tage gibt es kein Arbeitszeitmodell (0 h).</span>
                )}
              </>
            )}
          </p>
          <div className="space-y-2">
            <Label htmlFor="vacation-note">Notiz</Label>
            <Input
              id="vacation-note"
              name="note"
              maxLength={120}
              defaultValue={vacation?.note ?? ""}
              placeholder="z. B. Brückentag, Reise"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="vacation-calendar" name="inCalendar" defaultChecked={vacation?.inCalendar ?? false} />
            <Label htmlFor="vacation-calendar" className="font-normal">
              Im Arbeitskalender eingetragen
            </Label>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <SubmitButton disabled={!valid}>{vacation ? "Speichern" : "Planen"}</SubmitButton>
            {vacation && (
              <SubmitButton
                type="submit"
                variant="ghost"
                formAction={closingAfter(deleteVacation)}
                formNoValidate
                className="text-destructive hover:text-destructive order-first sm:mr-auto"
              >
                Löschen
              </SubmitButton>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// 450 → "07:30" for time inputs.
function clock(value: number) {
  return formatTime(Math.min(value, 23 * 60 + 59)).padStart(5, "0");
}

// "07:30" → 450, null if empty or invalid.
function minutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function standardLabel(target: number, settings: Settings) {
  const times = standardTimes(target, settings);
  const range = `${formatTime(times.start)}–${formatTime(times.end)}`;
  if (!times.breakMinutes) return range;
  const pause = standardBreak(target, settings);
  return `${range}, Pause ${formatTime(pause.start)}–${formatTime(pause.end)}`;
}
