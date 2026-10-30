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
import { deleteBreak, deleteMilestone, saveBreak, saveMilestone } from "./actions";
import type { Break, Milestone } from "./data";
import { closingAfter, Field } from "./fields";

// Adds days off, or edits / deletes them when `entry` is given.
export function BreakDialog({ entry, today }: { entry?: Break; today: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {entry ? (
          <Button variant="ghost" size="icon" aria-label={`Freie Tage „${entry.name || "Pause"}“ bearbeiten`} className="text-muted-foreground">
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline" className="w-fit">
            <PlusIcon /> Freie Tage
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={closingAfter(saveBreak, close)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{entry ? "Freie Tage bearbeiten" : "Freie Tage einplanen"}</DialogTitle>
            <DialogDescription>
              An diesen Tagen zeigt die Bachelorarbeit nur einen Hinweis auf deine Pause; wegklicken geht trotzdem.
            </DialogDescription>
          </DialogHeader>
          {entry && <input type="hidden" name="breakId" value={entry.id} />}
          <Field id="break-name" label="Name" hint="Optional, z. B. Weihnachten oder Urlaub.">
            <Input id="break-name" name="name" maxLength={80} defaultValue={entry?.name ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="break-start" label="Von">
              <Input id="break-start" type="date" name="startDate" required defaultValue={entry?.startDate ?? today} />
            </Field>
            <Field id="break-end" label="Bis (einschließlich)">
              <Input id="break-end" type="date" name="endDate" required defaultValue={entry?.endDate ?? ""} />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <SubmitButton>{entry ? "Speichern" : "Einplanen"}</SubmitButton>
            {entry && (
              <SubmitButton
                variant="ghost"
                formAction={closingAfter(deleteBreak, close)}
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

// Adds a milestone, or edits / deletes one when `milestone` is given.
export function MilestoneDialog({ milestone, defaultDate }: { milestone?: Milestone; defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {milestone ? (
          <Button variant="ghost" size="icon" aria-label={`Meilenstein „${milestone.name}“ bearbeiten`} className="text-muted-foreground">
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline" className="w-fit">
            <PlusIcon /> Meilenstein
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={closingAfter(saveMilestone, close)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{milestone ? "Meilenstein bearbeiten" : "Neuer Meilenstein"}</DialogTitle>
            <DialogDescription>Ein Ziel mit Datum, z. B. „Erster Entwurf“. Es steht auf der Zeitleiste und im Kalender.</DialogDescription>
          </DialogHeader>
          {milestone && <input type="hidden" name="milestoneId" value={milestone.id} />}
          <Field id="milestone-name" label="Name">
            <Input id="milestone-name" name="name" required maxLength={80} defaultValue={milestone?.name ?? ""} placeholder="Erster Entwurf" />
          </Field>
          <div className="w-44">
            <Field id="milestone-date" label="Bis">
              <Input id="milestone-date" type="date" name="date" required defaultValue={milestone?.date ?? defaultDate} />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <SubmitButton>{milestone ? "Speichern" : "Anlegen"}</SubmitButton>
            {milestone && (
              <SubmitButton
                variant="ghost"
                formAction={closingAfter(deleteMilestone, close)}
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
