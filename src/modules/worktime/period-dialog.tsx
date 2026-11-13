"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { deletePeriod, savePeriod } from "./actions";
import { formatDate, formatHours, vacationRule, weekdayNames, type Period } from "./calc";

type Props = {
  period?: Period;
  // Suggested start date for a new model.
  defaultFrom: string;
  canDelete?: boolean;
};

const fullTime = [480, 480, 480, 480, 480, 0, 0];

// Adds a work time model (hours per weekday and the vacation it earns from a
// date on), or edits / deletes one when `period` is given.
export function PeriodDialog({ period, defaultFrom, canDelete = false }: Props) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState((period?.weekdayMinutes ?? fullTime).map((minutes) => String(minutes / 60).replace(".", ",")));
  const [vacationMode, setVacationMode] = useState(period && period.vacationPerMonth !== null ? "fixed" : "rule");
  const [contractDays, setContractDays] = useState(String(period?.vacationContractDays ?? 12).replace(".", ","));
  const minutes = hours.map((value) => Math.round((Number(value.replace(",", ".")) || 0) * 60));
  const weekly = minutes.reduce((sum, value) => sum + value, 0);
  const rule = vacationRule(minutes, Number(contractDays.replace(",", ".")) || 0);

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
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">Urlaubsanspruch</legend>
            <input type="hidden" name="vacationMode" value={vacationMode} />
            <ToggleGroup
              type="single"
              variant="outline"
              aria-label="Urlaubsanspruch"
              value={vacationMode}
              onValueChange={(value) => value && setVacationMode(value)}
              className="w-full"
            >
              <ToggleGroupItem value="rule" className="flex-1">
                Nach Regel
              </ToggleGroupItem>
              <ToggleGroupItem value="fixed" className="flex-1">
                Fester Wert
              </ToggleGroupItem>
            </ToggleGroup>
            {vacationMode === "rule" ? (
              <>
                <div className="flex items-center gap-3">
                  <Input
                    id="period-contract-days"
                    name="vacationContractDays"
                    inputMode="decimal"
                    required
                    value={contractDays}
                    onChange={(event) => setContractDays(event.target.value)}
                    className="w-20 font-mono"
                  />
                  <Label htmlFor="period-contract-days" className="font-normal">
                    Urlaubstage pro Jahr laut Vertrag
                  </Label>
                </div>
                <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-lg bg-muted px-3 py-2.5 text-sm">
                  <dt className="text-muted-foreground">
                    Vertrag · {contractDays || 0} × {formatHours(rule.perDay)}
                  </dt>
                  <dd className="text-right font-mono">{formatHours(rule.contract)}</dd>
                  <dt className="text-muted-foreground">Gesetz · 4 × {formatHours(rule.weekly)}</dt>
                  <dd className="text-right font-mono">{formatHours(rule.law)}</dd>
                  <dt className="font-medium">Gilt pro Jahr</dt>
                  <dd className="text-right font-mono font-medium">{formatHours(rule.perYear)}</dd>
                  <dt className="font-medium">Pro Monat</dt>
                  <dd className="text-right font-mono font-medium">{formatHours(rule.perMonth)}</dd>
                </dl>
              </>
            ) : (
              <>
                {/* Keeps the contract days when switching back to the rule later. */}
                <input type="hidden" name="vacationContractDays" value={contractDays} />
                <div className="flex items-center gap-3">
                  <Input
                    id="period-vacation-hours"
                    name="vacationHoursPerMonth"
                    inputMode="decimal"
                    required
                    defaultValue={
                      period?.vacationPerMonth != null
                        ? String(Math.round((period.vacationPerMonth / 60) * 100) / 100).replace(".", ",")
                        : String(Math.round((rule.perMonth / 60) * 100) / 100).replace(".", ",")
                    }
                    className="w-24 font-mono"
                  />
                  <Label htmlFor="period-vacation-hours" className="font-normal">
                    Urlaubsstunden pro Monat
                  </Label>
                </div>
              </>
            )}
          </fieldset>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <SubmitButton>{period ? "Speichern" : "Anlegen"}</SubmitButton>
            {period && canDelete && (
              <SubmitButton
                type="submit"
                variant="ghost"
                formAction={closingAfter(deletePeriod)}
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
