"use client";

import { addDays, average, formatDate, formatNumber, formatSleep, hrvStatusLabel, lastWeeks, latest, rolling, series } from "./calc";
import { Legend, LineChart, StackedBars } from "./charts";
import { useSportData } from "./store";
import { Note, Panel } from "./ui";

export function RecoveryTab({ today, weeks: count }: { today: string; weeks: number }) {
  const data = useSportData();
  const from = lastWeeks(today, count)[0];
  const hrv = series(data.health, from, today, (day) => day.hrv);
  const rhr = series(data.health, from, today, (day) => day.restingHr);
  const lastHrv = latest(data.health, (day) => day.hrv);
  const lastRhr = latest(data.health, (day) => day.restingHr);
  const band = lastHrv?.entry.hrvLow && lastHrv.entry.hrvHigh ? ([lastHrv.entry.hrvLow, lastHrv.entry.hrvHigh] as [number, number]) : null;
  const rhr7 = average(rhr.slice(-7).map((point) => point.value));
  const rhr30 = average(rhr.slice(-30).map((point) => point.value));

  const sleepFrom = addDays(today, -27);
  const nights = series(data.health, sleepFrom, today, (day) => day.sleepS);
  const byDay = new Map(data.health.map((day) => [day.day, day]));
  const sleep28 = data.health.filter((day) => day.day >= sleepFrom && day.sleepS);
  const sleepLong = series(data.health, from, today, (day) => (day.sleepS ? day.sleepS / 3600 : null));

  return (
    <div className="space-y-4">
      <Panel title="HRV pro Nacht" aside={<span className="text-xs text-muted-foreground">Fläche: dein Normalbereich laut Garmin · dunkel: 7-Tage-Schnitt</span>}>
        <LineChart
          ariaLabel={`HRV der letzten ${count} Wochen`}
          values={hrv.map((point) => point.value)}
          smooth={rolling(hrv).map((point) => point.value)}
          band={band}
          height={220}
          format={(value) => `${formatNumber(value)} ms`}
          startLabel={formatDate(from)}
          endLabel="heute"
        />
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            Letzte Nacht <strong className="tabular-nums">{lastHrv ? `${lastHrv.value} ms` : "–"}</strong>
          </span>
          <span>
            7 Tage <strong className="tabular-nums">{lastHrv?.entry.hrvWeekly ? `${lastHrv.entry.hrvWeekly} ms` : "–"}</strong>
          </span>
          <span>
            Status <strong>{hrvStatusLabel(lastHrv?.entry.hrvStatus ?? null)}</strong>
          </span>
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Ruhepuls" aside={<span className="text-xl font-bold tabular-nums">{lastRhr ? `${lastRhr.value} bpm` : "–"}</span>}>
          <LineChart
            ariaLabel={`Ruhepuls der letzten ${count} Wochen`}
            values={rhr.map((point) => point.value)}
            smooth={rolling(rhr).map((point) => point.value)}
            height={170}
            format={(value) => `${formatNumber(value)}`}
            startLabel={formatDate(from)}
            endLabel="heute"
          />
          <Note>
            Schnitt 7 Tage {rhr7 ? `${formatNumber(rhr7)} bpm` : "–"}, 30 Tage {rhr30 ? `${formatNumber(rhr30)} bpm` : "–"}. Liegt er mehrere Tage
            deutlich höher als sonst, lieber locker trainieren.
          </Note>
        </Panel>

        <Panel
          title="Schlaf, letzte 28 Nächte"
          aside={
            <Legend
              items={[
                { label: "Tief", className: "bg-hero" },
                { label: "REM", className: "bg-brand" },
                { label: "Leicht und wach", className: "bg-chart-3" },
              ]}
            />
          }
        >
          <StackedBars
            ariaLabel="Schlafdauer der letzten 28 Nächte nach Phasen"
            height={170}
            bars={nights.map((point) => {
              const day = byDay.get(point.day);
              const total = (day?.sleepS ?? 0) / 3600;
              const deep = (day?.deepS ?? 0) / 3600;
              const rem = (day?.remS ?? 0) / 3600;
              return {
                key: point.day,
                title: day?.sleepS ? `${formatDate(point.day)}: ${formatSleep(day.sleepS)}${day.sleepScore ? `, Score ${day.sleepScore}` : ""}` : `${formatDate(point.day)}: keine Daten`,
                segments: [
                  { value: deep, className: "bg-hero" },
                  { value: rem, className: "bg-brand" },
                  { value: Math.max(0, total - deep - rem), className: "bg-chart-3" },
                ],
              };
            })}
            startLabel={formatDate(sleepFrom)}
            endLabel="letzte Nacht"
          />
          <Note>
            Schnitt {sleep28.length ? formatSleep(average(sleep28.map((day) => day.sleepS))!) : "–"} · Schlaf-Score Schnitt{" "}
            {formatNumber(average(sleep28.map((day) => day.sleepScore)) ?? 0)}
          </Note>
        </Panel>
      </div>

      {count > 4 && (
        <Panel title="Schlafdauer im Zeitraum">
          <LineChart
            ariaLabel={`Schlafdauer der letzten ${count} Wochen`}
            values={sleepLong.map((point) => point.value)}
            smooth={rolling(sleepLong).map((point) => point.value)}
            height={140}
            format={(value) => formatSleep(value * 3600)}
            startLabel={formatDate(from)}
            endLabel="heute"
          />
        </Panel>
      )}
    </div>
  );
}
