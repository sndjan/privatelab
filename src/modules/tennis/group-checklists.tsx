"use client";

import { Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveGroupChecklists } from "./actions";
import type { Group } from "./data";

// "Zum Abschluss" on the group page: what to do after each session, and
// additionally after the last session of the day.
export function GroupChecklists({ group }: { group: Group }) {
  const [afterSession, setAfterSession] = useState(group.afterSession);
  const [dayEnd, setDayEnd] = useState(group.dayEnd);
  const [pending, startTransition] = useTransition();
  const changed = afterSession.join("|") !== group.afterSession.join("|") || dayEnd.join("|") !== group.dayEnd.join("|");

  function save() {
    startTransition(async () => {
      try {
        await saveGroupChecklists(group.id, afterSession, dayEnd);
        toast.success("Gespeichert");
      } catch {
        toast.error("Konnte nicht gespeichert werden.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <ListEditor title="Nach jeder Stunde" hint="„Stunde abschließen“" items={afterSession} onChange={setAfterSession} placeholder="z. B. Netz runterlassen" />
      <ListEditor
        title="Wenn es die letzte Stunde des Tages ist"
        hint="„Tagesende“"
        items={dayEnd}
        onChange={setDayEnd}
        placeholder="z. B. Ballkorb abschließen"
      />
      <p className="text-xs text-muted-foreground">
        Letzte Stunde des Tages heißt: An diesem Tag folgt keine weitere Stunde von dir, auch nicht bei einer anderen Gruppe.
      </p>
      <Button variant="outline" onClick={save} disabled={pending || !changed}>
        {pending && <Loader2Icon className="animate-spin" />} Speichern
      </Button>
    </div>
  );
}

function ListEditor({
  title,
  hint,
  items,
  onChange,
  placeholder,
}: {
  title: string;
  hint: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const item = draft.trim().slice(0, 80);
    if (!item || items.includes(item) || items.length >= 10) return;
    onChange([...items, item]);
    setDraft("");
  }

  return (
    <section aria-label={title} className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h4 className="flex-1 text-sm font-medium">{title}</h4>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      {items.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item} className="flex min-h-11 items-center gap-2 pl-3">
              <span className="min-w-0 flex-1">{item}</span>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                aria-label={`${item} entfernen`}
                onClick={() => onChange(items.filter((entry) => entry !== item))}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          aria-label={`Neuer Punkt: ${title}`}
          maxLength={80}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          enterKeyHint="enter"
        />
        <Button variant="outline" size="icon" aria-label="Hinzufügen" onClick={add} disabled={!draft.trim() || items.length >= 10}>
          <PlusIcon />
        </Button>
      </div>
    </section>
  );
}
