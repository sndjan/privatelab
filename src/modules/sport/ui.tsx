import { ChevronRightIcon } from "lucide-react";
import { ViewLink as Link } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import type { SessionBlock } from "./calc";

export function Panel({ title, aside, children, className, info, id }: { title?: string; aside?: React.ReactNode; children: React.ReactNode; className?: string; info?: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={cn("min-w-0 scroll-mt-20 space-y-3 rounded-2xl border bg-card p-4 sm:p-5", className)}>
      {(title || aside) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
      {info && <Info>{info}</Info>}
    </section>
  );
}

// Explanations stay folded so the panels show the numbers first.
export function Info({ children, label = "So wird gerechnet" }: { children: React.ReactNode; label?: string }) {
  return (
    <details className="group text-xs text-muted-foreground">
      <summary className="flex min-h-8 w-fit cursor-pointer list-none items-center gap-1 font-semibold [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="size-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
        {label}
      </summary>
      <div className="space-y-1 pt-1 pl-[18px]">{children}</div>
    </details>
  );
}

// Head of a tab: a ring on the left, key figures on the right.
export function TabHero({ ring, figures }: { ring: React.ReactNode; figures: { label: string; value: string; sub?: string; tone?: "good" | "bad" }[] }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-3xl border bg-card p-5 sm:flex-row sm:gap-6">
      {ring}
      <dl className="grid w-full flex-1 grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0">
            <dt className="text-xs font-semibold text-muted-foreground">{figure.label}</dt>
            <dd className="text-xl font-bold tabular-nums sm:text-2xl">{figure.value}</dd>
            {figure.sub && (
              <dd className={cn("truncate text-xs", figure.tone === "good" ? "font-semibold text-good-foreground" : figure.tone === "bad" ? "font-semibold text-bad-foreground" : "text-muted-foreground")}>
                {figure.sub}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Stat({ label, value, sub, hero }: { label: string; value: string; sub?: string; hero?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className={cn("text-xs", hero ? "text-hero-muted" : "text-muted-foreground")}>{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      {sub && <span className={cn("text-xs", hero ? "text-hero-muted" : "text-muted-foreground")}>{sub}</span>}
    </div>
  );
}

// One color family: runs in the brand green, gym in the lighter green.
export const kindColor = { run: "bg-brand", gym: "bg-chart-2", other: "bg-chart-4", free: "bg-muted" } as const;

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

// Concentric rings, outermost first. value 0–1 (null: only the track).
export type Ring = { value: number | null; className: string };
const RADII = [132, 104, 76];

export function Rings({ rings, size = 236, label, children }: { rings: Ring[]; size?: number; label: string; children?: React.ReactNode }) {
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 300 300" width={size} height={size} role="img" aria-label={label}>
        {rings.slice(0, 3).map((ring, index) => {
          const radius = RADII[index];
          const length = 2 * Math.PI * radius;
          const value = ring.value == null ? 0 : Math.min(1, Math.max(0, ring.value));
          return (
            <g key={index} className={ring.className} fill="none" strokeWidth={20}>
              <circle cx={150} cy={150} r={radius} stroke="currentColor" opacity={0.14} />
              {value > 0 && (
                <circle
                  cx={150}
                  cy={150}
                  r={radius}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.max(0.01, value * length)} ${length}`}
                  transform="rotate(-90 150 150)"
                />
              )}
            </g>
          );
        })}
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}

// A single ring with something in the middle (gym days, phase progress).
export function SmallRing({ value, size = 56, className = "text-brand", label, children, dashed }: { value: number; size?: number; className?: string; label: string; children?: React.ReactNode; dashed?: boolean }) {
  const length = 2 * Math.PI * 40;
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div className={cn("relative flex-none", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
        <circle cx={50} cy={50} r={40} fill="none" stroke="currentColor" strokeWidth={10} opacity={0.15} strokeDasharray={dashed ? "6 6" : undefined} />
        {clamped > 0 && (
          <circle cx={50} cy={50} r={40} fill="none" stroke="currentColor" strokeWidth={10} strokeLinecap="round" strokeDasharray={`${clamped * length} ${length}`} transform="rotate(-90 50 50)" />
        )}
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center font-bold">{children}</div>}
    </div>
  );
}

// Row with icon, value, small comparison and a chevron (links to a tab).
export function ListRow({ href, icon: Icon, value, sub, tone = "good" }: { href: string; icon: React.ComponentType<{ className?: string }>; value: string; sub: string; tone?: "good" | "bad" | "neutral" }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-3.5 py-2.5 transition-colors hover:bg-muted/50">
      <span
        className={cn(
          "flex size-9 flex-none items-center justify-center rounded-xl",
          tone === "bad" ? "bg-bad text-bad-foreground" : tone === "neutral" ? "bg-muted text-muted-foreground" : "bg-good text-good-foreground",
        )}
      >
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <strong className="truncate text-base tabular-nums">{value}</strong>
        <span className="truncate text-xs text-muted-foreground">{sub}</span>
      </span>
      <ChevronRightIcon className="size-[18px] flex-none text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

// The run/walk blocks of a planned session as one bar.
export function SessionBar({ blocks, hero, className }: { blocks: SessionBlock[]; hero?: boolean; className?: string }) {
  const runs = blocks.filter((block) => block.kind === "run");
  const label = `${runs.length} ${runs.length === 1 ? "Laufblock" : "Laufblöcke"}${blocks.length > runs.length ? " mit Gehpausen" : ""}`;
  return (
    <div role="img" aria-label={label} className={cn("flex h-3 gap-[3px]", className)}>
      {blocks.map((block, index) => (
        <span
          key={index}
          className={cn("rounded-[3px]", block.kind === "run" ? (hero ? "bg-hero-bar" : "bg-brand") : hero ? "bg-hero-track" : "bg-muted")}
          style={{ flexGrow: block.minutes, flexBasis: 0 }}
        />
      ))}
    </div>
  );
}

// Segmented links for the sub areas of a tab (Training, Plan).
export function SubNav({ items, current, label }: { items: { href: string; label: string; id: string }[]; current: string; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted p-1 sm:inline-grid">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              aria-current={item.id === current ? "page" : undefined}
              className={cn(
                "flex h-10 items-center justify-center rounded-lg px-4 text-sm whitespace-nowrap transition-colors",
                item.id === current ? "bg-background font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
