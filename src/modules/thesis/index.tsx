import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ModulePageProps } from "@/modules/registry";
import {
  byPriority,
  byWhen,
  daysBetween,
  formatDate,
  formatHours,
  mondayOf,
  phaseOn,
  tabs,
  todayInGermany,
  type Settings,
  type TabId,
} from "./data";
import { DocumentsTab } from "./documents-tab";
import { EventList, EventsTab } from "./events-tab";
import { Infos, PeopleList } from "./infos";
import { LogTab } from "./log-tab";
import { PhaseDialog } from "./phase-dialog";
import { ProtocolsTab } from "./protocols-tab";
import {
  loadEvents,
  loadInfos,
  loadLog,
  loadPeople,
  loadPhases,
  loadProtocols,
  loadSettings,
  loadSources,
  loadTodos,
} from "./queries";
import { QuickTodo } from "./quick-todo";
import { SettingsDialog, SettingsForm } from "./settings-form";
import { SourcesTab } from "./sources-tab";
import { TodoList } from "./todo-list";
import { WritingTab } from "./writing-tab";

const PATH = "/m/thesis";

// Tracks the thesis as it happens: topic and time frame, phases, to-dos, a
// work log with hours, sources (APA 7 and BibLaTeX), meeting protocols and
// documents.
// It only shows what was entered; nothing is suggested or generated.
export default async function ThesisModule({ user, hasAccess, searchParams }: ModulePageProps) {
  if (!user || !hasAccess) notFound();

  const params = await searchParams;
  const param = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const tab: TabId = tabs.find((entry) => entry.id === param("tab"))?.id ?? "overview";
  const today = todayInGermany();

  return (
    <div className={`mx-auto space-y-6 ${tab === "writing" ? "max-w-5xl" : "max-w-3xl"}`}>
      <nav aria-label="Bereiche" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-lg bg-muted p-1 sm:w-full">
          {tabs.map((entry) => (
            <li key={entry.id} className="sm:flex-1">
              <Link
                href={entry.id === "overview" ? PATH : `${PATH}?tab=${entry.id}`}
                aria-current={entry.id === tab ? "page" : undefined}
                className={`flex h-9 items-center justify-center rounded-md px-3 text-sm whitespace-nowrap transition-colors ${
                  entry.id === tab
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {entry.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overview" && <Overview userId={user.id} today={today} />}
      {tab === "writing" && <WritingTab />}
      {tab === "todos" && <TodosTab today={today} />}
      {tab === "events" && <EventsTab today={today} />}
      {tab === "log" && <LogTab today={today} />}
      {tab === "sources" && <SourcesTab today={today} sourceId={param("source")} status={param("status")} />}
      {tab === "protocols" && (
        <ProtocolsTab
          today={today}
          protocolId={param("protocol")}
          edit={param("edit") === "1"}
          query={param("q")}
          eventId={param("event")}
        />
      )}
      {tab === "documents" && (
        <DocumentsTab
          userId={user.id}
          documentId={param("document")}
          edit={param("edit") === "1"}
          category={param("category")}
          sourceId={param("source")}
          protocolId={param("protocol")}
        />
      )}
    </div>
  );
}

// --- Überblick -----------------------------------------------------------------

async function Overview({ userId, today }: { userId: string; today: string }) {
  const [settings, phases, todos, log, sources, protocols, people, events, infos] = await Promise.all([
    loadSettings(userId),
    loadPhases(),
    loadTodos(),
    loadLog(),
    loadSources(),
    loadProtocols(),
    loadPeople(),
    loadEvents(),
    loadInfos(),
  ]);

  if (!settings.startDate || !settings.endDate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Leg deine Bachelorarbeit an</h2>
          </CardTitle>
          <CardDescription>Thema und Zeitraum. Alles lässt sich später ändern.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm settings={settings} />
        </CardContent>
      </Card>
    );
  }

  const currentPhase = phaseOn(phases, today);
  const open = todos.filter((todo) => !todo.doneOn).sort(byPriority);
  const overdue = open.filter((todo) => todo.deadline !== null && todo.deadline < today).length;
  const coming = events.filter((event) => event.date >= today).sort(byWhen).slice(0, 4);
  const totalHours = log.reduce((sum, entry) => sum + entry.hours, 0);
  const monday = mondayOf(today);
  const weekHours = log.filter((entry) => entry.day >= monday && entry.day <= today).reduce((sum, entry) => sum + entry.hours, 0);
  const cited = sources.filter((source) => source.status === "cited").length;
  const phaseHours = (id: string) => log.filter((entry) => entry.phaseId === id).reduce((sum, entry) => sum + entry.hours, 0);

  return (
    <div className="space-y-6">
      <TimeFrame settings={settings as Settings & { startDate: string; endDate: string }} today={today} />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Aktuelle Phase" value={currentPhase?.name ?? "–"} />
        <Stat label="Diese Woche" value={formatHours(weekHours)} mono />
        <Stat label="Stunden gesamt" value={formatHours(totalHours)} mono />
        <Stat label="Quellen" value={`${sources.length}`} detail={cited > 0 ? `${cited} zitiert` : undefined} mono />
      </dl>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Nächste Schritte</h2>
          </CardTitle>
          <CardDescription>
            {open.length === 0
              ? "Keine offenen To-dos."
              : `${open.length} offen${overdue > 0 ? ` · ${overdue} überfällig` : ""}`}
          </CardDescription>
          <CardAction>
            <Button asChild variant="ghost" size="sm" className="text-brand">
              <Link href={`${PATH}?tab=todos`}>Alle</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <QuickTodo people={people} phases={phases} today={today} />
          {open.length > 0 && <TodoList todos={open.slice(0, 5)} phases={phases} people={people} protocols={protocols} today={today} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Termine &amp; Deadlines</h2>
          </CardTitle>
          {coming.length === 0 && <CardDescription>Nichts eingetragen.</CardDescription>}
          <CardAction>
            <Button asChild variant="ghost" size="sm" className="text-brand">
              <Link href={`${PATH}?tab=events`}>{coming.length === 0 ? "Eintragen" : "Alle"}</Link>
            </Button>
          </CardAction>
        </CardHeader>
        {coming.length > 0 && (
          <CardContent>
            <EventList events={coming} people={people} protocols={protocols} today={today} compact />
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Allgemeine Infos</h2>
          </CardTitle>
          {infos.length === 0 && <CardDescription>Regeln und Fakten, die du immer parat haben willst.</CardDescription>}
        </CardHeader>
        <CardContent>
          <Infos infos={infos} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Thema</h2>
          </CardTitle>
          <CardAction>
            <SettingsDialog settings={settings} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <TopicItem label="Arbeitstitel" value={settings.title} wide />
            <TopicItem label="Forschungsfrage(n)" value={settings.researchQuestion} wide />
            <TopicItem label="Betreuer:innen" value={settings.supervisors} />
            <TopicItem label="Hochschule" value={settings.university} />
            {settings.company && <TopicItem label="Firma" value={settings.company} />}
            <TopicItem label="Zeitraum" value={`${formatDate(settings.startDate)} – ${formatDate(settings.endDate)}`} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Personen</h2>
          </CardTitle>
          <CardDescription>Für Protokolle, Termine und To-dos (@Name).</CardDescription>
        </CardHeader>
        <CardContent>
          <PeopleList people={people} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Phasen</h2>
          </CardTitle>
          {phases.length === 0 && (
            <CardDescription>Eigene Abschnitte mit Zeitraum, denen du To-dos und Arbeitszeit zuordnen kannst.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {phases.length > 0 && (
            <ul className="flex flex-col divide-y">
              {phases.map((phase) => {
                const state = phase.endDate < today ? "past" : phase.startDate > today ? "future" : "current";
                return (
                  <li key={phase.id} className={`flex items-center gap-3 py-2.5 ${state === "past" ? "text-muted-foreground" : ""}`}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        {phase.name}
                        {phase.id === currentPhase?.id && <span className="font-normal text-muted-foreground"> · aktuell</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(phase.startDate)} – {formatDate(phase.endDate)} · {formatHours(phaseHours(phase.id))}
                      </span>
                    </span>
                    <PhaseDialog key={JSON.stringify(phase)} phase={phase} defaultStart={phase.startDate} />
                  </li>
                );
              })}
            </ul>
          )}
          <PhaseDialog defaultStart={phases.at(-1)?.endDate ?? settings.startDate} />
        </CardContent>
      </Card>
    </div>
  );
}

function TimeFrame({ settings, today }: { settings: Settings & { startDate: string; endDate: string }; today: string }) {
  const total = daysBetween(settings.startDate, settings.endDate) + 1;
  const elapsed = Math.max(0, Math.min(total, daysBetween(settings.startDate, today) + 1));
  const left = daysBetween(today, settings.endDate);
  const headline =
    today < settings.startDate
      ? `Beginn in ${daysBetween(today, settings.startDate)} ${daysBetween(today, settings.startDate) === 1 ? "Tag" : "Tagen"}`
      : left > 0
        ? `noch ${left} ${left === 1 ? "Tag" : "Tage"}`
        : left === 0
          ? "Abgabe heute"
          : `Abgabe war am ${formatDate(settings.endDate)}`;

  return (
    <section aria-label="Zeitraum" className="flex flex-col gap-3 rounded-xl bg-hero p-5 text-hero-foreground sm:p-6">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-hero-muted">{settings.title || "Bachelorarbeit"}</span>
        <span className="shrink-0 font-mono text-hero-bar">
          Tag {elapsed} von {total}
        </span>
      </div>
      <div className="text-4xl leading-none font-medium tracking-tight">{headline}</div>
      <div
        role="progressbar"
        aria-label="Vergangene Zeit"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={elapsed}
        className="h-2 overflow-hidden rounded-full bg-hero-track"
      >
        <div className="h-full rounded-full bg-hero-bar" style={{ width: `${(elapsed / total) * 100}%` }} />
      </div>
      <div className="flex justify-between text-xs text-hero-muted">
        <span>{formatDate(settings.startDate)}</span>
        <span>Abgabe {formatDate(settings.endDate)}</span>
      </div>
    </section>
  );
}

function Stat({ label, value, detail, mono }: { label: string; value: string; detail?: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-4 py-3">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className={`truncate text-lg font-medium ${mono ? "font-mono" : ""}`}>{value}</dd>
      {detail && <dd className="text-xs text-muted-foreground">{detail}</dd>}
    </div>
  );
}

function TopicItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line">{value || "–"}</dd>
    </div>
  );
}

// --- To-dos --------------------------------------------------------------------

async function TodosTab({ today }: { today: string }) {
  const [phases, todos, protocols, people] = await Promise.all([loadPhases(), loadTodos(), loadProtocols(), loadPeople()]);
  const open = todos.filter((todo) => !todo.doneOn).sort(byPriority);
  const done = todos
    .filter((todo) => todo.doneOn)
    .sort((a, b) => (a.doneOn! < b.doneOn! ? 1 : a.doneOn! > b.doneOn! ? -1 : 0));

  return (
    <div className="space-y-6">
      <QuickTodo people={people} phases={phases} today={today} autoFocus />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Offen</h2>
          </CardTitle>
          <CardDescription>
            {open.length === 0 ? "Nichts offen." : `${open.length} To-dos, nach Priorität und Deadline sortiert`}
          </CardDescription>
        </CardHeader>
        {open.length > 0 && (
          <CardContent>
            <TodoList todos={open} phases={phases} people={people} protocols={protocols} today={today} showNotes />
          </CardContent>
        )}
      </Card>

      {done.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>Erledigt</h2>
            </CardTitle>
            <CardDescription>{done.length} To-dos</CardDescription>
          </CardHeader>
          <CardContent>
            <TodoList todos={done} phases={phases} people={people} protocols={protocols} today={today} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
