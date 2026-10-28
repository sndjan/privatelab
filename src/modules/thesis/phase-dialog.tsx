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
import { deletePhase, savePhase } from "./actions";
import type { Phase } from "./data";
import { closingAfter, Field } from "./fields";

// Adds a phase, or edits / deletes one when `phase` is given.
export function PhaseDialog({ phase, defaultStart }: { phase?: Phase; defaultStart: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {phase ? (
          <Button variant="ghost" size="icon" aria-label={`Phase „${phase.name}" bearbeiten`} className="text-muted-foreground">
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline" className="w-fit">
            <PlusIcon /> Neue Phase
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={closingAfter(savePhase, close)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{phase ? "Phase bearbeiten" : "Neue Phase"}</DialogTitle>
            <DialogDescription>
              To-dos und Arbeitslog-Einträge bekommen die Phase, in der das heutige Datum liegt, als Vorauswahl.
            </DialogDescription>
          </DialogHeader>
          {phase && <input type="hidden" name="phaseId" value={phase.id} />}
          <Field id="phase-name" label="Name">
            <Input id="phase-name" name="name" required maxLength={60} defaultValue={phase?.name ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="phase-start" label="Von">
              <Input id="phase-start" type="date" name="startDate" required defaultValue={phase?.startDate ?? defaultStart} />
            </Field>
            <Field id="phase-end" label="Bis">
              <Input id="phase-end" type="date" name="endDate" required defaultValue={phase?.endDate ?? ""} />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            {phase && (
              <SubmitButton
                variant="ghost"
                formAction={closingAfter(deletePhase, close)}
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
            <SubmitButton>{phase ? "Speichern" : "Anlegen"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
