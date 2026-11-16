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
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeftRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CopyIcon,
  CrosshairIcon,
  FlagIcon,
  DicesIcon,
  GripVerticalIcon,
  InfoIcon,
  Loader2Icon,
  SparklesIcon,
  StickyNoteIcon,
  MinusIcon,
  PalmtreeIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { ViewLink as Link } from "@/lib/query/view-link";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { planWithAi, saveSession, setExerciseTeilziel, setFavorite } from "./actions";
import { Court } from "./court";
import {
  fitsGroup,
  fitsPlayers,
  fitsStage,
  showsMidcourt,
  stageName,
  focusTags,
  formatClock,
  formatSessionDate,
  generatePlan,
  holidayOn,
  keepNotes,
  nextTrainingDate,
  phaseName,
  playersLabel,
  phases,
  pickExercise,
  teilzielOf,
  timeline,
  todayInGermany,
  type Exercise,
  type Group,
  type Holiday,
  type Phase,
  type Stage,
  type PlanItem,
  type Session,
  type StandIn,
} from "./data";
import { ExerciseDetails } from "./exercise-details";
import { Chip } from "./exercise-form";
import { TeilzielLine, TeilzielPicker } from "./teilziel-picker";

const PATH = "/m/tennis";
const durations = [45, 60, 75, 90];
const NO_GROUP = "none";

export type PlannerValues = {
  groupId: string | null;
  date: string;
  startTime: string;
  minutes: number;
  focus: string | null;
  // The Stundenziel, e.g. "Vorhand-Drive".
  goal: string;
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
  sessions,
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
  // The other sessions, newest first: to take exercises from and for the
  // group's last notes.
  sessions: Session[];
  initial: PlannerValues;
}) {
  const [values, setValues] = useState(initial);
  // The plan item whose Teilziel is being picked.
  const [choosingGoal, setChoosingGoal] = useState<number | null>(null);
  const [favorites, setFavorites] = useState(() => new Set(savedFavorites));
  const [picking, setPicking] = useState<{ index: number | null; phase: Phase } | null>(null);
  // The plan item whose details are open.
  const [showing, setShowing] = useState<number | null>(null);
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
  const groupOf = (groupId: string | null) => groups.find((group) => group.id === groupId);
  const group = groupOf(values.groupId);
  const fits = (exercise: Exercise) => fitsGroup(exercise, { players: kidCount, stage: group?.stage, serves: group?.serves });

  function context(groupId = values.groupId, focus = values.focus) {
    return {
      stage: groupOf(groupId)?.stage,
      serves: groupOf(groupId)?.serves,
      exercises,
      favorites: new Set(exercises.filter((exercise) => groupId && favorites.has(`${groupId}:${exercise.id}`)).map((exercise) => exercise.id)),
      recent: new Set(groupId ? recent[groupId] ?? [] : []),
      focus,
      players: kids(groupId),
    };
  }

  function update(change: Partial<PlannerValues>, regenerate = false) {
    const next = { ...values, ...change };
    if (regenerate) {
      next.plan = generatePlan(next.minutes, context(next.groupId, next.focus), Math.random, {
        gamesBetween: groupOf(next.groupId)?.gamesBetween,
      });
    }
    setValues(next);
  }

  function setPlan(next: PlanItem[]) {
    setValues({ ...values, plan: next });
  }

  function reroll(index: number) {
    const current = byId.get(plan[index].exerciseId)!;
    const taken = new Set(plan.map((item) => item.exerciseId));
    const exercise = pickExercise(current.phase, context(), taken);
    // A note was about the old exercise, so it goes with it.
    if (exercise) setPlan(plan.map((item, at) => (at === index ? { exerciseId: exercise.id, minutes: item.minutes } : item)));
    else toast.info(`Keine andere Übung für ${phaseName(current.phase)} in der Sammlung.`);
  }

  function pick(exercise: Exercise) {
    if (!picking) return;
    if (picking.index === null) setPlan([...plan, { exerciseId: exercise.id, minutes: exercise.minutes }]);
    else setPlan(plan.map((item, at) => (at === picking.index ? { exerciseId: exercise.id, minutes: item.minutes } : item)));
    setPicking(null);
  }

  // Ids for drag and drop: the exercise, numbered if it is in the plan twice.
  // Swapping an exercise changes the id, so the new one fades in.
  const itemIds = plan.map(
    (item, index) => `${item.exerciseId}#${plan.slice(0, index).filter((entry) => entry.exerciseId === item.exerciseId).length}`,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dndId = useId();

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setPlan(arrayMove(plan, itemIds.indexOf(String(active.id)), itemIds.indexOf(String(over.id))));
  }

  // undefined = no note field; "" = an open, empty one.
  function setNote(index: number, note: string | undefined) {
    setPlan(
      plan.map((entry, at) => {
        if (at !== index) return entry;
        const base: PlanItem = { ...entry };
        delete base.note;
        return note === undefined ? base : { ...base, note };
      }),
    );
  }

  // A Teilziel for this session; the exercise's own one needs no override.
  function setGoal(index: number, goal: string, asDefault: boolean) {
    const exercise = byId.get(plan[index].exerciseId)!;
    if (asDefault) {
      setExerciseTeilziel(exercise.id, goal).then(
        () => toast.success(goal ? `„${goal}“ ist jetzt das Teilziel von ${exercise.name}` : `${exercise.name} hat kein Teilziel mehr`),
        () => toast.error("Standard konnte nicht gespeichert werden."),
      );
    }
    setPlan(
      plan.map((entry, at) => {
        if (at !== index) return entry;
        const base: PlanItem = { ...entry };
        delete base.goal;
        return goal === exercise.teilziel && !asDefault ? base : { ...base, goal };
      }),
    );
  }

  function setMinutes(index: number, by: number) {
    setPlan(plan.map((entry, at) => (at === index ? { ...entry, minutes: Math.min(90, Math.max(1, entry.minutes + by)) } : entry)));
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
    <div className="mx-auto max-w-2xl space-y-4 pb-24 lg:max-w-6xl">
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-6">
      <div className="min-w-0 space-y-4 lg:col-start-2 lg:row-start-1">
        <AiPlanner
          values={values}
          onPlan={(next) => {
            const previous = values;
            setValues(next);
            return () => setValues(previous);
          }}
          groups={groups}
        />
        <CopyPanel
          sessions={sessions}
          groups={groups}
          group={group}
          byId={byId}
          onCopy={(items, replace, source) => {
            const previous = values;
            setValues({
              ...values,
              plan: replace ? items : [...plan, ...items],
              goal: values.goal || source.goal,
            });
            toast.success(
              `${items.length === 1 ? "1 Übung" : `${items.length} Übungen`} ${replace ? "übernommen" : "angehängt"}`,
              { action: { label: "Rückgängig", onClick: () => setValues(previous) } },
            );
          }}
        />
      </div>

      <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
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

          <GoalField
            value={values.goal}
            onChange={(goal) => update({ goal })}
            recent={[
              ...new Set(
                sessions
                  .filter((session) => session.goal && (!values.groupId || session.groupId === values.groupId))
                  .map((session) => session.goal),
              ),
            ]
              .filter((goal) => goal !== values.goal)
              .slice(0, 4)}
          />

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

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {plan.map((item, index) => {
              const exercise = byId.get(item.exerciseId)!;
              return (
                <PlanRow key={itemIds[index]} id={itemIds[index]}>
                  {(handle) => (
                    <>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowing(index)}
                          className="w-24 shrink-0 cursor-pointer self-start"
                          aria-label={`${exercise.name}: Details`}
                        >
                          <Court diagram={exercise.diagram} horizontal midcourt={showsMidcourt(exercise, group?.stage)} className="w-full" />
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
                            onClick={() => setShowing(index)}
                            className="block cursor-pointer text-left leading-tight font-medium"
                          >
                            {exercise.name}
                          </button>
                          <p className="line-clamp-2 text-sm text-muted-foreground">{exercise.summary}</p>
                          <FitWarnings exercise={exercise} kids={kidCount} group={group} />
                          <button
                            type="button"
                            onClick={() => setChoosingGoal(index)}
                            className={cn(
                              "-mx-1.5 mt-1 flex min-h-9 cursor-pointer items-center rounded-lg px-1.5 py-1 text-left text-sm hover:bg-accent",
                              teilzielOf(item, exercise) ? "bg-good/60 text-good-foreground" : "text-muted-foreground",
                            )}
                            aria-label={`Teilziel für ${exercise.name}`}
                          >
                            {teilzielOf(item, exercise) ? (
                              <TeilzielLine value={teilzielOf(item, exercise)} withSay />
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <CrosshairIcon className="size-4" /> Teilziel festlegen
                              </span>
                            )}
                          </button>
                        </div>
                        {handle}
                      </div>
                      {item.note !== undefined && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-100 px-2.5 py-1.5 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100">
                          <StickyNoteIcon className="mt-1.5 size-4 shrink-0" />
                          <Textarea
                            aria-label={`Notiz zu ${exercise.name}`}
                            autoFocus={item.note === ""}
                            rows={1}
                            maxLength={300}
                            value={item.note}
                            onChange={(event) => setNote(index, event.target.value)}
                            onBlur={(event) => !event.target.value.trim() && setNote(index, undefined)}
                            placeholder="z. B. noch ein Hütchen dazustellen"
                            className="field-sizing-content min-h-0 resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
                          />
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" aria-label="1 Minute kürzer" onClick={() => setMinutes(index, -1)}>
                          <MinusIcon />
                        </Button>
                        <span className="w-16 text-center font-mono text-sm whitespace-nowrap">{item.minutes} Min.</span>
                        <Button variant="ghost" size="icon" aria-label="1 Minute länger" onClick={() => setMinutes(index, 1)}>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Notiz zu dieser Übung"
                            title="Notiz"
                            aria-pressed={item.note !== undefined}
                            onClick={() => setNote(index, item.note ?? "")}
                          >
                            <StickyNoteIcon className={cn(item.note && "text-amber-500")} />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Andere Übung würfeln" title="Würfeln" onClick={() => reroll(index)}>
                            <DicesIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Übung austauschen"
                            title="Austauschen"
                            onClick={() => setPicking({ index, phase: exercise.phase })}
                          >
                            <ArrowLeftRightIcon />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Entfernen" title="Entfernen" onClick={() => setPlan(plan.filter((_, at) => at !== index))}>
                            <XIcon />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </PlanRow>
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>

      {exercises.length > 0 && (
        <Button variant="ghost" className="w-full border border-dashed" onClick={() => setPicking({ index: null, phase: "game" })}>
          <PlusIcon /> Übung hinzufügen
        </Button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="min-w-0 space-y-4 lg:col-start-2 lg:row-start-2">
        <LastSession sessions={sessions} groupId={values.groupId} date={values.date} />
        {group && <ClosingPreview group={group} />}
      </div>
      </div>

      <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-2xl justify-end lg:max-w-6xl">
        <Button size="lg" className="shadow-lg" onClick={save} disabled={pending || plan.length === 0 || !values.date || !values.startTime}>
          {pending && <Loader2Icon className="animate-spin" />}
          {sessionId ? "Speichern" : "Stunde speichern"}
        </Button>
      </div>

      <ExerciseDialog
        exercise={showing !== null && plan[showing] ? (byId.get(plan[showing].exerciseId) ?? null) : null}
        groupStage={group?.stage}
        warnings={(exercise) => <FitWarnings exercise={exercise} kids={kidCount} group={group} />}
        onOpenChange={(open) => !open && setShowing(null)}
        actions={
          showing !== null && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  reroll(showing);
                }}
              >
                <DicesIcon /> Würfeln
              </Button>
              <Button
                onClick={() => {
                  const exercise = byId.get(plan[showing].exerciseId)!;
                  setShowing(null);
                  setPicking({ index: showing, phase: exercise.phase });
                }}
              >
                <ArrowLeftRightIcon /> Austauschen
              </Button>
            </>
          )
        }
      />

      <TeilzielPicker
        open={choosingGoal !== null && plan[choosingGoal] !== undefined}
        onOpenChange={(open) => !open && setChoosingGoal(null)}
        title={choosingGoal !== null && plan[choosingGoal] ? byId.get(plan[choosingGoal].exerciseId)!.name : ""}
        value={choosingGoal !== null && plan[choosingGoal] ? teilzielOf(plan[choosingGoal], byId.get(plan[choosingGoal].exerciseId)!) : ""}
        defaultLabel={choosingGoal !== null && plan[choosingGoal] ? byId.get(plan[choosingGoal].exerciseId)!.teilziel : undefined}
        onPick={(goal, asDefault) => {
          if (choosingGoal !== null) setGoal(choosingGoal, goal, asDefault);
          setChoosingGoal(null);
        }}
      />

      <ExercisePicker
        open={picking !== null}
        onOpenChange={(open) => !open && setPicking(null)}
        exercises={exercises}
        initialPhase={picking?.phase ?? "game"}
        isFavorite={isFavorite}
        fits={fits}
        stage={group?.stage ?? null}
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
  fits,
  stage,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: Exercise[];
  initialPhase: Phase;
  isFavorite: (id: string) => boolean;
  // Whether it suits the group (kids, stage, serves); the others are greyed out and sorted last.
  fits: (exercise: Exercise) => boolean;
  stage: Stage | null;
  onPick: (exercise: Exercise) => void;
}) {
  const [phase, setPhase] = useState<Phase | null>(initialPhase);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Exercise | null>(null);
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
        Number(fits(b)) - Number(fits(a)) ||
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
            <li key={exercise.id} className={cn("flex items-start", !fits(exercise) && "opacity-50")}>
              <button
                type="button"
                onClick={() => onPick(exercise)}
                className="flex min-w-0 flex-1 cursor-pointer gap-3 rounded-lg p-2 text-left hover:bg-accent"
              >
                <Court diagram={exercise.diagram} horizontal midcourt={showsMidcourt(exercise, stage)} className="w-16 shrink-0 self-start" />
                <span className="min-w-0 space-y-0.5">
                  <span className="flex items-center gap-1 font-medium">
                    {isFavorite(exercise.id) && <StarIcon className="size-3.5 fill-amber-400 text-amber-500" />}
                    {exercise.name}
                  </span>
                  <span className="line-clamp-2 block text-sm text-muted-foreground">{exercise.summary}</span>
                  {playersLabel(exercise) && <span className="block text-xs text-muted-foreground">{playersLabel(exercise)}</span>}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="mt-1 shrink-0 text-muted-foreground"
                aria-label={`${exercise.name}: Details`}
                title="Details"
                onClick={() => setPreview(exercise)}
              >
                <InfoIcon />
              </Button>
            </li>
          ))}
          {shown.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Nichts gefunden.</li>}
        </ul>
        <ExerciseDialog
          exercise={preview}
          groupStage={stage}
          onOpenChange={(open) => !open && setPreview(null)}
          actions={
            preview && (
              <Button
                onClick={() => {
                  setPreview(null);
                  onPick(preview);
                }}
              >
                <CheckIcon /> Diese nehmen
              </Button>
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}

// One exercise of the plan, sortable by its grip (pointer or keyboard).
function PlanRow({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Verschieben"
      title="Ziehen zum Verschieben"
      className="-mt-1 -mr-1 flex size-9 shrink-0 cursor-grab touch-none items-center justify-center self-start rounded-md text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
    >
      <GripVerticalIcon className="size-5" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-xl border bg-card p-3 shadow-xs animate-in fade-in-0 zoom-in-[0.98] duration-300",
        isDragging && "relative z-10 shadow-lg ring-2 ring-brand/40",
      )}
    >
      {children(handle)}
    </li>
  );
}

// Why an exercise may not suit the group: number of kids, stage, serves.
function FitWarnings({ exercise, kids, group }: { exercise: Exercise; kids: number | null; group: Group | undefined }) {
  return (
    <>
      {!fitsPlayers(exercise, kids) && (
        <p className="text-xs text-debt">
          Passt nicht für {kids} Kinder ({playersLabel(exercise)})
        </p>
      )}
      {group?.stage && !fitsStage(exercise, group.stage) && (
        <p className="text-xs text-debt">
          Für {exercise.stages.map(stageName).join(", ")} gemacht, nicht für {stageName(group.stage)}
        </p>
      )}
      {group && !group.serves && exercise.focus.includes("Aufschlag") && (
        <p className="text-xs text-debt">Mit Aufschlag, die Gruppe schlägt noch nicht auf</p>
      )}
    </>
  );
}

// An exercise's details in a dialog, with buttons for what to do with it.
function ExerciseDialog({
  exercise,
  groupStage,
  warnings,
  actions,
  onOpenChange,
}: {
  exercise: Exercise | null;
  groupStage?: Stage | null;
  warnings?: (exercise: Exercise) => React.ReactNode;
  actions?: React.ReactNode;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={exercise !== null} onOpenChange={onOpenChange}>
      {exercise && (
        <DialogContent className="flex max-h-[90dvh] flex-col">
          <DialogHeader>
            <DialogTitle>{exercise.name}</DialogTitle>
          </DialogHeader>
          <div className="-mx-6 min-h-0 flex-1 space-y-2 overflow-y-auto px-6">
            {warnings?.(exercise)}
            <ExerciseDetails exercise={exercise} groupStage={groupStage} showNotes />
          </div>
          {actions && <DialogFooter className="gap-2">{actions}</DialogFooter>}
        </DialogContent>
      )}
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
  // With a plan in the planner, the request changes it; "Neu planen" starts over.
  const [fresh, setFresh] = useState(false);
  const editing = values.plan.length > 0 && !fresh;
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ask() {
    if (!request.trim() || pending) return;
    setError(null);
    setNote(null);
    startTransition(async () => {
      try {
        const result = await planWithAi(request, values.groupId, values.date, editing ? values.plan : []);
        if (result.error !== null) {
          setError(result.error);
          return;
        }
        const group = groups.find((entry) => entry.id === (result.groupId ?? values.groupId));
        const minutes = result.plan.reduce((sum, item) => sum + item.minutes, 0);
        const groupChanged = Boolean(result.groupId && result.groupId !== values.groupId);
        const undo = onPlan({
          groupId: group?.id ?? values.groupId,
          date: result.date ?? values.date,
          startTime: result.startTime ?? (groupChanged && group ? group.startTime : values.startTime),
          minutes,
          focus: editing ? (result.focus ?? values.focus) : result.focus,
          goal: values.goal,
          plan: editing ? keepNotes(result.plan, values.plan) : result.plan,
        });
        if (editing) setRequest("");
        setFresh(false);
        setNote(
          [result.created.length > 0 && `Neu in der Sammlung: ${result.created.join(", ")}.`, result.note].filter(Boolean).join(" ") ||
            null,
        );
        toast.success(editing ? "Stunde geändert, schau sie dir an und speichere" : "Stunde geplant, schau sie dir an und speichere", {
          action: { label: "Rückgängig", onClick: undo },
        });
      } catch {
        setError("Die KI ist gerade nicht erreichbar.");
      }
    });
  }

  return (
    <Card className="gap-3 py-4">
      <CardContent className="space-y-2 px-4">
        <div className="flex items-center gap-2">
          <label htmlFor="ai-plan" className="flex flex-1 items-center gap-2 text-sm font-medium">
            <SparklesIcon className="size-4 text-brand" /> {editing ? "Mit KI ändern" : "Mit KI planen"}
          </label>
          {values.plan.length > 0 && (
            <button
              type="button"
              onClick={() => setFresh(!fresh)}
              className="cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {editing ? "Stattdessen neu planen" : "Diese Stunde ändern"}
            </button>
          )}
        </div>
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
          placeholder={
            editing
              ? "z. B. Passt gut, aber tausch die zweite Übung gegen etwas mit mehr Laufen und mach das Spiel länger"
              : "z. B. Vorhandfokus für die U10, zum Aufwärmen Tic Tac Toe und zwei Spiele"
          }
          enterKeyHint="send"
          className="min-h-0 resize-none"
        />
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            {editing
              ? "Ändert nur, was du sagst, der Rest bleibt. Gespeichert wird erst mit „Speichern“."
              : "Nimmt Übungen aus deiner Sammlung, legt fehlende neu an. Gespeichert wird erst mit „Stunde speichern“."}
          </p>
          <Button variant="brand" size="sm" onClick={ask} disabled={pending || !request.trim()}>
            {pending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            {pending ? (editing ? "Ändert …" : "Plant …") : editing ? "Ändern" : "Planen"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {note && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{note}</p>}
      </CardContent>
    </Card>
  );
}

// The Stundenziel (BTV "Gesamtziel"): what the session is about; the
// Teilziele of the exercises build on it.
function GoalField({ value, onChange, recent }: { value: string; onChange: (value: string) => void; recent: string[] }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="plan-goal">Stundenziel</Label>
      <Input
        id="plan-goal"
        maxLength={80}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="z. B. Vorhand-Drive"
        className="font-medium"
      />
      {recent.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Zuletzt:</span>
          {recent.map((goal) => (
            <Chip key={goal} active={false} onClick={() => onChange(goal)}>
              {goal}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

// "Übungen übernehmen": exercises (with their Teilziele) from another
// session, e.g. of a group on the same level, so similar groups don't have
// to be planned twice. Folded on the phone, always open on a wide screen.
function CopyPanel({
  sessions,
  groups,
  group,
  byId,
  onCopy,
}: {
  sessions: Session[];
  groups: Group[];
  group: Group | undefined;
  byId: Map<string, Exercise>;
  onCopy: (items: PlanItem[], replace: boolean, source: Session) => void;
}) {
  const [open, setOpen] = useState(false);
  const groupOf = (id: string | null) => groups.find((entry) => entry.id === id);
  const sameStage = (session: Session) => Boolean(group?.stage && groupOf(session.groupId)?.stage === group.stage);
  const sources = sessions
    .filter((session) => session.plan.some((item) => byId.has(item.exerciseId)))
    .slice(0, 30)
    .sort((a, b) => Number(sameStage(b)) - Number(sameStage(a)))
    .slice(0, 8);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [off, setOff] = useState<Set<number>>(() => new Set());
  const source = sources.find((session) => session.id === sourceId) ?? sources[0];
  if (!source) return null;
  const items = source.plan.filter((item) => byId.has(item.exerciseId));
  const picked = items.filter((_, index) => !off.has(index));

  function copy(replace: boolean) {
    onCopy(
      picked.map((item) => ({ exerciseId: item.exerciseId, minutes: item.minutes, ...(item.goal !== undefined && { goal: item.goal }) })),
      replace,
      source,
    );
    setOff(new Set());
    setOpen(false);
  }

  return (
    <Card className="gap-0 py-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-12 w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm font-medium lg:cursor-default"
      >
        <CopyIcon className="size-4 text-brand" />
        <span className="flex-1">Übungen übernehmen</span>
        <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform lg:hidden", open && "rotate-180")} />
      </button>
      <CardContent className={cn("space-y-3 px-4 pb-4", !open && "hidden lg:block")}>
        <p className="text-xs text-muted-foreground">Aus der Stunde einer ähnlichen Gruppe, die Teilziele kommen mit.</p>
        <ul className="space-y-1.5">
          {sources.map((session) => {
            const selected = session.id === source.id;
            const sourceGroup = groupOf(session.groupId);
            return (
              <li key={session.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setSourceId(session.id);
                    setOff(new Set());
                  }}
                  className={cn(
                    "flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm",
                    selected ? "border-hero bg-hero text-hero-foreground" : "bg-card hover:bg-accent",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {sourceGroup?.name ?? "Ohne Gruppe"} · {formatSessionDate(session.date)}
                    </span>
                    {session.goal && <span className="block truncate text-xs opacity-80">Stundenziel: {session.goal}</span>}
                  </span>
                  {sourceGroup?.stage && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        sameStage(session)
                          ? selected
                            ? "bg-hero-bar text-hero"
                            : "bg-good text-good-foreground"
                          : selected
                            ? "bg-hero-track text-hero-muted"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {stageName(sourceGroup.stage)}
                      {sameStage(session) && " · gleiche Stufe"}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="divide-y border-t">
          {items.map((item, index) => {
            const exercise = byId.get(item.exerciseId)!;
            const on = !off.has(index);
            const teilziel = teilzielOf(item, exercise);
            return (
              <li key={index}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setOff((current) => {
                      const next = new Set(current);
                      if (next.has(index)) next.delete(index);
                      else next.add(index);
                      return next;
                    })
                  }
                  className="flex min-h-11 w-full cursor-pointer items-center gap-3 py-1.5 text-left"
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-muted-foreground/50",
                      on && "border-brand bg-brand text-brand-foreground",
                    )}
                  >
                    {on && <CheckIcon className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-medium", !on && "text-muted-foreground")}>{exercise.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{teilziel ? `Teilziel: ${teilziel}` : "ohne Teilziel"}</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{item.minutes}′</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={picked.length === 0} onClick={() => copy(false)}>
            Anhängen
          </Button>
          <Button variant="brand" className="flex-1" disabled={picked.length === 0} onClick={() => copy(true)}>
            Plan ersetzen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// What the coach wrote after the group's last session ("Wie lief's?").
function LastSession({ sessions, groupId, date }: { sessions: Session[]; groupId: string | null; date: string }) {
  const last = groupId ? sessions.find((session) => session.groupId === groupId && session.date < date) : undefined;
  if (!last) return null;
  return (
    <Card className="gap-2 py-4">
      <CardContent className="space-y-2 px-4">
        <Link href={`${PATH}?session=${last.id}`} className="block text-sm font-medium underline-offset-4 hover:underline">
          Letzte Stunde · {formatSessionDate(last.date)}
        </Link>
        {last.goal && <p className="text-xs text-muted-foreground">Stundenziel: {last.goal}</p>}
        {last.notes ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-line">„{last.notes}“</p>
        ) : (
          <p className="text-sm text-muted-foreground">Keine Notiz zur Stunde.</p>
        )}
      </CardContent>
    </Card>
  );
}

// The group's lists for the end of the session, as a reminder.
function ClosingPreview({ group }: { group: Group }) {
  if (group.afterSession.length === 0 && group.dayEnd.length === 0) return null;
  return (
    <Card className="gap-2 py-4">
      <CardContent className="space-y-1.5 px-4 text-sm">
        <div className="flex items-baseline gap-2">
          <span className="flex flex-1 items-center gap-1.5 font-medium">
            <FlagIcon className="size-4" /> Zum Abschluss
          </span>
          <Link href={`${PATH}?group=${group.id}`} className="text-xs text-brand underline-offset-4 hover:underline">
            In der Gruppe ändern
          </Link>
        </div>
        {group.afterSession.length > 0 && <p className="text-muted-foreground">Nach der Stunde: {group.afterSession.join(" · ")}</p>}
        {group.dayEnd.length > 0 && <p className="text-muted-foreground">Letzte Stunde des Tages: {group.dayEnd.join(" · ")}</p>}
      </CardContent>
    </Card>
  );
}
