"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deletePeriod, savePeriod } from "./actions";
import { formatDate, formatHours, weekdayNames, type Period } from "./calc";

type Props = {
  period?: Period;
  // Suggested start date for a new model.
  defaultFrom: string;
  canDelete?: boolean;
};

const fullTime = [480, 480, 480, 480, 480, 0, 0];

// Adds a work time model (hours per weekday and vacation days per month from
// a date on), or edits / deletes one when `period` is given.
export function PeriodDialog({ period, defaultFrom, canDelete = false }: Props) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState((period?.weekdayMinutes ?? fullTime).map((minutes) => String(minutes / 60).replace(".", ",")));
  const weekly = hours.reduce((sum, value) => sum + (Number(value.replace(",", ".")) || 0), 0) * 60;

  function closingAfter(action: (formData: FormData) => Promise<void>) {
    return async (formData: FormData) => {
      await action(formData);
      setOpen(false);
    };
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {period ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Modell ab ${formatDate(period.validFrom)} bearbeiten`}
            className="text-muted-foreground"
          >
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline" className="w-fit">
            <PlusIcon /> Neues Modell
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={closingAfter(savePeriod)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{period ? "Arbeitszeitmodell bearbeiten" : "Neues Arbeitszeitmodell"}</DialogTitle>
            <DialogDescription>Gilt ab dem Datum, bis ein neueres Modell beginnt.</DialogDescription>
          </DialogHeader>
          {period && <input type="hidden" name="periodId" value={period.id} />}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="period-from">Gilt ab</Label>
              <Input id="period-from" type="date" name="validFrom" required defaultValue={period?.validFrom ?? defaultFrom} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-label">Name</Label>
              <Input
                id="period-label"
                name="label"
                maxLength={60}
                defaultValue={period?.label ?? ""}
                placeholder="z. B. Teilzeit 32 h"
              />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">
              Stunden pro Tag <span className="font-normal text-muted-foreground">· {formatHours(weekly)} pro Woche</span>
            </legend>
            <div className="grid grid-cols-7 gap-1.5">
              {weekdayNames.map((name, index) => (
                <div key={name} className="space-y-1 text-center">
                  <Label htmlFor={`period-day${index}`} className="justify-center text-xs text-muted-foreground">
                    {name}
                  </Label>
                  <Input
                    id={`period-day${index}`}
                    name={`day${index}`}
                    inputMode="decimal"
                    value={hours[index]}
                    onChange={(event) =>
                      setHours((current) => current.map((value, i) => (i === index ? event.target.value : value)))
                    }
                    className="px-1 text-center font-mono"
                  />
                </div>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="period-vacation">Urlaubstage pro Monat</Label>
            <Input
              id="period-vacation"
              name="vacationPerMonth"
              inputMode="decimal"
              required
              defaultValue={String(period?.vacationPerMonth ?? 2).replace(".", ",")}
              className="w-28 font-mono"
            />
          </div>
          <DialogFooter className="gap-2">
            {period && canDelete && (
              <Button
                type="submit"
                variant="ghost"
                formAction={closingAfter(deletePeriod)}
                formNoValidate
                className="text-destructive hover:text-destructive sm:mr-auto"
              >
                Löschen
              </Button>
            )}
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <Button>{period ? "Speichern" : "Anlegen"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
