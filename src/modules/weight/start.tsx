"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { WeightChart } from "./chart";
import {
  challengeProgress,
  formatDate,
  formatNumber,
  formatShortDate,
  formatSigned,
  ranking,
  weekRows,
} from "./calc";
import { colorHex } from "./data";
import { useWeightData } from "./store";
import { Change, Dot, Panel, PersonName, Segmented } from "./ui";

export function StartTab({ today }: { today: string }) {
  const { settings, participants, weighings, me } = useWeightData();
  const [mode, setMode] = useState<"delta" | "absolute">("delta");

  if (!settings || participants.length === 0) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">
          {me.isAdmin ? "Noch keine Challenge. Leg sie im Setup an." : "Noch keine Challenge."}
        </p>
      </Panel>
    );
  }

  const progress = challengeProgress(settings, today);
  const standings = ranking(participants, weighings, settings);
  const weeks = weekRows(participants, weighings, settings);

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-xl bg-hero p-3 text-hero-foreground sm:p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold">{settings.title}</span>
          <span className="text-xs whitespace-nowrap text-hero-muted">bis {formatDate(settings.endDate)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold tabular-nums">
            {today < settings.startDate ? "Startet bald" : progress.left > 0 ? `${progress.left} Tage` : "Vorbei"}
          </span>
          <span className="text-xs text-hero-muted tabular-nums">
            Tag {progress.day}/{progress.total}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-hero-track">
          <div className="h-full rounded-full bg-hero-bar" style={{ width: `${Math.round(progress.share * 100)}%` }} />
        </div>
      </section>

      <ol className="space-y-2" aria-label="Rangliste">
        {standings.map((standing, index) => (
          <li
            key={standing.participant.id}
            className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-xl border bg-card px-3 py-2.5"
          >
            <span className="font-bold text-muted-foreground tabular-nums">{index + 1}</span>
            <span className="flex min-w-0 items-center gap-2">
              <PersonName participant={standing.participant} />
              <Change value={standing.change} good={standing.span < 0 ? "down" : "up"} />
            </span>
            <span className="text-right text-xl leading-none font-bold tabular-nums">
              {formatNumber(standing.current)} <small className="text-xs font-medium text-muted-foreground">kg</small>
            </span>
            <div className="col-span-2 col-start-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${standing.percent}%`, backgroundColor: colorHex(standing.participant.color) }}
              />
            </div>
            <div className="col-span-2 col-start-2 flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
              <span>
                {standing.percent} % · Ziel {formatNumber(standing.participant.goalWeight, standing.participant.goalWeight % 1 ? 1 : 0)}
              </span>
              {standing.bodyFat !== null && <span>KFA {formatNumber(standing.bodyFat)}</span>}
            </div>
          </li>
        ))}
      </ol>

      <Panel
        title="Verlauf"
        aside={
          <Segmented
            label="Darstellung"
            value={mode}
            onChange={setMode}
            options={[
              { id: "delta", label: "Δ" },
              { id: "absolute", label: "kg" },
            ]}
            className="w-24 normal-case [&_button]:h-7"
          />
        }
      >
        <WeightChart standings={standings} weighings={weighings} settings={settings} today={today} mode={mode} />
        <ul className="space-y-1 text-sm">
          {standings.map(({ participant, trend }) => (
            <li key={participant.id} className="flex items-center justify-between gap-2">
              <PersonName participant={participant} className="font-normal" />
              <span className="text-muted-foreground tabular-nums">
                {trend ? `${formatSigned(trend.slope * 7)}/Wo` : "–"}
                {trend?.goalDate && ` · Ziel ~${formatShortDate(trend.goalDate)}`}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      {weeks.length > 0 && (
        <Panel title="Wochen">
          <div className="-mx-3 overflow-x-auto px-3 sm:-mx-4 sm:px-4">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-1 pr-2 text-left font-medium">Wo</th>
                  {participants.map((participant) => (
                    <th key={participant.id} className="px-1 py-1 text-right font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Dot color={participant.color} className="size-2" />
                        <span className="max-w-[5.5rem] truncate">{participant.name}</span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week.number} className="border-t">
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      {week.number} <span className="text-xs text-muted-foreground">{formatShortDate(week.date)}</span>
                    </td>
                    {participants.map((participant) => {
                      const cell = week.cells[participant.id];
                      const span = participant.goalWeight - participant.startWeight;
                      return (
                        <td key={participant.id} className="px-1 py-1.5 text-right whitespace-nowrap">
                          {cell ? (
                            <>
                              {formatNumber(cell.weight)}
                              {cell.change !== null && (
                                <span
                                  className={cn(
                                    "ml-1 text-xs",
                                    Math.abs(cell.change) < 0.05
                                      ? "text-muted-foreground"
                                      : (cell.change < 0) === (span < 0)
                                        ? "text-good-foreground"
                                        : "text-bad-foreground",
                                  )}
                                >
                                  {formatSigned(cell.change)}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
