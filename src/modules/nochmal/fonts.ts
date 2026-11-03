import { Lilita_One, Nunito } from "next/font/google";

// The module's own look: a round display face for the sheets and headings,
// a friendly sans for the rest. Both set CSS variables on the module's root
// (and on the printed sheets), used as var(--font-display) / var(--font-body).
export const display = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
export const body = Nunito({ weight: ["500", "700", "800", "900"], subsets: ["latin"], variable: "--font-body", display: "swap" });
export const fontVariables = `${display.variable} ${body.variable}`;
