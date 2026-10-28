"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BookMarkedIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CopyIcon,
  CrosshairIcon,
  DownloadIcon,
  EllipsisIcon,
  GripVerticalIcon,
  ImageIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  ListTreeIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addSection, createOutline, deleteSection, saveOutline, saveSection } from "./actions";
import {
  countWords,
  formatWords,
  MAX_DEPTH,
  normalizeDepths,
  numbering,
  sectionStatuses,
  subtreeEnd,
  toLatex,
  toMarkdown,
  type ExportImage,
  type Section,
  type SectionStatus,
} from "./writing";

export type CitableSource = { key: string; label: string };

const SAVE_DELAY_MS = 800;
const template = ["Einleitung", "Grundlagen", "Methodik", "Ergebnisse", "Diskussion", "Fazit und Ausblick"];

// Where the text cursor of each section's textarea was, for inserting
// citations and images from the dialogs.
type Cursor = { id: string; start: number; end: number };

// The thesis as an outline: numbered sections with text, folded in and out,
// moved by dragging (with everything below them), indented with Tab. Every
// change saves in the background.
export function Writer({
  initial,
  sources,
  images,
}: {
  initial: Section[];
  sources: CitableSource[];
  images: ExportImage[];
}) {
  const [sections, setSections] = useState(initial);
  const [collapsed, setCollapsed] = useStoredSet("thesis-writer-collapsed");
  const [outlineOnly, setOutlineOnly] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [toolsId, setToolsId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  const [picker, setPicker] = useState<"cite" | "image" | null>(null);
  const cursor = useRef<Cursor | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, Partial<Section>>());
  // The new section whose title gets the focus.
  const [focusTitle, setFocusTitle] = useState<string | null>(null);
  // A new section keeps its React key when its temporary id is replaced, so
  // its title field stays focused while the server creates it.
  const [keys, setKeys] = useState<Record<string, string>>({});
  const keyOf = (id: string) => keys[id] ?? id;
  const tempCount = useRef(0);
  // The outline as last rendered, and the chain of order saves (one at a
  // time, each with the order at that moment, so they can't overtake).
  const latest = useRef(sections);
  useEffect(() => {
    latest.current = sections;
  });
  const orderQueue = useRef<Promise<unknown>>(Promise.resolve());

  const numbers = numbering(sections);
  const totalWords = sections.reduce((sum, section) => sum + countWords(section.body), 0);
  const done = sections.filter((section) => section.status === "done").length;

  // --- Saving ------------------------------------------------------------------

  async function persist(action: () => Promise<unknown>) {
    setSaving((count) => count + 1);
    try {
      await action();
    } catch {
      toast.error("Speichern hat nicht geklappt. Prüf deine Verbindung.");
    } finally {
      setSaving((count) => count - 1);
    }
  }

  function flush(id: string) {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    const patch = pending.current.get(id);
    if (!patch || id.startsWith("tmp-")) return;
    pending.current.delete(id);
    void persist(() => saveSection(id, patch));
  }

  // Changes text right away and saves it a moment after the last keystroke.
  function edit(id: string, patch: Partial<Section>, delay = SAVE_DELAY_MS) {
    setSections((current) => current.map((section) => (section.id === id ? { ...section, ...patch } : section)));
    pending.current.set(id, { ...pending.current.get(id), ...patch });
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => flush(id), delay));
  }

  useEffect(() => {
    const timersNow = timers.current;
    const onLeave = () => {
      for (const id of [...timersNow.keys()]) flush(id);
    };
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      onLeave();
    };
    // flush only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Saves order and depths of all sections that exist on the server.
  function saveOrder(list: Section[]) {
    const order = list.filter((section) => !section.id.startsWith("tmp-")).map(({ id, depth }) => ({ id, depth }));
    const run = orderQueue.current.then(() => saveOutline(order));
    orderQueue.current = run.catch(() => {});
    void persist(() => run);
  }

  function setOutline(next: Section[]) {
    const normalized = normalizeDepths(next);
    latest.current = normalized;
    setSections(normalized);
    saveOrder(normalized);
  }

  // --- Structure ---------------------------------------------------------------

  function add(index: number | null, depth: number, title = "") {
    const temp = `tmp-${++tempCount.current}`;
    const at = index === null ? sections.length : subtreeEnd(sections, index);
    const section: Section = { id: temp, depth, title, body: "", status: "open", targetWords: null };
    const next = normalizeDepths([...sections.slice(0, at), section, ...sections.slice(at)]);
    latest.current = next;
    setSections(next);
    setFocusTitle(temp);
    void persist(async () => {
      const id = await addSection({ title, depth: next[at].depth });
      setKeys((current) => ({ ...current, [id]: temp }));
      // Moved or indented meanwhile: the current outline counts.
      const now = latest.current.map((entry) => (entry.id === temp ? { ...entry, id } : entry));
      latest.current = now;
      setSections(now);
      saveOrder(now);
      // Typed while it was being created.
      const typed = pending.current.get(temp);
      if (typed) {
        pending.current.delete(temp);
        pending.current.set(id, typed);
        flush(id);
      }
    });
  }

  function addTemplate() {
    void persist(async () => {
      const ids = await createOutline(template);
      const created = ids.map((id, index): Section => ({ id, depth: 0, title: template[index], body: "", status: "open", targetWords: null }));
      latest.current = created;
      setSections(created);
    });
  }

  function move(index: number, by: -1 | 1) {
    const end = subtreeEnd(sections, index);
    const depth = sections[index].depth;
    const block = sections.slice(index, end);
    const rest = [...sections.slice(0, index), ...sections.slice(end)];
    let at: number;
    if (by === -1) {
      let previous = index - 1;
      while (previous >= 0 && sections[previous].depth > depth) previous--;
      if (previous < 0 || sections[previous].depth < depth) return;
      at = previous;
    } else {
      if (end >= sections.length || sections[end].depth < depth) return;
      at = subtreeEnd(sections, end) - block.length;
    }
    setOutline([...rest.slice(0, at), ...block, ...rest.slice(at)]);
  }

  function shift(index: number, by: -1 | 1) {
    const end = subtreeEnd(sections, index);
    const depth = sections[index].depth + by;
    if (depth < 0 || depth > MAX_DEPTH) return;
    if (by === 1 && (index === 0 || sections[index - 1].depth < sections[index].depth)) return;
    if (sections.slice(index, end).some((section) => section.depth + by > MAX_DEPTH)) return;
    setOutline(sections.map((section, at) => (at >= index && at < end ? { ...section, depth: section.depth + by } : section)));
  }

  function remove(index: number) {
    const section = sections[index];
    const words = countWords(section.body);
    if (!window.confirm(`„${section.title || "Ohne Titel"}“ löschen${words ? ` (${formatWords(words)})` : ""}? Unterabschnitte bleiben erhalten.`)) return;
    clearTimeout(timers.current.get(section.id));
    pending.current.delete(section.id);
    setOutline(sections.filter((_, at) => at !== index));
    if (!section.id.startsWith("tmp-")) void persist(() => deleteSection(section.id));
    if (focusId === section.id) setFocusId(null);
  }

  // --- What is shown -----------------------------------------------------------

  const focusStart = focusId ? sections.findIndex((section) => section.id === focusId) : -1;
  const range: [number, number] = focusStart >= 0 ? [focusStart, subtreeEnd(sections, focusStart)] : [0, sections.length];
  const visible: number[] = [];
  let hiddenBelow: number | null = null;
  for (let index = range[0]; index < range[1]; index++) {
    const section = sections[index];
    if (hiddenBelow !== null && section.depth > hiddenBelow) continue;
    hiddenBelow = collapsed.has(section.id) || section.id === dragId ? section.depth : null;
    visible.push(index);
  }

  // --- Dragging ----------------------------------------------------------------

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dndId = useId();

  function onDragStart({ active }: DragStartEvent) {
    setDragId(String(active.id));
  }

  // The dragged section takes the place of the one it was dropped on, with
  // everything below it, keeping its depth where the outline allows it.
  function onDragEnd({ active, over }: DragEndEvent) {
    setDragId(null);
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((section) => section.id === active.id);
    const end = subtreeEnd(sections, from);
    const block = sections.slice(from, end);
    const rest = [...sections.slice(0, from), ...sections.slice(end)];
    const target = rest.findIndex((section) => section.id === over.id);
    const down = sections.findIndex((section) => section.id === over.id) > from;
    const at = down ? (collapsed.has(String(over.id)) ? subtreeEnd(rest, target) : target + 1) : target;
    const before = rest[at - 1];
    const depth = Math.min(block[0].depth, before ? before.depth + 1 : 0);
    const moved = block.map((section) => ({ ...section, depth: Math.min(MAX_DEPTH, section.depth - block[0].depth + depth) }));
    setOutline([...rest.slice(0, at), ...moved, ...rest.slice(at)]);
  }

  // --- Inserting citations and images -------------------------------------------

  function insert(text: string, block = false) {
    const at = cursor.current;
    const section = sections.find((entry) => entry.id === at?.id);
    if (!at || !section) {
      toast.info("Setz zuerst den Cursor in einen Text.");
      return;
    }
    const before = section.body.slice(0, at.start);
    const after = section.body.slice(at.end);
    const piece = block ? `${before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : ""}${text}\n\n` : text;
    edit(section.id, { body: before + piece + after });
    cursor.current = { id: section.id, start: at.start + piece.length, end: at.start + piece.length };
    setPicker(null);
  }

  // --- Export -------------------------------------------------------------------

  function downloadLatex() {
    const blob = new Blob([toLatex(sections, images)], { type: "application/x-tex" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "arbeit.tex";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(toMarkdown(sections));
      toast.success("Als Markdown kopiert");
    } catch {
      toast.error("Kopieren hat nicht geklappt.");
    }
  }

  if (sections.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed p-6 text-center">
        <ListTreeIcon className="mx-auto size-8 text-muted-foreground" />
        <p className="font-medium">Schreib deine Arbeit hier, ohne Formatierung</p>
        <p className="text-sm text-muted-foreground">
          Leg eine Gliederung an und schreib den Text darunter. Abschnitte lassen sich verschieben, einklappen und am Ende als
          LaTeX exportieren.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="brand" onClick={addTemplate}>
            <ListTreeIcon /> Typische Gliederung
          </Button>
          <Button variant="outline" onClick={() => add(null, 0)}>
            <PlusIcon /> Leeres Kapitel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav aria-label="Gliederung" className="sticky top-4 max-h-[calc(100dvh-2rem)] space-y-0.5 overflow-y-auto text-sm">
          {sections.map((section, index) => (
            <a
              key={section.id}
              href={`#section-${section.id}`}
              onClick={() => {
                if (focusId && (index < range[0] || index >= range[1])) setFocusId(null);
              }}
              className={cn(
                "flex gap-1.5 rounded px-2 py-1 hover:bg-accent",
                section.depth === 0 ? "font-medium" : "text-muted-foreground",
              )}
              style={{ paddingLeft: `${0.5 + section.depth * 0.75}rem` }}
            >
              <span className="font-mono text-xs leading-5 text-muted-foreground">{numbers[index]}</span>
              <span className="min-w-0 flex-1 truncate">{section.title || "Ohne Titel"}</span>
              {section.status === "done" && <CheckIcon className="size-3.5 shrink-0 text-brand" />}
            </a>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-3">
        <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-3">
          <p className="mr-auto text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{formatWords(totalWords)}</span> · {done}/{sections.length} fertig ·{" "}
            {saving > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Loader2Icon className="size-3 animate-spin" /> speichert
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <CheckIcon className="size-3 text-brand" /> gespeichert
              </span>
            )}
          </p>
          <Button variant={outlineOnly ? "secondary" : "ghost"} size="sm" aria-pressed={outlineOnly} onClick={() => setOutlineOnly(!outlineOnly)}>
            <ListTreeIcon /> Nur Gliederung
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(collapsed.size > 0 ? new Set() : new Set(sections.map((section) => section.id)))}
          >
            {collapsed.size > 0 ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
            {collapsed.size > 0 ? "Alle aufklappen" : "Alle einklappen"}
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadLatex}>
            <DownloadIcon /> LaTeX
          </Button>
          <Button variant="ghost" size="sm" onClick={copyMarkdown}>
            <CopyIcon /> Markdown
          </Button>
        </div>

        {focusId && focusStart >= 0 && (
          <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
            <CrosshairIcon className="size-4" />
            <span className="flex-1">
              Fokus: {numbers[focusStart]} {sections[focusStart].title || "Ohne Titel"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setFocusId(null)}>
              Alles zeigen
            </Button>
          </p>
        )}

        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragId(null)}
        >
          <SortableContext items={visible.map((index) => sections[index].id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {visible.map((index) => {
                const section = sections[index];
                const hasChildren = index + 1 < sections.length && sections[index + 1].depth > section.depth;
                return (
                  <SectionCard
                    key={keyOf(section.id)}
                    section={section}
                    number={numbers[index]}
                    collapsed={collapsed.has(section.id)}
                    hasChildren={hasChildren}
                    outlineOnly={outlineOnly}
                    toolsOpen={toolsId === section.id}
                    autoFocusTitle={focusTitle === section.id}
                    sources={sources}
                    images={images}
                    onTitleFocused={() => {
                      if (focusTitle === section.id) setFocusTitle(null);
                    }}
                    onToggle={() => {
                      const next = new Set(collapsed);
                      if (next.has(section.id)) next.delete(section.id);
                      else next.add(section.id);
                      setCollapsed(next);
                    }}
                    onTools={() => setToolsId(toolsId === section.id ? null : section.id)}
                    onEdit={(patch, delay) => edit(section.id, patch, delay)}
                    onBlur={() => flush(section.id)}
                    onCursor={(start, end) => (cursor.current = { id: section.id, start, end })}
                    onAddAfter={() => add(index, section.depth)}
                    onAddChild={() => {
                      if (collapsed.has(section.id)) {
                        const next = new Set(collapsed);
                        next.delete(section.id);
                        setCollapsed(next);
                      }
                      add(index, Math.min(MAX_DEPTH, section.depth + 1));
                    }}
                    onShift={(by) => shift(index, by)}
                    onMove={(by) => move(index, by)}
                    onFocus={() => setFocusId(focusId === section.id ? null : section.id)}
                    onDelete={() => remove(index)}
                    onPick={(kind) => setPicker(kind)}
                  />
                );
              })}
            </ol>
          </SortableContext>
        </DndContext>

        <Button variant="ghost" className="w-full border border-dashed" onClick={() => add(null, 0)}>
          <PlusIcon /> Kapitel hinzufügen
        </Button>
        <p className="text-xs text-muted-foreground">
          Im Titel: Enter = neuer Abschnitt, Tab / Umschalt+Tab = ein- / ausrücken, Alt+↑/↓ = verschieben. Im Text: Leerzeile =
          neuer Absatz, **fett**, *kursiv*, „- “ für Listen, [@schlüssel] zitiert eine Quelle.
        </p>
      </div>

      <SourcePicker
        open={picker === "cite"}
        onOpenChange={(open) => !open && setPicker(null)}
        sources={sources}
        onPick={(key) => insert(`[@${key}]`)}
      />
      <ImagePicker
        open={picker === "image"}
        onOpenChange={(open) => !open && setPicker(null)}
        images={images}
        onPick={(image) => insert(`![${image.title}](doc:${image.id})`, true)}
      />
    </div>
  );
}

function SectionCard({
  section,
  number,
  collapsed,
  hasChildren,
  outlineOnly,
  toolsOpen,
  autoFocusTitle,
  sources,
  images,
  onTitleFocused,
  onToggle,
  onTools,
  onEdit,
  onBlur,
  onCursor,
  onAddAfter,
  onAddChild,
  onShift,
  onMove,
  onFocus,
  onDelete,
  onPick,
}: {
  section: Section;
  number: string;
  collapsed: boolean;
  hasChildren: boolean;
  outlineOnly: boolean;
  toolsOpen: boolean;
  autoFocusTitle: boolean;
  sources: CitableSource[];
  images: ExportImage[];
  onTitleFocused: () => void;
  onToggle: () => void;
  onTools: () => void;
  onEdit: (patch: Partial<Section>, delay?: number) => void;
  onBlur: () => void;
  onCursor: (start: number, end: number) => void;
  onAddAfter: () => void;
  onAddChild: () => void;
  onShift: (by: -1 | 1) => void;
  onMove: (by: -1 | 1) => void;
  onFocus: () => void;
  onDelete: () => void;
  onPick: (kind: "cite" | "image") => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: section.id.startsWith("tmp-"),
  });
  const words = countWords(section.body);
  const status = sectionStatuses.find((entry) => entry.value === section.status)!;
  const showBody = !collapsed && !outlineOnly;
  const [citeQuery, setCiteQuery] = useState<{ start: number; query: string } | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const citeOptions = citeQuery
    ? sources.filter((source) => `${source.key} ${source.label}`.toLowerCase().includes(citeQuery.query.toLowerCase())).slice(0, 6)
    : [];
  const figures = [...section.body.matchAll(/!\[([^\]]*)\]\(doc:([^)]*)\)/g)].map((match) => ({
    caption: match[1],
    image: images.find((image) => image.id === match[2]),
  }));

  function cycleStatus() {
    const order: SectionStatus[] = ["open", "draft", "done"];
    onEdit({ status: order[(order.indexOf(section.status) + 1) % order.length] }, 0);
  }

  function completeCitation(key: string) {
    if (!citeQuery || !textarea.current) return;
    const caret = textarea.current.selectionStart;
    const body = `${section.body.slice(0, citeQuery.start)}[@${key}]${section.body.slice(caret).replace(/^\]/, "")}`;
    onEdit({ body });
    setCiteQuery(null);
    const position = citeQuery.start + key.length + 3;
    requestAnimationFrame(() => {
      textarea.current?.setSelectionRange(position, position);
      onCursor(position, position);
    });
  }

  return (
    <li
      ref={setNodeRef}
      id={`section-${section.id}`}
      style={{ transform: CSS.Translate.toString(transform), transition, marginLeft: `${section.depth * 1.25}rem` }}
      className={cn("scroll-mt-16 rounded-xl border bg-card shadow-xs", isDragging && "relative z-10 opacity-80 shadow-lg")}
    >
      <div className="flex items-center gap-1 py-1 pr-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`${section.title || "Abschnitt"} verschieben`}
          className="inline-flex size-9 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground/60 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Aufklappen" : "Einklappen"}
          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent"
        >
          {collapsed ? <ChevronRightIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
        </button>
        <span className="shrink-0 font-mono text-sm text-muted-foreground">{number}</span>
        <input
          value={section.title}
          autoFocus={autoFocusTitle}
          onFocus={onTitleFocused}
          onChange={(event) => onEdit({ title: event.target.value })}
          onBlur={onBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAddAfter();
            } else if (event.key === "Tab") {
              event.preventDefault();
              onShift(event.shiftKey ? -1 : 1);
            } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
              event.preventDefault();
              onMove(event.key === "ArrowUp" ? -1 : 1);
            }
          }}
          maxLength={300}
          placeholder={section.depth === 0 ? "Kapitel" : "Abschnitt"}
          aria-label={`Titel von ${number}`}
          className={cn(
            "h-9 min-w-0 flex-1 rounded-md bg-transparent px-1 outline-none focus-visible:bg-accent/50",
            section.depth === 0 ? "text-lg font-semibold" : section.depth === 1 ? "font-semibold" : "font-medium",
          )}
        />
        {(collapsed || outlineOnly) && hasChildren && collapsed && <span className="text-xs text-muted-foreground">…</span>}
        <button
          type="button"
          onClick={cycleStatus}
          title="Status ändern"
          className={cn(
            "h-6 shrink-0 cursor-pointer rounded-full px-2 text-xs",
            section.status === "done"
              ? "bg-good text-good-foreground"
              : section.status === "draft"
                ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                : "bg-muted text-muted-foreground",
          )}
        >
          {status.label}
        </button>
        <Button variant="ghost" size="icon-sm" aria-label="Mehr" aria-expanded={toolsOpen} onClick={onTools} className="text-muted-foreground">
          <EllipsisIcon />
        </Button>
      </div>

      {toolsOpen && (
        <div className="flex flex-wrap items-center gap-1 border-t px-2 py-1.5">
          <Button variant="ghost" size="sm" onClick={() => onShift(-1)} disabled={section.depth === 0}>
            <IndentDecreaseIcon /> Ausrücken
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onShift(1)} disabled={section.depth === MAX_DEPTH}>
            <IndentIncreaseIcon /> Einrücken
          </Button>
          <Button variant="ghost" size="sm" onClick={onAddAfter}>
            <PlusIcon /> Danach
          </Button>
          {section.depth < MAX_DEPTH && (
            <Button variant="ghost" size="sm" onClick={onAddChild}>
              <PlusIcon /> Unterabschnitt
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onFocus}>
            <CrosshairIcon /> Fokus
          </Button>
          <label className="flex items-center gap-1 px-2 text-sm text-muted-foreground">
            Ziel
            <Input
              type="number"
              min={1}
              max={100000}
              step={50}
              defaultValue={section.targetWords ?? ""}
              onBlur={(event) => onEdit({ targetWords: event.target.value ? Number(event.target.value) : null }, 0)}
              className="h-8 w-20 font-mono"
            />
            Wörter
          </label>
          <Button variant="ghost" size="sm" onClick={onDelete} className="ml-auto text-destructive hover:text-destructive">
            <Trash2Icon /> Löschen
          </Button>
        </div>
      )}

      {showBody && (
        <div className="space-y-1.5 border-t px-3 pt-2 pb-2">
          <div className="relative">
            <textarea
              ref={textarea}
              value={section.body}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="sentences"
              onChange={(event) => {
                onEdit({ body: event.target.value });
                const caret = event.target.selectionStart;
                onCursor(caret, event.target.selectionEnd);
                const match = /\[@([^\]\s]*)$/.exec(event.target.value.slice(0, caret));
                setCiteQuery(match && sources.length > 0 ? { start: caret - match[0].length, query: match[1] } : null);
              }}
              onSelect={(event) => onCursor(event.currentTarget.selectionStart, event.currentTarget.selectionEnd)}
              onBlur={() => {
                onBlur();
                setTimeout(() => setCiteQuery(null), 150);
              }}
              onKeyDown={(event) => {
                if (citeQuery && citeOptions.length > 0 && (event.key === "Tab" || event.key === "Enter")) {
                  event.preventDefault();
                  completeCitation(citeOptions[0].key);
                } else if (event.key === "Escape") setCiteQuery(null);
              }}
              placeholder="Schreib los … Leerzeile = neuer Absatz, [@ zitiert eine Quelle"
              aria-label={`Text von ${number}`}
              className="field-sizing-content block min-h-14 w-full resize-none bg-transparent font-serif text-[15px] leading-7 outline-none placeholder:font-sans placeholder:text-sm placeholder:text-muted-foreground"
            />
            {citeQuery && citeOptions.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-popover text-sm shadow-md">
                {citeOptions.map((source, index) => (
                  <li
                    key={source.key}
                    className={cn("cursor-pointer px-3 py-1.5 hover:bg-accent", index === 0 && "bg-accent")}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      completeCitation(source.key);
                    }}
                  >
                    <span className="font-mono">@{source.key}</span>{" "}
                    <span className="text-muted-foreground">{source.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {figures.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {figures.map((figure, index) => (
                <li
                  key={index}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs",
                    !figure.image && "text-destructive",
                  )}
                >
                  <ImageIcon className="size-3" /> {figure.caption || figure.image?.title || "Bild"}
                  {!figure.image && " (Dokument fehlt)"}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onMouseDown={(event) => event.preventDefault()} onClick={() => onPick("cite")}>
              <BookMarkedIcon /> Quelle zitieren
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onMouseDown={(event) => event.preventDefault()} onClick={() => onPick("image")}>
              <ImageIcon /> Bild einfügen
            </Button>
            <span className="ml-auto font-mono">
              {words}
              {section.targetWords ? ` / ${section.targetWords}` : ""} Wörter
            </span>
          </div>
          {section.targetWords ? (
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (words / section.targetWords) * 100)}%` }} />
            </div>
          ) : null}
        </div>
      )}
    </li>
  );
}

function SourcePicker({
  open,
  onOpenChange,
  sources,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: CitableSource[];
  onPick: (key: string) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = sources.filter((source) => `${source.key} ${source.label}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col">
        <DialogHeader>
          <DialogTitle>Quelle zitieren</DialogTitle>
          <DialogDescription>Fügt [@schlüssel] ein; im LaTeX-Export wird daraus \parencite.</DialogDescription>
        </DialogHeader>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Suchen" aria-label="Quellen durchsuchen" autoFocus />
        <ul className="-mx-2 min-h-0 flex-1 divide-y overflow-y-auto">
          {shown.map((source) => (
            <li key={source.key}>
              <button type="button" onClick={() => onPick(source.key)} className="w-full cursor-pointer rounded-md p-2 text-left hover:bg-accent">
                <span className="block font-mono text-sm">@{source.key}</span>
                <span className="line-clamp-2 block text-sm text-muted-foreground">{source.label}</span>
              </button>
            </li>
          ))}
          {shown.length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">
              {sources.length === 0 ? "Noch keine Quellen. Leg sie im Tab Quellen an." : "Nichts gefunden."}
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function ImagePicker({
  open,
  onOpenChange,
  images,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: ExportImage[];
  onPick: (image: ExportImage) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col">
        <DialogHeader>
          <DialogTitle>Bild einfügen</DialogTitle>
          <DialogDescription>Bilder aus deinen Dokumenten. Die Beschriftung kannst du danach im Text ändern.</DialogDescription>
        </DialogHeader>
        <ul className="-mx-2 min-h-0 flex-1 divide-y overflow-y-auto">
          {images.map((image) => (
            <li key={image.id}>
              <button type="button" onClick={() => onPick(image)} className="flex w-full cursor-pointer items-center gap-2 rounded-md p-2 text-left hover:bg-accent">
                <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{image.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{image.fileName}</span>
                </span>
              </button>
            </li>
          ))}
          {images.length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">Noch keine Bilder. Lade sie im Tab Dokumente hoch.</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

// A set of ids kept in localStorage (here: which sections are folded in), so
// it stays as it was on the next visit on this device.
function useStoredSet(key: string): [Set<string>, (next: Set<string>) => void] {
  const raw = useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      window.addEventListener(`${key}-change`, callback);
      return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(`${key}-change`, callback);
      };
    },
    () => {
      try {
        return localStorage.getItem(key) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  const set = parseSet(raw);
  return [
    set,
    (next) => {
      try {
        localStorage.setItem(key, JSON.stringify([...next]));
      } catch {}
      window.dispatchEvent(new Event(`${key}-change`));
    },
  ];
}

const setCache = new Map<string, Set<string>>();
function parseSet(raw: string) {
  let set = setCache.get(raw);
  if (!set) {
    try {
      set = new Set(JSON.parse(raw) as string[]);
    } catch {
      set = new Set();
    }
    setCache.clear();
    setCache.set(raw, set);
  }
  return set;
}
