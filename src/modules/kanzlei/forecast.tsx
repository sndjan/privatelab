"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useMemo } from "react";
import { formatDate, formatMinutes } from "./data";
import { addDays, deadlineOf, deadlineRisks, isActionable, itemLabel, weekLoads } from "./plan";
import { useDialogs, useKanzleiData, usePlanData } from "./store";

const PX_PER_HOUR = 6;

// The order load of the next 12 weeks against the time for orders (60 % by
// default), with what can't be done by its deadline.
export function ForecastView() {
  const { today, items, types } = useKanzleiData();
  const data = usePlanData();
  const { openItem } = useDialogs();
  const weeks = useMemo(() => weekLoads(data, today, 12), [data, today]);
  const risks = useMemo(() => deadlineRisks(data, today), [data, today]);
  const max = Math.max(1, ...weeks.map((week) => Math.max(week.load, week.capacity))) / 60;
  const height = Math.min(260, Math.max(120, max * PX_PER_HOUR));
  const scale = height / max;

  // Orders that can be done now and whose deadline lies in an overloaded week:
  // starting them early takes load off that week.
  const pullForward = useMemo(() => {
    const overloaded = weeks.filter((week) => week.capacity > 0 && week.load > week.capacity);
    if (overloaded.length === 0) return [];
    const byId = new Map(items.map((item) => [item.id, item]));
    const first = overloaded[0].monday;
    return items
      .filter((item) => item.kind === "auftrag" && isActionable(item, today, byId))
      .filter((item) => {
        const deadline = deadlineOf(item);
        return deadline !== null && deadline >= first;
      })
      .sort((a, b) => (deadlineOf(a) ?? "").localeCompare(deadlineOf(b) ?? ""))
      .slice(0, 5);
  }, [weeks, items, today]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Die nächsten 12 Wochen</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Restaufwand der Aufträge, gleichmäßig verteilt bis zur Frist, gegen deine Zeit für Aufträge. Aufträge ohne Unterlagen und solche, die
          wiederkehrende Aufträge noch anlegen werden, zählen als Prognose mit.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Legend className="bg-brand" label="Bearbeitbar" />
          <Legend className="bg-brand/45" label="Wartet (Unterlagen, Rückmeldung)" />
          <Legend className="bg-[repeating-linear-gradient(135deg,var(--muted-foreground)_0_3px,transparent_3px_7px)] opacity-60" label="Prognose wiederkehrend" />
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-foreground" /> Zeit für Aufträge
          </span>
        </div>
        <div className="overflow-x-auto">
          <div
            role="img"
            aria-label={`Wochenlast: ${weeks.filter((week) => week.load > week.capacity && week.capacity > 0).length} von 12 Wochen überlastet`}
            className="flex min-w-[640px] gap-2"
          >
            {weeks.map((week) => {
              const over = week.capacity > 0 && week.load > week.capacity;
              return (
                <div key={week.monday} className={`flex flex-1 flex-col items-center gap-1 rounded-md pt-2 ${over ? "bg-amber-500/10" : ""}`}>
                  <div className="relative flex w-full flex-col-reverse items-center" style={{ height }}>
                    <div className="flex w-3/5 max-w-10 flex-col-reverse overflow-hidden rounded-t-sm">
                      <div className="bg-brand" style={{ height: (week.open / 60) * scale }} />
                      <div className="bg-brand/45" style={{ height: (week.waiting / 60) * scale }} />
                      <div
                        className="bg-[repeating-linear-gradient(135deg,var(--muted-foreground)_0_3px,transparent_3px_7px)] opacity-60"
                        style={{ height: (week.forecast / 60) * scale }}
                      />
                    </div>
                    <div className="absolute inset-x-1 border-t-2 border-dashed border-foreground" style={{ bottom: (week.capacity / 60) * scale }} />
                  </div>
                  <span className="text-xs font-medium">{formatDate(week.monday)}</span>
                  <span className={`text-xs tabular-nums ${over ? "font-semibold text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                    {Math.round(week.load / 60)}/{Math.round(week.capacity / 60)} h
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-2 rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Gefährdete Fristen</h2>
          {risks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nach jetzigem Stand ist bis zu jeder Frist genug Zeit.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {risks.map((risk) => (
                <li key={risk.deadline} className="flex gap-2">
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                  <span>
                    Bis <b>{formatDate(risk.deadline, true)}</b> fehlen rund {formatMinutes(risk.missing)}: {formatMinutes(risk.work)} Arbeit, {formatMinutes(risk.capacity)}{" "}
                    Zeit für Aufträge.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2 rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Jetzt schon anfangen</h2>
          {pullForward.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Woche ist überlastet, nichts muss vorgezogen werden.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {pullForward.map((item) => (
                <li key={item.id}>
                  <button type="button" className="cursor-pointer text-left hover:underline" onClick={() => openItem({ item })}>
                    {itemLabel(item, types)}
                  </button>
                  <span className="text-muted-foreground"> · Frist {formatDate(deadlineOf(item))} · Rest {formatMinutes(item.remaining || item.estimate)}</span>
                </li>
              ))}
              <li className="pt-1 text-xs text-muted-foreground">
                Ab {formatDate(weeks.find((week) => week.capacity > 0 && week.load > week.capacity)?.monday ?? addDays(today, 0))} wird es eng. Fest einplanen
                geht über „Fest für heute einplanen“.
              </li>
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-3 rounded-sm ${className}`} /> {label}
    </span>
  );
}
