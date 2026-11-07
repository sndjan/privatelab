"use client";

import { useState } from "react";
import { compositions, formatNumber, formatShortDate, metricOf, weighingsOf, type BodyMetric } from "./calc";
import { colorHex } from "./data";
import { useWeightData } from "./store";
import { Change, Panel, PersonName, Segmented } from "./ui";

const metrics: { id: BodyMetric; label: string; unit: string; good: "down" | "up" }[] = [
  { id: "bodyFat", label: "KFA", unit: "%", good: "down" },
  { id: "muscleMass", label: "Muskeln", unit: "kg", good: "up" },
  { id: "fatFreeMass", label: "FFM", unit: "kg", good: "up" },
];

export function BodyTab() {
  const { participants, weighings } = useWeightData();
  const [metricId, setMetricId] = useState<BodyMetric>("bodyFat");
  const metric = metrics.find((entry) => entry.id === metricId) ?? metrics[0];

  const rows = participants
    .map((participant) => ({ participant, value: metricOf(weighingsOf(weighings, participant.id), metric.id) }))
    .filter((row) => row.value !== null);
  const bars = participants
    .map((participant) => ({ participant, items: compositions(weighingsOf(weighings, participant.id)) }))
    .filter((row) => row.items.length > 0);
  const maxWeight = Math.max(1, ...bars.flatMap((row) => row.items.map((item) => item.fat + item.rest + item.muscle)));

  return (
    <div className="space-y-4">
      <Segmented label="Wert" value={metricId} onChange={setMetricId} options={metrics.map(({ id, label }) => ({ id, label }))} />

      <Panel title={`${metric.label} · seit erster Messung`}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Werte.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map(({ participant, value }) => (
              <li key={participant.id} className="flex items-center justify-between gap-2">
                <PersonName participant={participant} />
                <span className="flex items-center gap-2 tabular-nums">
                  <span className="font-semibold">
                    {formatNumber(value!.last)} {metric.unit}
                  </span>
                  <Change value={value!.change} good={metric.good} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {bars.length > 0 && (
        <Panel title="Zusammensetzung">
          <div className="flex flex-wrap gap-x-6 gap-y-4">
            {bars.map(({ participant, items }) => (
              <figure key={participant.id} className="space-y-1">
                <figcaption className="text-xs font-semibold" style={{ color: colorHex(participant.color) }}>
                  {participant.name}
                </figcaption>
                <div className="flex h-32 items-end gap-1.5">
                  {items.map((item) => {
                    const height = (value: number) => `${(value / maxWeight) * 100}%`;
                    return (
                      <div key={item.date} className="flex h-full w-6 flex-col items-center gap-1">
                        <div
                          className="flex w-full flex-1 flex-col justify-end overflow-hidden rounded-sm"
                          title={`${formatShortDate(item.date)}: Fett ${formatNumber(item.fat)} kg, Rest ${formatNumber(item.rest)} kg, Muskeln ${formatNumber(item.muscle)} kg`}
                        >
                          <div style={{ height: height(item.fat), backgroundColor: colorHex(participant.color), opacity: 0.55 }} />
                          <div className="bg-muted-foreground/40" style={{ height: height(item.rest) }} />
                          <div className="bg-brand" style={{ height: height(item.muscle) }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{formatShortDate(item.date).slice(0, 5)}</span>
                      </div>
                    );
                  })}
                </div>
              </figure>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full opacity-55" style={{ backgroundColor: colorHex(bars[0].participant.color) }} />
              Fett
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-muted-foreground/40" />
              Rest
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-brand" />
              Muskeln
            </span>
          </div>
        </Panel>
      )}
    </div>
  );
}
