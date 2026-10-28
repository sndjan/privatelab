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
  BoldIcon,
  BookMarkedIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CircleIcon,
  CopyIcon,
  CrosshairIcon,
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  FileCodeIcon,
  GripVerticalIcon,
  ImageIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  ItalicIcon,
  ListIcon,
  ListTreeIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlusIcon,
  Redo2Icon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ViewLink as Link } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import { addSection, createOutline, deleteSection, saveOutline, saveSection } from "./actions";
import type { Phase } from "./data";
import { thesisQuery } from "./query";
import { WritingSession } from "./writing-session";
import {
  canIndent,
  countWords,
  estimatePages,
  figureMarkup,
  figurePattern,
  formatWords,
  joinBody,
  MAX_DEPTH,
  normalizeDepths,
  numbering,
  partOffset,
  sectionStatuses,
  splitBody,
  subtreeEnd,
  toLatex,
  toLatexDocument,
  toMarkdown,
  toOutline,
  type BodyPart,
  type ExportImage,
  type Section,
  type SectionComment,
  type SectionStatus,
} from "./writing";

const PATH = "/m/thesis";

export type CitableSource = { id: string; key: string; label: string; summary: string };
// An image from the documents with a short-lived preview link.
export type WriterImage = ExportImage & { url: string | null };

const SAVE_DELAY_MS = 800;
const template = ["Einleitung", "Grundlagen", "Methodik", "Ergebnisse", "Diskussion", "Fazit und Ausblick"];

// Where the text cursor of each section's textarea was, for inserting
// citations and images from the dialogs.
type Cursor = { id: string; start: number; end: number };

// Undo and redo: the whole outline before each change. Typing in one field
// counts as one step until a pause.
const HISTORY_SIZE = 200;
const TYPING_PAUSE_MS = 1000;
// Outside the component: only called from event handlers.
const clock = () => Date.now();
type FocusRequest = { id: string; field: "title" | "body"; offset: number; nonce: number };

// The thesis as an outline: numbered sections with text, folded in and out,
// moved by dragging (with everything below them), indented with Tab. Every
// change saves in the background.
export function Writer({
  initial,
  title,
  targetPages,
  wordsPerPage,
  sources,
  images,
  phases,
  today,
}: {
  initial: Section[];
  phases: Phase[];
  today: string;
  title: string;
  targetPages: number | null;
  wordsPerPage: number;
  sources: CitableSource[];
  images: WriterImage[];
}) {
  const [sections, setSections] = useState(initial);
  const [collapsed, setCollapsed] = useStoredSet("thesis-writer-collapsed");
  // View options remembered on this device, e.g. "hide-images".
  const [view, setView] = useStoredSet("thesis-writer-view");
  const showImages = !view.has("hide-images");
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
  const undoStack = useRef<Section[][]>([]);
  const redoStack = useRef<Section[][]>([]);
  const typing = useRef<{ key: string; at: number } | null>(null);
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const root = useRef<HTMLDivElement>(null);
  // The cache follows the outline, so coming back to this tab shows the text
  // as typed, saved or not.
  const queryClient = useQueryClient();
  useEffect(() => {
    queryClient.setQueryData(thesisQuery("sections").queryKey, sections);
  }, [queryClient, sections]);

  const numbers = numbering(sections);
  const totalWords = sections.reduce((sum, section) => sum + countWords(section.body), 0);
  const done = sections.filter((section) => section.status === "done").length;
  const pages = estimatePages(sections, wordsPerPage);

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

  function schedule(id: string, patch: Partial<Section>, delay: number) {
    pending.current.set(id, { ...pending.current.get(id), ...patch });
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => flush(id), delay));
  }

  // Changes text right away and saves it a moment after the last keystroke.
  // typed: keystrokes in a title or text, which are undone together.
  function edit(id: string, patch: Partial<Section>, delay = SAVE_DELAY_MS, typed = false) {
    record(typed ? `${id}:${Object.keys(patch).join()}` : null);
    setSections((current) => current.map((section) => (section.id === id ? { ...section, ...patch } : section)));
    schedule(id, patch, delay);
  }

  // --- Undo and redo -------------------------------------------------------------

  function syncHistory() {
    setHistory({ undo: undoStack.current.length, redo: redoStack.current.length });
  }

  // Remembers the outline before a change. Keystrokes in the same field
  // without a pause belong to the step of the first one.
  function record(typingKey: string | null) {
    const now = clock();
    if (typingKey && typing.current?.key === typingKey && now - typing.current.at < TYPING_PAUSE_MS) {
      typing.current.at = now;
      return;
    }
    typing.current = typingKey ? { key: typingKey, at: now } : null;
    undoStack.current.push(sections);
    if (undoStack.current.length > HISTORY_SIZE) undoStack.current.shift();
    redoStack.current = [];
    syncHistory();
  }

  // A section got its real id (or a new one when it was restored).
  function renameInHistory(from: string, to: string) {
    const rename = (list: Section[]) => list.map((section) => (section.id === from ? { ...section, id: to } : section));
    undoStack.current = undoStack.current.map(rename);
    redoStack.current = redoStack.current.map(rename);
  }

  function step(from: Section[][], to: Section[][]) {
    const target = from.pop();
    if (!target) return;
    to.push(sections);
    typing.current = null;
    restore(target);
    syncHistory();
  }

  const undo = () => step(undoStack.current, redoStack.current);
  const redo = () => step(redoStack.current, undoStack.current);

  // Brings the outline back to an earlier state and saves the difference:
  // changed texts, the order, deleted sections and ones that come back.
  function restore(target: Section[]) {
    const current = sections;
    const ids = new Set(target.map((section) => section.id));
    for (const section of current) {
      if (ids.has(section.id)) continue;
      clearTimeout(timers.current.get(section.id));
      pending.current.delete(section.id);
      if (!section.id.startsWith("tmp-")) void persist(() => deleteSection(section.id));
    }
    const restored = target.map((section) => {
      const now = current.find((entry) => entry.id === section.id);
      if (!now) return recreate(section);
      const patch = changes(now, section);
      if (patch) schedule(section.id, patch, 0);
      return section;
    });
    setOutline(restored);
    focusChange(current, restored);
  }

  // A deleted section comes back under a new id.
  function recreate(section: Section): Section {
    const temp = `tmp-${++tempCount.current}`;
    renameInHistory(section.id, temp);
    const { body, status, targetWords, comments } = section;
    pending.current.set(temp, { body, status, targetWords, comments });
    createOnServer(temp, section.title, section.depth);
    return { ...section, id: temp };
  }

  // Puts the cursor where undo or redo changed something.
  function focusChange(from: Section[], to: Section[]) {
    for (const section of to) {
      const before = from.find((entry) => entry.id === section.id);
      if (!before) continue;
      for (const field of ["body", "title"] as const) {
        const [old, now] = [before[field], section[field]];
        if (old === now) continue;
        let common = 0;
        while (common < old.length && common < now.length && old[common] === now[common]) common++;
        setFocusRequest({ id: section.id, field, offset: common + Math.max(0, now.length - old.length), nonce: ++tempCount.current });
        return;
      }
    }
  }

  // Strg+Z, Strg+Umschalt+Z and Strg+Y in titles and texts of the writer, or
  // when nothing else has the focus. Other fields keep the browser's undo.
  const shortcuts = useRef<{ undo: () => void; redo: () => void } | null>(null);
  useEffect(() => {
    shortcuts.current = { undo, redo };
  });
  useEffect(() => {
    const ours = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.closest("[role=dialog]")) return false;
      const field = target.closest("input, textarea, select, [contenteditable=true]");
      if (field) return field.hasAttribute("data-writer-field");
      return target === document.body || root.current?.contains(target) === true;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || !ours(event.target)) return;
      const key = event.key.toLowerCase();
      const isRedo = (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey);
      if (key !== "z" && !isRedo) return;
      event.preventDefault();
      if (isRedo) shortcuts.current?.redo();
      else shortcuts.current?.undo();
    };
    // Undo from the browser's menu or a shake on the phone.
    const onBeforeInput = (event: InputEvent) => {
      if ((event.inputType !== "historyUndo" && event.inputType !== "historyRedo") || !ours(event.target)) return;
      event.preventDefault();
      if (event.inputType === "historyRedo") shortcuts.current?.redo();
      else shortcuts.current?.undo();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("beforeinput", onBeforeInput);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("beforeinput", onBeforeInput);
    };
  }, []);

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
    record(null);
    const temp = `tmp-${++tempCount.current}`;
    const at = index === null ? sections.length : subtreeEnd(sections, index);
    const section: Section = { id: temp, depth, title, body: "", status: "open", targetWords: null, comments: [] };
    const next = normalizeDepths([...sections.slice(0, at), section, ...sections.slice(at)]);
    latest.current = next;
    setSections(next);
    setFocusTitle(temp);
    createOnServer(temp, title, next[at].depth);
  }

  function createOnServer(temp: string, title: string, depth: number) {
    void persist(async () => {
      const id = await addSection({ title, depth });
      // Undone while it was being created.
      if (!latest.current.some((entry) => entry.id === temp)) {
        pending.current.delete(temp);
        await deleteSection(id);
        return;
      }
      setKeys((current) => ({ ...current, [id]: current[temp] ?? temp }));
      renameInHistory(temp, id);
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
      const created = ids.map(
        (id, index): Section => ({ id, depth: 0, title: template[index], body: "", status: "open", targetWords: null, comments: [] }),
      );
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
    record(null);
    setOutline([...rest.slice(0, at), ...block, ...rest.slice(at)]);
  }

  function shift(index: number, by: -1 | 1) {
    const end = subtreeEnd(sections, index);
    const depth = sections[index].depth + by;
    if (depth < 0 || depth > MAX_DEPTH) return;
    if (by === 1 && !canIndent(sections, index)) return;
    record(null);
    setOutline(sections.map((section, at) => (at >= index && at < end ? { ...section, depth: section.depth + by } : section)));
  }

  async function remove(index: number) {
    const section = sections[index];
    const words = countWords(section.body);
    const ok = await confirmDialog({
      title: `„${section.title || "Ohne Titel"}“ löschen?`,
      description: `${words ? `Der Text (${formatWords(words)}) geht verloren. ` : ""}Unterabschnitte bleiben erhalten.`,
    });
    if (!ok) return;
    record(null);
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
    record(null);
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

  function download(text: string, fileName: string, type: string) {
    const blob = new Blob([text], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} kopiert`);
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
    <div ref={root} className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
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
        <div className="sticky top-0 z-20 -mx-4 flex items-center gap-1 border-b bg-background/95 px-4 py-1.5 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-3">
          <p className="mr-auto min-w-0 truncate text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{formatWords(totalWords)}</span>
            {" · "}
            <span className="font-mono" title={`Geschätzt mit ${wordsPerPage} Wörtern pro Seite, Bilder als halbe Seite`}>
              ≈ {formatPages(pages)}
              {targetPages ? ` / ${targetPages}` : ""} S.
            </span>
            {" · "}
            {done}/{sections.length} fertig
          </p>
          {/* Same width while saving and when saved, so nothing shifts. */}
          <span className="inline-flex w-24 shrink-0 items-center justify-end gap-1 text-xs text-muted-foreground" aria-live="polite">
            {saving > 0 ? (
              <>
                <Loader2Icon className="size-3 animate-spin" /> speichert
              </>
            ) : (
              <>
                <CheckIcon className="size-3 text-brand" /> gespeichert
              </>
            )}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={undo}
            disabled={history.undo === 0}
            aria-label="Rückgängig"
            title="Rückgängig (Strg+Z)"
          >
            <Undo2Icon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={redo}
            disabled={history.redo === 0}
            aria-label="Wiederherstellen"
            title="Wiederherstellen (Strg+Umschalt+Z)"
          >
            <Redo2Icon />
          </Button>
          <WritingSession sections={sections} phases={phases} today={today} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <EyeIcon /> <span className="hidden sm:inline">Ansicht</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem checked={outlineOnly} onCheckedChange={(checked) => setOutlineOnly(checked === true)}>
                Nur Gliederung
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showImages}
                onCheckedChange={(checked) => {
                  const next = new Set(view);
                  if (checked) next.delete("hide-images");
                  else next.add("hide-images");
                  setView(next);
                }}
              >
                Bilder im Text zeigen
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCollapsed(new Set(sections.map((section) => section.id)))}>
                <ChevronsDownUpIcon /> Alle einklappen
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCollapsed(new Set())} disabled={collapsed.size === 0}>
                <ChevronsUpDownIcon /> Alle aufklappen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <DownloadIcon /> <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>LaTeX</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => download(toLatexDocument(sections, images, title), "main.tex", "application/x-tex")}>
                <FileCodeIcon />
                <span className="flex flex-col">
                  Komplettes Dokument
                  <span className="text-xs text-muted-foreground">main.tex, kompiliert so in Overleaf</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => download(toLatex(sections, images), "arbeit.tex", "application/x-tex")}>
                <FileCodeIcon />
                <span className="flex flex-col">
                  Nur der Inhalt
                  <span className="text-xs text-muted-foreground">arbeit.tex für \input in deine Vorlage</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Gliederung zum Absprechen</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => void copy(toOutline(sections), "Gliederung")}>
                <ListTreeIcon /> Gliederung kopieren
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copy(toOutline(sections, { withWords: true }), "Gliederung")}>
                <ListTreeIcon /> Mit Wortzahlen kopieren
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => download(toOutline(sections), "gliederung.txt", "text/plain")}>
                <DownloadIcon /> Als gliederung.txt
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void copy(toMarkdown(sections), "Markdown")}>
                <CopyIcon /> Alles als Markdown kopieren
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {targetPages ? (
            <div
              role="progressbar"
              aria-label="Umfang geschätzt"
              aria-valuemin={0}
              aria-valuemax={targetPages}
              aria-valuenow={Math.round(pages)}
              className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden sm:inset-x-2"
            >
              <div className="h-full bg-brand" style={{ width: `${Math.min(100, (pages / targetPages) * 100)}%` }} />
            </div>
          ) : null}
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
                    indentable={canIndent(sections, index)}
                    outlineOnly={outlineOnly}
                    showImages={showImages}
                    toolsOpen={toolsId === section.id}
                    autoFocusTitle={focusTitle === section.id}
                    focusRequest={focusRequest?.id === section.id ? focusRequest : null}
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
                    onType={(patch) => edit(section.id, patch, SAVE_DELAY_MS, true)}
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
          neuer Absatz, **fett** (Strg+B), *kursiv* (Strg+I), „- “ für Listen, [@schlüssel] zitiert eine Quelle. Rechtsklick auf
          markierten Text zeigt alle Funktionen. Strg+Z / Strg+Umschalt+Z macht rückgängig und stellt wieder her.
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
        onPick={(image) => insert(figureMarkup(image.title, image.id), true)}
      />
    </div>
  );
}

function SectionCard({
  section,
  number,
  collapsed,
  hasChildren,
  indentable,
  outlineOnly,
  showImages,
  toolsOpen,
  autoFocusTitle,
  focusRequest,
  sources,
  images,
  onTitleFocused,
  onToggle,
  onTools,
  onEdit,
  onType,
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
  indentable: boolean;
  outlineOnly: boolean;
  showImages: boolean;
  toolsOpen: boolean;
  autoFocusTitle: boolean;
  focusRequest: FocusRequest | null;
  sources: CitableSource[];
  images: WriterImage[];
  onTitleFocused: () => void;
  onToggle: () => void;
  onTools: () => void;
  onEdit: (patch: Partial<Section>, delay?: number) => void;
  onType: (patch: Partial<Section>) => void;
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
  // citeQuery.start is in the whole text; part is the text field it's typed in.
  const [citeQuery, setCiteQuery] = useState<{ part: number; start: number; query: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // The selection the context menu or a comment works on. It stays marked
  // while the field doesn't have the focus (for this text only).
  const [held, setHeld] = useState<{ body: string; start: number; end: number } | null>(null);
  const keepHeld = useRef(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draftComment, setDraftComment] = useState("");
  const commentInput = useRef<HTMLInputElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  // The text fields between the images, and the one last focused.
  const fields = useRef<(HTMLTextAreaElement | null)[]>([]);
  const activePart = useRef(0);
  const partsOf = (body: string): BodyPart[] =>
    showImages ? splitBody(body) : [{ kind: "text", text: body, lead: "", trail: "" }];
  const parts = partsOf(section.body);
  const marked = held && held.body === section.body ? held : null;
  const citeOptions = citeQuery
    ? sources.filter((source) => matches(source, citeQuery.query)).slice(0, 6)
    : [];
  // Images inside a line (not on their own) and all of them while images are
  // hidden show up as chips below the text.
  const chipFigures = parts.flatMap((part) =>
    part.kind === "text"
      ? [...part.text.matchAll(figurePattern)].map((match) => ({
          caption: match[1],
          image: images.find((image) => image.id === match[2]),
        }))
      : [],
  );
  const citedKeys = [
    ...new Set(
      [...section.body.matchAll(/\[@([^\],]+)(?:,[^\]]*)?\]/g)].flatMap((match) =>
        match[1].split(/[;\s]+@?/).filter(Boolean),
      ),
    ),
  ];
  const openComments = section.comments.filter((comment) => !comment.resolved).length;

  // The selection in the whole text: the marked one, or the one of the text
  // field last used.
  function selection() {
    if (marked) return { start: marked.start, end: marked.end };
    const index = activePart.current;
    const field = fields.current[index];
    if (!field || parts[index]?.kind !== "text") return null;
    const base = partOffset(parts, index);
    return { start: base + field.selectionStart, end: base + field.selectionEnd };
  }

  // Selects a range of the whole text in the field that shows it, once the
  // new text is on screen.
  function selectInBody(body: string, start: number, end = start) {
    requestAnimationFrame(() => {
      const now = partsOf(body);
      let index = now.length - 1;
      for (let at = 0; at < now.length; at++) {
        const part = now[at];
        if (part.kind === "text" && start <= partOffset(now, at) + part.text.length) {
          index = at;
          break;
        }
      }
      const field = fields.current[index];
      const part = now[index];
      if (!field || part.kind !== "text") return;
      const base = partOffset(now, index);
      const clamp = (value: number) => Math.max(0, Math.min(part.text.length, value - base));
      field.focus();
      field.setSelectionRange(clamp(start), clamp(end));
      onCursor(base + clamp(start), base + clamp(end));
    });
  }

  // Undo and redo put the cursor where they changed something.
  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.field === "title") {
      titleInput.current?.focus();
      titleInput.current?.setSelectionRange(focusRequest.offset, focusRequest.offset);
    } else if (showBody) {
      selectInBody(section.body, focusRequest.offset);
    }
    // Only for a new request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  function cycleStatus() {
    const order: SectionStatus[] = ["open", "draft", "done"];
    onEdit({ status: order[(order.indexOf(section.status) + 1) % order.length] }, 0);
  }

  // Typing in the text field `index` (between images).
  function typeInPart(index: number, field: HTMLTextAreaElement) {
    const next = parts.map((part, at) => (at === index && part.kind === "text" ? { ...part, text: field.value } : part));
    const body = joinBody(next);
    onType({ body });
    const base = partOffset(next, index);
    onCursor(base + field.selectionStart, base + field.selectionEnd);
    const match = /\[@([^\]\s]*)$/.exec(field.value.slice(0, field.selectionStart));
    setCiteQuery(
      match && sources.length > 0 ? { part: index, start: base + field.selectionStart - match[0].length, query: match[1] } : null,
    );
    // An image typed or pasted on a line of its own becomes a picture.
    if (partsOf(body).length !== parts.length) selectInBody(body, base + field.selectionStart);
  }

  function completeCitation(key: string) {
    const range = selection();
    if (!citeQuery || !range) return;
    const body = `${section.body.slice(0, citeQuery.start)}[@${key}]${section.body.slice(range.start).replace(/^\]/, "")}`;
    onEdit({ body });
    setCiteQuery(null);
    selectInBody(body, citeQuery.start + key.length + 3);
  }

  // Replaces the selected text and selects the result again.
  function replaceSelection(transform: (selected: string) => string) {
    const range = selection();
    if (!range) return;
    const replaced = transform(section.body.slice(range.start, range.end));
    const body = section.body.slice(0, range.start) + replaced + section.body.slice(range.end);
    onEdit({ body });
    selectInBody(body, range.start, range.start + replaced.length);
  }

  // **fett** or *kursiv* around the selection, or off again if it has it.
  function toggleMark(mark: "**" | "*") {
    const range = selection();
    if (!range) return;
    const { start, end } = range;
    const before = section.body.slice(0, start);
    const after = section.body.slice(end);
    const selected = section.body.slice(start, end);
    // Italics inside bold ("***") count as bold plus italics.
    const wrapped = before.endsWith(mark) && after.startsWith(mark) && !(mark === "*" && before.endsWith("**") && !before.endsWith("***"));
    if (wrapped) {
      const body = before.slice(0, -mark.length) + selected + after.slice(mark.length);
      onEdit({ body });
      selectInBody(body, start - mark.length, end - mark.length);
    } else if (selected.startsWith(mark) && selected.endsWith(mark) && selected.length > mark.length * 2) {
      replaceSelection((text) => text.slice(mark.length, -mark.length));
    } else {
      const body = before + mark + selected + mark + after;
      onEdit({ body });
      selectInBody(body, start + mark.length, end + mark.length);
    }
  }

  function commentOnSelection() {
    const range = selection();
    const selected = range ? section.body.slice(range.start, range.end).trim() : "";
    // The commented text stays marked while the comment is typed.
    if (selected && range) {
      keepHeld.current = true;
      setHeld({ body: section.body, ...range });
    }
    setCommentsOpen(true);
    setDraftComment(selected ? `„${selected.length > 80 ? `${selected.slice(0, 80)}…` : selected}“: ` : "");
    requestAnimationFrame(() => commentInput.current?.focus());
  }

  function closeComments() {
    setCommentsOpen(false);
    setHeld(null);
  }

  // Citations and images go behind the selected text instead of replacing it.
  function pickAfterSelection(kind: "cite" | "image") {
    const end = selection()?.end ?? section.body.length;
    onCursor(end, end);
    onPick(kind);
  }

  function setComments(comments: SectionComment[]) {
    onEdit({ comments }, 0);
  }

  function addComment() {
    const text = draftComment.trim();
    if (!text) return;
    setComments([...section.comments, { id: crypto.randomUUID(), text, createdAt: new Date().toISOString(), resolved: false }]);
    setDraftComment("");
    setHeld(null);
  }

  function setCaption(index: number, caption: string) {
    const part = parts[index];
    if (part.kind !== "image") return;
    onType({ body: joinBody(parts.map((entry, at) => (at === index ? { ...part, caption, line: figureMarkup(caption, part.id) } : entry))) });
  }

  // Takes an image out; the text before and after it joins up.
  function removeImage(index: number) {
    const before = parts[index - 1];
    const after = parts[index + 1];
    if (before?.kind !== "text" || after?.kind !== "text") return;
    const text = before.text && after.text ? `${before.text}\n\n${after.text}` : before.text || after.text;
    const body = joinBody([...parts.slice(0, index - 1), { kind: "text", text, lead: before.lead, trail: after.trail }, ...parts.slice(index + 2)]);
    onEdit({ body });
    selectInBody(body, partOffset(parts, index - 1) + before.text.length);
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
          ref={titleInput}
          data-writer-field
          value={section.title}
          autoFocus={autoFocusTitle}
          onFocus={onTitleFocused}
          onChange={(event) => onType({ title: event.target.value })}
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
        {(section.comments.length > 0 || commentsOpen) && (
          <button
            type="button"
            onClick={() => (commentsOpen ? closeComments() : setCommentsOpen(true))}
            aria-expanded={commentsOpen}
            aria-label={`Kommentare (${openComments} offen)`}
            title={commentsOpen ? "Kommentare ausblenden" : "Kommentare"}
            className={cn(
              "inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 text-xs hover:bg-accent",
              openComments > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
              commentsOpen && "bg-accent",
            )}
          >
            <MessageSquareIcon className="size-3.5" />
            {openComments > 0 ? openComments : section.comments.length > 0 ? <CheckIcon className="size-3" /> : null}
          </button>
        )}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onShift(1)}
            disabled={!indentable}
            title={indentable ? undefined : "Davor steht kein Abschnitt auf derselben Ebene, unter den er rücken könnte."}
          >
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
          <Button variant="ghost" size="sm" onClick={() => (commentsOpen ? closeComments() : commentOnSelection())}>
            <MessageSquareIcon /> {commentsOpen ? "Kommentare ausblenden" : "Kommentar"}
          </Button>
          <label className="flex items-center gap-1 px-2 text-sm text-muted-foreground">
            Ziel
            <Input
              type="number"
              min={1}
              max={100000}
              step={50}
              defaultValue={section.targetWords ?? ""}
              onBlur={(event) => {
                const targetWords = event.target.value ? Number(event.target.value) : null;
                if (targetWords !== section.targetWords) onEdit({ targetWords }, 0);
              }}
              className="h-8 w-20 font-mono"
            />
            Wörter
          </label>
          <Button variant="ghost" size="sm" onClick={onDelete} className="ml-auto text-destructive hover:text-destructive">
            <Trash2Icon /> Löschen
          </Button>
        </div>
      )}

      {commentsOpen && (
        <div className="space-y-2 border-t bg-amber-50/60 px-3 py-2 dark:bg-amber-950/20">
          {section.comments.length > 0 && (
            <ul className="space-y-1">
              {section.comments.map((comment) => (
                <li key={comment.id} className="group flex items-start gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() =>
                      setComments(section.comments.map((entry) => (entry.id === comment.id ? { ...entry, resolved: !entry.resolved } : entry)))
                    }
                    aria-label={comment.resolved ? "Wieder öffnen" : "Erledigt"}
                    title={comment.resolved ? "Wieder öffnen" : "Erledigt"}
                    className="mt-0.5 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
                  >
                    {comment.resolved ? <CheckIcon className="size-3.5 text-brand" /> : <CircleIcon className="size-3.5" />}
                  </button>
                  <p className={cn("min-w-0 flex-1 whitespace-pre-line", comment.resolved && "text-muted-foreground line-through")}>
                    {comment.text}
                  </p>
                  <span className="shrink-0 text-xs leading-6 text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setComments(section.comments.filter((entry) => entry.id !== comment.id))}
                    aria-label="Kommentar löschen"
                    className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground opacity-60 hover:bg-accent hover:opacity-100"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addComment();
            }}
            className="flex gap-2"
          >
            <Input
              ref={commentInput}
              value={draftComment}
              onChange={(event) => setDraftComment(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeComments();
              }}
              maxLength={2000}
              placeholder="Kommentar, z. B. „Zahl noch belegen“"
              aria-label="Neuer Kommentar"
              className="h-8 bg-background"
            />
            <Button type="submit" size="sm" variant="outline" disabled={!draftComment.trim()}>
              Hinzufügen
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" onClick={closeComments} aria-label="Kommentare ausblenden" title="Ausblenden (Esc)">
              <XIcon />
            </Button>
          </form>
        </div>
      )}

      {showBody && (
        <div className="space-y-1.5 border-t px-3 pt-2 pb-2">
          {parts.map((part, index) => {
            if (part.kind === "image") {
              const image = images.find((entry) => entry.id === part.id);
              return (
                <figure key={index} className="group/figure relative space-y-1 py-1">
                  {image?.url ? (
                    // Signed storage links; next/image would need the bucket host configured.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image.url} alt={part.caption || image.title} className="max-h-80 max-w-full rounded-md border object-contain" />
                  ) : (
                    <div className={cn("flex h-20 items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground", !image && "text-destructive")}>
                      <ImageIcon className="size-4" /> {image ? image.title : "Dokument fehlt"}
                    </div>
                  )}
                  <figcaption className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="shrink-0">Abb.:</span>
                    <input
                      data-writer-field
                      value={part.caption}
                      onChange={(event) => setCaption(index, event.target.value)}
                      onBlur={onBlur}
                      placeholder={image?.title ?? "Beschriftung"}
                      aria-label="Beschriftung des Bildes"
                      className="h-6 min-w-0 flex-1 rounded bg-transparent px-1 outline-none focus-visible:bg-accent/50"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      aria-label="Bild aus dem Text nehmen"
                      title="Aus dem Text nehmen"
                      className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded opacity-60 hover:bg-accent hover:opacity-100"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </figcaption>
                </figure>
              );
            }
            const base = partOffset(parts, index);
            const highlight = marked
              ? [Math.max(0, marked.start - base), Math.min(part.text.length, marked.end - base)]
              : null;
            const only = parts.length === 1;
            const last = index === parts.length - 1;
            return (
              <div key={index} className="relative">
                {highlight && highlight[0] < highlight[1] && (
                  // The marked text behind the field, at the same place as in it.
                  <div aria-hidden className={cn(textClass, "pointer-events-none absolute inset-0 text-transparent")}>
                    {part.text.slice(0, highlight[0])}
                    <mark className="rounded-sm bg-brand/25 text-transparent">{part.text.slice(highlight[0], highlight[1])}</mark>
                    {part.text.slice(highlight[1])}
                  </div>
                )}
                <textarea
                  ref={(element) => {
                    fields.current[index] = element;
                  }}
                  data-writer-field
                  value={part.text}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  onFocus={() => {
                    activePart.current = index;
                    setHeld(null);
                  }}
                  onChange={(event) => typeInPart(index, event.currentTarget)}
                  onSelect={(event) =>
                    onCursor(base + event.currentTarget.selectionStart, base + event.currentTarget.selectionEnd)
                  }
                  onBlur={() => {
                    onBlur();
                    setTimeout(() => setCiteQuery(null), 150);
                  }}
                  onContextMenu={(event) => {
                    // With text selected, the own menu; otherwise the browser's.
                    const field = event.currentTarget;
                    if (field.selectionStart === field.selectionEnd) return;
                    event.preventDefault();
                    activePart.current = index;
                    const range = { start: base + field.selectionStart, end: base + field.selectionEnd };
                    onCursor(range.start, range.end);
                    setHeld({ body: section.body, ...range });
                    setMenu({ x: event.clientX, y: event.clientY });
                  }}
                  onKeyDown={(event) => {
                    const field = event.currentTarget;
                    if (citeQuery && citeOptions.length > 0 && (event.key === "Tab" || event.key === "Enter")) {
                      event.preventDefault();
                      completeCitation(citeOptions[0].key);
                    } else if (event.key === "Escape") setCiteQuery(null);
                    else if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.key === "b" || event.key === "i")) {
                      event.preventDefault();
                      toggleMark(event.key === "b" ? "**" : "*");
                    } else if (
                      // Arrow keys go on into the text after or before an image.
                      !event.shiftKey &&
                      !event.altKey &&
                      ((event.key === "ArrowDown" && field.selectionEnd === field.value.length && !last) ||
                        (event.key === "ArrowUp" && field.selectionStart === 0 && index > 0))
                    ) {
                      event.preventDefault();
                      const next = fields.current[index + (event.key === "ArrowDown" ? 2 : -2)];
                      next?.focus();
                      const at = event.key === "ArrowDown" ? 0 : (next?.value.length ?? 0);
                      next?.setSelectionRange(at, at);
                    }
                  }}
                  placeholder={only ? "Schreib los … Leerzeile = neuer Absatz, [@ zitiert eine Quelle" : undefined}
                  aria-label={only ? `Text von ${number}` : `Text von ${number}, Teil ${index / 2 + 1}`}
                  className={cn(
                    textClass,
                    "relative block w-full resize-none bg-transparent outline-none placeholder:font-sans placeholder:text-sm placeholder:text-muted-foreground",
                    only ? "min-h-14" : "min-h-7",
                  )}
                />
                {citeQuery?.part === index && citeOptions.length > 0 && (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-popover text-sm shadow-md">
                    {citeOptions.map((source, option) => (
                      <li
                        key={source.key}
                        className={cn("cursor-pointer px-3 py-1.5 hover:bg-accent", option === 0 && "bg-accent")}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          completeCitation(source.key);
                        }}
                      >
                        <span className="font-mono">@{source.key}</span>{" "}
                        <span className="text-muted-foreground">{source.label}</span>
                        {source.summary && <span className="block truncate text-xs text-muted-foreground">{source.summary}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          <DropdownMenu
            open={menu !== null}
            onOpenChange={(open) => {
              if (open) return;
              setMenu(null);
              if (!keepHeld.current) setHeld(null);
              keepHeld.current = false;
            }}
            modal={false}
          >
            <DropdownMenuTrigger asChild>
              <span aria-hidden className="pointer-events-none fixed size-0" style={{ left: menu?.x ?? 0, top: menu?.y ?? 0 }} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={2} onCloseAutoFocus={(event) => event.preventDefault()}>
              <DropdownMenuItem onSelect={() => toggleMark("**")}>
                <BoldIcon /> Fett <DropdownMenuShortcut>Strg+B</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleMark("*")}>
                <ItalicIcon /> Kursiv <DropdownMenuShortcut>Strg+I</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  replaceSelection((text) =>
                    text
                      .split("\n")
                      .map((line) => (line.trim() && !/^\s*- /.test(line) ? `- ${line}` : line))
                      .join("\n"),
                  )
                }
              >
                <ListIcon /> Als Liste
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => pickAfterSelection("cite")}>
                <BookMarkedIcon /> Quelle zitieren …
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => pickAfterSelection("image")}>
                <ImageIcon /> Bild einfügen …
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={commentOnSelection}>
                <MessageSquareIcon /> Kommentieren
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  const range = selection();
                  if (range) void navigator.clipboard.writeText(section.body.slice(range.start, range.end)).catch(() => {});
                }}
              >
                <CopyIcon /> Kopieren <DropdownMenuShortcut>Strg+C</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {(citedKeys.length > 0 || chipFigures.length > 0) && (
            <ul className="flex flex-wrap gap-1.5">
              {citedKeys.map((key) => {
                const source = sources.find((entry) => entry.key === key);
                return (
                  <li key={key}>
                    {source ? (
                      <Link
                        href={`${PATH}?tab=sources#source-${source.id}`}
                        title={[source.label, source.summary].filter(Boolean).join(" · ")}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs hover:bg-accent hover:text-brand"
                      >
                        <BookMarkedIcon className="size-3" /> {key}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-destructive">
                        <BookMarkedIcon className="size-3" /> {key} (unbekannt)
                      </span>
                    )}
                  </li>
                );
              })}
              {chipFigures.map((figure, index) => (
                <li
                  key={`figure-${index}`}
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
            {section.comments.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => (commentsOpen ? closeComments() : commentOnSelection())}
              >
                <MessageSquareIcon /> {commentsOpen ? "Kommentar ausblenden" : "Kommentar"}
              </Button>
            )}
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

// Text field and the marked selection behind it share these, so they line up.
const textClass = "field-sizing-content font-serif text-[15px] leading-7 whitespace-pre-wrap break-words";

// The saved fields that differ, or null.
function changes(from: Section, to: Section): Partial<Section> | null {
  const patch: Partial<Section> = {};
  if (from.title !== to.title) patch.title = to.title;
  if (from.body !== to.body) patch.body = to.body;
  if (from.status !== to.status) patch.status = to.status;
  if (from.targetWords !== to.targetWords) patch.targetWords = to.targetWords;
  if (from.comments !== to.comments) patch.comments = to.comments;
  return Object.keys(patch).length > 0 ? patch : null;
}

const matches = (source: CitableSource, query: string) =>
  `${source.key} ${source.label} ${source.summary}`.toLowerCase().includes(query.trim().toLowerCase());

const formatPages = (pages: number) => (pages < 10 ? pages.toLocaleString("de-DE", { maximumFractionDigits: 1 }) : Math.round(pages).toString());

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
  const shown = sources.filter((source) => matches(source, query));
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
                {source.summary && <span className="block text-sm">{source.summary}</span>}
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
  images: WriterImage[];
  onPick: (image: WriterImage) => void;
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
