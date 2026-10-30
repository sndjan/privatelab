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
import { Textarea } from "@/components/ui/textarea";
import { deleteTodo, saveTodo } from "./actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Person, Phase, Todo } from "./data";
import { closingAfter, Field, PhaseSelect } from "./fields";

type Props = {
  todo?: Todo;
  phases: Phase[];
  people: Person[];
  // Preselected phase of a new to-do: the current one.
  defaultPhaseId: string | null;
  // A new to-do from a meeting protocol.
  protocolId?: string;
  triggerLabel?: string;
};

// Adds a to-do, or edits / deletes one when `todo` is given.
export function TodoDialog({ todo, phases, people, defaultPhaseId, protocolId, triggerLabel = "Neues To-do" }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {todo ? (
          <Button variant="ghost" size="icon" aria-label={`„${todo.title}" bearbeiten`} className="text-muted-foreground">
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline" className="w-fit">
            <PlusIcon /> {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={closingAfter(saveTodo, close)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{todo ? "To-do bearbeiten" : "Neues To-do"}</DialogTitle>
            {protocolId && <DialogDescription>Wird mit diesem Protokoll verknüpft.</DialogDescription>}
          </DialogHeader>
          {todo && <input type="hidden" name="todoId" value={todo.id} />}
          {protocolId && <input type="hidden" name="protocolId" value={protocolId} />}
          <Field id="todo-title" label="Was">
            <Input id="todo-title" name="title" required maxLength={200} defaultValue={todo?.title ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="todo-deadline" label="Deadline">
              <Input id="todo-deadline" type="date" name="deadline" defaultValue={todo?.deadline ?? ""} />
            </Field>
            <Field id="todo-phase" label="Phase">
              <PhaseSelect id="todo-phase" phases={phases} defaultValue={todo ? todo.phaseId : defaultPhaseId} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="todo-priority" label="Priorität">
              <Select name="priority" defaultValue={todo?.priority ? String(todo.priority) : "none"}>
                <SelectTrigger id="todo-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine</SelectItem>
                  <SelectItem value="1">!1 Hoch</SelectItem>
                  <SelectItem value="2">!2 Mittel</SelectItem>
                  <SelectItem value="3">!3 Niedrig</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id="todo-person" label="Person">
              <Select name="personId" defaultValue={todo?.personId ?? "none"}>
                <SelectTrigger id="todo-person" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Niemand</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field id="todo-note" label="Notiz">
            <Textarea id="todo-note" name="note" rows={3} maxLength={2000} defaultValue={todo?.note ?? ""} />
          </Field>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <SubmitButton>{todo ? "Speichern" : "Anlegen"}</SubmitButton>
            {todo && (
              <SubmitButton
                variant="ghost"
                formAction={closingAfter(deleteTodo, close)}
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
