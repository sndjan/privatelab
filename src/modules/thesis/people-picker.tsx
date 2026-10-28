"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Person } from "./data";

// People as chips to tap, for a form: posts "personId" for each chosen person
// and "newPerson" for names typed in that don't exist yet (the server adds
// them). Typing filters the chips; Enter picks the first match or adds the name.
export function PeoplePicker({ people, defaultIds = [], id }: { people: Person[]; defaultIds?: string[]; id?: string }) {
  const [chosen, setChosen] = useState<string[]>(defaultIds);
  const [added, setAdded] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const shown = search ? people.filter((person) => person.name.toLowerCase().includes(search)) : people;
  const toggle = (personId: string) =>
    setChosen((current) => (current.includes(personId) ? current.filter((entry) => entry !== personId) : [...current, personId]));

  function enter() {
    if (!search) return;
    const exact = people.find((person) => person.name.toLowerCase() === search);
    const match = exact ?? (shown.length === 1 ? shown[0] : undefined);
    if (match) {
      if (!chosen.includes(match.id)) toggle(match.id);
    } else if (!added.some((name) => name.toLowerCase() === search)) {
      setAdded([...added, query.trim().slice(0, 80)]);
    }
    setQuery("");
  }

  return (
    <div className="space-y-2">
      {chosen.map((personId) => (
        <input key={personId} type="hidden" name="personId" value={personId} />
      ))}
      {added.map((name) => (
        <input key={name} type="hidden" name="newPerson" value={name} />
      ))}
      <ul className="flex flex-wrap gap-1.5">
        {shown.map((person) => (
          <li key={person.id}>
            <Chip active={chosen.includes(person.id)} onClick={() => toggle(person.id)}>
              {person.name}
            </Chip>
          </li>
        ))}
        {added.map((name) => (
          <li key={name}>
            <Chip active onClick={() => setAdded(added.filter((entry) => entry !== name))}>
              {name} <span className="text-xs opacity-70">neu</span>
            </Chip>
          </li>
        ))}
      </ul>
      <div className="relative">
        <PlusIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              enter();
            }
          }}
          maxLength={80}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={people.length > 0 ? "Suchen oder neue Person, Enter" : "Name, Enter"}
          aria-label="Person suchen oder hinzufügen"
          className="h-9 pl-8"
        />
      </div>
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-8 cursor-pointer items-center gap-1 rounded-full border px-3 text-sm transition-colors",
        active ? "border-brand bg-good text-good-foreground" : "bg-card text-muted-foreground hover:bg-accent",
      )}
    >
      {active && <CheckIcon className="size-3.5" />}
      {children}
    </button>
  );
}
