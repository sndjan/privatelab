import { cn } from "@/lib/utils";

export function Panel({ title, aside, children, className }: { title?: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 space-y-3 rounded-xl border bg-card p-4", className)}>
      {(title || aside) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
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

export const kindColor = { run: "bg-brand", gym: "bg-chart-2", other: "bg-debt", free: "bg-muted" } as const;

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
