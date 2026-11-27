"use client";

import { ArrowUpIcon, CheckIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { applyChanges, chat, makePlan } from "./actions";
import type { ChatChange } from "./ai";
import { formatDate, formatMinutes, priorities, statusLabel, type Item, type ItemInput, type TypeDef } from "./data";
import { itemLabel } from "./plan";
import { useKanzleiData, useRun } from "./store";

type Message = {
  role: "user" | "assistant";
  text: string;
  changes?: ChatChange[];
  selected?: boolean[];
  applied?: boolean;
  replan?: boolean;
};

// Short messages ("FiBu 10002 fertig, Rest 0") become proposed changes the
// user confirms with one click. Nothing is saved before that.
export function ChatPanel() {
  const { hasAi, items, types } = useKanzleiData();
  const run = useRun();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const message = text.trim();
    if (!message || busy) return;
    setText("");
    setBusy(true);
    const history = messages.map((entry) => ({ role: entry.role, text: entry.text }));
    setMessages((list) => [...list, { role: "user", text: message }]);
    const result = await chat(message, history).catch(() => ({ error: "Die KI hat nicht geantwortet." }));
    setBusy(false);
    if ("error" in result && result.error) {
      setMessages((list) => [...list, { role: "assistant", text: result.error }]);
      return;
    }
    if ("reply" in result) {
      setMessages((list) => [
        ...list,
        { role: "assistant", text: result.reply, changes: result.changes, selected: result.changes.map(() => true), replan: result.replan },
      ]);
    }
  }

  async function apply(index: number) {
    const message = messages[index];
    if (!message.changes) return;
    const chosen = message.changes.filter((_, position) => message.selected?.[position]);
    if (chosen.length === 0) return;
    setBusy(true);
    const result = await run(() => applyChanges(chosen), chosen.length === 1 ? "Übernommen" : `${chosen.length} Änderungen übernommen`);
    setBusy(false);
    if (result && !("error" in result && result.error)) {
      setMessages((list) => list.map((entry, position) => (position === index ? { ...entry, applied: true } : entry)));
    }
  }

  return (
    <aside aria-label="Assistent" className="flex min-w-0 flex-[1_1_340px] flex-col rounded-xl border bg-card lg:sticky lg:top-4">
      <div className="flex items-baseline gap-2 border-b px-4 py-3">
        <h2 className="font-semibold">Assistent</h2>
        <span className="text-xs text-muted-foreground">sieht nur Nummern, nie Notizen</span>
      </div>
      <div className="max-h-[60vh] min-h-40 space-y-3 overflow-y-auto p-4 text-sm">
        {messages.length === 0 && (
          <p className="text-muted-foreground">
            {hasAi
              ? "Schreib, was passiert ist, z. B. „Unterlagen ESt 10001 da, ca. 2 h“ oder „JA 30217 zur Kontrolle beim Chef“. Mehreres auf einmal geht auch."
              : "Für den Assistenten fehlt der ANTHROPIC_API_KEY. Alles andere funktioniert auch ohne."}
          </p>
        )}
        {messages.map((message, index) =>
          message.role === "user" ? (
            <p key={index} className="ml-auto max-w-[88%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 whitespace-pre-line text-primary-foreground">
              {message.text}
            </p>
          ) : (
            <div key={index} className="max-w-[95%] space-y-2">
              <p className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 whitespace-pre-line">{message.text}</p>
              {message.changes && message.changes.length > 0 && (
                <div className="space-y-2 rounded-lg border p-3">
                  {message.changes.map((change, position) => (
                    <label key={position} className="flex cursor-pointer gap-2">
                      <Checkbox
                        className="mt-0.5"
                        disabled={message.applied}
                        checked={message.selected?.[position] ?? true}
                        onCheckedChange={(checked) =>
                          setMessages((list) =>
                            list.map((entry, other) =>
                              other === index ? { ...entry, selected: entry.selected?.map((value, at) => (at === position ? checked === true : value)) } : entry,
                            ),
                          )
                        }
                      />
                      <ChangeView change={change} items={items} types={types} />
                    </label>
                  ))}
                  {message.applied ? (
                    <p className="flex items-center gap-1.5 text-xs text-brand">
                      <CheckIcon className="size-3.5" /> Übernommen, steht im Verlauf
                    </p>
                  ) : (
                    <Button size="sm" variant="brand" disabled={busy || !message.selected?.some(Boolean)} onClick={() => apply(index)}>
                      {message.changes.length > 1 ? "Ausgewählte übernehmen" : "Übernehmen"}
                    </Button>
                  )}
                </div>
              )}
              {message.replan && (message.applied || !message.changes?.length) && (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => makePlan(), "Neuer Plan steht")}>
                  Tag neu planen
                </Button>
              )}
            </div>
          ),
        )}
        {busy && <p className="text-xs text-muted-foreground">Einen Moment …</p>}
      </div>
      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Textarea
          aria-label="Nachricht an den Assistenten"
          rows={2}
          className="min-h-11 resize-none"
          disabled={!hasAi}
          placeholder="Was ist passiert?"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <Button type="submit" size="icon" variant="brand" aria-label="Senden" disabled={!hasAi || busy || !text.trim()}>
          <ArrowUpIcon />
        </Button>
      </form>
    </aside>
  );
}

const fieldLabels: Partial<Record<keyof ItemInput, string>> = {
  client: "Mandant",
  title: "Titel",
  period: "Zeitraum",
  status: "Status",
  priority: "Priorität",
  deadlineInternal: "Frist intern",
  deadlineLegal: "Frist gesetzlich",
  estimate: "Aufwand",
  remaining: "Rest",
  docsAt: "Unterlagen",
  followUp: "Wiedervorlage",
  plannedFor: "Fest geplant",
  nextStep: "Nächster Schritt",
};

function show(key: keyof ItemInput, value: unknown, types: TypeDef[]) {
  if (value === null || value === undefined || value === "") return "–";
  if (key === "status") return statusLabel(String(value));
  if (key === "priority") return priorities.find((entry) => entry.id === value)?.label ?? String(value);
  if (key === "estimate" || key === "remaining") return formatMinutes(Number(value));
  if (key === "typeId") return types.find((type) => type.id === value)?.name ?? "–";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value, true);
  return String(value);
}

// One proposed change: what it is about and each field old → new.
function ChangeView({ change, items, types }: { change: ChatChange; items: Item[]; types: TypeDef[] }) {
  const item = change.itemId ? items.find((entry) => entry.id === change.itemId) : undefined;
  const keys = (Object.keys(fieldLabels) as (keyof ItemInput)[]).filter((key) => change.fields[key] !== undefined);
  const deadlineChanged = keys.includes("deadlineLegal") || keys.includes("deadlineInternal");
  return (
    <span className="min-w-0 space-y-1">
      <span className="block font-medium">
        {change.action === "create" ? "Neu: " : ""}
        {item ? itemLabel(item, types) : change.summary}
      </span>
      {item && <span className="block text-xs text-muted-foreground">{change.summary}</span>}
      {change.action === "create" && change.fields.typeId && (
        <span className="block text-xs">Art: {show("typeId", change.fields.typeId, types)}</span>
      )}
      {keys.map((key) => (
        <span key={key} className="block text-xs">
          <span className="text-muted-foreground">{fieldLabels[key]}:</span>{" "}
          {item && (
            <>
              <s className="text-muted-foreground">{show(key, item[key], types)}</s> →{" "}
            </>
          )}
          <b>{show(key, change.fields[key], types)}</b>
        </span>
      ))}
      {deadlineChanged && <span className="block text-xs text-amber-700 dark:text-amber-400">Frist bitte prüfen: nur übernehmen, wenn du sie genannt hast.</span>}
    </span>
  );
}
