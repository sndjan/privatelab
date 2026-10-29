"use client";

import { CalendarIcon, FlagIcon, InfoIcon, Loader2Icon, PlusIcon, TagIcon, UserIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addQuickTodo } from "./actions";
import { compact, formatShortDate, parseQuickTodo, priorityClass, type Person, type Phase } from "./data";

// One line for a new to-do: "Gliederung schicken !1 @Sandra #Exposé bis Fr".
// Enter saves it and keeps the field focused for the next one. Below the
// field, chips show what was understood; @ and # suggest people and phases.
// The shortcuts are explained behind the info button.
export function QuickTodo({
  people,
  phases,
  today,
  protocolId = null,
  autoFocus = false,
}: {
  people: Person[];
  phases: Phase[];
  today: string;
  protocolId?: string | null;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [help, setHelp] = useState(false);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  // Where the cursor goes after a completion, set right after the render so
  // the next keystroke lands behind the completed word.
  const caretAfterRender = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caretAfterRender.current === null) return;
    input.current?.setSelectionRange(caretAfterRender.current, caretAfterRender.current);
    caretAfterRender.current = null;
  });
  const parsed = parseQuickTodo(value, { people, phases, today });
  const suggestion = suggest(value, caret, people, phases);

  function complete(label: string) {
    if (!suggestion) return;
    // Names are written without spaces ("@Prof.Weber"); the parser matches them so.
    const insert = `${suggestion.sign}${label.replace(/\s+/g, "")} `;
    const next = value.slice(0, suggestion.start) + insert + value.slice(caret);
    const cursor = suggestion.start + insert.length;
    setValue(next);
    setCaret(cursor);
    setHighlight(0);
    caretAfterRender.current = cursor;
  }

  function save() {
    if (!parsed.title || pending) return;
    const text = value;
    setValue("");
    setCaret(0);
    startTransition(async () => {
      try {
        const result = await addQuickTodo(text, protocolId);
        if (result.error) {
          setValue(text);
          toast.error(result.error);
        } else {
          toast.success(`To-do „${parsed.title}“ angelegt`);
        }
      } catch {
        setValue(text);
        toast.error("Das To-do konnte nicht gespeichert werden.");
      }
      input.current?.focus();
    });
  }

  const person = parsed.personId ? people.find((entry) => entry.id === parsed.personId)?.name : parsed.newPerson;
  const phase = phases.find((entry) => entry.id === parsed.phaseId)?.name;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <PlusIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={input}
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => {
            setValue(event.target.value);
            setCaret(event.target.selectionStart ?? event.target.value.length);
            setHighlight(0);
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
          onKeyDown={(event) => {
            if (suggestion && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setHighlight((index) => (index + step + suggestion.options.length) % suggestion.options.length);
            } else if (suggestion && (event.key === "Tab" || event.key === "Enter")) {
              event.preventDefault();
              complete(suggestion.options[Math.min(highlight, suggestion.options.length - 1)]);
            } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              save();
            }
          }}
          maxLength={400}
          autoComplete="off"
          enterKeyHint="send"
          aria-label="Neues To-do"
          aria-autocomplete="list"
          placeholder="Neues To-do …"
          className="h-11 w-full rounded-lg border bg-card pr-10 pl-9 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
        />
        {pending ? (
          <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <button
            type="button"
            onClick={() => setHelp(!help)}
            aria-expanded={help}
            aria-label="Kürzel erklären"
            title="Kürzel erklären"
            className={cn(
              "absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
              help && "text-foreground",
            )}
          >
            <InfoIcon className="size-4" />
          </button>
        )}
        {suggestion && (
          <ul role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-popover text-sm shadow-md">
            {suggestion.options.map((option, index) => (
              <li
                key={option}
                role="option"
                aria-selected={index === highlight}
                className={cn("cursor-pointer px-3 py-1.5", index === highlight && "bg-accent")}
                onMouseDown={(event) => {
                  event.preventDefault();
                  complete(option);
                }}
              >
                {suggestion.sign}
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>
      {help && (
        <ul className="space-y-0.5 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <li>
            <code>!1</code> bis <code>!3</code> Priorität (1 ist am wichtigsten)
          </li>
          <li>
            <code>@Name</code> Person, neue Namen werden angelegt
          </li>
          <li>
            <code>#Phase</code> Phase
          </li>
          <li>
            <code>bis Fr</code>, <code>bis morgen</code>, <code>bis 12.11.</code> Deadline
          </li>
          <li>Enter legt an, das Feld bleibt für das nächste To-do offen.</li>
        </ul>
      )}
      {value.trim() && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          {parsed.priority && <Token icon={FlagIcon} className={priorityClass(parsed.priority)}>Prio {parsed.priority}</Token>}
          {person && (
            <Token icon={UserIcon}>
              {person}
              {parsed.newPerson && " (neu)"}
            </Token>
          )}
          {phase && <Token icon={TagIcon}>{phase}</Token>}
          {parsed.deadline && <Token icon={CalendarIcon}>bis {formatShortDate(parsed.deadline)}</Token>}
          {parsed.title ? <span>Enter zum Anlegen</span> : <span>Noch kein Text</span>}
        </p>
      )}
    </div>
  );
}

function Token({
  icon: Icon,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-foreground", className)}>
      <Icon className="size-3" />
      {children}
    </span>
  );
}

// The "@…" or "#…" word ending at the cursor and what could complete it.
function suggest(value: string, caret: number, people: Person[], phases: Phase[]) {
  const match = /(^|\s)([@#])([^\s@#]*)$/.exec(value.slice(0, caret));
  if (!match) return null;
  const [, , sign, query] = match;
  const names = sign === "@" ? people.map((person) => person.name) : phases.map((phase) => phase.name);
  const options = names
    .filter((name) => compact(name).startsWith(compact(query)) && compact(name) !== compact(query))
    .slice(0, 6);
  return options.length > 0 ? { sign, start: caret - query.length - 1, options } : null;
}
