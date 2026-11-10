import { DM_Sans, Nunito } from "next/font/google";

// The module's own look, as in the design: round Nunito for headings and the
// big clock, DM Sans for the rest. Both set CSS variables on the module's root.
export const display = Nunito({ weight: ["800", "900"], subsets: ["latin"], variable: "--font-fokus-display", display: "swap" });
export const body = DM_Sans({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-fokus-body", display: "swap" });
export const fontVariables = `${display.variable} ${body.variable}`;
