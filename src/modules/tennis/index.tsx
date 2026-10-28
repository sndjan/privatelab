import { BookOpenIcon, CalendarPlusIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormPending } from "@/components/form-pending";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";
import type { ModulePageProps } from "@/modules/registry";
import {
  createGroup,
  deleteExercise,
  deleteGroup,
  deleteSession,
  loadStarterExercises,
  saveExerciseNotes,
  saveSessionNotes,
  updateGroup,
} from "./actions";
import { AiImport } from "./ai-import";
import { Court } from "./court";
import {
  emptyDiagram,
  formatClock,
  formatSessionDate,
  generatePlan,
  parseDiagram,
  phaseName,
  timeline,
  todayInGermany,
  type Exercise,
  type Group,
  type Phase,
  type PlanItem,
  type Session,
} from "./data";
import { ExerciseForm } from "./exercise-form";
import { FavoriteToggles } from "./favorite-toggles";
import { Library } from "./library";
import { Planner } from "./planner";
import { LiveBadge, PrintButton, SessionPlan } from "./session-plan";
import { starterExercises } from "./starter";

const PATH = "/m/tennis";

export default async function TennisModule({ user, hasAccess, searchParams }: ModulePageProps) {
  if (!user || !hasAccess) notFound();

  const params = await searchParams;
  const param = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);

  if (param("plan")) return <PlanView sessionId={param("session") ?? null} groupId={param("group") ?? null} />;
  const sessionId = param("session");
  if (sessionId) return <SessionView sessionId={sessionId} />;
  const exerciseId = param("exercise");
  if (exerciseId === "new") return <ExerciseForm id={null} initial={newExercise} />;
  if (exerciseId) return <ExerciseView exerciseId={exerciseId} edit={param("edit") === "1"} />;
  if (param("exercises")) return <LibraryView />;
  const groupId = param("group");
  if (groupId) return <GroupView groupId={groupId} />;
  return <Overview />;
}

const newExercise = {
  name: "",
  phase: "game" as Phase,
  minutes: 10,
  summary: "",
  description: "",
  tips: [],
  focus: [],
  diagram: emptyDiagram,
};

// --- Rows ---------------------------------------------------------------------

const exerciseColumns = "id, name, phase, minutes, summary, description, tips, focus, diagram, notes";
const groupColumns = "id, name, note, start_time, minutes";
const sessionColumns = "id, group_id, date, start_time, minutes, focus, plan, notes";

type ExerciseRow = Omit<Exercise, "diagram"> & { diagram: unknown };
type GroupRow = { id: string; name: string; note: string; start_time: string; minutes: number };
type SessionRow = {
  id: string;
  group_id: string | null;
  date: string;
  start_time: string;
  minutes: number;
  focus: string | null;
  plan: unknown;
  notes: string;
};

const toExercise = (row: ExerciseRow): Exercise => ({ ...row, diagram: parseDiagram(row.diagram) });

const toGroup = (row: GroupRow): Group => ({
  id: row.id,
  name: row.name,
  note: row.note,
  startTime: row.start_time.slice(0, 5),
  minutes: row.minutes,
});

function toSession(row: SessionRow): Session {
  const plan = (Array.isArray(row.plan) ? row.plan : []).filter(
    (item): item is PlanItem => typeof item?.exerciseId === "string" && typeof item?.minutes === "number",
  );
  return {
    id: row.id,
    groupId: row.group_id,
    date: row.date,
    startTime: row.start_time.slice(0, 5),
    minutes: row.minutes,
    focus: row.focus,
    plan,
    notes: row.notes,
  };
}

const sessionEnd = (session: Session) => formatClock(timeline(session.startTime, session.plan).at(-1)?.end ?? 0);

// --- Overview -------------------------------------------------------------------

async function Overview() {
  const supabase = await createClient();
  const [{ data: groupRows }, { count: exerciseCount }, { data: sessionRows }] = await Promise.all([
    supabase.from("tennis_groups").select(groupColumns).order("name"),
    supabase.from("tennis_exercises").select("id", { count: "exact", head: true }),
    supabase.from("tennis_sessions").select(sessionColumns).order("date", { ascending: false }).order("start_time", { ascending: false }).limit(30),
  ]);
  const groups = ((groupRows ?? []) as GroupRow[]).map(toGroup);
  const sessions = ((sessionRows ?? []) as SessionRow[]).map(toSession);
  const today = todayInGermany();
  const upcoming = sessions.filter((session) => session.date >= today).reverse();
  const past = sessions.filter((session) => session.date < today).slice(0, 5);
  const groupName = (id: string | null) => groups.find((group) => group.id === id)?.name ?? "Ohne Gruppe";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {!exerciseCount && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Willkommen auf dem Platz 🎾</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Starte mit {starterExercises.length} erprobten Übungen und Spielen für Kinder und Jugendliche, jede mit Skizze und
              Tipps zum Zurufen. Du kannst alles ändern, löschen und mit KI weitere dazuholen.
            </p>
            <form action={loadStarterExercises}>
              <SubmitButton size="lg" className="h-12 w-full" done="Starter-Sammlung geladen">
                Starter-Sammlung laden
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      )}

      <Button asChild size="lg" className="h-14 w-full text-base">
        <Link href={`${PATH}?plan=1`}>
          <CalendarPlusIcon className="size-5" /> Stunde planen
        </Link>
      </Button>

      {upcoming.length > 0 && (
        <section aria-label="Nächste Stunden" className="space-y-1.5">
          <h2 className="px-1 text-sm font-medium text-muted-foreground">Nächste Stunden</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {upcoming.map((session) => (
              <li key={session.id}>
                <SessionLink session={session} title={groupName(session.groupId)} today={today} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Gruppen" className="space-y-1.5">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">Gruppen</h2>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {groups.map((group) => (
            <li key={group.id} className="flex items-center">
              <Link href={`${PATH}?group=${group.id}`} className="flex min-h-12 flex-1 flex-col justify-center px-4 py-2 active:bg-accent">
                <span>{group.name}</span>
                {group.note && <span className="line-clamp-1 text-xs text-muted-foreground">{group.note}</span>}
              </Link>
              <Button asChild variant="ghost" size="sm" className="mr-2 text-brand">
                <Link href={`${PATH}?plan=1&group=${group.id}`}>Planen</Link>
              </Button>
            </li>
          ))}
          <li>
            <form action={createGroup} className="relative">
              <Input
                name="name"
                required
                maxLength={60}
                aria-label="Neue Gruppe"
                placeholder="+ Neue Gruppe, z. B. U10 Mittwoch"
                enterKeyHint="enter"
                className="h-12 rounded-none border-0 px-4 shadow-none focus-visible:ring-0"
              />
              <FormPending />
            </form>
          </li>
        </ul>
      </section>

      <Link href={`${PATH}?exercises=1`} className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 shadow-xs active:bg-accent">
        <BookOpenIcon className="size-5 text-muted-foreground" />
        <span className="flex-1">Übungssammlung</span>
        <span className="font-mono text-sm text-muted-foreground">{exerciseCount ?? 0}</span>
        <ChevronRightIcon className="size-4 text-muted-foreground" />
      </Link>

      {past.length > 0 && (
        <section aria-label="Vergangene Stunden" className="space-y-1.5">
          <h2 className="px-1 text-sm font-medium text-muted-foreground">Vergangene Stunden</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {past.map((session) => (
              <li key={session.id}>
                <SessionLink session={session} title={groupName(session.groupId)} today={today} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SessionLink({ session, title, today }: { session: Session; title: string; today: string }) {
  return (
    <Link href={`${PATH}?session=${session.id}`} className="flex min-h-12 items-center gap-3 px-4 py-2 active:bg-accent">
      <span className="flex min-w-0 flex-1 flex-col">
        <span>
          {session.date === today ? "Heute" : formatSessionDate(session.date)}, {session.startTime} · {title}
        </span>
        {session.notes && <span className="line-clamp-1 text-xs text-muted-foreground">{session.notes}</span>}
      </span>
      {session.date === today && <LiveBadge date={session.date} startTime={session.startTime} plan={session.plan} />}
      <ChevronRightIcon className="size-4 text-muted-foreground" />
    </Link>
  );
}

// --- Planner --------------------------------------------------------------------

async function PlanView({ sessionId, groupId }: { sessionId: string | null; groupId: string | null }) {
  const supabase = await createClient();
  const [{ data: groupRows }, { data: exerciseRows }, { data: favoriteRows }, { data: sessionRows }] = await Promise.all([
    supabase.from("tennis_groups").select(groupColumns).order("name"),
    supabase.from("tennis_exercises").select(exerciseColumns).order("name"),
    supabase.from("tennis_favorites").select("group_id, exercise_id"),
    supabase.from("tennis_sessions").select(sessionColumns).order("date", { ascending: false }).limit(60),
  ]);
  const groups = ((groupRows ?? []) as GroupRow[]).map(toGroup);
  const exercises = ((exerciseRows ?? []) as ExerciseRow[]).map(toExercise);
  const favorites = (favoriteRows ?? []).map((row) => `${row.group_id}:${row.exercise_id}`);
  const sessions = ((sessionRows ?? []) as SessionRow[]).map(toSession);

  // What each group played in its last two sessions comes up less often.
  const recent: Record<string, string[]> = {};
  for (const group of groups) {
    recent[group.id] = sessions
      .filter((session) => session.groupId === group.id && session.id !== sessionId)
      .slice(0, 2)
      .flatMap((session) => session.plan.map((item) => item.exerciseId));
  }

  const existing = sessionId ? sessions.find((session) => session.id === sessionId) : undefined;
  if (sessionId && !existing) notFound();

  let initial;
  if (existing) {
    initial = {
      groupId: existing.groupId,
      date: existing.date,
      startTime: existing.startTime,
      minutes: existing.minutes,
      focus: existing.focus,
      plan: existing.plan,
    };
  } else {
    const group = groups.find((entry) => entry.id === groupId) ?? groups[0];
    const minutes = group?.minutes ?? 60;
    initial = {
      groupId: group?.id ?? null,
      date: todayInGermany(),
      startTime: group?.startTime ?? "16:00",
      minutes,
      focus: null,
      plan: generatePlan(minutes, {
        exercises,
        favorites: new Set(favorites.filter((key) => group && key.startsWith(`${group.id}:`)).map((key) => key.split(":")[1])),
        recent: new Set(group ? recent[group.id] : []),
        focus: null,
      }),
    };
  }

  return (
    <Planner
      key={sessionId ?? groupId ?? "new"}
      sessionId={sessionId}
      groups={groups}
      exercises={exercises}
      favorites={favorites}
      recent={recent}
      initial={initial}
    />
  );
}

// --- One session ----------------------------------------------------------------

async function SessionView({ sessionId }: { sessionId: string }) {
  const supabase = await createClient();
  const { data: row } = await supabase.from("tennis_sessions").select(sessionColumns).eq("id", sessionId).maybeSingle<SessionRow>();
  if (!row) notFound();
  const session = toSession(row);
  const [{ data: exerciseRows }, { data: group }] = await Promise.all([
    supabase
      .from("tennis_exercises")
      .select(exerciseColumns)
      .in("id", session.plan.map((item) => item.exerciseId)),
    session.groupId
      ? supabase.from("tennis_groups").select(groupColumns).eq("id", session.groupId).maybeSingle<GroupRow>()
      : Promise.resolve({ data: null }),
  ]);
  const exercises = ((exerciseRows ?? []) as ExerciseRow[]).map(toExercise);
  const items = session.plan.flatMap((item) => {
    const exercise = exercises.find((entry) => entry.id === item.exerciseId);
    return exercise ? [{ exercise, minutes: item.minutes }] : [];
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4 print:max-w-none">
      <div className="-ml-2 flex items-center gap-1 print:ml-0">
        <Button asChild variant="ghost" size="icon" className="size-10 text-muted-foreground print:hidden">
          <Link href={group ? `${PATH}?group=${group.id}` : PATH} aria-label="Zurück">
            <ChevronLeftIcon className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold tracking-tight">
            {group?.name ?? "Training"}
            <span className="hidden print:inline"> · Tennistraining</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatSessionDate(session.date)} · {session.startTime}–{sessionEnd(session)}
            {session.focus && ` · Schwerpunkt ${session.focus}`}
          </p>
        </div>
        <div className="flex print:hidden">
          <PrintButton />
          <Button asChild variant="ghost" size="icon" className="size-10">
            <Link href={`${PATH}?plan=1&session=${session.id}`} aria-label="Stunde bearbeiten" title="Bearbeiten">
              <PencilIcon />
            </Link>
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Keine Übungen in dieser Stunde.</p>
      ) : (
        <SessionPlan date={session.date} startTime={session.startTime} items={items} />
      )}

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Notizen</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveSessionNotes} className="space-y-2">
            <input type="hidden" name="sessionId" value={session.id} />
            <Textarea
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={session.notes}
              placeholder="Wie lief's? Wer fehlte, was hat Spaß gemacht, was nächstes Mal?"
            />
            <SubmitButton variant="outline" done="Notizen gespeichert">Speichern</SubmitButton>
          </form>
        </CardContent>
      </Card>

      {/* Room for handwritten notes on the printed sheet. */}
      <div className="hidden print:block">
        <p className="text-sm font-medium">Notizen</p>
        <p className="whitespace-pre-line">{session.notes}</p>
        <div className="mt-2 h-24 border-b border-dashed" />
      </div>

      <form action={deleteSession} className="print:hidden">
        <input type="hidden" name="sessionId" value={session.id} />
        <SubmitButton variant="ghost" className="text-destructive hover:text-destructive">
          Stunde löschen
        </SubmitButton>
      </form>
    </div>
  );
}

// --- Exercises --------------------------------------------------------------------

async function LibraryView() {
  const supabase = await createClient();
  const [{ data: exerciseRows }, { data: favoriteRows }] = await Promise.all([
    supabase.from("tennis_exercises").select(exerciseColumns).order("name"),
    supabase.from("tennis_favorites").select("exercise_id"),
  ]);
  const exercises = ((exerciseRows ?? []) as ExerciseRow[]).map(toExercise);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="-ml-2 flex items-center gap-1">
        <BackLink />
        <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">Übungssammlung</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`${PATH}?exercise=new`}>+ Neue Übung</Link>
        </Button>
        <AiImport existing={exercises.map((exercise) => exercise.name)} />
        {exercises.length < starterExercises.length && (
          <form action={loadStarterExercises}>
            <SubmitButton variant="ghost" className="text-muted-foreground" done="Starter-Sammlung ergänzt">
              Starter-Sammlung ergänzen
            </SubmitButton>
          </form>
        )}
      </div>
      <Library exercises={exercises} favoriteIds={(favoriteRows ?? []).map((row) => row.exercise_id)} />
    </div>
  );
}

async function ExerciseView({ exerciseId, edit }: { exerciseId: string; edit: boolean }) {
  const supabase = await createClient();
  const [{ data: row }, { data: groupRows }, { data: favoriteRows }] = await Promise.all([
    supabase.from("tennis_exercises").select(exerciseColumns).eq("id", exerciseId).maybeSingle<ExerciseRow>(),
    supabase.from("tennis_groups").select(groupColumns).order("name"),
    supabase.from("tennis_favorites").select("group_id").eq("exercise_id", exerciseId),
  ]);
  if (!row) notFound();
  const exercise = toExercise(row);
  if (edit) return <ExerciseForm id={exercise.id} initial={exercise} />;
  const groups = ((groupRows ?? []) as GroupRow[]).map(toGroup);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="-ml-2 flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="size-10 text-muted-foreground">
          <Link href={`${PATH}?exercises=1`} aria-label="Zur Übungssammlung">
            <ChevronLeftIcon className="size-5" />
          </Link>
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">{exercise.name}</h2>
        <Button asChild variant="ghost" size="icon" className="size-10">
          <Link href={`${PATH}?exercise=${exercise.id}&edit=1`} aria-label="Übung bearbeiten">
            <PencilIcon />
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{phaseName(exercise.phase)}</Badge>
        <Badge variant="secondary">{exercise.minutes} Min.</Badge>
        {exercise.focus.map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <Court diagram={exercise.diagram} className="mx-auto w-full max-w-60" />
        <div className="space-y-3">
          {exercise.summary && <p className="font-medium">{exercise.summary}</p>}
          {exercise.description && <p className="text-sm whitespace-pre-line">{exercise.description}</p>}
          {exercise.tips.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">Zum Zurufen</p>
              <ul className="flex flex-wrap gap-1.5">
                {exercise.tips.map((tip) => (
                  <li key={tip} className="rounded-full bg-good px-2.5 py-0.5 text-sm text-good-foreground">
                    „{tip}“
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StarIcon className="size-4" /> Lieblingsübung von
          </CardTitle>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Lege auf der Startseite eine Gruppe an, um Favoriten zu markieren.</p>
          ) : (
            <FavoriteToggles
              exerciseId={exercise.id}
              groups={groups}
              favoriteGroupIds={(favoriteRows ?? []).map((favorite) => favorite.group_id)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meine Notizen</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveExerciseNotes} className="space-y-2">
            <input type="hidden" name="exerciseId" value={exercise.id} />
            <Textarea
              name="notes"
              rows={3}
              maxLength={1000}
              defaultValue={exercise.notes}
              placeholder="z. B. Mit 8 Kindern lieber zwei Reihen. Kam super an."
            />
            <SubmitButton variant="outline" done="Notizen gespeichert">Speichern</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <form action={deleteExercise}>
        <input type="hidden" name="exerciseId" value={exercise.id} />
        <SubmitButton variant="ghost" className="text-destructive hover:text-destructive">
          Übung löschen
        </SubmitButton>
      </form>
    </div>
  );
}

// --- One group ----------------------------------------------------------------------

async function GroupView({ groupId }: { groupId: string }) {
  const supabase = await createClient();
  const [{ data: row }, { data: favoriteRows }, { data: sessionRows }] = await Promise.all([
    supabase.from("tennis_groups").select(groupColumns).eq("id", groupId).maybeSingle<GroupRow>(),
    supabase.from("tennis_favorites").select("exercise_id").eq("group_id", groupId),
    supabase
      .from("tennis_sessions")
      .select(sessionColumns)
      .eq("group_id", groupId)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(20),
  ]);
  if (!row) notFound();
  const group = toGroup(row);
  const favoriteIds = (favoriteRows ?? []).map((favorite) => favorite.exercise_id);
  const { data: exerciseRows } = favoriteIds.length
    ? await supabase.from("tennis_exercises").select("id, name, diagram").in("id", favoriteIds).order("name")
    : { data: [] };
  const favorites = (exerciseRows ?? []) as { id: string; name: string; diagram: unknown }[];
  const sessions = ((sessionRows ?? []) as SessionRow[]).map(toSession);
  const today = todayInGermany();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="-ml-2 flex items-center gap-1">
        <BackLink />
        <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">{group.name}</h2>
      </div>

      <Button asChild size="lg" className="h-14 w-full text-base">
        <Link href={`${PATH}?plan=1&group=${group.id}`}>
          <CalendarPlusIcon className="size-5" /> Stunde für {group.name} planen
        </Link>
      </Button>

      <section aria-label="Lieblingsübungen" className="space-y-1.5">
        <h3 className="px-1 text-sm font-medium text-muted-foreground">Lieblingsübungen</h3>
        {favorites.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Noch keine. Markiere Übungen mit dem Stern, beim Planen oder in der Übungssammlung. Favoriten kommen etwa viermal so
            oft dran.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {favorites.map((exercise) => (
              <li key={exercise.id}>
                <Link href={`${PATH}?exercise=${exercise.id}`} className="block space-y-1">
                  <Court diagram={parseDiagram(exercise.diagram)} className="w-full" />
                  <span className="block text-sm leading-tight">{exercise.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sessions.length > 0 && (
        <section aria-label="Stunden" className="space-y-1.5">
          <h3 className="px-1 text-sm font-medium text-muted-foreground">Stunden</h3>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {sessions.map((session) => (
              <li key={session.id}>
                <SessionLink session={session} title={`${session.plan.length} Übungen`} today={today} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gruppe</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateGroup} className="space-y-4">
            <input type="hidden" name="groupId" value={group.id} />
            <div className="space-y-2">
              <Label htmlFor="group-name">Name</Label>
              <Input id="group-name" name="name" required maxLength={60} defaultValue={group.name} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="group-time">Beginn</Label>
                <Input id="group-time" name="startTime" type="time" step={300} defaultValue={group.startTime} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-minutes">Dauer (Min.)</Label>
                <Input id="group-minutes" name="minutes" type="number" min={15} max={180} step={15} defaultValue={group.minutes} className="font-mono" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-note">Notiz</Label>
              <Textarea
                id="group-note"
                name="note"
                rows={3}
                maxLength={500}
                defaultValue={group.note}
                placeholder="z. B. 6 Kinder, 8–10 Jahre. Lisa und Ben nicht zusammen. Lieben Rundlauf."
              />
            </div>
            <SubmitButton variant="outline" done="Gruppe gespeichert">Speichern</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <form action={deleteGroup}>
        <input type="hidden" name="groupId" value={group.id} />
        <SubmitButton variant="ghost" className="text-destructive hover:text-destructive">
          Gruppe löschen
        </SubmitButton>
      </form>
    </div>
  );
}

// --- Shared bits --------------------------------------------------------------------

function BackLink() {
  return (
    <Button asChild variant="ghost" size="icon" className="size-10 text-muted-foreground">
      <Link href={PATH} aria-label="Zur Übersicht">
        <ChevronLeftIcon className="size-5" />
      </Link>
    </Button>
  );
}
