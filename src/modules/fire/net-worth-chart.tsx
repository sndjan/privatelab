"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatCompactMoney, formatMoney, formatMonth } from "./calc";

type Point = { month: string; value: number };

const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 64 };
const MIN_LABEL_SPACING = 96;

// Show the FIRE number as a reference line only while it doesn't flatten the
// net worth line into the baseline.
const TARGET_RANGE_FACTOR = 3;

const ranges = [
  { value: "12", label: "12 Mon.", months: 12 },
  { value: "36", label: "3 J.", months: 36 },
  { value: "all", label: "Alles", months: null },
] as const;

function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || 1;
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const niceStep = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => span / s <= count) ?? step * 10;
  const ticks: number[] = [];
  for (let tick = Math.floor(min / niceStep) * niceStep; tick <= max + niceStep / 2; tick += niceStep) {
    ticks.push(tick);
  }
  return ticks;
}

// Points from the last `months` months, counted back from the latest point.
function inRange(points: Point[], months: number | null) {
  if (months === null || points.length === 0) return points;
  const latest = new Date(`${points[points.length - 1].month}T00:00:00`);
  const first = new Date(latest.getFullYear(), latest.getMonth() - months + 1, 1);
  return points.filter((point) => new Date(`${point.month}T00:00:00`) >= first);
}

export function NetWorthChart({ points: allPoints, target }: { points: Point[]; target: number }) {
  const [active, setActive] = useState<number | null>(null);
  const [range, setRange] = useState<(typeof ranges)[number]>(ranges[0]);
  const [width, setWidth] = useState(640);
  const containerRef = useRef<HTMLDivElement>(null);

  // Size the SVG to its container so text stays 11px on every screen.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const points = inRange(allPoints, range.months);

  return (
    <Card aria-labelledby="chart-heading" role="region">
      {/* Title and range buttons wrap onto two lines on narrow screens. */}
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle id="chart-heading" className="text-lg">
          <h2>Vermögen im Zeitverlauf</h2>
        </CardTitle>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label="Zeitraum"
          value={range.value}
          onValueChange={(value) => {
            const next = ranges.find((option) => option.value === value);
            if (!next) return;
            setRange(next);
            setActive(null);
          }}
          >
          {ranges.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value} className="px-3">
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardHeader>
      <CardContent ref={containerRef}>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground">Trag deine ersten Monatsstände ein, um das Diagramm zu sehen.</p>
        ) : (
          <Plot points={points} target={target} width={width} active={active} setActive={setActive} />
        )}
      </CardContent>
    </Card>
  );
}

function Plot({
  points,
  target,
  width,
  active,
  setActive,
}: {
  points: Point[];
  target: number;
  width: number;
  active: number | null;
  setActive: (index: number | null) => void;
}) {
  const values = points.map((point) => point.value);
  const maxValue = Math.max(...values);
  const showTarget = target > 0 && target <= Math.max(maxValue, 1) * TARGET_RANGE_FACTOR;
  const ticks = niceTicks(Math.min(0, ...values), Math.max(maxValue, showTarget ? target : 0, 1));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];

  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) =>
    PAD.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => PAD.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;

  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.value)}`).join(" ");
  // Label every n-th month, counted back from the latest so it is always labelled.
  const labelEvery = Math.ceil(points.length / Math.max(1, Math.floor(plotWidth / MIN_LABEL_SPACING)));
  const last = points.length - 1;

  function handlePointer(event: React.PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = PAD.left + ((event.clientX - rect.left) / rect.width) * plotWidth;
    let nearest = 0;
    points.forEach((_, index) => {
      if (Math.abs(x(index) - svgX) < Math.abs(x(nearest) - svgX)) nearest = index;
    });
    setActive(nearest);
  }

  // Without a hovered point, the label shows the latest month.
  const shown = active ?? last;
  const shownPoint = points[shown];
  const first = points[0];
  const latest = points[last];

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          width={width}
          height={HEIGHT}
          className="block"
          role="img"
          aria-label={`Vermögen von ${formatMoney(first.value)} im ${formatMonth(first.month)} auf ${formatMoney(latest.value)} im ${formatMonth(latest.month)}`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--muted)" />
              <text
                x={PAD.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                fontSize="11"
                fill="var(--muted-foreground)"
                className="font-mono"
              >
                {formatCompactMoney(tick)}
              </text>
            </g>
          ))}
          {points.map((point, index) =>
            (last - index) % labelEvery === 0 ? (
              <text
                key={point.month}
                x={x(index)}
                y={HEIGHT - 8}
                textAnchor={index === last && last > 0 ? "end" : index === 0 && last > 0 ? "start" : "middle"}
                fontSize="11"
                fill="var(--muted-foreground)"
                className="font-mono"
              >
                {formatMonth(point.month)}
              </text>
            ) : null,
          )}
          {showTarget && (
            <g>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(target)}
                y2={y(target)}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
              />
              <text x={width - PAD.right} y={y(target) - 6} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">
                FIRE-Zahl {formatMoney(target)}
              </text>
            </g>
          )}
          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + plotHeight}
              stroke="var(--input)"
              strokeWidth="1"
            />
          )}
          <path d={path} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" />
          <circle
            cx={x(shown)}
            cy={y(shownPoint.value)}
            r={6}
            fill="var(--brand)"
            stroke="var(--card)"
            strokeWidth="2"
          />
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onPointerMove={handlePointer}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        <div
          className="pointer-events-none absolute top-3.5 flex gap-2 rounded-lg bg-hero px-2.5 py-1.5 text-xs text-hero-foreground"
          style={
            shown > points.length / 2
              ? { right: Math.max(12, width - x(shown) + 12) }
              : { left: x(shown) + 12 }
          }
        >
          <span>{formatMonth(shownPoint.month)}</span>
          <span className="font-mono">{formatMoney(shownPoint.value)}</span>
        </div>
      </div>
      {!showTarget && target > 0 && (
        <p className="text-[13px] text-muted-foreground">
          Die FIRE-Linie bei {formatMoney(target)} liegt außerhalb dieser Skala. Sie erscheint, sobald dein Vermögen ein Drittel davon erreicht.
        </p>
      )}
    </div>
  );
}
