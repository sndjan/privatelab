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
  blockDays,
  buildContext,
  formatDays,
  formatHours,
  formatRange,
  isDate,
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
// Shows how many vacation days (or overtime hours) the dates use while typing.
export function VacationDialog({ vacation, today, periods, settings, entries }: Props) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(vacation?.startDate ?? today);
  const [endDate, setEndDate] = useState(vacation?.endDate ?? today);
  const [paidWith, setPaidWith] = useState(vacation?.fromOvertime ? "overtime" : "vacation");
  const context = useMemo(() => buildContext(periods, settings, entries, []), [periods, settings, entries]);
  const valid = isDate(startDate) && isDate(endDate) && endDate >= startDate;
  const used = valid ? blockDays({ startDate, endDate }, context) : null;

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
                Urlaubstagen
              </ToggleGroupItem>
              <ToggleGroupItem value="overtime" className="flex-1">
                Überstunden
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <p aria-live="polite" className="rounded-lg bg-muted px-3 py-2.5 text-sm">
            {used === null ? (
              "Das Ende muss nach dem Start liegen."
            ) : (
              <>
                <strong className="font-mono font-medium">{formatDays(used.days)}</strong>{" "}
                {used.days === 1 ? "Arbeitstag" : "Arbeitstage"}
                {paidWith === "overtime" && (
                  <>
                    {" "}
                    = <strong className="font-mono font-medium">{formatHours(-used.minutes, { signed: true })}</strong>{" "}
                    Überstunden
                  </>
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
            {vacation && (
              <SubmitButton
                type="submit"
                variant="ghost"
                formAction={closingAfter(deleteVacation)}
                formNoValidate
                className="text-destructive hover:text-destructive sm:mr-auto"
              >
                Löschen
              </SubmitButton>
            )}
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <SubmitButton disabled={!valid}>{vacation ? "Speichern" : "Planen"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
