"use client";

import { InfoIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { addInfo, addPerson, deleteInfo, deletePerson, updateInfo } from "./actions";
import type { Info, Person } from "./data";

type InfoChange = { type: "add"; info: Info } | { type: "update"; id: string; text: string } | { type: "delete"; id: string };

// Short facts for the overview ("Kolloquium spätestens 4 Wochen nach Abgabe").
// Tap one to change it; emptied, it is removed.
export function Infos({ infos: saved }: { infos: Info[] }) {
  const [infos, change] = useOptimistic(saved, (current, update: InfoChange) => {
    if (update.type === "add") return [...current, update.info];
    if (update.type === "delete") return current.filter((info) => info.id !== update.id);
    return update.text.trim()
      ? current.map((info) => (info.id === update.id ? { ...info, text: update.text } : info))
      : current.filter((info) => info.id !== update.id);
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function run(update: InfoChange, action: () => Promise<unknown>) {
    startTransition(async () => {
      change(update);
      try {
        await action();
      } catch {
        toast.error("Das hat nicht geklappt.");
      }
    });
  }

  return (
    <div className="space-y-2">
      {infos.length > 0 && (
        <ul className="flex flex-col divide-y">
          {infos.map((info) => (
            <li key={info.id} className="flex items-start gap-2 py-2">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {editing === info.id ? (
                <input
                  autoFocus
                  defaultValue={info.text}
                  maxLength={500}
                  aria-label="Info bearbeiten"
                  className="min-w-0 flex-1 rounded-md border bg-card px-2 py-0.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") setEditing(null);
                  }}
                  onBlur={(event) => {
                    const text = event.currentTarget.value;
                    setEditing(null);
                    if (text.trim() !== info.text) run({ type: "update", id: info.id, text }, () => updateInfo(info.id, text));
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(info.id)}
                  className="min-w-0 flex-1 cursor-text text-left text-sm whitespace-pre-line"
                  title="Zum Ändern antippen"
                >
                  {info.text}
                </button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="-my-1 text-muted-foreground"
                aria-label="Info löschen"
                disabled={info.id.startsWith("new-")}
                onClick={() => {
                  const data = new FormData();
                  data.set("infoId", info.id);
                  run({ type: "delete", id: info.id }, () => deleteInfo(data));
                }}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setDraft("");
          const data = new FormData();
          data.set("text", text);
          run({ type: "add", info: { id: `new-${Date.now()}`, text } }, () => addInfo(data));
          input.current?.focus();
        }}
        className="relative"
      >
        <PlusIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={500}
          enterKeyHint="enter"
          aria-label="Neue Info"
          placeholder="z. B. Kolloquium spätestens 4 Wochen nach Abgabe"
          className="h-9 w-full rounded-md border bg-card pr-8 pl-8 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        {pending && <Loader2Icon className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </form>
    </div>
  );
}

// The people of the thesis (supervisors, interview partners …), chosen as
// chips in protocols, appointments and to-dos (@Name).
export function PeopleList({ people: saved }: { people: Person[] }) {
  const [people, change] = useOptimistic(saved, (current, update: { type: "add"; person: Person } | { type: "delete"; id: string }) =>
    update.type === "add"
      ? [...current, update.person].sort((a, b) => a.name.localeCompare(b.name, "de"))
      : current.filter((person) => person.id !== update.id),
  );
  const [name, setName] = useState("");
  const [, startTransition] = useTransition();

  function run(update: { type: "add"; person: Person } | { type: "delete"; id: string }, action: () => Promise<unknown>) {
    startTransition(async () => {
      change(update);
      try {
        await action();
      } catch {
        toast.error("Das hat nicht geklappt.");
      }
    });
  }

  return (
    <div className="space-y-2">
      {people.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {people.map((person) => (
            <li key={person.id} className="flex h-8 items-center gap-0.5 rounded-full border bg-card pr-1 pl-3 text-sm">
              {person.name}
              <button
                type="button"
                aria-label={`${person.name} entfernen`}
                disabled={person.id.startsWith("new-")}
                className="flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: `${person.name} entfernen?`,
                    description: "Aus Protokollen, Terminen und To-dos verschwindet die Person auch.",
                    confirmLabel: "Entfernen",
                  });
                  if (!ok) return;
                  const data = new FormData();
                  data.set("personId", person.id);
                  run({ type: "delete", id: person.id }, () => deletePerson(data));
                }}
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          setName("");
          run({ type: "add", person: { id: `new-${Date.now()}`, name: trimmed } }, () => addPerson(trimmed));
        }}
        className="relative"
      >
        <PlusIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          enterKeyHint="enter"
          aria-label="Neue Person"
          placeholder="Person hinzufügen, z. B. Prof. Weber"
          className="h-9 w-full rounded-md border bg-card pr-2 pl-8 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </form>
    </div>
  );
}
