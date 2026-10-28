"use client";

import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, EyeOffIcon, GripVerticalIcon, MessageSquareIcon, PlusIcon, RotateCcwIcon, SlidersHorizontalIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ViewLink as Link } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import { saveOverviewLayout } from "./actions";
import {
  byPriority,
  byWhen,
  daysBetween,
  defaultOverviewLayout,
  formatDate,
  formatHours,
  mondayOf,
  normalizeOverviewLayout,
  overviewWidgets,
  phaseOn,
  type OverviewArea,
  type OverviewLayout,
  type Settings,
  type WidgetId,
} from "./data";
import { EventList } from "./events-tab";
import { Infos, PeopleList } from "./infos";
import { PhaseDialog } from "./phase-dialog";
import { thesisQuery } from "./query";
import { QuickTodo } from "./quick-todo";
import { SettingsDialog, SettingsForm } from "./settings-form";
import { TodoList } from "./todo-list";
import { useThesis } from "./use-thesis";
import { countWords, estimatePages, formatWords, numbering, subtreeEnd } from "./writing";

const PATH = "/m/thesis";

const labelOf = (id: WidgetId) => overviewWidgets.find((widget) => widget.id === id)!.label;

// The Überblick: cards that can be moved, hidden and shown again ("Anpassen").
// The arrangement is saved with the settings, so it is the same on every device.
export function Overview({ today }: { today: string }) {
  const [settings, phases, todos, log, sources, protocols, people, events, infos, sections] = useThesis(
    "settings",
    "phases",
    "todos",
    "log",
    "sources",
    "protocols",
    "people",
    "events",
    "infos",
    "sections",
  );
  const queryClient = useQueryClient();
  // The arrangement being edited, or null while just looking.
  const [draft, setDraft] = useState<OverviewLayout | null>(null);

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

  const dates = { start: settings.startDate, end: settings.endDate };
  const layout = draft ?? normalizeOverviewLayout(settings.overviewLayout);

  async function save(next: OverviewLayout) {
    const key = thesisQuery("settings").queryKey;
    const stored = JSON.stringify(next) === JSON.stringify(defaultOverviewLayout) ? null : next;
    queryClient.setQueryData(key, (current) => (current ? { ...current, overviewLayout: stored } : current));
    setDraft(null);
    try {
      await saveOverviewLayout(stored);
    } catch {
      toast.error("Die Anordnung wurde nicht gespeichert. Ist die Migration 20261114000000_thesis_overview_layout.sql ausgeführt?");
      void queryClient.invalidateQueries({ queryKey: key });
    }
  }

  const currentPhase = phaseOn(phases, today);
  const open = todos.filter((todo) => !todo.doneOn).sort(byPriority);
  const overdue = open.filter((todo) => todo.deadline !== null && todo.deadline < today).length;
  const coming = events.filter((event) => event.date >= today).sort(byWhen).slice(0, 4);
  const totalHours = log.reduce((sum, entry) => sum + entry.hours, 0);
  const monday = mondayOf(today);
  const thisWeek = log.filter((entry) => entry.day >= monday && entry.day <= today);
  const weekHours = thisWeek.reduce((sum, entry) => sum + entry.hours, 0);
  const cited = sources.filter((source) => source.status === "cited").length;
  const words = sections.reduce((sum, section) => sum + countWords(section.body), 0);
  const pages = Math.round(estimatePages(sections, settings.wordsPerPage));
  const phaseHours = (id: string) => log.filter((entry) => entry.phaseId === id).reduce((sum, entry) => sum + entry.hours, 0);
  const numbers = numbering(sections);
  const openComments = sections.flatMap((section, index) =>
    section.comments.filter((comment) => !comment.resolved).map((comment) => ({ comment, section, number: numbers[index] })),
  );
  const chapters = sections.flatMap((section, index) => {
    if (section.depth !== 0) return [];
    const part = sections.slice(index, subtreeEnd(sections, index));
    const target = part.reduce((sum, entry) => sum + (entry.targetWords ?? 0), 0);
    return [
      {
        section,
        number: numbers[index],
        words: part.reduce((sum, entry) => sum + countWords(entry.body), 0),
        target,
        done: part.filter((entry) => entry.status === "done").length,
        total: part.length,
      },
    ];
  });

  const allLink = (href: string, label = "Alle") => (
    <CardAction>
      <Button asChild variant="ghost" size="sm" className="text-brand">
        <Link href={href}>{label}</Link>
      </Button>
    </CardAction>
  );

  const widgets: Record<WidgetId, () => ReactNode> = {
    timeframe: () => <TimeFrame settings={{ ...settings, startDate: dates.start, endDate: dates.end }} today={today} />,
    stats: () => (
      // Laid out by its own width, so it also fits into a column.
      <div className="@container">
        <dl className="grid grid-cols-2 gap-3 @md:grid-cols-3 @3xl:grid-cols-5">
        <Stat label="Aktuelle Phase" value={currentPhase?.name ?? "–"} />
        <Stat
          label="Geschrieben"
          value={settings.targetPages ? `≈ ${pages} / ${settings.targetPages} S.` : `≈ ${pages} S.`}
          detail={words > 0 ? formatWords(words) : settings.targetPages ? undefined : "Umfang beim Thema eintragen"}
          progress={settings.targetPages ? Math.min(1, pages / settings.targetPages) : undefined}
          mono
        />
        <Stat label="Diese Woche" value={formatHours(weekHours)} mono />
        <Stat label="Stunden gesamt" value={formatHours(totalHours)} mono />
          <Stat label="Quellen" value={`${sources.length}`} detail={cited > 0 ? `${cited} zitiert` : undefined} mono />
        </dl>
      </div>
    ),
    todos: () => (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Nächste Schritte</h2>
          </CardTitle>
          <CardDescription>
            {open.length === 0 ? "Keine offenen To-dos." : `${open.length} offen${overdue > 0 ? ` · ${overdue} überfällig` : ""}`}
          </CardDescription>
          {allLink(`${PATH}?tab=todos`)}
        </CardHeader>
        <CardContent className="space-y-3">
          <QuickTodo people={people} phases={phases} today={today} />
          {open.length > 0 && <TodoList todos={open.slice(0, 5)} phases={phases} people={people} protocols={protocols} today={today} />}
        </CardContent>
      </Card>
    ),
    events: () => (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Termine &amp; Deadlines</h2>
          </CardTitle>
          {coming.length === 0 && <CardDescription>Nichts eingetragen.</CardDescription>}
          {allLink(`${PATH}?tab=events`, coming.length === 0 ? "Eintragen" : "Alle")}
        </CardHeader>
        {coming.length > 0 && (
          <CardContent>
            <EventList events={coming} people={people} protocols={protocols} today={today} compact />
          </CardContent>
        )}
      </Card>
    ),
    comments: () => (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Offene Kommentare</h2>
          </CardTitle>
          <CardDescription>
            {openComments.length === 0 ? "Keine offenen Kommentare im Text." : `${openComments.length} im Text`}
          </CardDescription>
        </CardHeader>
        {openComments.length > 0 && (
          <CardContent>
            <ul className="flex flex-col divide-y">
              {openComments.slice(0, 6).map(({ comment, section, number }) => (
                <li key={comment.id}>
                  <Link href={`${PATH}?tab=writing#section-${section.id}`} className="flex items-start gap-2 py-2 text-sm hover:text-brand">
                    <MessageSquareIcon className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2">{comment.text}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {number} {section.title || "Ohne Titel"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {openComments.length > 6 && <p className="pt-1 text-xs text-muted-foreground">und {openComments.length - 6} weitere</p>}
          </CardContent>
        )}
      </Card>
    ),
    infos: () => (
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
    ),
    chapters: () => (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Kapitel</h2>
          </CardTitle>
          {chapters.length === 0 && <CardDescription>Noch keine Gliederung.</CardDescription>}
          {allLink(`${PATH}?tab=writing`, chapters.length === 0 ? "Anlegen" : "Schreiben")}
        </CardHeader>
        {chapters.length > 0 && (
          <CardContent>
            <ul className="flex flex-col gap-3">
              {chapters.map((chapter) => (
                <li key={chapter.section.id}>
                  <Link href={`${PATH}?tab=writing#section-${chapter.section.id}`} className="group block space-y-1 text-sm">
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{chapter.number}</span>
                      <span className="min-w-0 flex-1 truncate font-medium group-hover:text-brand">{chapter.section.title || "Ohne Titel"}</span>
                      {chapter.done === chapter.total && <CheckIcon className="size-3.5 shrink-0 text-brand" />}
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {chapter.words.toLocaleString("de-DE")}
                        {chapter.target ? ` / ${chapter.target.toLocaleString("de-DE")}` : ""}
                      </span>
                    </span>
                    {chapter.target > 0 && (
                      <span className="block h-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (chapter.words / chapter.target) * 100)}%` }} />
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    ),
    log: () => (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Arbeitslog</h2>
          </CardTitle>
          <CardDescription>
            Diese Woche {formatHours(weekHours)}
            {thisWeek.length > 0 ? ` an ${new Set(thisWeek.map((entry) => entry.day)).size} Tagen` : ""}
          </CardDescription>
          {allLink(`${PATH}?tab=log`)}
        </CardHeader>
        {log.length > 0 && (
          <CardContent>
            <ul className="flex flex-col divide-y">
              {log.slice(0, 4).map((entry) => (
                <li key={entry.id} className="flex items-baseline gap-3 py-2 text-sm">
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(entry.day)}</span>
                  <span className="min-w-0 flex-1 truncate">{entry.text || "–"}</span>
                  <span className="shrink-0 font-mono text-xs">{formatHours(entry.hours)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    ),
    topic: () => (
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
            <TopicItem label="Zeitraum" value={`${formatDate(dates.start)} – ${formatDate(dates.end)}`} />
            {settings.targetPages && (
              <TopicItem label="Umfang" value={`${settings.targetPages} Seiten (${settings.wordsPerPage} Wörter pro Seite)`} />
            )}
          </dl>
        </CardContent>
      </Card>
    ),
    people: () => (
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
    ),
    phases: () => (
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
          <PhaseDialog defaultStart={phases.at(-1)?.endDate ?? dates.start} />
        </CardContent>
      </Card>
    ),
  };

  if (draft) {
    return <OverviewEditor draft={draft} onChange={setDraft} onCancel={() => setDraft(null)} onSave={() => void save(draft)} widgets={widgets} />;
  }

  return (
    <div className="space-y-6">
      {layout.top.map((id) => (
        <div key={id}>{widgets[id]()}</div>
      ))}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {(["left", "right"] as const).map((area) => (
          <div key={area} className="space-y-6">
            {layout[area].map((id) => (
              <div key={id}>{widgets[id]()}</div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-center">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setDraft(layout)}>
          <SlidersHorizontalIcon /> Überblick anpassen
        </Button>
      </div>
    </div>
  );
}

// --- Anpassen --------------------------------------------------------------------

const areaOf = (layout: OverviewLayout, id: string): OverviewArea | undefined =>
  (["top", "left", "right", "hidden"] as const).find((area) => area === id || layout[area].includes(id as WidgetId));

function OverviewEditor({
  draft,
  onChange,
  onCancel,
  onSave,
  widgets,
}: {
  draft: OverviewLayout;
  onChange: (layout: OverviewLayout) => void;
  onCancel: () => void;
  onSave: () => void;
  widgets: Record<WidgetId, () => ReactNode>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dndId = useId();

  // Into another area while dragging, so the card shows where it would land.
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const id = active.id as WidgetId;
    const from = areaOf(draft, id);
    const to = areaOf(draft, String(over.id));
    if (!from || !to || from === to) return;
    const target = draft[to].filter((entry) => entry !== id);
    const at = target.indexOf(over.id as WidgetId);
    target.splice(at >= 0 ? at : target.length, 0, id);
    onChange({ ...draft, [from]: draft[from].filter((entry) => entry !== id), [to]: target });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const area = areaOf(draft, String(active.id));
    if (!area || area !== areaOf(draft, String(over.id))) return;
    const list = draft[area];
    const from = list.indexOf(active.id as WidgetId);
    const to = list.indexOf(over.id as WidgetId);
    if (from >= 0 && to >= 0 && from !== to) onChange({ ...draft, [area]: arrayMove(list, from, to) });
  }

  function hide(id: WidgetId) {
    const area = areaOf(draft, id);
    if (!area || area === "hidden") return;
    onChange({ ...draft, [area]: draft[area].filter((entry) => entry !== id), hidden: [...draft.hidden, id] });
  }

  // Back into the shorter column.
  function show(id: WidgetId) {
    const area = draft.left.length <= draft.right.length ? "left" : "right";
    onChange({ ...draft, hidden: draft.hidden.filter((entry) => entry !== id), [area]: [...draft[area], id] });
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-3">
        <p className="mr-auto text-sm text-muted-foreground">Karten an ihrem Griff verschieben, ausblenden oder wieder einblenden.</p>
        <Button variant="ghost" size="sm" onClick={() => onChange(defaultOverviewLayout)}>
          <RotateCcwIcon /> Standard
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button variant="brand" size="sm" onClick={onSave}>
          <CheckIcon /> Fertig
        </Button>
      </div>

      {draft.hidden.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
          <span className="text-muted-foreground">Ausgeblendet:</span>
          {draft.hidden.map((id) => (
            <Button key={id} variant="outline" size="sm" onClick={() => show(id)}>
              <PlusIcon /> {labelOf(id)}
            </Button>
          ))}
        </div>
      )}

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCorners} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <Area id="top" items={draft.top} label="Ganze Breite">
          {draft.top.map((id) => (
            <EditableWidget key={id} id={id} onHide={() => hide(id)}>
              {widgets[id]()}
            </EditableWidget>
          ))}
        </Area>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {(["left", "right"] as const).map((area) => (
            <Area key={area} id={area} items={draft[area]} label={area === "left" ? "Linke Spalte" : "Rechte Spalte"}>
              {draft[area].map((id) => (
                <EditableWidget key={id} id={id} onHide={() => hide(id)}>
                  {widgets[id]()}
                </EditableWidget>
              ))}
            </Area>
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Area({ id, items, label, children }: { id: OverviewArea; items: WidgetId[]; label: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
      <section
        ref={setNodeRef}
        aria-label={label}
        className={cn("mb-6 min-h-20 space-y-4 rounded-xl border border-dashed p-2 transition-colors", isOver && "border-brand bg-accent/40")}
      >
        {items.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{label}: hierher ziehen</p>}
        {children}
      </section>
    </SortableContext>
  );
}

function EditableWidget({ id, onHide, children }: { id: WidgetId; onHide: () => void; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("overflow-hidden rounded-xl border bg-background shadow-xs", isDragging && "relative z-10 opacity-80 shadow-lg")}
    >
      <div className="flex items-center gap-1 border-b bg-muted/50 py-1 pr-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`${labelOf(id)} verschieben`}
          className="inline-flex size-8 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <span className="flex-1 truncate text-sm font-medium">{labelOf(id)}</span>
        <Button variant="ghost" size="sm" onClick={onHide} className="text-muted-foreground">
          <EyeOffIcon /> Ausblenden
        </Button>
      </div>
      {/* A preview: not clickable while arranging, and not too tall to drag. */}
      <div inert className="pointer-events-none max-h-64 overflow-hidden p-2 opacity-70 select-none">
        {children}
      </div>
    </div>
  );
}

// --- Cards -----------------------------------------------------------------------

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

function Stat({
  label,
  value,
  detail,
  progress,
  mono,
}: {
  label: string;
  value: string;
  detail?: string;
  progress?: number;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-4 py-3">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className={`truncate text-lg font-medium ${mono ? "font-mono" : ""}`}>{value}</dd>
      {progress !== undefined && (
        <dd className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand" style={{ width: `${progress * 100}%` }} />
        </dd>
      )}
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
