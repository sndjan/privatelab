"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSigned } from "./calc";
import { colorHex, type Participant } from "./data";

export function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: colorHex(color) }}
    />
  );
}

export function PersonName({ participant, className }: { participant: Participant; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 font-medium", className)}>
      <Dot color={participant.color} />
      <span className="truncate">{participant.name}</span>
    </span>
  );
}

// A change as a pill: green when it goes the wanted way, orange when not.
export function Change({
  value,
  good,
  decimals = 1,
  unit,
  className,
}: {
  value: number;
  // Which direction is good; undefined = neutral.
  good?: "down" | "up";
  decimals?: number;
  unit?: string;
  className?: string;
}) {
  const zero = Math.abs(value) < 0.5 * 10 ** -decimals;
  const tone =
    zero || !good ? "neutral" : (value < 0) === (good === "down") ? "good" : "bad";
  return (
    <span
      className={cn(
        "inline-block rounded-full px-1.5 py-px text-xs font-semibold whitespace-nowrap tabular-nums",
        tone === "good" && "bg-good text-good-foreground",
        tone === "bad" && "bg-bad text-bad-foreground",
        tone === "neutral" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {formatSigned(value, decimals)}
      {unit && ` ${unit}`}
    </span>
  );
}

export function Panel({ title, aside, children, className }: { title?: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3 rounded-xl border bg-card p-3 sm:p-4", className)}>
      {title && (
        <h2 className="flex items-center justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          <span>{title}</span>
          {aside}
        </h2>
      )}
      {children}
    </section>
  );
}

// A row of buttons where one is chosen.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { id: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex gap-1 rounded-lg bg-muted p-1", className)}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          onClick={() => onChange(option.id)}
          className={cn(
            "flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-sm whitespace-nowrap transition-colors",
            option.id === value ? "bg-background font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// A sheet that slides up from the bottom on phones and is a centred dialog
// from sm on.
export function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border-t bg-background shadow-lg",
            "pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-200",
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:p-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95",
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" aria-hidden="true" />
          <div className="flex shrink-0 items-center justify-between px-4 pt-2 pb-1 sm:pt-4">
            <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="-mr-2 flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
              <XIcon className="size-5" />
              <span className="sr-only">Schließen</span>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 overflow-y-auto px-4 pt-2 pb-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
