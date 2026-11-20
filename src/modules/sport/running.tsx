"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  easyPercent,
  easyShare,
  formatDate,
  formatDayDate,
  formatDuration,
  formatKm,
  formatMinutes,
  formatNumber,
  formatPace,
  lastWeeks,
  paceOf,
  runKind,
  runWeeks,
  tenPercentRule,
  ZONE1_MAX_HR,
} from "./calc";
import { Legend, LineChart, StackedBars } from "./charts";
import { useSportData } from "./store";
import { Note, Panel } from "./ui";

const kmFormat = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function RunningTab({ today, weeks: count }: { today: string; weeks: number }) {
  const data = useSportData();
  const weeks = lastWeeks(today, count);
  const from = weeks[0];
  const runs = data.runs.filter((run) => run.day >= from && run.day <= today);
  const perWeek = runWeeks(data.runs, weeks);
  const km = runs.reduce((sum, run) => sum + (run.km ?? 0), 0);
  const minutes = runs.reduce((sum, run) => sum + (run.durationS ?? 0), 0) / 60;
  const easy = easyPercent(perWeek);
  const longest = runs.reduce<(typeof runs)[number] | null>((best, run) => ((run.km ?? 0) > (best?.km ?? 0) ? run : best), null);
  const rule = tenPercentRule(data.runs, today);
  const easyRuns = runs.filter((run) => run.avgHr != null && run.avgHr < ZONE1_MAX_HR && paceOf(run) != null && !run.type.includes("treadmill"));
  const [showAll, setShowAll] = useState(false);
  const list = [...runs].reverse();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Kilometer" value={formatKm(km)} sub={`${runs.length} Läufe im Zeitraum`} />
        <Kpi label="Laufzeit" value={formatMinutes(minutes)} sub={`Schnitt ${formatMinutes(minutes / count)} pro Woche`} />
        <Kpi label="Zone 1" value={easy != null ? `${formatNumber(easy)} %` : "–"} sub="Anteil der Laufzeit" />
        <Kpi
          label="Längster Lauf"
          value={longest?.km ? formatKm(longest.km) : "–"}
          sub={longest ? `${formatMinutes((longest.durationS ?? 0) / 60)} am ${formatDate(longest.day)}` : undefined}
        />
      </div>

      <Panel
        title="Laufzeit pro Woche nach Puls"
        aside={
          <Legend
            items={[
              { label: "Zone 1", className: "bg-brand" },
              { label: "darüber", className: "bg-debt" },
              { label: "ohne Puls", className: "bg-chart-4" },
              { label: "Kilometer (Linie)", className: "h-0.5 bg-foreground" },
            ]}
          />
        }
      >
        <StackedBars
          ariaLabel={`Laufminuten pro Woche der letzten ${count} Wochen, aufgeteilt nach Puls`}
          height={240}
          bars={perWeek.map((week) => ({
            key: week.week,
            title: `Woche ab ${formatDate(week.week)}: ${week.runs} Läufe, ${formatKm(week.km)}, ${formatMinutes(week.minutes)}${week.minutes ? `, Zone 1 ${formatNumber(easyPercent([week]) ?? 0)} %` : ""}`,
            segments: [
              { value: week.easyMinutes, className: "bg-brand" },
              { value: week.hardMinutes, className: "bg-debt" },
              { value: week.unknownMinutes, className: "bg-chart-4" },
            ],
          }))}
          line={perWeek.map((week) => week.km)}
          startLabel={formatDate(from)}
          endLabel="diese Woche"
        />
        <Note>
          Zone 1 zählt die Zeit in Garmin-Zone 1 und 2. Mit deinen aktuellen Garmin-Zonen reicht das bis etwa 149 bpm; stell in
          Garmin Connect die Obergrenze von Zone 2 auf 145 bpm, dann passt es genau. Läufe ohne Zonenzeiten zählen nach dem Ø-Puls.
        </Note>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Pace bei lockeren Läufen">
          <LineChart
            ariaLabel="Pace der Läufe mit Ø-Puls unter 145 im Verlauf"
            values={easyRuns.map(() => null)}
            smooth={easyRuns.map((run) => paceOf(run))}
            format={(value) => formatPace(value)}
            height={170}
            startLabel={easyRuns[0] ? formatDate(easyRuns[0].day) : undefined}
            endLabel={easyRuns.at(-1) ? formatDate(easyRuns.at(-1)!.day) : undefined}
          />
          <Note>Läufe draußen mit Ø-Puls unter 145, einer pro Punkt. Sinkt die Linie, wirst du bei gleichem Puls schneller.</Note>
        </Panel>
        <Panel title="10-%-Regel">
          {rule ? (
            <>
              <p className="text-sm">
                Längster Lauf der letzten 30 Tage: <strong>{formatMinutes((rule.longest.durationS ?? 0) / 60)}</strong> am{" "}
                {formatDate(rule.longest.day)} Der nächste lange Lauf höchstens <strong>{formatMinutes(rule.maxNextMinutes)}</strong>.
              </p>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-brand" style={{ width: `${(1 / 1.1) * 100}%` }} />
              </div>
            </>
          ) : (
            <p className="text-sm">In den letzten 30 Tagen gab es keinen Lauf. Fang mit der ersten Einheit aus dem Plan an.</p>
          )}
          <Note>Aus deinem Laufplan: kein Lauf mehr als 10 % länger als der längste der letzten 30 Tage.</Note>
        </Panel>
      </div>

      <Panel title="Alle Läufe im Zeitraum">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Läufe im Zeitraum.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-2 font-medium">Datum</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">Art</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">km</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">Zeit</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">Pace</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">Ø / max Puls</th>
                  <th scope="col" className="w-[22%] py-1.5 pl-2 font-medium">Zone 1</th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? list : list.slice(0, 10)).map((run) => {
                  const share = easyShare(run);
                  const pace = paceOf(run);
                  return (
                    <tr key={run.id} className="border-t">
                      <td className="py-2 pr-2">{formatDayDate(run.day)}</td>
                      <td className="px-2 py-2">{runKind(run.type)}</td>
                      <td className="px-2 py-2">{run.km != null ? kmFormat.format(run.km) : "–"}</td>
                      <td className="px-2 py-2">{run.durationS ? formatDuration(run.durationS) : "–"}</td>
                      <td className="px-2 py-2">{pace ? formatPace(pace) : "–"}</td>
                      <td className="px-2 py-2">{run.avgHr ? `${run.avgHr} / ${run.maxHr ?? "–"}` : "–"}</td>
                      <td className="py-2 pl-2">
                        {share == null ? (
                          <span className="text-muted-foreground">kein Puls</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-bad">
                              <div className="h-full bg-brand" style={{ width: `${share * 100}%` }} />
                            </div>
                            <span className="w-9 text-right text-xs text-muted-foreground">{formatNumber(share * 100)} %</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {list.length > 10 && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Weniger anzeigen" : `Alle ${list.length} Läufe anzeigen`}
          </Button>
        )}
      </Panel>
    </div>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border bg-card px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}
