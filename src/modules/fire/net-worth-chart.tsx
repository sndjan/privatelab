"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney, formatMonth } from "./calc";

type Point = { month: string; value: number };

const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 72 };
const MIN_LABEL_SPACING = 80;

// Show the FIRE number as a reference line only while it doesn't flatten the
// net worth line into the baseline.
const TARGET_RANGE_FACTOR = 3;

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

export function NetWorthChart({ points, target }: { points: Point[]; target: number }) {
  const [active, setActive] = useState<number | null>(null);
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

  if (points.length === 0) {
    return <p className="text-sm opacity-70">Add your first monthly balances to see the chart.</p>;
  }

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

  const activePoint = active === null ? null : points[active];

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">Net worth over time</figcaption>
      <div ref={containerRef} className="relative">
        <svg width={width} height={HEIGHT} className="block" role="img" aria-label="Net worth over time">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--grid)" />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--text-muted)">
                {formatMoney(tick)}
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
                fill="var(--text-muted)"
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
                stroke="var(--text-muted)"
                strokeDasharray="4 4"
              />
              <text x={width - PAD.right} y={y(target) - 6} textAnchor="end" fontSize="11" fill="var(--text-muted)">
                FIRE number {formatMoney(target)}
              </text>
            </g>
          )}
          <path d={path} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" />
          {points.map((point, index) => (
            <circle
              key={point.month}
              cx={x(index)}
              cy={y(point.value)}
              r={index === active ? 5 : 4}
              fill="var(--series-1)"
              stroke="var(--background)"
              strokeWidth="2"
            />
          ))}
          {activePoint && (
            <line
              x1={x(active!)}
              x2={x(active!)}
              y1={PAD.top}
              y2={PAD.top + plotHeight}
              stroke="var(--text-muted)"
              strokeWidth="1"
            />
          )}
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
        {activePoint && (
          <div
            className="pointer-events-none absolute top-0 rounded border border-foreground/10 bg-background px-2 py-1 text-xs shadow"
            style={{
              left: x(active!),
              transform: active! > points.length / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
            }}
          >
            <div className="font-semibold">{formatMoney(activePoint.value)}</div>
            <div className="opacity-70">{formatMonth(activePoint.month)}</div>
          </div>
        )}
      </div>
      {!showTarget && target > 0 && (
        <p className="text-xs opacity-60">Your FIRE number ({formatMoney(target)}) is above the chart range.</p>
      )}
    </figure>
  );
}
