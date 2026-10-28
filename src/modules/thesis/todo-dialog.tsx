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
import type { Phase, Todo } from "./data";
import { closingAfter, Field, PhaseSelect } from "./fields";

type Props = {
  todo?: Todo;
  phases: Phase[];
  // Preselected phase of a new to-do: the current one.
  defaultPhaseId: string | null;
  // A new to-do from a meeting protocol.
  protocolId?: string;
  triggerLabel?: string;
};

// Adds a to-do, or edits / deletes one when `todo` is given.
export function TodoDialog({ todo, phases, defaultPhaseId, protocolId, triggerLabel = "Neues To-do" }: Props) {
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
          <Field id="todo-note" label="Notiz">
            <Textarea id="todo-note" name="note" rows={3} maxLength={2000} defaultValue={todo?.note ?? ""} />
          </Field>
          <DialogFooter className="gap-2">
            {todo && (
              <SubmitButton
                variant="ghost"
                formAction={closingAfter(deleteTodo, close)}
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
            <SubmitButton>{todo ? "Speichern" : "Anlegen"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
