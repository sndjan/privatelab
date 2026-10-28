"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { deleteLogEntry, saveLogEntry } from "./actions";
import { formatDate, type LogEntry, type Phase } from "./data";
import { closingAfter, Field, PhaseSelect } from "./fields";

function LogFields({ entry, phases, today, defaultPhaseId }: { entry?: LogEntry; phases: Phase[]; today: string; defaultPhaseId: string | null }) {
  const prefix = entry ? `log-${entry.id}` : "log-new";
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3 sm:grid-cols-[10rem_6rem_minmax(0,1fr)]">
        <Field id={`${prefix}-day`} label="Datum">
          <Input id={`${prefix}-day`} type="date" name="day" required defaultValue={entry?.day ?? today} />
        </Field>
        <Field id={`${prefix}-hours`} label="Stunden">
          <Input
            id={`${prefix}-hours`}
            name="hours"
            inputMode="decimal"
            required
            pattern="^\s*\d{1,2}([.,]\d{1,2})?\s*$"
            placeholder="1,5"
            defaultValue={entry ? String(entry.hours).replace(".", ",") : ""}
            className="font-mono"
          />
        </Field>
        <div className="col-span-2 sm:col-span-1">
          <Field id={`${prefix}-phase`} label="Phase">
            <PhaseSelect id={`${prefix}-phase`} phases={phases} defaultValue={entry ? entry.phaseId : defaultPhaseId} />
          </Field>
        </div>
      </div>
      <Field id={`${prefix}-text`} label="Was ich gemacht habe">
        <Textarea id={`${prefix}-text`} name="text" required rows={3} maxLength={2000} defaultValue={entry?.text ?? ""} />
      </Field>
    </>
  );
}

// The form at the top of the log. After saving it starts empty again.
export function LogForm({ phases, today, defaultPhaseId }: { phases: Phase[]; today: string; defaultPhaseId: string | null }) {
  return (
    <form action={saveLogEntry} className="space-y-4">
      <LogFields phases={phases} today={today} defaultPhaseId={defaultPhaseId} />
      <SubmitButton variant="brand">Eintragen</SubmitButton>
    </form>
  );
}

export function LogDialog({ entry, phases, today }: { entry: LogEntry; phases: Phase[]; today: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Eintrag vom ${formatDate(entry.day)} bearbeiten`}
          className="text-muted-foreground"
        >
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form action={closingAfter(saveLogEntry, close)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Eintrag bearbeiten</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="entryId" value={entry.id} />
          <LogFields entry={entry} phases={phases} today={today} defaultPhaseId={null} />
          <DialogFooter className="gap-2">
            <SubmitButton
              variant="ghost"
              formAction={closingAfter(deleteLogEntry, close)}
              formNoValidate
              className="text-destructive hover:text-destructive sm:mr-auto"
            >
              Löschen
            </SubmitButton>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <SubmitButton>Speichern</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
