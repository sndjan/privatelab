"use client";

import { SearchIcon, StarIcon } from "lucide-react";
import { ViewLink as Link } from "@/lib/query/view-link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Court } from "./court";
import { focusTags, phases, type Exercise, type Phase } from "./data";
import { Chip } from "./exercise-form";

const PATH = "/m/tennis";

// All exercises, filtered by text, phase and focus as you type.
export function Library({ exercises, favoriteIds }: { exercises: Exercise[]; favoriteIds: string[] }) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const favorites = new Set(favoriteIds);

  const search = query.trim().toLowerCase();
  const shown = exercises.filter(
    (exercise) =>
      (!phase || exercise.phase === phase) &&
      (!focus || exercise.focus.includes(focus)) &&
      (!search || `${exercise.name} ${exercise.summary} ${exercise.description}`.toLowerCase().includes(search)),
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`${exercises.length} Übungen durchsuchen`}
          aria-label="Übungen durchsuchen"
          className="bg-card pl-9"
        />
      </div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {phases.map((entry) => (
          <Chip key={entry.id} active={phase === entry.id} onClick={() => setPhase(phase === entry.id ? null : entry.id)}>
            {entry.name}
          </Chip>
        ))}
        <span className="w-px shrink-0 bg-border" />
        {focusTags.map((tag) => (
          <Chip key={tag} active={focus === tag} onClick={() => setFocus(focus === tag ? null : tag)}>
            {tag}
          </Chip>
        ))}
      </div>

      {phases.map((entry) => {
        const list = shown.filter((exercise) => exercise.phase === entry.id);
        if (list.length === 0) return null;
        return (
          <section key={entry.id} aria-label={entry.name} className="space-y-1.5">
            <h3 className="px-1 text-sm font-medium text-muted-foreground">
              {entry.name} ({list.length})
            </h3>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {list.map((exercise) => (
                <li key={exercise.id}>
                  <Link href={`${PATH}?exercise=${exercise.id}`} className="flex gap-3 p-3 active:bg-accent">
                    <Court diagram={exercise.diagram} horizontal className="w-20 shrink-0 self-start" />
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="flex items-center gap-1.5 font-medium">
                        {favorites.has(exercise.id) && <StarIcon className="size-3.5 shrink-0 fill-amber-400 text-amber-500" />}
                        {exercise.name}
                      </span>
                      <span className="line-clamp-2 block text-sm text-muted-foreground">{exercise.summary}</span>
                    </span>
                    <span className="shrink-0 font-mono text-sm text-muted-foreground">{exercise.minutes}′</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {shown.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nichts gefunden.</p>}
    </div>
  );
}
