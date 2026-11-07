"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { circumferencesOf, formatNumber, formatShortDate } from "./calc";
import { colorHex, siteValueKeys } from "./data";
import { useOpenSheet, useWeightData } from "./store";
import { Change, Dot, Panel, Segmented } from "./ui";

export function MeasuresTab() {
  const { participants, sites, circumferences, me } = useWeightData();
  const openSheet = useOpenSheet();
  const mine = participants.find((participant) => participant.userId === me.id);
  const [personId, setPersonId] = useState(mine?.id ?? participants[0]?.id ?? "");
  const [all, setAll] = useState(false);
  const person = participants.find((participant) => participant.id === personId) ?? participants[0];

  if (!person) return <p className="text-sm text-muted-foreground">Noch keine Personen.</p>;

  const sets = circumferencesOf(circumferences, person.id);
  const shown = all ? sets : sets.length > 1 ? [sets[0], sets[sets.length - 1]] : sets;
  const rows = sites
    .filter((site) => site.active)
    .flatMap((site) =>
      siteValueKeys(site).map((key, index) => ({
        key,
        label: site.sided ? `${site.label} ${index === 0 ? "L" : "R"}` : site.label,
      })),
    )
    .map((row) => ({ ...row, values: sets.map((set) => set.values[row.key]).filter((value) => value !== undefined) }))
    .filter((row) => row.values.length > 0);

  return (
    <div className="space-y-4">
      <Segmented
        label="Person"
        value={person.id}
        onChange={setPersonId}
        options={participants.map((participant) => ({
          id: participant.id,
          label: (
            <>
              <Dot color={participant.color} className="size-2" />
              <span className="truncate">{participant.name}</span>
            </>
          ),
        }))}
      />

      <Panel
        title="Maße · cm"
        aside={
          sets.length > 2 && (
            <button type="button" onClick={() => setAll(!all)} className="cursor-pointer text-xs font-semibold tracking-normal text-brand normal-case">
              {all ? "Erste & letzte" : `Alle ${sets.length}`}
            </button>
          )
        }
      >
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Maße.</p>
        ) : (
          <div className="-mx-3 overflow-x-auto px-3 sm:-mx-4 sm:px-4">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-1 pr-2 text-left font-medium" />
                  {shown.map((set) => (
                    <th key={set.date} className="px-1 py-1 text-right font-medium">
                      <button
                        type="button"
                        className="cursor-pointer hover:text-foreground"
                        onClick={() => openSheet({ kind: "measures", edit: { participantId: person.id, date: set.date } })}
                      >
                        {formatShortDate(set.date)}
                      </button>
                    </th>
                  ))}
                  {sets.length > 1 && <th className="py-1 pl-1 text-right font-medium">Δ</th>}
                  <th className="w-14 py-1 pl-2" aria-label="Verlauf" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const first = row.values[0];
                  const last = row.values[row.values.length - 1];
                  return (
                    <tr key={row.key} className="border-t">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{row.label}</td>
                      {shown.map((set) => (
                        <td key={set.date} className="px-1 py-1.5 text-right">
                          {set.values[row.key] !== undefined ? formatNumber(set.values[row.key]) : <span className="text-muted-foreground">–</span>}
                        </td>
                      ))}
                      {sets.length > 1 && (
                        <td className="py-1.5 pl-1 text-right">
                          {row.values.length > 1 ? <Change value={last - first} /> : null}
                        </td>
                      )}
                      <td className="py-1.5 pl-2">
                        <Sparkline values={row.values} color={colorHex(person.color)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Sparkline({ values, color, className }: { values: number[]; color: string; className?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (index: number) => 2 + (index / (values.length - 1)) * 44;
  const y = (value: number) => 14 - ((value - min) / (max - min || 1)) * 12;
  return (
    <svg viewBox="0 0 48 16" className={cn("h-4 w-12", className)} aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}
      />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={1.8} fill={color} />
    </svg>
  );
}
