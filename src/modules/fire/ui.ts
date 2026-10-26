// Shared fonts and class names for the FIRE module's look.
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import type { AccountKind } from "./calc";

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const rootClass = `${sans.variable} ${mono.variable} font-fire text-[15px] leading-normal text-fire-ink`;

export const cardClass = "rounded-2xl border border-fire-line bg-fire-surface p-6";
export const headingClass = "text-lg font-semibold";
export const labelClass = "flex flex-col gap-1.5 text-[13px] text-fire-muted";
export const inputClass =
  "min-h-11 rounded-[10px] border border-fire-field bg-fire-surface px-3 font-figures text-[15px] text-fire-ink";
export const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] bg-fire-ink px-4 font-medium text-fire-ground";
export const accentButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] bg-fire-accent px-[18px] font-semibold text-fire-accent-ink";
export const secondaryButtonClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-fire-field bg-fire-surface px-3.5 font-medium";

export const kindColor: Record<AccountKind, string> = {
  investment: "var(--fire-accent)",
  pension: "var(--fire-kind-pension)",
  cash: "var(--fire-kind-cash)",
  property: "var(--fire-kind-property)",
  debt: "var(--fire-debt)",
};
