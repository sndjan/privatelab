"use client";

import { Loader2Icon, XIcon } from "lucide-react";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addPlayer, deletePlayer, setPlayerGender } from "./actions";
import { genderName, type Gender, type Player } from "./data";

type Change = { type: "add"; player: Player } | { type: "delete"; id: string } | { type: "gender"; id: string; gender: Gender | null };

// The kids of a group with Junge/Mädchen. Names are typed one after the
// other: Enter adds and keeps the field focused for the next one.
export function Players({ groupId, players: saved }: { groupId: string; players: Player[] }) {
  const [players, change] = useOptimistic(saved, (current, update: Change) => {
    if (update.type === "add") return [...current, update.player];
    if (update.type === "delete") return current.filter((player) => player.id !== update.id);
    return current.map((player) => (player.id === update.id ? { ...player, gender: update.gender } : player));
  });
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const boys = players.filter((player) => player.gender === "m").length;
  const girls = players.filter((player) => player.gender === "f").length;

  function run(update: Change, action: () => Promise<unknown>) {
    startTransition(async () => {
      change(update);
      try {
        await action();
      } catch {
        toast.error("Das hat nicht geklappt.");
      }
    });
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const data = new FormData();
    data.set("groupId", groupId);
    data.set("name", trimmed);
    if (gender) data.set("gender", gender);
    setName("");
    input.current?.focus();
    run({ type: "add", player: { id: `new-${Date.now()}`, groupId, name: trimmed, gender } }, () => addPlayer(data));
  }

  return (
    <div className="space-y-3">
      {players.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {players.length} {players.length === 1 ? "Kind" : "Kinder"}
          {(boys > 0 || girls > 0) && ` · ${boys} ${boys === 1 ? "Junge" : "Jungs"}, ${girls} Mädchen`}
        </p>
      )}
      <ul className="divide-y rounded-lg border">
        {players.map((player) => (
          <li key={player.id} className="flex items-center gap-2 py-1 pr-1 pl-3">
            <span className="min-w-0 flex-1 truncate">{player.name}</span>
            <GenderToggle
              value={player.gender}
              disabled={player.id.startsWith("new-")}
              onChange={(value) => run({ type: "gender", id: player.id, gender: value }, () => setPlayerGender(player.id, value))}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label={`${player.name} entfernen`}
              disabled={player.id.startsWith("new-")}
              onClick={() => {
                const data = new FormData();
                data.set("playerId", player.id);
                run({ type: "delete", id: player.id }, () => deletePlayer(data));
              }}
            >
              <XIcon />
            </Button>
          </li>
        ))}
        <li>
          <form onSubmit={add} className="flex items-center gap-2 py-1 pr-1 pl-1">
            <Input
              ref={input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              aria-label="Name des Kindes"
              placeholder="+ Kind hinzufügen"
              enterKeyHint="enter"
              autoComplete="off"
              className="h-9 flex-1 border-0 shadow-none focus-visible:ring-0"
            />
            <GenderToggle value={gender} onChange={setGender} />
            <Button type="submit" size="sm" variant="outline" disabled={!name.trim()}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Hinzufügen
            </Button>
          </form>
        </li>
      </ul>
    </div>
  );
}

function GenderToggle({
  value,
  onChange,
  disabled,
}: {
  value: Gender | null;
  onChange: (value: Gender | null) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="Geschlecht" className="flex shrink-0 overflow-hidden rounded-md border">
      {(["m", "f"] as const).map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          aria-pressed={value === option}
          title={genderName[option]}
          onClick={() => onChange(value === option ? null : option)}
          className={cn(
            "h-8 w-8 cursor-pointer text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-50",
            value === option
              ? option === "m"
                ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100"
                : "bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-100"
              : "bg-card text-muted-foreground hover:bg-accent",
          )}
        >
          {option === "m" ? "J" : "M"}
          <span className="sr-only"> {genderName[option]}</span>
        </button>
      ))}
    </div>
  );
}
