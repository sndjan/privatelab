"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  BoldIcon,
  DownloadIcon,
  Heading2Icon,
  ItalicIcon,
  ListChecksIcon,
  ListIcon,
  PinIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ViewLink as Link, useViewNavigate } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import { createNote, deleteNote, saveNote } from "./actions";
import type { Note } from "./data";
import { NotFoundNote, SearchForm } from "./fields";
import { ProtocolMarkdown } from "./markdown";
import { thesisQuery } from "./query";
import { useThesis } from "./use-thesis";

const PATH = "/m/thesis";
const SAVE_DELAY_MS = 600;

type Props = { noteId?: string; query?: string };

// Free notes in Markdown, next to the thesis text but without its outline and
// rules: the Zielvereinbarung, ideas, a draft of an e-mail. Saved as typed.
export function NotesTab({ noteId, query }: Props) {
  const [notes] = useThesis("notes");
  if (noteId) {
    const note = notes.find((entry) => entry.id === noteId);
    if (!note) return <NotFoundNote what="Diese Notiz" back={`${PATH}?tab=notes`} />;
    return <NoteEditor key={note.id} note={note} />;
  }
  return <NoteList notes={notes} query={query} />;
}

// --- List ----------------------------------------------------------------------

function NoteList({ notes, query }: { notes: Note[]; query?: string }) {
  const navigate = useViewNavigate();
  const queryClient = useQueryClient();
  const [creating, startCreating] = useTransition();
  const search = query?.trim() ?? "";
  const shown = (search ? notes.filter((note) => matches(note, search)) : notes).sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || (a.updatedAt < b.updatedAt ? 1 : -1),
  );

  function add() {
    startCreating(async () => {
      try {
        const id = await createNote();
        const now = new Date().toISOString();
        queryClient.setQueryData(thesisQuery("notes").queryKey, (current) => [
          { id, title: "", body: "", pinned: false, createdAt: now, updatedAt: now },
          ...(current ?? []),
        ]);
        navigate(`${PATH}?tab=notes&note=${id}`);
      } catch {
        toast.error("Die Notiz konnte nicht angelegt werden.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="brand" onClick={add} disabled={creating}>
          <PlusIcon /> Neue Notiz
        </Button>
        {notes.length > 0 && (
          <SearchForm
            query={search}
            href={(q) => `${PATH}?tab=notes${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            placeholder="Notizen durchsuchen"
            label="Notizen durchsuchen"
            className="relative min-w-48 flex-1 sm:ml-auto sm:max-w-72"
          />
        )}
      </div>

      {notes.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            Noch keine Notizen. Platz für alles, was nicht in die Arbeit selbst gehört, z. B. die Zielvereinbarung,
            Ideen oder Entwürfe. Geschrieben wird in Markdown, ohne Gliederung und Formalien.
          </CardContent>
        </Card>
      ) : shown.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">Keine Notiz enthält „{search}“.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((note) => (
            <li key={note.id}>
              <Link
                href={`${PATH}?tab=notes&note=${note.id}`}
                className="flex h-full flex-col gap-1 rounded-xl border bg-card px-4 py-3 shadow-xs hover:bg-accent/50 active:bg-accent"
              >
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {note.pinned && <PinIcon className="size-3.5 text-brand" aria-label="Angeheftet" />}
                  {formatUpdated(note.updatedAt)}
                </span>
                <span className={cn("font-medium", !note.title && "text-muted-foreground")}>
                  {note.title || "Ohne Titel"}
                </span>
                {note.body && <span className="line-clamp-3 text-sm text-muted-foreground">{snippet(note.body, search)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- One note ------------------------------------------------------------------

type Mode = "write" | "split" | "preview";

function NoteEditor({ note }: { note: Note }) {
  const queryClient = useQueryClient();
  const navigate = useViewNavigate();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [pinned, setPinned] = useState(note.pinned);
  // Empty notes start in writing mode, others show the formatted text.
  const [mode, setMode] = useState<Mode>(note.body ? "preview" : "write");
  const [saving, setSaving] = useState(0);
  const [dirty, setDirty] = useState(false);
  const pending = useRef<{ title?: string; body?: string; pinned?: boolean }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const deleted = useRef(false);

  function updateCache(patch: Partial<Note>) {
    queryClient.setQueryData(thesisQuery("notes").queryKey, (current) =>
      current?.map((entry) => (entry.id === note.id ? { ...entry, ...patch } : entry)),
    );
  }

  async function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0 || deleted.current) return;
    setSaving((count) => count + 1);
    try {
      await saveNote(note.id, patch);
      setDirty(Object.keys(pending.current).length > 0);
    } catch {
      // Keep the change for the next try.
      pending.current = { ...patch, ...pending.current };
      toast.error("Speichern hat nicht geklappt. Prüf deine Verbindung.");
    } finally {
      setSaving((count) => count - 1);
    }
  }

  function change(patch: { title?: string; body?: string; pinned?: boolean }, delay = SAVE_DELAY_MS) {
    pending.current = { ...pending.current, ...patch };
    setDirty(true);
    updateCache({ ...patch, ...((patch.title !== undefined || patch.body !== undefined) && { updatedAt: new Date().toISOString() }) });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
  }

  // Saves what is left when leaving the note or the page.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => {
    const onLeave = () => void flushRef.current();
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      void flushRef.current();
    };
  }, []);

  // Wraps the selection in Markdown, e.g. **fett**; without a selection the
  // cursor lands between the marks.
  function wrap(before: string, after = before) {
    const field = textarea.current;
    if (!field) return;
    const { selectionStart: start, selectionEnd: end, value } = field;
    const next = `${value.slice(0, start)}${before}${value.slice(start, end)}${after}${value.slice(end)}`;
    setBody(next);
    change({ body: next });
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + before.length, end + before.length);
    });
  }

  // Puts a prefix (e.g. "- ") in front of every selected line, or takes it away.
  function prefixLines(prefix: string) {
    const field = textarea.current;
    if (!field) return;
    const { selectionStart: start, selectionEnd: end, value } = field;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end);
    const block = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd);
    const lines = block.split("\n");
    const remove = lines.every((line) => line.startsWith(prefix));
    const changed = lines.map((line) => (remove ? line.slice(prefix.length) : `${prefix}${line}`)).join("\n");
    const next = `${value.slice(0, lineStart)}${changed}${value.slice(lineStart + block.length)}`;
    setBody(next);
    change({ body: next });
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(lineStart, lineStart + changed.length);
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === "b") {
      event.preventDefault();
      wrap("**");
    } else if (mod && event.key.toLowerCase() === "i") {
      event.preventDefault();
      wrap("*");
    } else if (mod && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void flush();
    } else if (event.key === "Enter" && !event.shiftKey && !mod) {
      // Continues a list: "- ", "- [ ] " or "1. " on the next line; Enter on
      // an empty item ends the list.
      const field = event.currentTarget;
      const { selectionStart: start, selectionEnd: end, value } = field;
      if (start !== end) return;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const line = value.slice(lineStart, start);
      const match = line.match(/^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. )/);
      if (!match) return;
      event.preventDefault();
      const marker = match[3] ? `${Number(match[3]) + 1}. ` : match[2].replace(/\[[xX]\]/, "[ ]");
      const next =
        line.trim() === match[2].trim()
          ? `${value.slice(0, lineStart)}${value.slice(start)}`
          : `${value.slice(0, start)}\n${match[1]}${marker}${value.slice(end)}`;
      const caret = line.trim() === match[2].trim() ? lineStart : start + 1 + match[1].length + marker.length;
      setBody(next);
      change({ body: next });
      requestAnimationFrame(() => field.setSelectionRange(caret, caret));
    }
  }

  async function remove() {
    if (!(await confirmDialog({ title: `„${title || "Ohne Titel"}“ löschen?` }))) return;
    deleted.current = true;
    if (timer.current) clearTimeout(timer.current);
    try {
      await deleteNote(note.id);
      queryClient.setQueryData(thesisQuery("notes").queryKey, (current) => current?.filter((entry) => entry.id !== note.id));
      navigate(`${PATH}?tab=notes`, { replace: true });
    } catch {
      deleted.current = false;
      toast.error("Löschen hat nicht geklappt.");
    }
  }

  function download() {
    const text = `${title ? `# ${title}\n\n` : ""}${body}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName(title)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const status = saving > 0 ? "Speichert …" : dirty ? "Nicht gespeichert" : "Gespeichert";

  const editor = (
    <textarea
      ref={textarea}
      aria-label="Text der Notiz"
      value={body}
      onChange={(event) => {
        setBody(event.target.value);
        change({ body: event.target.value });
      }}
      onKeyDown={onKeyDown}
      onBlur={() => void flush()}
      autoFocus={!note.body && Boolean(note.title)}
      placeholder={"Einfach losschreiben. Markdown geht: **fett**, *kursiv*, # Überschrift, - Liste, - [ ] Aufgabe"}
      className="field-sizing-content min-h-[50vh] w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
    />
  );
  const preview = body.trim() ? (
    <ProtocolMarkdown text={body} />
  ) : (
    <p className="text-sm text-muted-foreground">Noch kein Text.</p>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href={`${PATH}?tab=notes`}>
            <ArrowLeftIcon /> Notizen
          </Link>
        </Button>
        <span aria-live="polite" className="ml-auto text-xs text-muted-foreground">
          {words} {words === 1 ? "Wort" : "Wörter"} · {status}
        </span>
      </div>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
          <div role="group" aria-label="Ansicht" className="flex rounded-md bg-muted p-0.5">
            {(
              [
                ["write", "Schreiben"],
                ["split", "Geteilt"],
                ["preview", "Ansehen"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "h-8 cursor-pointer rounded px-2.5 text-sm transition-colors",
                  value === "split" && "hidden lg:block",
                  mode === value ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {mode !== "preview" && (
            <div className="flex items-center">
              <ToolButton label="Fett (Strg+B)" onClick={() => wrap("**")}>
                <BoldIcon />
              </ToolButton>
              <ToolButton label="Kursiv (Strg+I)" onClick={() => wrap("*")}>
                <ItalicIcon />
              </ToolButton>
              <ToolButton label="Überschrift" onClick={() => prefixLines("## ")}>
                <Heading2Icon />
              </ToolButton>
              <ToolButton label="Liste" onClick={() => prefixLines("- ")}>
                <ListIcon />
              </ToolButton>
              <ToolButton label="Aufgabenliste" onClick={() => prefixLines("- [ ] ")}>
                <ListChecksIcon />
              </ToolButton>
            </div>
          )}
          <div className="ml-auto flex items-center">
            <ToolButton
              label={pinned ? "Nicht mehr anheften" : "Oben anheften"}
              pressed={pinned}
              onClick={() => {
                setPinned(!pinned);
                change({ pinned: !pinned }, 0);
              }}
            >
              <PinIcon className={cn(pinned && "fill-current text-brand")} />
            </ToolButton>
            <ToolButton label="Als Markdown herunterladen" onClick={download}>
              <DownloadIcon />
            </ToolButton>
            <ToolButton label="Notiz löschen" onClick={remove} className="hover:text-destructive">
              <Trash2Icon />
            </ToolButton>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 sm:px-6">
          <input
            aria-label="Titel"
            value={title}
            maxLength={200}
            onChange={(event) => {
              setTitle(event.target.value);
              change({ title: event.target.value });
            }}
            onBlur={() => void flush()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                setMode((current) => (current === "preview" ? "write" : current));
                requestAnimationFrame(() => textarea.current?.focus());
              }
            }}
            autoFocus={!note.title}
            placeholder="Titel, z. B. Zielvereinbarung"
            className="w-full bg-transparent text-xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60"
          />
          {mode === "write" && editor}
          {mode === "preview" && (
            // A double click on the text switches to writing.
            <div onDoubleClick={() => setMode("write")}>{preview}</div>
          )}
          {mode === "split" && (
            <div className="grid grid-cols-2 gap-6">
              {editor}
              <div className="border-l pl-6">{preview}</div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  pressed,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      // Keeps the selection in the text while clicking.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn("size-9 text-muted-foreground", className)}
    >
      {children}
    </Button>
  );
}

// --- Helpers ---------------------------------------------------------------------

const normalize = (text: string) => text.toLocaleLowerCase("de-DE");

function matches(note: Note, search: string) {
  const needle = normalize(search);
  return normalize(note.title).includes(needle) || normalize(note.body).includes(needle);
}

// The text around the first match (or the start), without Markdown symbols.
function snippet(body: string, search: string) {
  const plain = body.replace(/[#*_`>[\]]|\(https?:[^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const index = search ? normalize(plain).indexOf(normalize(search)) : -1;
  if (index <= 40) return plain.slice(0, 240);
  return `…${plain.slice(index - 40, index + 200)}`;
}

// "heute 14:05", "gestern", "3. Nov."
function formatUpdated(iso: string) {
  const date = new Date(iso);
  const day = (value: Date) => value.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  if (day(date) === day(today)) {
    return `heute ${date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}`;
  }
  if (day(date) === day(yesterday)) return "gestern";
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
    timeZone: "Europe/Berlin",
  });
}

const fileName = (title: string) =>
  title
    .trim()
    .replace(/[^\p{L}\p{N} _-]+/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 60) || "notiz";
