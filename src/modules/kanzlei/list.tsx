"use client";

import { PlusIcon, RepeatIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { bulkUpdate, type BulkPatch } from "./actions";
import { formatDate, formatMinutes, isWaitingStatus, orderStatuses, priorities, statusLabel, taskStatuses, type Item } from "./data";
import { QuickActions, TypeTag } from "./item-actions";
import { deadlineOf, followUpDue, isOpen } from "./plan";
import { useDialogs, useKanzleiData, useRun } from "./store";

const filters = [
  { id: "open", label: "Alle offenen", test: (item: Item) => isOpen(item) },
  { id: "ready", label: "Bearbeitbar", test: (item: Item) => isOpen(item) && !isWaitingStatus(item.status) },
  { id: "docs", label: "Warte auf Unterlagen", test: (item: Item) => item.status === "warte_unterlagen" || item.status === "teilweise" },
  { id: "waiting", label: "Wartet / Kontrolle", test: (item: Item) => ["warte_rueckmeldung", "kontrolle", "wartet"].includes(item.status) },
  { id: "tasks", label: "Aufgaben", test: (item: Item) => isOpen(item) && item.kind === "aufgabe" },
  { id: "done", label: "Erledigt", test: (item: Item) => item.status === "erledigt" },
] as const;

type FilterId = (typeof filters)[number]["id"];

export function ListView() {
  const { items, types, today } = useKanzleiData();
  const { openItem } = useDialogs();
  const [filter, setFilter] = useState<FilterId>("open");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const test = filters.find((entry) => entry.id === filter)!.test;
    const query = search.trim().toLowerCase();
    return items
      .filter(test)
      .filter((item) => typeFilter === "all" || item.typeId === typeFilter)
      .filter(
        (item) =>
          !query ||
          [item.client, item.title, item.period, types.find((type) => type.id === item.typeId)?.name ?? ""].join(" ").toLowerCase().includes(query),
      )
      .sort((a, b) => (deadlineOf(a) ?? "9999").localeCompare(deadlineOf(b) ?? "9999"));
  }, [items, types, filter, search, typeFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of visible) map.set(item.client, [...(map.get(item.client) ?? []), item]);
    return [...map.entries()].sort(([a], [b]) => (a || "99999").localeCompare(b || "99999"));
  }, [visible]);

  const remaining = visible.filter(isOpen).reduce((sum, item) => sum + (item.remaining || item.estimate), 0);
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Aufträge und Aufgaben</h1>
          <p className="text-sm text-muted-foreground">
            {visible.length} Einträge · {formatMinutes(remaining)} Restaufwand
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openItem({ kind: "aufgabe" })}>
            <PlusIcon /> Aufgabe
          </Button>
          <Button variant="brand" size="sm" onClick={() => openItem({ kind: "auftrag" })}>
            <PlusIcon /> Auftrag
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={filter === entry.id}
            onClick={() => setFilter(entry.id)}
            className={cn(
              "h-8 cursor-pointer rounded-full border px-3 text-sm",
              filter === entry.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
            )}
          >
            {entry.label} · {items.filter(entry.test).length}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input aria-label="Suchen" placeholder="Mandant, Titel, Zeitraum …" className="max-w-xs" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger aria-label="Art" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Arten</SelectItem>
            {types.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && <BulkBar ids={[...selected]} onDone={() => setSelected(new Set())} />}

      {groups.length === 0 && <p className="text-sm text-muted-foreground">Keine Einträge.</p>}

      {groups.map(([client, list]) => (
        <section key={client || "none"} className="overflow-hidden rounded-xl border bg-card">
          <h2 className="flex items-center gap-3 border-b bg-muted/50 px-4 py-2 text-sm font-semibold">
            <Checkbox
              aria-label={`Alle von ${client || "ohne Mandant"} auswählen`}
              checked={list.every((item) => selected.has(item.id))}
              onCheckedChange={(checked) =>
                setSelected((current) => {
                  const next = new Set(current);
                  for (const item of list) {
                    if (checked === true) next.add(item.id);
                    else next.delete(item.id);
                  }
                  return next;
                })
              }
            />
            {client || "Ohne Mandant"}
            <span className="font-normal text-muted-foreground">{list.length}</span>
            {client && (
              <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => openItem({ kind: "auftrag", client })}>
                <PlusIcon /> Auftrag
              </Button>
            )}
          </h2>
          <ul className="divide-y">
            {list.map((item) => {
              const deadline = deadlineOf(item);
              const overdue = deadline !== null && deadline < today && isOpen(item);
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <Checkbox aria-label="Auswählen" checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} />
                  <button type="button" className="min-w-0 flex-[1_1_220px] cursor-pointer text-left" onClick={() => openItem({ item })}>
                    <span className="flex flex-wrap items-center gap-2">
                      <TypeTag typeId={item.typeId} types={types} />
                      <span className="font-medium">{[item.period, item.title].filter(Boolean).join(" · ") || "Ohne Titel"}</span>
                      {item.recurringId && <RepeatIcon className="size-3.5 text-muted-foreground" aria-label="wiederkehrend" />}
                      {item.priority === 1 && <span className="text-xs font-semibold text-destructive">dringend</span>}
                    </span>
                    {item.nextStep && <span className="mt-0.5 block text-xs text-muted-foreground">Nächster Schritt: {item.nextStep}</span>}
                  </button>
                  <span className="w-40 text-sm">
                    {statusLabel(item.status)}
                    {item.followUp && (
                      <span className={cn("block text-xs", followUpDue(item, today) ? "font-semibold text-brand" : "text-muted-foreground")}>
                        WV {formatDate(item.followUp)}
                      </span>
                    )}
                  </span>
                  <span className="w-36 text-xs text-muted-foreground">
                    intern {formatDate(item.deadlineInternal)}
                    <br />
                    <span className={overdue ? "font-semibold text-destructive" : ""}>gesetzl. {formatDate(item.deadlineLegal, true)}</span>
                  </span>
                  <span className="w-24 text-xs text-muted-foreground tabular-nums">
                    Rest <b className="text-foreground">{formatMinutes(item.remaining)}</b>
                    <br />
                    von {formatMinutes(item.estimate)}
                  </span>
                  <QuickActions item={item} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

const KEEP = "keep";

// Sammeländerung for the selected items, in one step.
function BulkBar({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const run = useRun();
  const [status, setStatus] = useState(KEEP);
  const [legal, setLegal] = useState("");
  const [internal, setInternal] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [priority, setPriority] = useState(KEEP);
  const [busy, setBusy] = useState(false);
  const patch: BulkPatch = {
    ...(status !== KEEP ? { status } : {}),
    ...(legal ? { deadlineLegal: legal } : {}),
    ...(internal ? { deadlineInternal: internal } : {}),
    ...(followUp ? { followUp } : {}),
    ...(priority !== KEEP ? { priority: Number(priority) as 1 | 2 | 3 } : {}),
  };
  const empty = Object.keys(patch).length === 0;

  return (
    <div className="space-y-3 rounded-xl border border-brand/40 bg-brand/5 p-4">
      <p className="text-sm font-medium">Sammeländerung für {ids.length} Einträge · nur ausgefüllte Felder werden geändert</p>
      <div className="grid gap-3 sm:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="bulk-status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="bulk-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={KEEP}>unverändert</SelectItem>
              {[...orderStatuses, ...taskStatuses.filter((entry) => entry.id !== "erledigt")].map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bulk-legal">Frist gesetzlich</Label>
          <Input id="bulk-legal" type="date" value={legal} onChange={(event) => setLegal(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bulk-internal">Frist intern</Label>
          <Input id="bulk-internal" type="date" value={internal} onChange={(event) => setInternal(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bulk-followup">Wiedervorlage</Label>
          <Input id="bulk-followup" type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bulk-priority">Priorität</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger id="bulk-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={KEEP}>unverändert</SelectItem>
              {priorities.map((entry) => (
                <SelectItem key={entry.id} value={String(entry.id)}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="brand"
          size="sm"
          disabled={empty || busy}
          onClick={async () => {
            setBusy(true);
            await run(() => bulkUpdate(ids, patch), `${ids.length} Einträge geändert`);
            setBusy(false);
            onDone();
          }}
        >
          Für alle übernehmen
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Auswahl aufheben
        </Button>
      </div>
    </div>
  );
}
