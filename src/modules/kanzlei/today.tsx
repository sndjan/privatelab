"use client";

import { AlertTriangleIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { makePlan, resetPlan } from "./actions";
import { ChatPanel } from "./chat";
import { formatDate, formatMinutes, statusLabel, type PlanEntry } from "./data";
import { QuickActions, TypeTag } from "./item-actions";
import { currentPlan, dayCapacity, deadlineOf, itemLabel, timeBlocks } from "./plan";
import { useDialogs, useKanzleiData, usePlanData, useRun } from "./store";

const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export function TodayView() {
  const data = useKanzleiData();
  const planData = usePlanData();
  const { openItem } = useDialogs();
  const run = useRun();
  const [planning, setPlanning] = useState(false);
  const { today, settings, absences } = data;
  const plan = useMemo(() => currentPlan(data.plan, planData, today), [data.plan, planData, today]);
  const capacity = dayCapacity(today, settings, absences);
  const times = timeBlocks(plan, settings, capacity);
  const date = new Date(`${today}T12:00:00Z`);
  const now = plan.must[0] ?? plan.focus[0] ?? null;
  const planned = [...plan.must, ...plan.focus].reduce((sum, entry) => sum + entry.minutes, 0);

  async function replan() {
    setPlanning(true);
    await run(() => makePlan(), "Neuer Plan steht");
    setPlanning(false);
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section aria-label="Tagesplan" className="min-w-0 flex-[999_1_560px] space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {weekdays[(date.getUTCDay() + 6) % 7]}, {date.getUTCDate()}. {months[date.getUTCMonth()]} {date.getUTCFullYear()}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Heute</h1>
            {plan.summary && <p className="mt-1 max-w-2xl text-sm text-foreground/80">{plan.summary}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openItem({ kind: "aufgabe" })}>
              <PlusIcon /> Aufgabe
            </Button>
            <Button variant="outline" size="sm" onClick={() => openItem({ kind: "auftrag" })}>
              <PlusIcon /> Auftrag
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="font-medium">{capacity.total > 0 ? `${formatMinutes(capacity.total)} netto` : "Kein Arbeitstag"}</span>
            {capacity.total > 0 && (
              <span className="text-muted-foreground">
                {formatMinutes(capacity.orders)} Aufträge · {formatMinutes(capacity.daily)} Tagesgeschäft · {formatMinutes(capacity.buffer)} Puffer
              </span>
            )}
            <span className="ml-auto text-muted-foreground">verplant {formatMinutes(planned)}</span>
          </div>
          {capacity.total > 0 && (
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="bg-brand" style={{ width: `${Math.min(100, (planned / capacity.total) * 100)}%` }} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
            <span>
              {plan.source === "ki"
                ? `Plan der KI von ${new Date(plan.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
                : "Plan nach Regeln"}
            </span>
            {data.hasAi && (
              <Button size="sm" variant="secondary" className="h-7" disabled={planning} onClick={replan}>
                <SparklesIcon /> {planning ? "Plant …" : plan.source === "ki" ? "Neu planen" : "Mit KI planen"}
              </Button>
            )}
            {plan.source === "ki" && (
              <Button size="sm" variant="ghost" className="h-7" onClick={() => run(() => resetPlan())}>
                Nach Regeln
              </Button>
            )}
          </div>
        </div>

        {now && <NowCard entry={now} time={times.get(now.id)} />}

        <Group title="Muss heute erledigt werden" entries={plan.must} times={times} empty="Nichts, was heute zwingend fällig ist." />
        <Group title="Hauptfokus" entries={plan.focus} times={times} empty="Nichts Bearbeitbares. Unterlagen oder Rückmeldungen fehlen noch." />
        <Group title="Wenn noch Zeit bleibt" entries={plan.optional} times={times} muted />

        {plan.warnings.length > 0 && (
          <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            {plan.warnings.map((warning) => (
              <p key={warning} className="flex gap-2">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                {warning}
              </p>
            ))}
          </div>
        )}
      </section>

      <ChatPanel />
    </div>
  );
}

function NowCard({ entry, time }: { entry: PlanEntry; time?: string }) {
  const { items, types } = useKanzleiData();
  const item = items.find((candidate) => candidate.id === entry.id);
  if (!item) return null;
  return (
    <div className="space-y-3 rounded-xl bg-primary p-5 text-primary-foreground">
      <p className="text-xs font-semibold tracking-wider uppercase opacity-70">Jetzt dran{time ? ` · ca. ${time}` : ""}</p>
      <p className="text-xl font-semibold">{itemLabel(item, types)}</p>
      <p className="text-sm opacity-80">
        {entry.reason} · {formatMinutes(entry.minutes)}
      </p>
      <div className="rounded-lg bg-background p-2 text-foreground">
        <QuickActions item={item} />
      </div>
    </div>
  );
}

function Group({
  title,
  entries,
  times,
  empty,
  muted = false,
}: {
  title: string;
  entries: PlanEntry[];
  times: Map<string, string>;
  empty?: string;
  muted?: boolean;
}) {
  const { items, types } = useKanzleiData();
  const { openItem } = useDialogs();
  const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  if (entries.length === 0 && !empty) return null;
  return (
    <section className="space-y-2">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold">
        {title}
        {entries.length > 0 && <span className="font-normal text-muted-foreground">{formatMinutes(total)}</span>}
      </h2>
      {entries.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
      <ul className="space-y-2">
        {entries.map((entry) => {
          const item = items.find((candidate) => candidate.id === entry.id);
          if (!item) return null;
          const deadline = deadlineOf(item);
          return (
            <li key={entry.id} className={`flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 ${muted ? "border-dashed bg-card/60" : ""}`}>
              <div className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums">{times.get(entry.id) ?? ""}</div>
              <button type="button" className="min-w-0 flex-[1_1_240px] cursor-pointer text-left" onClick={() => openItem({ item })}>
                <span className="flex flex-wrap items-center gap-2">
                  <TypeTag typeId={item.typeId} types={types} />
                  <span className="font-medium">
                    {[item.client, item.period, item.title].filter(Boolean).join(" · ") || "Ohne Titel"}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {entry.reason}
                  {deadline ? ` · Frist ${formatDate(deadline)}` : ""} · {statusLabel(item.status)}
                </span>
              </button>
              <span className="w-14 text-right text-sm font-semibold tabular-nums">{formatMinutes(entry.minutes)}</span>
              <QuickActions item={item} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
