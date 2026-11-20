import { cn } from "@/lib/utils";

// Small hand-drawn charts for the Sport module. Bars are plain divs (each
// with a tooltip), lines are SVG polylines that skip days without a value.

export type BarSegment = { value: number; className: string };
export type Bar = { key: string; title: string; segments: BarSegment[]; label?: string };

export function StackedBars({
  bars,
  height = 200,
  line,
  lineClassName = "stroke-foreground",
  lineOnBarScale = false,
  ariaLabel,
  startLabel,
  endLabel,
}: {
  bars: Bar[];
  height?: number;
  // Optional overlay with its own scale, one value per bar.
  line?: number[];
  lineClassName?: string;
  // Draw the line on the bars' scale (e.g. a plan target) instead of its own.
  lineOnBarScale?: boolean;
  ariaLabel: string;
  startLabel?: string;
  endLabel?: string;
}) {
  const barMax = Math.max(1, ...bars.map((bar) => bar.segments.reduce((sum, segment) => sum + segment.value, 0)));
  const max = lineOnBarScale && line ? Math.max(barMax, ...line) : barMax;
  const lineMax = lineOnBarScale ? max : line ? Math.max(1, ...line) : 1;
  const points = line?.map((value, index) => `${((index + 0.5) / line.length) * 100},${100 - (value / lineMax) * 92}`).join(" ");
  return (
    <figure className="m-0 space-y-1" aria-label={ariaLabel}>
      <div className="relative flex items-end gap-[3px] border-b" style={{ height }}>
        {bars.map((bar) => (
          <div key={bar.key} title={bar.title} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-px">
            {bar.label && <span className="pb-0.5 text-center text-[10px] text-muted-foreground tabular-nums">{bar.label}</span>}
            {bar.segments
              .slice()
              .reverse()
              .map((segment, index) => (
                <div
                  key={index}
                  className={cn(segment.className, index === 0 && "rounded-t-[3px]")}
                  style={{ height: `${(segment.value / max) * 92}%` }}
                />
              ))}
          </div>
        ))}
        {points && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
            <polyline points={points} fill="none" className={lineClassName} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeDasharray={lineOnBarScale ? "5 4" : undefined} />
          </svg>
        )}
      </div>
      {(startLabel || endLabel) && (
        <figcaption className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </figcaption>
      )}
    </figure>
  );
}

function segmentsOf(values: (number | null)[], min: number, max: number, height: number) {
  const span = max - min || 1;
  const n = values.length;
  const out: string[] = [];
  let current: string[] = [];
  values.forEach((value, index) => {
    if (value == null) {
      if (current.length) out.push(current.join(" "));
      current = [];
      return;
    }
    const x = n === 1 ? 50 : (index / (n - 1)) * 100;
    const y = height - ((value - min) / span) * height * 0.9 - height * 0.05;
    current.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  });
  if (current.length) out.push(current.join(" "));
  return out;
}

export function LineChart({
  values,
  smooth,
  band,
  goal,
  dots,
  height = 160,
  ariaLabel,
  format,
  startLabel,
  endLabel,
}: {
  values: (number | null)[];
  smooth?: (number | null)[];
  // Shaded range (e.g. the HRV normal range).
  band?: [number, number] | null;
  // Dashed line, e.g. a goal.
  goal?: number | null;
  // Draw the smooth line's values as dots too (sparse data like VO2max).
  dots?: boolean;
  height?: number;
  ariaLabel: string;
  format: (value: number) => string;
  startLabel?: string;
  endLabel?: string;
}) {
  const all = [...values, ...(smooth ?? []), ...(band ?? []), ...(goal != null ? [goal] : [])].filter((value): value is number => value != null);
  if (all.length === 0) return <p className="text-sm text-muted-foreground">Noch keine Werte.</p>;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const H = 40;
  const span = max - min || 1;
  const yOf = (value: number) => H - ((value - min) / span) * H * 0.9 - H * 0.05;
  return (
    <figure className="m-0 space-y-1">
      <div className="relative">
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel} className="block w-full overflow-visible" style={{ height }}>
          {band && <rect x="0" width="100" y={yOf(band[1])} height={Math.max(0, yOf(band[0]) - yOf(band[1]))} className="fill-good" />}
          {segmentsOf(values, min, max, H).map((points, index) => (
            <polyline key={`d${index}`} points={points} fill="none" className="stroke-chart-3" strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          ))}
          {goal != null && (
            <line x1="0" x2="100" y1={yOf(goal)} y2={yOf(goal)} className="stroke-debt" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          )}
          {smooth &&
            segmentsOf(smooth, min, max, H).map((points, index) => (
              <polyline key={`s${index}`} points={points} fill="none" className="stroke-brand" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            ))}
        </svg>
        {dots && smooth && (
          <div className="pointer-events-none absolute inset-0">
            {smooth.map((value, index) =>
              value == null ? null : (
                <span
                  key={index}
                  className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand"
                  style={{ left: `${smooth.length === 1 ? 50 : (index / (smooth.length - 1)) * 100}%`, top: `${(yOf(value) / H) * 100}%` }}
                />
              ),
            )}
          </div>
        )}
        <span className="pointer-events-none absolute top-0 right-0 text-[11px] text-muted-foreground tabular-nums">{format(max)}</span>
        <span className="pointer-events-none absolute right-0 bottom-0 text-[11px] text-muted-foreground tabular-nums">{format(min)}</span>
      </div>
      {(startLabel || endLabel) && (
        <figcaption className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </figcaption>
      )}
    </figure>
  );
}

export function Sparkline({ values, className = "stroke-brand", height = 48 }: { values: (number | null)[]; className?: string; height?: number }) {
  const present = values.filter((value): value is number => value != null);
  if (present.length < 2) return <div style={{ height }} />;
  const lines = segmentsOf(values, Math.min(...present), Math.max(...present), 30);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" className="block w-full overflow-visible" style={{ height }}>
      {lines.map((points, index) => (
        <polyline key={index} points={points} fill="none" className={className} strokeWidth="2.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

export function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-[3px]", item.className)} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </span>
  );
}
