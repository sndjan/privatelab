import { Barlow_Condensed, Inter } from "next/font/google";

// The club site's own look, as in the design: condensed Barlow for headings,
// Inter for the rest. Both set CSS variables on the site's root.
export const display = Barlow_Condensed({ weight: ["600", "700", "800"], subsets: ["latin"], variable: "--font-tvb-display", display: "swap" });
export const body = Inter({ subsets: ["latin"], variable: "--font-tvb-body", display: "swap" });
export const fontVariables = `${display.variable} ${body.variable}`;
