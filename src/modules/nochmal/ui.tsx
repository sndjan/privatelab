"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fontVariables } from "./fonts";

// The module's own look: a dark "game table" with chunky rounded controls,
// orange accents and a round display face. Fixed colours, the same in light
// and dark mode, like a game box.

export const display = "font-[family-name:var(--font-display)] font-normal tracking-wide";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        fontVariables,
        "-mx-4 -my-8 min-h-[calc(100vh-3.5rem)] bg-[#111417] px-4 py-6 font-[family-name:var(--font-body)] text-[#f2f4f5] sm:mx-0 sm:my-0 sm:min-h-0 sm:rounded-3xl sm:p-8 print:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[22px] border border-[#2a3036] bg-[#1b1f23] p-5", className)}>{children}</div>;
}

export function Heading({ children, className, as: Tag = "h2" }: { children: ReactNode; className?: string; as?: "h2" | "h3" }) {
  return <Tag className={cn(display, "text-xl", className)}>{children}</Tag>;
}

export function Muted({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm font-bold text-[#b4bcc4]", className)}>{children}</p>;
}

// A selectable card or chip (aria-pressed), orange border when chosen.
export function Choice({ active, className, ...props }: ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "flex min-h-11 cursor-pointer flex-col items-start gap-0.5 rounded-[14px] border-2 px-3 py-2 text-left transition-colors",
        active ? "border-[#ff9a2e] bg-[#2a2117]" : "border-[#2a3036] bg-[#15191c] hover:border-[#3a424a]",
        className,
      )}
      {...props}
    />
  );
}

export function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {label && <p className="text-sm font-bold text-[#b4bcc4]">{label}</p>}
      <div className="grid gap-1 rounded-xl bg-[#111417] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={cn(
              "min-h-11 cursor-pointer rounded-[9px] px-2 text-sm font-extrabold transition-colors",
              value === option.id ? "bg-[#ff9a2e] text-[#1a1205]" : "text-[#dfe4e8] hover:bg-[#1f2428]",
            )}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Stepper({
  label,
  value,
  min,
  max,
  shown,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  shown?: string;
  onChange: (value: number) => void;
}) {
  const button =
    "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#2f363d] bg-[#15191c] text-[#f2f4f5] hover:bg-[#1f2428] disabled:cursor-default disabled:opacity-40 [&_svg]:size-4";
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-[#b4bcc4]">{label}</p>
      <div className="flex items-center gap-1.5">
        <button type="button" className={button} aria-label={`${label} weniger`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <MinusIcon />
        </button>
        <span className={cn(display, "flex-1 text-center text-2xl tabular-nums")}>{shown ?? value}</span>
        <button type="button" className={button} aria-label={`${label} mehr`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}

export function BigButton({ tone = "orange", className, ...props }: ComponentProps<"button"> & { tone?: "orange" | "white" | "ghost" }) {
  return (
    <button
      type="button"
      className={cn(
        display,
        "inline-flex h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-full px-6 text-lg transition-colors disabled:cursor-default disabled:opacity-60 [&_svg]:size-5",
        tone === "orange" && "bg-[#ff9a2e] text-[#1a1205] hover:bg-[#ffab52]",
        tone === "white" && "bg-white text-[#111417] hover:bg-[#e9edf0]",
        tone === "ghost" && "border border-[#2f363d] bg-[#1b1f23] text-[#dfe4e8] hover:bg-[#232a30]",
        className,
      )}
      {...props}
    />
  );
}

export function SmallButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-[#2f363d] bg-[#1b1f23] px-4 text-sm font-extrabold text-[#dfe4e8] hover:bg-[#232a30] [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function TextField({ label, className, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-bold text-[#b4bcc4]">{label}</span>
      <input
        className={cn(
          "h-12 w-full rounded-xl border-2 border-[#2f363d] bg-[#111417] px-3.5 text-base font-bold text-[#f2f4f5] outline-none placeholder:text-[#6f7881] focus:border-[#ff9a2e]",
          className,
        )}
        {...props}
      />
    </label>
  );
}

// The four colours as a little logo.
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("grid size-[34px] grid-cols-2 gap-[3px]", className)} aria-hidden="true">
      <div className="rounded-[5px] bg-[#8cc63f]" />
      <div className="rounded-[5px] bg-[#ffcf2e]" />
      <div className="rounded-[5px] bg-[#5cc6f0]" />
      <div className="rounded-[5px] bg-[#ef3f80]" />
    </div>
  );
}
