"use client";

import { FlagIcon } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { setRunItem } from "./actions";

export type RunItem = {
  id: string;
  name: string;
  note: string | null;
  kind: "pack" | "task";
  done: boolean;
  forgotten: boolean;
  pinned: boolean;
  atDestination: boolean;
};

type Patch = { id: string; done?: boolean; forgotten?: boolean };

// The run's checklist. Ticks and flags update at once and save in the background.
export function RunChecklist({ items: saved, destination }: { items: RunItem[]; destination: string | null }) {
  const [items, apply] = useOptimistic(saved, (current, patch: Patch) =>
    current.map((item) => (item.id === patch.id ? { ...item, ...patch } : item)),
  );
  const [, startTransition] = useTransition();

  function update(patch: Patch) {
    startTransition(async () => {
      apply(patch);
      const { id, ...values } = patch;
      await setRunItem(id, values);
    });
  }

  const needed = items.filter((item) => !item.atDestination);
  const doneCount = needed.filter((item) => item.done).length;
  const pinned = needed.filter((item) => item.pinned);
  const pack = needed.filter((item) => !item.pinned && item.kind === "pack");
  const tasks = needed.filter((item) => !item.pinned && item.kind === "task");
  const there = items.filter((item) => item.atDestination);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            {doneCount} von {needed.length} erledigt
          </span>
          {doneCount === needed.length && needed.length > 0 && (
            <span className="font-medium text-brand">Alles dabei</span>
          )}
        </div>
        <Progress
          value={needed.length ? (doneCount / needed.length) * 100 : 0}
          aria-label="Fortschritt"
          className="h-2 bg-muted"
          indicatorClassName="bg-brand"
        />
      </div>

      {pinned.length > 0 && (
        <Section
          title="Letztes Mal vergessen"
          description="Diese Sachen fehlten bei der letzten Reise."
          items={pinned}
          onChange={update}
          className="border-bad bg-bad/40"
        />
      )}
      {pack.length > 0 && <Section title="Einpacken" items={pack} onChange={update} />}
      {tasks.length > 0 && <Section title="Vor der Abfahrt erledigen" items={tasks} onChange={update} />}
      {there.length > 0 && (
        <Section
          title={destination ? `Schon in ${destination}` : "Schon am Ziel"}
          description="Laut Inventar schon dort, musst du nicht mitnehmen."
          items={there}
          onChange={update}
          muted
        />
      )}
    </div>
  );
}

function Section({
  title,
  description,
  items,
  onChange,
  className,
  muted = false,
}: {
  title: string;
  description?: string;
  items: RunItem[];
  onChange: (patch: Patch) => void;
  className?: string;
  muted?: boolean;
}) {
  // Open items first, so the list shrinks as you pack.
  const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {sorted.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-1">
              <label
                className={cn(
                  "flex min-h-12 flex-1 cursor-pointer items-center gap-3",
                  (item.done || muted) && "text-muted-foreground",
                )}
              >
                <Checkbox
                  checked={item.done}
                  onCheckedChange={(checked) => onChange({ id: item.id, done: checked === true })}
                  className="size-5"
                />
                <span className="flex flex-col">
                  <span className={cn(item.done && "line-through")}>{item.name}</span>
                  {item.note && <span className="text-xs text-muted-foreground">{item.note}</span>}
                </span>
              </label>
              {!muted && (
                <button
                  type="button"
                  aria-pressed={item.forgotten}
                  aria-label={`${item.name} als vergessen markieren`}
                  title="Vergessen? Dann steht es nächstes Mal oben."
                  onClick={() => onChange({ id: item.id, forgotten: !item.forgotten })}
                  className={cn(
                    "inline-flex size-11 cursor-pointer items-center justify-center rounded-md hover:bg-accent",
                    item.forgotten ? "text-debt" : "text-muted-foreground/60",
                  )}
                >
                  <FlagIcon className={cn("size-4", item.forgotten && "fill-current")} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
