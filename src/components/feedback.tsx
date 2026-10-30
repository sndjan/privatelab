"use client";

import { Loader2Icon, MessageSquareIcon, XIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { sendFeedback } from "@/app/feedback/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type Kind = "bug" | "idea" | "other";

const kinds: { value: Kind; label: string }[] = [
  { value: "bug", label: "Fehler" },
  { value: "idea", label: "Idee" },
  { value: "other", label: "Sonstiges" },
];

// "@Fehler", "@Idee" or "@Sonstiges" in the text sets the kind, so it works
// without the mouse. The tag is removed from the message when it is sent.
const tagKinds: Record<string, Kind> = {
  fehler: "bug",
  bug: "bug",
  idee: "idea",
  idea: "idea",
  sonstiges: "other",
  sonst: "other",
  other: "other",
};
const TAG = /(^|\s)@(fehler|bug|idee|idea|sonstiges|sonst|other)(?=\s|$)/gi;

function tagKind(text: string): Kind | null {
  const matches = [...text.matchAll(TAG)];
  const last = matches.at(-1);
  return last ? tagKinds[last[2].toLowerCase()] : null;
}

const withoutTags = (text: string) => text.replace(TAG, "$1").replace(/[ \t]{2,}/g, " ").trim();

// The "@…" word that ends at the cursor, if any.
function partialTag(text: string, caret: number) {
  const match = /(^|\s)@(\p{L}*)$/u.exec(text.slice(0, caret));
  if (!match) return null;
  const query = match[2].toLowerCase();
  const options = kinds.filter((kind) => kind.label.toLowerCase().startsWith(query));
  return options.length > 0 ? { start: caret - query.length - 1, options } : null;
}

// Wide screens with a mouse get a panel next to the page instead of a dialog,
// so the app stays usable while writing.
const DESKTOP = "(min-width: 768px) and (pointer: fine)";
function subscribeDesktop(callback: () => void) {
  const media = window.matchMedia(DESKTOP);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const useDesktop = () =>
  useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

// Header button for bugs, ideas and other feedback. Shortcut: F (outside of
// text fields) or Alt+Shift+F anywhere. The current page is sent along so
// it's clear what the feedback is about. It's read on sending, not with
// usePathname: the button is also part of the prerendered header, where the
// URL isn't known yet.
export function Feedback() {
  const desktop = useDesktop();
  const [open, setOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const shortcut =
        event.code === "KeyF" &&
        !event.ctrlKey &&
        !event.metaKey &&
        ((event.altKey && event.shiftKey) || (!event.altKey && !event.shiftKey && !isTyping(event.target)));
      if (!shortcut) return;
      event.preventDefault();
      setOpen(true);
      // Already open: jump into the text field.
      textarea.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className={cn("text-muted-foreground", open && desktop && "bg-accent text-foreground")}
      aria-label="Feedback geben"
      aria-expanded={open}
      title="Feedback (F)"
      onClick={() => setOpen(!open || !desktop)}
    >
      <MessageSquareIcon />
    </Button>
  );

  if (desktop) {
    return (
      <>
        {trigger}
        {open && (
          <section
            aria-label="Feedback"
            className="fixed right-4 bottom-4 z-50 w-96 rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2 print:hidden"
            onKeyDown={(event) => {
              if (event.key === "Escape" && !event.defaultPrevented) setOpen(false);
            }}
          >
            <div className="mb-3 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">Feedback</h2>
                <p className="text-sm text-muted-foreground">Die Seite bleibt bedienbar, schreib einfach nebenher.</p>
              </div>
              <Button variant="ghost" size="icon-sm" className="-mt-1 -mr-1 text-muted-foreground" aria-label="Schließen" title="Schließen (Esc)" onClick={() => setOpen(false)}>
                <XIcon />
              </Button>
            </div>
            <FeedbackForm textarea={textarea} keepOpen />
          </section>
        )}
      </>
    );
  }

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Compact, so it still fits above the on-screen keyboard. */}
        <DialogContent className="gap-3 p-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Feedback</DialogTitle>
            <DialogDescription className="sr-only">Was funktioniert nicht, was fehlt dir, was wünschst du dir?</DialogDescription>
          </DialogHeader>
          <FeedbackForm textarea={textarea} onSent={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

// keepOpen (the desktop panel): after sending, the field is emptied and keeps
// the focus for the next one. Otherwise (the phone dialog) the form is
// compact, onSent is called (the dialog closes) and a toast thanks.
function FeedbackForm({
  textarea,
  keepOpen = false,
  onSent,
}: {
  textarea: React.RefObject<HTMLTextAreaElement | null>;
  keepOpen?: boolean;
  onSent?: () => void;
}) {
  const [kind, setKind] = useState<Kind>("idea");
  const [message, setMessage] = useState("");
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const suggestion = dismissed ? null : partialTag(message, caret);
  // Where the cursor goes after a completion, set right after the render so
  // the next keystroke lands behind the completed tag.
  const caretAfterRender = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caretAfterRender.current === null) return;
    textarea.current?.setSelectionRange(caretAfterRender.current, caretAfterRender.current);
    caretAfterRender.current = null;
  });

  useEffect(() => {
    textarea.current?.focus();
  }, [textarea]);

  function change(text: string, cursor: number) {
    setMessage(text);
    setCaret(cursor);
    setHighlight(0);
    setDismissed(false);
    setError(null);
    const tagged = tagKind(text);
    if (tagged) setKind(tagged);
  }

  function complete(option: { value: Kind; label: string }) {
    if (!suggestion) return;
    const insert = `@${option.label} `;
    const text = message.slice(0, suggestion.start) + insert + message.slice(caret);
    const cursor = suggestion.start + insert.length;
    change(text, cursor);
    setKind(option.value);
    caretAfterRender.current = cursor;
  }

  function send() {
    const text = withoutTags(message);
    if (!text) {
      setError("Bitte schreib eine Nachricht.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("message", text);
    formData.set("page", window.location.pathname);
    formData.set("userAgent", navigator.userAgent);
    startTransition(async () => {
      try {
        const result = await sendFeedback(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        setMessage("");
        setCaret(0);
        setKind("idea");
        if (keepOpen) {
          setSent((count) => count + 1);
          textarea.current?.focus();
        } else {
          toast.success("Danke! Dein Feedback ist angekommen.");
          onSent?.();
        }
      } catch {
        setError("Keine Verbindung zum Server. Versuch es bitte noch einmal.");
      }
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className="space-y-3"
    >
      <ToggleGroup
        type="single"
        variant="outline"
        value={kind}
        onValueChange={(value) => value && setKind(value as Kind)}
        aria-label="Art"
        className="w-full"
      >
        {kinds.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value} className="h-9">
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="relative space-y-2">
        <Label htmlFor="feedback-message" className="sr-only">
          Nachricht
        </Label>
        <Textarea
          ref={textarea}
          id="feedback-message"
          name="message"
          maxLength={4000}
          rows={keepOpen ? 5 : 3}
          className={keepOpen ? "min-h-32" : "max-h-40 min-h-20"}
          value={message}
          placeholder={kind === "bug" ? "Was ist passiert, und was hättest du erwartet?" : "Erzähl …"}
          aria-autocomplete="list"
          aria-controls={suggestion ? "feedback-tags" : undefined}
          onChange={(event) => change(event.target.value, event.target.selectionStart)}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              if (!pending) send();
              return;
            }
            if (!suggestion) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setHighlight((index) => (index + step + suggestion.options.length) % suggestion.options.length);
            } else if (event.key === "Tab" || event.key === "Enter") {
              event.preventDefault();
              complete(suggestion.options[Math.min(highlight, suggestion.options.length - 1)]);
            } else if (event.key === "Escape") {
              // Closes the suggestions, not the panel.
              event.preventDefault();
              setDismissed(true);
            }
          }}
        />
        {suggestion && (
          <ul id="feedback-tags" role="listbox" className="absolute inset-x-2 top-full z-10 -mt-1 overflow-hidden rounded-md border bg-popover text-sm shadow-md">
            {suggestion.options.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={index === highlight}
                className={cn("cursor-pointer px-3 py-1.5", index === highlight && "bg-accent")}
                onMouseDown={(event) => {
                  event.preventDefault();
                  complete(option);
                }}
              >
                @{option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground" aria-live="polite">
          {sent > 0 ? (
            <span className="text-brand">
              {sent === 1 ? "Gesendet, danke!" : `${sent} gesendet, danke!`} Schreib ruhig weiter.
            </span>
          ) : (
            keepOpen && (
              <>
                <kbd className="font-mono">Strg/⌘</kbd>+<kbd className="font-mono">Enter</kbd> sendet · @Fehler, @Idee oder
                @Sonstiges setzt die Art
              </>
            )
          )}
        </p>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          Senden
        </Button>
      </div>
    </form>
  );
}
