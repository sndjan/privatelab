"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { deleteEvent, saveEvent } from "./actions";
import { eventKinds, type EventKind, type Person, type ThesisEvent } from "./data";
import { closingAfter, Field } from "./fields";
import { PeoplePicker } from "./people-picker";

// Adds an appointment or deadline, or edits / deletes one when `event` is given.
export function EventDialog({
  event,
  people,
  today,
  defaultKind = "appointment",
}: {
  event?: ThesisEvent;
  people: Person[];
  today: string;
  defaultKind?: EventKind;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<EventKind>(event?.kind ?? defaultKind);
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {event ? (
          <Button variant="ghost" size="icon" aria-label={`„${event.title}" bearbeiten`} className="text-muted-foreground">
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline" className="w-fit">
            <PlusIcon /> {defaultKind === "deadline" ? "Neue Deadline" : "Neuer Termin"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={closingAfter(saveEvent, close)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{event ? "Bearbeiten" : kind === "deadline" ? "Neue Deadline" : "Neuer Termin"}</DialogTitle>
          </DialogHeader>
          {event && <input type="hidden" name="eventId" value={event.id} />}
          <input type="hidden" name="kind" value={kind} />
          <ToggleGroup
            type="single"
            variant="outline"
            value={kind}
            onValueChange={(value) => value && setKind(value as EventKind)}
            aria-label="Art"
            className="w-full"
          >
            {eventKinds.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value} className="h-9">
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Field id="event-title" label="Was">
            <Input
              id="event-title"
              name="title"
              required
              maxLength={200}
              defaultValue={event?.title ?? ""}
              placeholder={kind === "deadline" ? "z. B. Anmeldung beim Prüfungsamt" : "z. B. Treffen mit Betreuerin"}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="event-date" label="Datum">
              <Input id="event-date" type="date" name="date" required defaultValue={event?.date ?? today} />
            </Field>
            <Field id="event-time" label="Uhrzeit (optional)">
              <Input id="event-time" type="time" name="time" step={300} defaultValue={event?.time ?? ""} />
            </Field>
          </div>
          {kind === "appointment" && (
            <>
              <Field id="event-location" label="Ort (optional)">
                <Input id="event-location" name="location" maxLength={200} defaultValue={event?.location ?? ""} placeholder="z. B. Raum 2.14, Teams" />
              </Field>
              <Field id="event-people" label="Mit">
                <PeoplePicker id="event-people" people={people} defaultIds={event?.personIds ?? []} />
              </Field>
            </>
          )}
          <Field id="event-note" label="Notiz">
            <Textarea id="event-note" name="note" rows={2} maxLength={2000} defaultValue={event?.note ?? ""} />
          </Field>
          <DialogFooter className="gap-2">
            {event && (
              <SubmitButton
                variant="ghost"
                formAction={closingAfter(deleteEvent, close)}
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
            <SubmitButton>{event ? "Speichern" : "Eintragen"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
