"use client";

import { daysBetween, formatNumber, weighingsOf, type Standing } from "./calc";
import { colorHex, type Settings, type Weighing } from "./data";

const W = 320;
const H = 180;
const LEFT = 30;
const RIGHT = 6;
const TOP = 8;
const BOTTOM = 20;

const monthLabels = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

// Weight over the challenge: one line per person, the goal dashed, the trend
// dotted up to the end. "delta" shows the change since the own start,
// "absolute" the weight in kg.
export function WeightChart({
  standings,
  weighings,
  settings,
  today,
  mode,
}: {
  standings: Standing[];
  weighings: Weighing[];
  settings: Settings;
  today: string;
  mode: "delta" | "absolute";
}) {
  const total = Math.max(1, daysBetween(settings.startDate, settings.endDate));
  const series = standings.map((standing) => {
    const { participant } = standing;
    const base = mode === "delta" ? participant.startWeight : 0;
    return {
      standing,
      color: colorHex(participant.color),
      goal: participant.goalWeight - base,
      base,
      points: weighingsOf(weighings, participant.id).map((weighing) => ({
        day: daysBetween(settings.startDate, weighing.date),
        value: weighing.weight - base,
      })),
    };
  });

  const values = series.flatMap((line) => [line.goal, ...line.points.map((point) => point.value), mode === "delta" ? 0 : line.standing.participant.startWeight]);
  const step = mode === "delta" ? 5 : niceStep(Math.max(...values) - Math.min(...values));
  const min = Math.floor((Math.min(...values) - 0.5) / step) * step;
  const max = Math.ceil((Math.max(...values) + 0.5) / step) * step;
  const x = (day: number) => LEFT + (Math.min(total, Math.max(0, day)) / total) * (W - LEFT - RIGHT);
  const y = (value: number) => TOP + ((max - Math.min(max, Math.max(min, value))) / (max - min || 1)) * (H - TOP - BOTTOM);

  const ticks: number[] = [];
  for (let value = min; value <= max + 1e-9; value += step) ticks.push(Math.round(value * 10) / 10);

  const months: { day: number; label: string }[] = [];
  const start = new Date(`${settings.startDate}T00:00:00Z`);
  for (let index = 1; index < 24; index++) {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const day = daysBetween(settings.startDate, date.toISOString().slice(0, 10));
    if (day >= total) break;
    months.push({ day, label: monthLabels[date.getUTCMonth()] });
  }
  const todayDay = daysBetween(settings.startDate, today);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gewichtsverlauf">
      {ticks.map((value) => (
        <g key={value}>
          <line
            x1={LEFT}
            x2={W - RIGHT}
            y1={y(value)}
            y2={y(value)}
            className="stroke-border"
            strokeWidth={mode === "delta" && value === 0 ? 1.2 : 0.6}
          />
          <text x={LEFT - 4} y={y(value) + 3} textAnchor="end" className="fill-muted-foreground text-[9px] tabular-nums">
            {mode === "delta" ? (value === 0 ? "0" : `${value > 0 ? "+" : "−"}${Math.abs(value)}`) : formatNumber(value, 0)}
          </text>
        </g>
      ))}
      {months.map((month) => (
        <text key={month.day} x={x(month.day)} y={H - 5} textAnchor="middle" className="fill-muted-foreground text-[9px]">
          {month.label}
        </text>
      ))}
      {todayDay > 0 && todayDay < total && (
        <line x1={x(todayDay)} x2={x(todayDay)} y1={TOP} y2={H - BOTTOM} className="stroke-muted-foreground" strokeWidth={0.8} strokeDasharray="2 3" />
      )}
      {series.map((line) => {
        const trend = line.standing.trend;
        const offset = mode === "delta" ? 0 : line.standing.participant.startWeight;
        return (
          <g key={line.standing.participant.id}>
            <line x1={LEFT} x2={W - RIGHT} y1={y(line.goal)} y2={y(line.goal)} stroke={line.color} strokeWidth={0.9} strokeDasharray="4 4" opacity={0.7} />
            {trend && (
              <line
                x1={x(trend.fromDay)}
                y1={y(trend.slope * trend.fromDay + trend.intercept + offset)}
                x2={x(total)}
                y2={y(trend.slope * total + trend.intercept + offset)}
                stroke={line.color}
                strokeWidth={1.2}
                strokeDasharray="1.5 3"
                opacity={0.8}
              />
            )}
            {line.points.length > 1 && (
              <polyline
                fill="none"
                stroke={line.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={line.points.map((point) => `${x(point.day)},${y(point.value)}`).join(" ")}
              />
            )}
            {line.points.length > 0 && (
              <circle
                cx={x(line.points[line.points.length - 1].day)}
                cy={y(line.points[line.points.length - 1].value)}
                r={3.2}
                fill={line.color}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function niceStep(range: number) {
  for (const step of [1, 2, 5, 10, 20, 25, 50]) if (range / step <= 6) return step;
  return 100;
}
