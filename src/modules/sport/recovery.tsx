"use client";

import { formatClock, sleepRegularity, sleepStats } from "./analytics";
import { addDays, average, formatDate, formatNumber, formatSleep, hrvStatusLabel, lastWeeks, latest, rolling, series } from "./calc";
import { Legend, LineChart, StackedBars } from "./charts";
import { useSportData } from "./store";
import { Panel, SmallRing, TabHero } from "./ui";

const hours = (value: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);

export function RecoveryTab({ today, weeks: count }: { today: string; weeks: number }) {
  const data = useSportData();
  const settings = data.settings;
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
  const sleepLong = series(data.health, from, today, (day) => (day.sleepS ? day.sleepS / 3600 : null));
  const week = sleepStats(data.health, addDays(today, -6), today, settings);
  const month = sleepStats(data.health, sleepFrom, today, settings);
  const range = sleepStats(data.health, from, today, settings);
  const regularity = sleepRegularity(data.health, today);

  const steps = series(data.health, from, today, (day) => day.steps);
  const stepsGoal = settings.stepsGoal ?? latest(data.health, (day) => day.stepsGoal)?.value ?? 7000;
  const stepsAvg = average(steps.slice(-7).map((point) => point.value));
  const weight = data.weight.filter((entry) => entry.day >= addDays(today, -Math.max(count * 7, 120)));

  return (
    <div className="space-y-4">
      <TabHero
        ring={
          <SmallRing value={(week.average ?? 0) / settings.sleepGoalH} size={132} label={`Schlaf im Schnitt der letzten 7 Nächte: ${week.average != null ? formatSleep(week.average * 3600) : "keine Daten"}`}>
            <span className="flex flex-col items-center leading-tight">
              <span className="text-2xl font-extrabold tabular-nums">{week.average != null ? formatSleep(week.average * 3600) : "–"}</span>
              <span className="text-xs font-semibold text-muted-foreground">Ø 7 Nächte</span>
            </span>
          </SmallRing>
        }
        figures={[
          {
            label: "Schlaf 28 Nächte",
            value: month.average != null ? formatSleep(month.average * 3600) : "–",
            sub: month.average == null ? undefined : month.average >= settings.sleepGoalH ? "Ziel erreicht" : `${formatNumber((settings.sleepGoalH - month.average) * 60)} min unter Ziel`,
            tone: month.average == null ? undefined : month.average >= settings.sleepGoalH ? "good" : "bad",
          },
          { label: "Im Bereich", value: `${month.inRange} / ${month.nights}`, sub: `Nächte, ${month.below} zu kurz` },
          { label: "HRV", value: lastHrv ? `${lastHrv.value} ms` : "–", sub: hrvStatusLabel(lastHrv?.entry.hrvStatus ?? null) },
          { label: "Ruhepuls", value: lastRhr ? `${lastRhr.value} bpm` : "–", sub: rhr30 ? `Ø 30 Tage ${formatNumber(rhr30)}` : undefined },
        ]}
      />

      <Panel info={<>Grünes Band: dein Bereich · gestrichelt: Ziel {hours(settings.sleepGoalH)} h im Schnitt. Ändern in den Einstellungen.</>}
        title="Schlaf"
        aside={
          <Legend
            items={[
              { label: "Tief", className: "bg-hero" },
              { label: "REM", className: "bg-brand" },
              { label: "Leicht und wach", className: "bg-chart-3" },
              { label: `Bereich ${hours(settings.sleepMinH)}–${hours(settings.sleepMaxH)} h`, className: "bg-good border border-brand/30" },
            ]}
          />
        }
      >
        <SleepBars
          days={nights.map((point) => byDay.get(point.day) ?? null)}
          keys={nights.map((point) => point.day)}
          min={settings.sleepMinH}
          max={settings.sleepMaxH}
          goal={settings.sleepGoalH}
        />
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{formatDate(sleepFrom)}</span>
          <span>letzte Nacht</span>
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel info={<>Jeder Balken eine Nacht, von Einschlafen bis Aufwachen. Je gleichmäßiger, desto besser für Erholung und HRV; unter ± 30 min gilt als regelmäßig.</>} title="Regelmäßigkeit, letzte 28 Nächte">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted-foreground">Einschlafen im Schnitt</span>
              <p className="text-2xl font-bold tabular-nums">{regularity.bedAvg != null ? formatClock(regularity.bedAvg, 18) : "–"}</p>
              <span className="text-xs text-muted-foreground">± {regularity.bedSpread != null ? formatNumber(regularity.bedSpread) : "–"} min</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Aufwachen im Schnitt</span>
              <p className="text-2xl font-bold tabular-nums">{regularity.wakeAvg != null ? formatClock(regularity.wakeAvg, 0) : "–"}</p>
              <span className="text-xs text-muted-foreground">± {regularity.wakeSpread != null ? formatNumber(regularity.wakeSpread) : "–"} min</span>
            </div>
          </div>
          <SleepWindows nights={regularity.nights} />
        </Panel>

        {count > 4 ? (
          <Panel title="Schlafdauer im Zeitraum" aside={<span className="text-xs text-muted-foreground">{range.inRange} von {range.nights} Nächten im Bereich</span>}>
            <LineChart
              ariaLabel={`Schlafdauer der letzten ${count} Wochen`}
              values={sleepLong.map((point) => point.value)}
              smooth={rolling(sleepLong).map((point) => point.value)}
              band={[settings.sleepMinH, settings.sleepMaxH]}
              goal={settings.sleepGoalH}
              height={180}
              format={(value) => formatSleep(value * 3600)}
              startLabel={formatDate(from)}
              endLabel="heute"
            />
          </Panel>
        ) : (
          <Panel title="Schritte" aside={<span className="text-xs text-muted-foreground">Ziel {formatNumber(stepsGoal)}</span>}>
            <StepsChart steps={steps} goal={stepsGoal} avg={stepsAvg} from={from} />
          </Panel>
        )}
      </div>

      <Panel title="HRV pro Nacht" info={<>Fläche: dein Normalbereich laut Garmin · dunkle Linie: 7-Tage-Schnitt.</>}>
        <LineChart
          ariaLabel={`HRV der letzten ${count} Wochen`}
          values={hrv.map((point) => point.value)}
          smooth={rolling(hrv).map((point) => point.value)}
          band={band}
          height={200}
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
        <Panel info={<>Schnitt 7 Tage {rhr7 ? `${formatNumber(rhr7)} bpm` : "–"}, 30 Tage {rhr30 ? `${formatNumber(rhr30)} bpm` : "–"}. Liegt er mehrere Tage deutlich höher als sonst, lieber locker trainieren.</>} title="Ruhepuls" aside={<span className="text-xl font-bold tabular-nums">{lastRhr ? `${lastRhr.value} bpm` : "–"}</span>}>
          <LineChart
            ariaLabel={`Ruhepuls der letzten ${count} Wochen`}
            values={rhr.map((point) => point.value)}
            smooth={rolling(rhr).map((point) => point.value)}
            height={160}
            format={(value) => `${formatNumber(value)}`}
            startLabel={formatDate(from)}
            endLabel="heute"
          />
        </Panel>

        <Panel info={<>Aus der Gewicht-Challenge (deine Person dort). {data.weight.at(-1)?.bodyFat ? `Zuletzt ${String(data.weight.at(-1)!.bodyFat).replace(".", ",")} % Körperfett.` : ""}</>}
          title="Gewicht"
          aside={<span className="text-xl font-bold tabular-nums">{data.weight.at(-1) ? `${String(data.weight.at(-1)!.kg).replace(".", ",")} kg` : "–"}</span>}
        >
          {weight.length >= 2 ? (
            <LineChart
              ariaLabel="Gewicht aus der Gewicht-Challenge"
              values={weight.map(() => null)}
              smooth={weight.map((entry) => entry.kg)}
              dots
              height={160}
              format={(value) => `${String(Math.round(value * 10) / 10).replace(".", ",")} kg`}
              startLabel={formatDate(weight[0].day)}
              endLabel={formatDate(weight.at(-1)!.day)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Zu wenige Messungen im Zeitraum.</p>
          )}
        </Panel>
      </div>

      {count > 4 && (
        <Panel title="Schritte" aside={<span className="text-xs text-muted-foreground">Ziel {formatNumber(stepsGoal)}</span>}>
          <StepsChart steps={steps} goal={stepsGoal} avg={stepsAvg} from={from} />
        </Panel>
      )}
    </div>
  );
}

// Nightly bars with the goal range as a band (scale: 0 to 10 h or more).
function SleepBars({
  days,
  keys,
  min,
  max,
  goal,
}: {
  days: ({ sleepS: number | null; deepS: number | null; remS: number | null; sleepScore: number | null } | null)[];
  keys: string[];
  min: number;
  max: number;
  goal: number;
}) {
  const top = Math.max(10, max + 0.5, ...days.map((day) => (day?.sleepS ?? 0) / 3600));
  const y = (value: number) => `${(value / top) * 100}%`;
  return (
    <div className="relative h-44 border-b" role="img" aria-label="Schlafdauer der letzten 28 Nächte mit Zielbereich">
      <div className="absolute inset-x-0 bg-good" style={{ bottom: y(min), height: `calc(${y(max)} - ${y(min)})` }} />
      <div className="absolute inset-x-0 border-t-[1.5px] border-dashed border-debt" style={{ bottom: y(goal) }} />
      <div className="relative flex h-full items-end gap-[2px]">
        {days.map((day, index) => {
          const total = (day?.sleepS ?? 0) / 3600;
          const deep = (day?.deepS ?? 0) / 3600;
          const rem = (day?.remS ?? 0) / 3600;
          return (
            <div
              key={keys[index]}
              title={day?.sleepS ? `${formatDate(keys[index])}: ${formatSleep(day.sleepS)}${day.sleepScore ? `, Score ${day.sleepScore}` : ""}` : `${formatDate(keys[index])}: keine Daten`}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <div className="rounded-t-[2px] bg-chart-3" style={{ height: y(Math.max(0, total - deep - rem)) }} />
              <div className="bg-brand" style={{ height: y(rem) }} />
              <div className="bg-hero" style={{ height: y(deep) }} />
            </div>
          );
        })}
      </div>
      <span className="absolute right-0 text-[11px] text-muted-foreground" style={{ bottom: `calc(${y(max)} + 2px)` }}>
        {max} h
      </span>
    </div>
  );
}

// Bed-to-wake windows from 20:00 to 12:00.
function SleepWindows({ nights }: { nights: { day: string; bed: number; wake: number }[] }) {
  const start = 2 * 60; // 20:00 as minutes after 18:00
  const span = 16 * 60; // until 12:00
  const pos = (minutesAfter18: number) => `${Math.min(100, Math.max(0, ((minutesAfter18 - start) / span) * 100))}%`;
  return (
    <div className="space-y-1">
      <div className="relative flex h-32 gap-[2px]" role="img" aria-label="Schlafenszeiten der letzten 28 Nächte">
        {nights.map((night) => {
          const wakeAfter18 = night.wake + 6 * 60; // wake is minutes after midnight
          return (
            <div key={night.day} className="relative min-w-0 flex-1" title={`${formatDate(night.day)}: ${formatClock(night.bed, 18)}–${formatClock(night.wake, 0)}`}>
              <div className="absolute inset-x-0 rounded-sm bg-brand/80" style={{ top: pos(night.bed), bottom: `calc(100% - ${pos(wakeAfter18)})` }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>oben 20:00</span>
        <span>unten 12:00</span>
      </div>
    </div>
  );
}

function StepsChart({ steps, goal, avg, from }: { steps: { day: string; value: number | null }[]; goal: number; avg: number | null; from: string }) {
  const reached = steps.filter((point) => (point.value ?? 0) >= goal).length;
  return (
    <>
      <p className="text-sm">
        Schnitt 7 Tage <strong className="tabular-nums">{avg != null ? formatNumber(avg) : "–"}</strong> · Ziel an {reached} von {steps.filter((point) => point.value != null).length} Tagen erreicht
      </p>
      <StackedBars
        ariaLabel="Schritte pro Tag"
        height={140}
        bars={steps.map((point) => ({
          key: point.day,
          title: `${formatDate(point.day)}: ${point.value != null ? formatNumber(point.value) : "–"} Schritte`,
          segments: [{ value: point.value ?? 0, className: (point.value ?? 0) >= goal ? "bg-brand" : "bg-chart-3" }],
        }))}
        line={steps.map(() => goal)}
        lineOnBarScale
        lineClassName="stroke-debt"
        startLabel={formatDate(from)}
        endLabel="heute"
      />
    </>
  );
}
