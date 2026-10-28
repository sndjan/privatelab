"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  DicesIcon,
  Loader2Icon,
  SparklesIcon,
  MinusIcon,
  PalmtreeIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { planWithAi, saveSession, setFavorite } from "./actions";
import { Court } from "./court";
import {
  fitsPlayers,
  focusTags,
  formatClock,
  formatSessionDate,
  generatePlan,
  holidayOn,
  nextTrainingDate,
  phaseName,
  playersLabel,
  phases,
  pickExercise,
  timeline,
  todayInGermany,
  type Exercise,
  type Group,
  type Holiday,
  type Phase,
  type PlanItem,
  type StandIn,
} from "./data";
import { Chip } from "./exercise-form";

const PATH = "/m/tennis";
const durations = [45, 60, 75, 90];
const NO_GROUP = "none";

export type PlannerValues = {
  groupId: string | null;
  date: string;
  startTime: string;
  minutes: number;
  focus: string | null;
  plan: PlanItem[];
};

// Plans a session: the server hands in a generated plan for the chosen group,
// every change (dice, swap, minutes, order) happens here until it is saved.
export function Planner({
  sessionId,
  groups,
  exercises,
  favorites: savedFavorites,
  recent,
  players,
  absent,
  holidays,
  standIns,
  initial,
}: {
  sessionId: string | null;
  groups: Group[];
  exercises: Exercise[];
  // "groupId:exerciseId"
  favorites: string[];
  // Exercise ids of each group's last sessions.
  recent: Record<string, string[]>;
  // Kids per group, and how many of the session's group cancelled.
  players: Record<string, number>;
  absent: number;
  holidays: Holiday[];
  standIns: StandIn[];
  initial: PlannerValues;
}) {
  const [values, setValues] = useState(initial);
  const [favorites, setFavorites] = useState(() => new Set(savedFavorites));
  const [picking, setPicking] = useState<{ index: number | null; phase: Phase } | null>(null);
  const [pending, startTransition] = useTransition();
  const [, startFavorite] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const plan = values.plan.filter((item) => byId.has(item.exerciseId));
  const ranges = timeline(values.startTime, plan);
  const total = plan.reduce((sum, item) => sum + item.minutes, 0);
  const isFavorite = (exerciseId: string) => values.groupId !== null && favorites.has(`${values.groupId}:${exerciseId}`);
  const holiday = holidayOn(values.date, holidays);

  // The kids who come: the group's players minus those who cancelled. Null
  // (any exercise fits) when the group has no players entered.
  function kids(groupId = values.groupId) {
    if (!groupId || !players[groupId]) return null;
    return Math.max(0, players[groupId] - (sessionId && groupId === initial.groupId ? absent : 0));
  }
  const kidCount = kids();

  function context(groupId = values.groupId, focus = values.focus) {
    return {
      exercises,
      favorites: new Set(exercises.filter((exercise) => groupId && favorites.has(`${groupId}:${exercise.id}`)).map((exercise) => exercise.id)),
      recent: new Set(groupId ? recent[groupId] ?? [] : []),
      focus,
      players: kids(groupId),
    };
  }

  function update(change: Partial<PlannerValues>, regenerate = false) {
    const next = { ...values, ...change };
    if (regenerate) next.plan = generatePlan(next.minutes, context(next.groupId, next.focus));
    setValues(next);
  }

  function setPlan(next: PlanItem[]) {
    setValues({ ...values, plan: next });
  }

  function reroll(index: number) {
    const current = byId.get(plan[index].exerciseId)!;
    const taken = new Set(plan.map((item) => item.exerciseId));
    const exercise = pickExercise(current.phase, context(), taken);
    if (exercise) setPlan(plan.map((item, at) => (at === index ? { ...item, exerciseId: exercise.id } : item)));
    else toast.info(`Keine andere Übung für ${phaseName(current.phase)} in der Sammlung.`);
  }

  function pick(exercise: Exercise) {
    if (!picking) return;
    if (picking.index === null) setPlan([...plan, { exerciseId: exercise.id, minutes: exercise.minutes }]);
    else setPlan(plan.map((item, at) => (at === picking.index ? { ...item, exerciseId: exercise.id } : item)));
    setPicking(null);
  }

  function move(index: number, by: number) {
    const next = [...plan];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    setPlan(next);
  }

  function toggleFavorite(exerciseId: string) {
    const groupId = values.groupId;
    if (!groupId) return;
    const key = `${groupId}:${exerciseId}`;
    const on = !favorites.has(key);
    setFavorites((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
    const group = groups.find((entry) => entry.id === groupId)?.name;
    toast.success(on ? `Lieblingsübung von ${group}` : `Keine Lieblingsübung mehr von ${group}`, { id: `favorite-${exerciseId}` });
    startFavorite(async () => {
      try {
        await setFavorite(groupId, exerciseId, on);
      } catch {
        toast.error("Favorit konnte nicht gespeichert werden.");
      }
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveSession(sessionId, { ...values, plan });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <div className="-ml-2 flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="size-10 text-muted-foreground">
          <Link href={sessionId ? `${PATH}?session=${sessionId}` : PATH} aria-label="Zurück">
            <ChevronLeftIcon className="size-5" />
          </Link>
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">
          {sessionId ? "Stunde bearbeiten" : "Stunde planen"}
        </h2>
      </div>

      <AiPlanner
        values={values}
        onPlan={(next) => {
          const previous = values;
          setValues(next);
          return () => setValues(previous);
        }}
        groups={groups}
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 space-y-2 sm:col-span-1">
              <Label htmlFor="plan-group">Gruppe</Label>
              <Select
                value={values.groupId ?? NO_GROUP}
                onValueChange={(value) => {
                  const group = groups.find((entry) => entry.id === value);
                  update(
                    {
                      groupId: group?.id ?? null,
                      ...(group && !sessionId && { startTime: group.startTime, minutes: group.minutes }),
                      ...(group &&
                        !sessionId && { date: nextTrainingDate(group, todayInGermany(), holidays, standIns) ?? values.date }),
                    },
                    !sessionId,
                  );
                }}
              >
                <SelectTrigger id="plan-group" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_GROUP}>Ohne Gruppe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-date">Datum</Label>
              <Input
                id="plan-date"
                type="date"
                required
                value={values.date}
                onChange={(event) => update({ date: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-time">Beginn</Label>
              <Input
                id="plan-time"
                type="time"
                required
                step={300}
                value={values.startTime}
                onChange={(event) => update({ startTime: event.target.value })}
              />
            </div>
          </div>
          {holiday && (
            <p className="flex items-center gap-2 text-sm text-debt">
              <PalmtreeIcon className="size-4 shrink-0" />
              {formatSessionDate(values.date)}: {holiday.name || "Ferien"}, eigentlich kein Training.
            </p>
          )}
          {kidCount !== null && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <UsersIcon className="size-4 shrink-0" />
              Geplant für {kidCount} {kidCount === 1 ? "Kind" : "Kinder"}
              {sessionId && absent > 0 && ` (${absent} abgesagt)`}
            </p>
          )}

          <div className="space-y-2">
            <span className="text-sm font-medium">Dauer</span>
            <div className="flex flex-wrap gap-1.5">
              {durations.map((minutes) => (
                <Chip key={minutes} active={values.minutes === minutes} onClick={() => update({ minutes }, true)}>
                  {minutes} Min.
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Schwerpunkt (optional)</span>
            <div className="-mx-6 flex gap-1.5 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {focusTags.map((tag) => (
                <Chip
                  key={tag}
                  active={values.focus === tag}
                  onClick={() => update({ focus: values.focus === tag ? null : tag }, true)}
                >
                  {tag}
                </Chip>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted-foreground">
          <span className={cn("font-mono", total !== values.minutes && "text-debt")}>{total} Min.</span>
          {plan.length > 0 && (
            <>
              {" "}
              · {values.startTime}–{formatClock(ranges.at(-1)!.end)}
            </>
          )}
        </p>
        <Button variant="outline" onClick={() => update({}, true)} disabled={exercises.length === 0}>
          <DicesIcon /> Alles neu würfeln
        </Button>
      </div>

      {exercises.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Noch keine Übungen. Lade auf der Startseite die Starter-Sammlung.
        </p>
      )}

      <ol className="space-y-2">
        {plan.map((item, index) => {
          const exercise = byId.get(item.exerciseId)!;
          return (
            // The key changes when an exercise is swapped, so the new one fades in.
            <li key={`${index}-${item.exerciseId}`} className="rounded-xl border bg-card p-3 shadow-xs animate-in fade-in-0 zoom-in-[0.98] duration-300">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPicking({ index, phase: exercise.phase })}
                  className="w-16 shrink-0 cursor-pointer"
                  aria-label={`${exercise.name} austauschen`}
                >
                  <Court diagram={exercise.diagram} className="w-full" />
                </button>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">
                      {formatClock(ranges[index].start)}–{formatClock(ranges[index].end)}
                    </span>{" "}
                    · {phaseName(exercise.phase)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPicking({ index, phase: exercise.phase })}
                    className="block cursor-pointer text-left leading-tight font-medium"
                  >
                    {exercise.name}
                  </button>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{exercise.summary}</p>
                  {!fitsPlayers(exercise, kidCount) && (
                    <p className="text-xs text-debt">Passt nicht für {kidCount} Kinder ({playersLabel(exercise)})</p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-0.5">
                <Button variant="ghost" size="icon" aria-label="Kürzer" onClick={() => setPlan(plan.map((entry, at) => (at === index ? { ...entry, minutes: Math.max(5, entry.minutes - 5) } : entry)))}>
                  <MinusIcon />
                </Button>
                <span className="w-16 text-center font-mono text-sm whitespace-nowrap">{item.minutes} Min.</span>
                <Button variant="ghost" size="icon" aria-label="Länger" onClick={() => setPlan(plan.map((entry, at) => (at === index ? { ...entry, minutes: Math.min(90, entry.minutes + 5) } : entry)))}>
                  <PlusIcon />
                </Button>
                <div className="ml-auto flex items-center gap-0.5 text-muted-foreground">
                  {values.groupId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-pressed={isFavorite(exercise.id)}
                      aria-label="Lieblingsübung der Gruppe"
                      title="Lieblingsübung der Gruppe"
                      onClick={() => toggleFavorite(exercise.id)}
                    >
                      <StarIcon className={cn(isFavorite(exercise.id) && "fill-amber-400 text-amber-500")} />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" aria-label="Andere Übung würfeln" title="Andere Übung" onClick={() => reroll(index)}>
                    <DicesIcon />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Nach oben" disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUpIcon />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Nach unten" disabled={index === plan.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDownIcon />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Entfernen" onClick={() => setPlan(plan.filter((_, at) => at !== index))}>
                    <XIcon />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {exercises.length > 0 && (
        <Button variant="ghost" className="w-full border border-dashed" onClick={() => setPicking({ index: null, phase: "game" })}>
          <PlusIcon /> Übung hinzufügen
        </Button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-2xl justify-end">
        <Button size="lg" className="shadow-lg" onClick={save} disabled={pending || plan.length === 0 || !values.date || !values.startTime}>
          {pending && <Loader2Icon className="animate-spin" />}
          {sessionId ? "Speichern" : "Stunde speichern"}
        </Button>
      </div>

      <ExercisePicker
        open={picking !== null}
        onOpenChange={(open) => !open && setPicking(null)}
        exercises={exercises}
        initialPhase={picking?.phase ?? "game"}
        isFavorite={isFavorite}
        kids={kidCount}
        onPick={pick}
      />
    </div>
  );
}

function ExercisePicker({
  open,
  onOpenChange,
  exercises,
  initialPhase,
  isFavorite,
  kids,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: Exercise[];
  initialPhase: Phase;
  isFavorite: (id: string) => boolean;
  kids: number | null;
  onPick: (exercise: Exercise) => void;
}) {
  const [phase, setPhase] = useState<Phase | null>(initialPhase);
  const [query, setQuery] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  // Each opening starts on the phase of the exercise being replaced.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPhase(initialPhase);
      setQuery("");
    }
  }

  const search = query.trim().toLowerCase();
  const shown = exercises
    .filter((exercise) => (search ? `${exercise.name} ${exercise.summary}`.toLowerCase().includes(search) : !phase || exercise.phase === phase))
    .sort(
      (a, b) =>
        Number(fitsPlayers(b, kids)) - Number(fitsPlayers(a, kids)) ||
        Number(isFavorite(b.id)) - Number(isFavorite(a.id)) ||
        a.name.localeCompare(b.name, "de"),
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col">
        <DialogHeader>
          <DialogTitle>Übung wählen</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Suchen" aria-label="Suchen" className="pl-9" />
        </div>
        {!search && (
          <div className="flex flex-wrap gap-1.5">
            {phases.map((entry) => (
              <Chip key={entry.id} active={phase === entry.id} onClick={() => setPhase(phase === entry.id ? null : entry.id)}>
                {entry.name}
              </Chip>
            ))}
          </div>
        )}
        <ul className="-mx-2 min-h-0 flex-1 divide-y overflow-y-auto">
          {shown.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => onPick(exercise)}
                className={cn(
                  "flex w-full cursor-pointer gap-3 rounded-lg p-2 text-left hover:bg-accent",
                  !fitsPlayers(exercise, kids) && "opacity-50",
                )}
              >
                <Court diagram={exercise.diagram} className="w-10 shrink-0" />
                <span className="min-w-0 space-y-0.5">
                  <span className="flex items-center gap-1 font-medium">
                    {isFavorite(exercise.id) && <StarIcon className="size-3.5 fill-amber-400 text-amber-500" />}
                    {exercise.name}
                  </span>
                  <span className="line-clamp-2 block text-sm text-muted-foreground">{exercise.summary}</span>
                  {playersLabel(exercise) && <span className="block text-xs text-muted-foreground">{playersLabel(exercise)}</span>}
                </span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Nichts gefunden.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

// "Mit KI planen": a sentence in, a plan out. Applies the plan to the
// planner (nothing is saved yet) and offers to undo it.
function AiPlanner({
  values,
  onPlan,
  groups,
}: {
  values: PlannerValues;
  // Returns a function that restores the plan before.
  onPlan: (next: PlannerValues) => () => void;
  groups: Group[];
}) {
  const [request, setRequest] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ask() {
    if (!request.trim() || pending) return;
    setError(null);
    setNote(null);
    startTransition(async () => {
      try {
        const result = await planWithAi(request, values.groupId, values.date);
        if (result.error !== null) {
          setError(result.error);
          return;
        }
        const group = groups.find((entry) => entry.id === (result.groupId ?? values.groupId));
        const minutes = result.plan.reduce((sum, item) => sum + item.minutes, 0);
        const undo = onPlan({
          groupId: group?.id ?? values.groupId,
          date: result.date ?? values.date,
          startTime: result.startTime ?? (result.groupId && group ? group.startTime : values.startTime),
          minutes,
          focus: result.focus,
          plan: result.plan,
        });
        setNote(
          [result.created.length > 0 && `Neu in der Sammlung: ${result.created.join(", ")}.`, result.note].filter(Boolean).join(" ") ||
            null,
        );
        toast.success("Stunde geplant, schau sie dir an und speichere", { action: { label: "Rückgängig", onClick: undo } });
      } catch {
        setError("Die KI ist gerade nicht erreichbar.");
      }
    });
  }

  return (
    <Card className="gap-3 py-4">
      <CardContent className="space-y-2 px-4">
        <label htmlFor="ai-plan" className="flex items-center gap-2 text-sm font-medium">
          <SparklesIcon className="size-4 text-brand" /> Mit KI planen
        </label>
        <Textarea
          id="ai-plan"
          rows={2}
          maxLength={1000}
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey || !event.shiftKey) && !event.nativeEvent.isComposing) {
              event.preventDefault();
              ask();
            }
          }}
          placeholder="z. B. Vorhandfokus für die U10, zum Aufwärmen Tic Tac Toe und zwei Spiele"
          enterKeyHint="send"
          className="min-h-0 resize-none"
        />
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            Nimmt Übungen aus deiner Sammlung, legt fehlende neu an. Gespeichert wird erst mit „Stunde speichern“.
          </p>
          <Button variant="brand" size="sm" onClick={ask} disabled={pending || !request.trim()}>
            {pending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            {pending ? "Plant …" : "Planen"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {note && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{note}</p>}
      </CardContent>
    </Card>
  );
}
