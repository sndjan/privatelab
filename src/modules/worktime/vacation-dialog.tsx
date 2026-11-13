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
  isDate,
  splitBlock,
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
// Paid with vacation, overtime or both (a number of hours from overtime, the
// rest vacation). Shows the hours the dates use while typing.
export function VacationDialog({ vacation, today, periods, settings, entries }: Props) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(vacation?.startDate ?? today);
  const [endDate, setEndDate] = useState(vacation?.endDate ?? today);
  const [paidWith, setPaidWith] = useState(
    vacation?.fromOvertime ? "overtime" : vacation?.overtimeMinutes ? "split" : "vacation",
  );
  const [overtimeHours, setOvertimeHours] = useState(
    vacation?.overtimeMinutes ? String(vacation.overtimeMinutes / 60).replace(".", ",") : "",
  );
  const requestedOvertime = Math.max(0, Math.round((Number(overtimeHours.replace(",", ".")) || 0) * 60));
  const context = useMemo(() => buildContext(periods, settings, entries, []), [periods, settings, entries]);
  const valid = isDate(startDate) && isDate(endDate) && endDate >= startDate;
  const used = valid
    ? splitBlock(
        {
          startDate,
          endDate,
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="vacation-start">Von</Label>
              <Input
                id="vacation-start"
                type="date"
                name="startDate"
                required
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  if (event.target.value > endDate) setEndDate(event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vacation-end">Bis</Label>
              <Input
                id="vacation-end"
                type="date"
                name="endDate"
                required
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
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
              "Das Ende muss nach dem Start liegen."
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
