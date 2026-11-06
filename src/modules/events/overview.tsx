"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckIcon, EllipsisVerticalIcon, GripVerticalIcon, PencilIcon, PlusIcon, SquarePenIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { addEntry, createTypes, deleteEntry, endSpan, reopenSpan, reorderTypes } from "./actions";
import { formatDays, goalState, lastEntry, relativeDay, runningSpan, sinceDay, spanDays, type GoalState } from "./calc";
import { colorHex, periodNames, starterTypes, unitName, type Entry, type EventType } from "./data";
import { isTemp, tempId, useChange, useDialogs, useEventsData } from "./store";
import { TypeIcon } from "./ui";

export function Overview({ today }: { today: string }) {
  const { types, entries } = useEventsData();
  const change = useChange();
  const { openType } = useDialogs();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dndId = useId();

  if (types.length === 0) return <Starters />;

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = types.map((type) => type.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    void change(
      (data) => ({
        types: next.map((id, position) => ({ ...data.types.find((type) => type.id === id)!, position })),
      }),
      () => reorderTypes(next.filter((id) => !isTemp(id))),
    );
  }

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={types.map((type) => type.id)} strategy={rectSortingStrategy}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {types.map((type) => (
            <Tile key={type.id} type={type} entries={entries} today={today} />
          ))}
          <li>
            <button
              type="button"
              onClick={() => openType()}
              className="flex h-full min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              <PlusIcon className="size-5" />
              Neuer Typ
            </button>
          </li>
        </ul>
      </SortableContext>
    </DndContext>
  );
}

// --- One tile ---------------------------------------------------------------

function Tile({ type, entries, today }: { type: EventType; entries: Entry[]; today: string }) {
  const change = useChange();
  const { openEntry, openType } = useDialogs();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: type.id,
  });
  const running = runningSpan(type, entries);
  const last = lastEntry(type, entries, today);
  const goal = goalState(type, entries, today);
  const color = colorHex(type.color);
  const todayCount = type.kind === "moment" ? entries.filter((e) => e.typeId === type.id && e.startDate === today).length : 0;

  // One tap: a moment for today, or a span starting today. Types with an
  // amount open the form, since the amount is the point of the entry.
  function quickLog() {
    if (isTemp(type.id)) return;
    if (running) return openEntry({ entry: running });
    if (type.trackAmount) return openEntry({ typeId: type.id });
    const optimistic: Entry = { id: tempId(), typeId: type.id, startDate: today, endDate: null, note: "", amount: null, rating: null };
    const input = { ...optimistic, id: undefined };
    const saved = change((data) => ({ entries: [optimistic, ...data.entries] }), () => addEntry(input));
    toast.success(type.kind === "span" ? `${type.name}: läuft seit heute` : `${type.name} eingetragen`, {
      action: {
        label: "Rückgängig",
        onClick: () => {
          void saved.then((id) =>
            change(
              (data) => ({ entries: data.entries.filter((entry) => entry.id !== optimistic.id && entry.id !== id) }),
              async () => {
                if (id) await deleteEntry(id);
              },
            ),
          );
        },
      },
    });
  }

  function end(entry: Entry) {
    if (isTemp(entry.id)) return;
    const endDate = entry.startDate > today ? entry.startDate : today;
    void change(
      (data) => ({ entries: data.entries.map((other) => (other.id === entry.id ? { ...other, endDate } : other)) }),
      () => endSpan(entry.id, endDate),
    );
    toast.success(`${type.name}: beendet nach ${formatDays(spanDays({ ...entry, endDate }, today))}`, {
      action: {
        label: "Rückgängig",
        onClick: () =>
          void change(
            (data) => ({ entries: data.entries.map((other) => (other.id === entry.id ? { ...other, endDate: null } : other)) }),
            () => reopenSpan(entry.id),
          ),
      },
    });
  }

  const status = running
    ? `läuft ${sinceDay(running.startDate, today)}`
    : !last
      ? "noch nie"
      : type.kind === "span"
        ? `zuletzt ${relativeDay(last.endDate ?? today, today)} · ${formatDays(spanDays(last, today))}`
        : todayCount > 0
          ? `heute${todayCount > 1 ? ` ${todayCount}×` : ""}`
          : `zuletzt ${relativeDay(last.startDate, today)}`;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        borderColor: running ? color : undefined,
        backgroundColor: running ? `${color}1a` : undefined,
      }}
      className={cn(
        "relative flex min-h-36 flex-col rounded-xl border bg-card shadow-xs",
        running && "border-2",
        isDragging && "z-10 shadow-lg",
      )}
    >
      {/* The whole tile logs; the controls on top of it do their own thing. */}
      <button
        type="button"
        onClick={quickLog}
        aria-label={
          running ? `${type.name} bearbeiten` : type.kind === "span" ? `${type.name} ab heute starten` : `${type.name} heute eintragen`
        }
        className="absolute inset-0 cursor-pointer rounded-xl transition-colors hover:bg-muted/40 active:bg-muted/70"
      />
      <div className="pointer-events-none relative flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start gap-2">
          <TypeIcon type={type} />
          <div className="pointer-events-auto -mt-1 -mr-1.5 ml-auto flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`${type.name}: mehr`}>
                  <EllipsisVerticalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={isTemp(type.id)}
                  onSelect={() => openEntry(running ? { entry: running } : { typeId: type.id })}
                >
                  <SquarePenIcon /> {running ? "Laufenden Eintrag bearbeiten" : "Mit Details eintragen …"}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isTemp(type.id)} onSelect={() => openType(type)}>
                  <PencilIcon /> Typ bearbeiten
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`${type.name} verschieben`}
              className="flex size-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
            >
              <GripVerticalIcon className="size-4" />
            </button>
          </div>
        </div>
        <div className="min-w-0">
          <h2 className="leading-tight font-semibold break-words">{type.name}</h2>
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>
        {goal && type.goal && <GoalBar type={type} goal={goal} color={color} />}
        {running && (
          <Button
            size="sm"
            variant="outline"
            className="pointer-events-auto mt-auto w-full bg-background"
            onClick={() => end(running)}
          >
            <CheckIcon /> Beendet
          </Button>
        )}
      </div>
    </li>
  );
}

function GoalBar({ type, goal, color }: { type: EventType; goal: GoalState; color: string }) {
  const { kind, period } = type.goal!;
  const share = goal.target === 0 ? (goal.value > 0 ? 1 : 0) : Math.min(1, goal.value / goal.target);
  const note = { ok: null, at: "Grenze erreicht", over: "überschritten", open: null, reached: "geschafft" }[goal.status];
  return (
    <div className="mt-auto space-y-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn("h-full rounded-full", goal.status === "over" && "bg-destructive")}
          style={{ width: `${share * 100}%`, backgroundColor: goal.status === "over" ? undefined : color }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{goal.value}</span> / {kind === "max" ? "max." : "min."}{" "}
        {goal.target}
        {type.kind === "span" ? ` ${unitName("span", goal.target)}` : "×"} {periodNames[period].this}
        {note && (
          <span
            className={cn(
              "ml-1 font-medium",
              goal.status === "over" && "text-destructive",
              goal.status === "reached" && "text-green-600 dark:text-green-500",
            )}
          >
            · {note}
          </span>
        )}
      </p>
    </div>
  );
}

// --- Empty module -------------------------------------------------------------

function Starters() {
  const { openType } = useDialogs();
  const change = useChange();
  const [picked, setPicked] = useState<string[]>(starterTypes.map((type) => type.name));

  function create() {
    const chosen = starterTypes.filter((type) => picked.includes(type.name));
    if (chosen.length === 0) return;
    void change(
      () => ({ types: chosen.map((type, position) => ({ ...type, id: tempId(), position })) }),
      () => createTypes(chosen),
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Was willst du festhalten?</h2>
        <p className="text-sm text-muted-foreground">
          Leg ein paar Typen an. Danach trägt ein Tipp auf die Kachel heute ein. Alles lässt sich später ändern.
        </p>
      </div>
      <ul className="space-y-1">
        {starterTypes.map((type) => (
          <li key={type.name}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-muted/50">
              <Checkbox
                checked={picked.includes(type.name)}
                onCheckedChange={(checked) =>
                  setPicked((current) => (checked ? [...current, type.name] : current.filter((name) => name !== type.name)))
                }
              />
              <TypeIcon type={type} className="size-8 text-base" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{type.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {[
                    type.kind === "span" ? "Zeitraum" : "Moment",
                    type.trackAmount && `Menge (${type.amountUnit})`,
                    type.trackRating && "Bewertung",
                    type.goal &&
                      `${type.goal.kind === "max" ? "max." : "min."} ${type.goal.count}× ${periodNames[type.goal.period].per}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="brand" className="flex-1" disabled={picked.length === 0} onClick={create}>
          {picked.length === 1 ? "1 Typ anlegen" : `${picked.length} Typen anlegen`}
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => openType()}>
          <PlusIcon /> Eigener Typ
        </Button>
      </div>
    </div>
  );
}
