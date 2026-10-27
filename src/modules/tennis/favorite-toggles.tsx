"use client";

import { StarIcon } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setFavorite } from "./actions";

// One star per group: favorites come up about four times as often when
// planning a session for that group.
export function FavoriteToggles({
  exerciseId,
  groups,
  favoriteGroupIds,
}: {
  exerciseId: string;
  groups: { id: string; name: string }[];
  favoriteGroupIds: string[];
}) {
  const [favorites, toggle] = useOptimistic(new Set(favoriteGroupIds), (current, groupId: string) => {
    const next = new Set(current);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    return next;
  });
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-1.5">
      {groups.map((group) => {
        const on = favorites.has(group.id);
        return (
          <button
            key={group.id}
            type="button"
            aria-pressed={on}
            onClick={() =>
              startTransition(async () => {
                toggle(group.id);
                await setFavorite(group.id, exerciseId, !on);
              })
            }
            className={cn(
              "flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
              on ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100" : "bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            <StarIcon className={cn("size-4", on && "fill-amber-400 text-amber-500")} />
            {group.name}
          </button>
        );
      })}
    </div>
  );
}
