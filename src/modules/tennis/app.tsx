"use client";

import { BookOpenIcon, CalendarCheckIcon, CalendarPlusIcon, ChevronLeftIcon, ChevronRightIcon, PalmtreeIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { FormPending } from "@/components/form-pending";
import { Loading } from "@/components/loading";
import { confirmSubmit } from "@/components/confirm-dialog";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ViewLink as Link } from "@/lib/query/view-link";
import {
  addHoliday,
  addStandIn,
  createGroup,
  deleteExercise,
  deleteGroup,
  deleteHoliday,
  deleteSession,
  deleteStandIn,
  loadStarterExercises,
  saveExerciseNotes,
  saveSessionNotes,
  updateGroup,
} from "./actions";
import { AiImport } from "./ai-import";
import { Attendance } from "./attendance";
import { Court } from "./court";
import {
  addDays,
  emptyDiagram,
  formatClock,
  formatSessionDate,
  generatePlan,
  holidayOn,
  isoWeekday,
  myTrainingDates,
  nextTrainingDate,
  parseDiagram,
  phaseName,
  playersLabel,
  timeline,
  todayInGermany,
  weekdayNames,
  weekdays,
  type Holiday,
  type Phase,
  type Session,
} from "./data";
import { ExerciseForm } from "./exercise-form";
import { FavoriteToggles } from "./favorite-toggles";
import { Library } from "./library";
import { Planner } from "./planner";
import { Players } from "./players";
import { PrintSheet } from "./print-sheet";
import { LiveBadge, PrintButton, SessionPlan } from "./session-plan";
import { starterExercises } from "./starter";
import { useTennis } from "./use-tennis";

const PATH = "/m/tennis";

// The module in the browser: every view by the URL, from the query cache
// (see index.tsx for the server side).
export function TennisApp() {
  const searchParams = useSearchParams();
  const param = (key: string) => searchParams.get(key) ?? undefined;

  if (param("plan")) {
    return (
      <PlanView
        key={`${param("session")}-${param("group")}-${param("date")}`}
        sessionId={param("session") ?? null}
        groupId={param("group") ?? null}
        date={param("date") ?? null}
      />
    );
  }
  if (param("holidays")) return <HolidaysView />;
  const sessionId = param("session");
  if (sessionId) return <SessionView key={sessionId} sessionId={sessionId} />;
  const exerciseId = param("exercise");
  if (exerciseId === "new") return <ExerciseForm id={null} initial={newExercise} />;
  if (exerciseId) return <ExerciseView key={exerciseId} exerciseId={exerciseId} edit={param("edit") === "1"} />;
  if (param("exercises")) return <LibraryView />;
  const groupId = param("group");
  if (groupId) return <GroupView key={groupId} groupId={groupId} />;
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
  playersMin: null,
  playersMax: null,
};

const sessionEnd = (session: Session) => formatClock(timeline(session.startTime, session.plan).at(-1)?.end ?? 0);

// --- Overview -------------------------------------------------------------------

function Overview() {
  const [groups, exercises, allSessions, players, allHolidays, allStandIns] = useTennis(
    "groups",
    "exercises",
    "sessions",
    "players",
    "holidays",
    "standIns",
  );
  const exerciseCount = exercises.length;
  const sessions = allSessions.slice(0, 30);
  const holidays = allHolidays.filter((holiday) => holiday.endDate >= todayInGermany());
  const standIns = allStandIns.filter((standIn) => standIn.date >= todayInGermany());
  const today = todayInGermany();
  const upcoming = sessions.filter((session) => session.date >= today).reverse();
  const past = sessions.filter((session) => session.date < today).slice(0, 5);
  const groupName = (id: string | null) => groups.find((group) => group.id === id)?.name ?? "Ohne Gruppe";
  const playerCount = (groupId: string) => players.filter((player) => player.groupId === groupId).length;
  const nextStandIn = (groupId: string) => standIns.find((standIn) => standIn.groupId === groupId)?.date;
  const currentHoliday = holidayOn(today, holidays);
  const nextHoliday = holidays.find((holiday) => holiday.startDate > today);

  // My training days of the next week (stand-ins: the next two weeks) that
  // have no session yet.
  const unplanned = groups
    .flatMap((group) =>
      myTrainingDates(group, today, addDays(today, group.coach ? 13 : 6), holidays, standIns).map((date) => ({ group, date })),
    )
    .filter(({ group, date }) => !sessions.some((session) => session.groupId === group.id && session.date === date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.group.startTime.localeCompare(b.group.startTime));

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

      {currentHoliday && (
        <p className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm">
          <PalmtreeIcon className="size-4 shrink-0" />
          {currentHoliday.name || "Ferien"} bis {formatSessionDate(currentHoliday.endDate)}: kein Training.
        </p>
      )}

      <Button asChild size="lg" className="h-14 w-full text-base">
        <Link href={`${PATH}?plan=1`}>
          <CalendarPlusIcon className="size-5" /> Stunde planen
        </Link>
      </Button>

      {(upcoming.length > 0 || unplanned.length > 0) && (
        <section aria-label="Nächste Stunden" className="space-y-1.5">
          <h2 className="px-1 text-sm font-medium text-muted-foreground">Nächste Stunden</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {[
              ...upcoming.map((session) => ({ key: `${session.date} ${session.startTime} ${session.id}`, session, group: null, date: session.date })),
              ...unplanned.map(({ group, date }) => ({ key: `${date} ${group.startTime} ${group.id}`, session: null, group, date })),
            ]
              .sort((a, b) => a.key.localeCompare(b.key))
              .map(({ key, session, group, date }) =>
                session ? (
                  <li key={key}>
                    <SessionLink session={session} title={groupName(session.groupId)} today={today} />
                  </li>
                ) : (
                  <li key={key}>
                    <Link
                      href={`${PATH}?plan=1&group=${group.id}&date=${date}`}
                      className="flex min-h-12 items-center gap-3 px-4 py-2 text-muted-foreground active:bg-accent"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span>
                          {date === today ? "Heute" : formatSessionDate(date)}, {group.startTime} · {group.name}
                        </span>
                        <span className="text-xs">
                          {group.coach ? `Aushilfe für ${group.coach} · ` : ""}Noch nicht geplant
                        </span>
                      </span>
                      <span className="text-sm font-medium text-brand">Planen</span>
                    </Link>
                  </li>
                ),
              )}
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
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {[
                    group.weekday && `${weekdays[group.weekday - 1]} ${group.startTime}`,
                    group.coach && `Trainer:in ${group.coach}`,
                    group.coach && nextStandIn(group.id) && `ich helfe ${formatSessionDate(nextStandIn(group.id)!)} aus`,
                    playerCount(group.id) > 0 && `${playerCount(group.id)} Kinder`,
                    group.note,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
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

      <div className="space-y-2">
        <Link href={`${PATH}?exercises=1`} className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 shadow-xs active:bg-accent">
          <BookOpenIcon className="size-5 text-muted-foreground" />
          <span className="flex-1">Übungssammlung</span>
          <span className="font-mono text-sm text-muted-foreground">{exerciseCount ?? 0}</span>
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </Link>
        <Link href={`${PATH}?holidays=1`} className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 shadow-xs active:bg-accent">
          <PalmtreeIcon className="size-5 text-muted-foreground" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span>Ferien</span>
            {(currentHoliday ?? nextHoliday) && (
              <span className="truncate text-xs text-muted-foreground">
                {currentHoliday ? "Gerade: " : "Nächste: "}
                {(currentHoliday ?? nextHoliday)!.name || "Ferien"}, {formatRange(currentHoliday ?? nextHoliday!)}
              </span>
            )}
          </span>
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </Link>
      </div>

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

const formatRange = (holiday: Holiday) =>
  holiday.startDate === holiday.endDate
    ? formatSessionDate(holiday.startDate)
    : `${formatSessionDate(holiday.startDate)} – ${formatSessionDate(holiday.endDate)}`;

// --- Holidays -------------------------------------------------------------------

function HolidaysView() {
  const [allHolidays] = useTennis("holidays");
  const today = todayInGermany();
  const holidays = [...allHolidays].reverse();
  const coming = holidays.filter((holiday) => holiday.endDate >= today).reverse();
  const over = holidays.filter((holiday) => holiday.endDate < today).slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="-ml-2 flex items-center gap-1">
        <BackLink />
        <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">Ferien</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        In den Ferien fällt das Training aus: Diese Tage schlägt die Übersicht nicht zum Planen vor, und beim Planen gibt es
        einen Hinweis.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Ferien eintragen</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addHoliday} className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="holiday-name">Name</Label>
              <Input id="holiday-name" name="name" maxLength={60} placeholder="z. B. Herbstferien" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday-start">Von</Label>
              <Input id="holiday-start" name="startDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday-end">Bis</Label>
              <Input id="holiday-end" name="endDate" type="date" />
            </div>
            <div className="col-span-2">
              <SubmitButton done="Ferien eingetragen">Eintragen</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      {[
        { title: "Kommende", list: coming },
        { title: "Vorbei", list: over },
      ].map(
        ({ title, list }) =>
          list.length > 0 && (
            <section key={title} aria-label={title} className="space-y-1.5">
              <h3 className="px-1 text-sm font-medium text-muted-foreground">{title}</h3>
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {list.map((holiday) => (
                  <li key={holiday.id} className="flex items-center gap-3 px-4 py-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span>{holiday.name || "Ferien"}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatRange(holiday)}
                        {holidayOn(today, [holiday]) && " · gerade"}
                      </span>
                    </span>
                    <form action={deleteHoliday}>
                      <input type="hidden" name="holidayId" value={holiday.id} />
                      <SubmitButton variant="ghost" size="icon" className="text-muted-foreground" aria-label="Löschen" done="Ferien gelöscht">
                        <Trash2Icon />
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ),
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

function PlanView({ sessionId, groupId, date }: { sessionId: string | null; groupId: string | null; date: string | null }) {
  const [groups, exercises, favorites, allSessions, playerRows, allHolidays, allStandIns] = useTennis(
    "groups",
    "exercises",
    "favorites",
    "sessions",
    "players",
    "holidays",
    "standIns",
  );
  // The suggested plan is random, so it is made in the browser only (the
  // server's and the browser's dice would differ).
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const today = todayInGermany();
  const sessions = allSessions.slice(0, 60);
  const holidays = allHolidays.filter((holiday) => holiday.endDate >= today);
  const standIns = allStandIns.filter((standIn) => standIn.date >= today);

  // What each group played in its last two sessions comes up less often.
  const recent: Record<string, string[]> = {};
  // How many kids each group has.
  const players: Record<string, number> = {};
  for (const group of groups) {
    recent[group.id] = sessions
      .filter((session) => session.groupId === group.id && session.id !== sessionId)
      .slice(0, 2)
      .flatMap((session) => session.plan.map((item) => item.exerciseId));
    players[group.id] = playerRows.filter((row) => row.groupId === group.id).length;
  }

  const existing = sessionId ? allSessions.find((session) => session.id === sessionId) : undefined;
  if (sessionId && !existing) return <Gone what="Diese Stunde" />;
  if (!hydrated) return <Loading />;

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
    const count = group ? players[group.id] : 0;
    initial = {
      groupId: group?.id ?? null,
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : group ? (nextTrainingDate(group, today, holidays, standIns) ?? today) : today,
      startTime: group?.startTime ?? "16:00",
      minutes,
      focus: null,
      plan: generatePlan(minutes, {
        exercises,
        favorites: new Set(favorites.filter((key) => group && key.startsWith(`${group.id}:`)).map((key) => key.split(":")[1])),
        recent: new Set(group ? recent[group.id] : []),
        focus: null,
        players: count > 0 ? count : null,
      }),
    };
  }

  return (
    <Planner
      key={sessionId ?? `${groupId}-${date}`}
      sessionId={sessionId}
      groups={groups}
      exercises={exercises}
      favorites={favorites}
      recent={recent}
      players={players}
      absent={existing?.absent.length ?? 0}
      holidays={holidays}
      standIns={standIns}
      initial={initial}
    />
  );
}

// --- One session ----------------------------------------------------------------

function SessionView({ sessionId }: { sessionId: string }) {
  const [sessions, allExercises, groups, allPlayers] = useTennis("sessions", "exercises", "groups", "players");
  const session = sessions.find((entry) => entry.id === sessionId);
  if (!session) return <Gone what="Diese Stunde" />;
  const group = groups.find((entry) => entry.id === session.groupId) ?? null;
  const players = allPlayers.filter((player) => player.groupId === session.groupId);
  const exercises = allExercises;
  const items = session.plan.flatMap((item) => {
    const exercise = exercises.find((entry) => entry.id === item.exerciseId);
    return exercise ? [{ exercise, minutes: item.minutes }] : [];
  });

  return (
    <>
      <PrintSheet
        title={`${group?.name ?? "Training"} · Tennistraining`}
        subtitle={`${formatSessionDate(session.date)} · ${session.startTime}–${sessionEnd(session)}${session.focus ? ` · ${session.focus}` : ""}`}
        startTime={session.startTime}
        items={items}
        players={players}
        absent={session.absent}
        notes={session.notes}
      />
      <div className="mx-auto max-w-2xl space-y-4 print:hidden">
        <div className="-ml-2 flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="size-10 text-muted-foreground">
            <Link href={group ? `${PATH}?group=${group.id}` : PATH} aria-label="Zurück">
              <ChevronLeftIcon className="size-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold tracking-tight">{group?.name ?? "Training"}</h2>
            <p className="text-sm text-muted-foreground">
              {formatSessionDate(session.date)} · {session.startTime}–{sessionEnd(session)}
              {session.focus && ` · Schwerpunkt ${session.focus}`}
            </p>
          </div>
          <div className="flex">
            <PrintButton />
            <Button asChild variant="ghost" size="icon" className="size-10">
              <Link href={`${PATH}?plan=1&session=${session.id}`} aria-label="Stunde bearbeiten" title="Bearbeiten">
                <PencilIcon />
              </Link>
            </Button>
          </div>
        </div>

        {group && session.date >= todayInGermany() && (
          <Attendance
            sessionId={session.id}
            groupId={group.id}
            date={session.date}
            startTime={session.startTime}
            players={players}
            absent={session.absent}
            items={items}
          />
        )}

        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Keine Übungen in dieser Stunde.</p>
        ) : (
          <SessionPlan date={session.date} startTime={session.startTime} items={items} />
        )}

        <Card>
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

        <form action={deleteSession}>
          <input type="hidden" name="sessionId" value={session.id} />
          <SubmitButton
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={confirmSubmit({ title: "Stunde löschen?", description: "Plan, Notizen und Absagen dieser Stunde gehen verloren." })}
          >
            Stunde löschen
          </SubmitButton>
        </form>
      </div>
    </>
  );
}

// --- Exercises --------------------------------------------------------------------

function LibraryView() {
  const [exercises, favorites] = useTennis("exercises", "favorites");

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
      <Library exercises={exercises} favoriteIds={[...new Set(favorites.map((key) => key.split(":")[1]))]} />
    </div>
  );
}

function ExerciseView({ exerciseId, edit }: { exerciseId: string; edit: boolean }) {
  const [exercises, groups, favorites] = useTennis("exercises", "groups", "favorites");
  const exercise = exercises.find((entry) => entry.id === exerciseId);
  if (!exercise) return <Gone what="Diese Übung" />;
  if (edit) return <ExerciseForm key={JSON.stringify(exercise)} id={exercise.id} initial={exercise} />;

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
        {playersLabel(exercise) && <Badge variant="secondary">{playersLabel(exercise)}</Badge>}
        {exercise.focus.map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="space-y-4">
        <Court diagram={exercise.diagram} horizontal className="w-full" />
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
              favoriteGroupIds={favorites.filter((key) => key.endsWith(`:${exercise.id}`)).map((key) => key.split(":")[0])}
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

function GroupView({ groupId }: { groupId: string }) {
  const [groups, exercises, favoriteKeys, allSessions, allPlayers, allStandIns] = useTennis(
    "groups",
    "exercises",
    "favorites",
    "sessions",
    "players",
    "standIns",
  );
  const group = groups.find((entry) => entry.id === groupId);
  if (!group) return <Gone what="Diese Gruppe" />;
  const favoriteIds = new Set(favoriteKeys.filter((key) => key.startsWith(`${groupId}:`)).map((key) => key.split(":")[1]));
  const favorites = exercises.filter((exercise) => favoriteIds.has(exercise.id));
  const sessions = allSessions.filter((session) => session.groupId === groupId).slice(0, 20);
  const playerRows = allPlayers.filter((player) => player.groupId === groupId);
  const today = todayInGermany();
  const standIns = allStandIns.filter((standIn) => standIn.groupId === groupId);
  const comingStandIns = standIns.filter((standIn) => standIn.date >= today);
  const pastStandIns = standIns.filter((standIn) => standIn.date < today).length;
  // The group's next training day I'm not standing in yet, as the default.
  let suggested = today;
  if (group.weekday) {
    suggested = addDays(today, (group.weekday - isoWeekday(today) + 7) % 7);
    while (standIns.some((standIn) => standIn.date === suggested)) suggested = addDays(suggested, 7);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="-ml-2 flex items-center gap-1">
        <BackLink />
        <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">{group.name}</h2>
      </div>

      {group.coach && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheckIcon className="size-4" /> Wann ich aushelfe
            </CardTitle>
            <CardDescription>
              Die Gruppe trainiert normalerweise {group.coach}. Nur diese Tage erscheinen bei dir unter „Nächste Stunden“.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {comingStandIns.length > 0 && (
              <ul className="divide-y">
                {comingStandIns.map((standIn) => {
                  const planned = sessions.find((session) => session.date === standIn.date);
                  return (
                    <li key={standIn.id} className="flex items-center gap-2 py-1.5">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span>
                          {standIn.date === today ? "Heute" : formatSessionDate(standIn.date)}, {group.startTime}
                        </span>
                        {standIn.note && <span className="truncate text-xs text-muted-foreground">{standIn.note}</span>}
                      </span>
                      <Button asChild variant="ghost" size="sm" className="text-brand">
                        <Link href={planned ? `${PATH}?session=${planned.id}` : `${PATH}?plan=1&group=${group.id}&date=${standIn.date}`}>
                          {planned ? "Ansehen" : "Planen"}
                        </Link>
                      </Button>
                      <form action={deleteStandIn}>
                        <input type="hidden" name="standInId" value={standIn.id} />
                        <SubmitButton variant="ghost" size="icon" className="text-muted-foreground" aria-label="Löschen" done="Gelöscht">
                          <Trash2Icon />
                        </SubmitButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
            <form action={addStandIn} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="groupId" value={group.id} />
              <div className="space-y-2">
                <Label htmlFor="stand-in-date">Datum</Label>
                <Input key={suggested} id="stand-in-date" name="date" type="date" required defaultValue={suggested} className="w-40" />
              </div>
              <div className="min-w-40 flex-1 space-y-2">
                <Label htmlFor="stand-in-note">Notiz</Label>
                <Input id="stand-in-note" name="note" maxLength={200} placeholder={`z. B. ${group.coach} im Urlaub`} />
              </div>
              <SubmitButton variant="outline" done="Eingetragen">
                <PlusIcon /> Eintragen
              </SubmitButton>
            </form>
            {pastStandIns > 0 && (
              <p className="text-xs text-muted-foreground">
                Schon {pastStandIns}× ausgeholfen.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Button asChild size="lg" className="h-14 w-full text-base">
        <Link href={`${PATH}?plan=1&group=${group.id}`}>
          <CalendarPlusIcon className="size-5" /> Stunde für {group.name} planen
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="size-4" /> Kinder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Players groupId={group.id} players={playerRows} />
        </CardContent>
      </Card>

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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="group-weekday">Tag</Label>
                <select
                  id="group-weekday"
                  name="weekday"
                  defaultValue={group.weekday ?? ""}
                  className="h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs dark:bg-input/30"
                >
                  <option value="">–</option>
                  {weekdayNames.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-time">Beginn</Label>
                <Input id="group-time" name="startTime" type="time" step={300} defaultValue={group.startTime} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-minutes">Minuten</Label>
                <Input id="group-minutes" name="minutes" type="number" min={15} max={180} step={15} defaultValue={group.minutes} className="font-mono" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-coach">Wer trainiert die Gruppe normalerweise?</Label>
              <Input id="group-coach" name="coach" maxLength={60} defaultValue={group.coach} placeholder="Ich" />
              <p className="text-xs text-muted-foreground">
                Leer lassen, wenn es deine Gruppe ist. Mit einem Namen planst du nur die Tage, an denen du aushilfst.
              </p>
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
        <SubmitButton
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={confirmSubmit({
            title: `„${group.name}“ löschen?`,
            description: "Mit ihren Kindern, Favoriten und Aushilfe-Terminen. Ihre Stunden bleiben ohne Gruppe erhalten.",
          })}
        >
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

function Gone({ what }: { what: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <BackLink />
      <p className="text-sm text-muted-foreground">{what} gibt es nicht (mehr).</p>
    </div>
  );
}
