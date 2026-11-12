import { Archivo, Newsreader, Source_Sans_3 } from "next/font/google";

// The club site's own look: semi-condensed Archivo for headings (in normal
// case, not capitals), Source Sans 3 for text, and Newsreader italic for small
// human touches like photo captions. Each sets a CSS variable on the site's root.
export const display = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-tvb-display", display: "swap" });
export const body = Source_Sans_3({ subsets: ["latin"], variable: "--font-tvb-body", display: "swap" });
export const serif = Newsreader({ subsets: ["latin"], style: "italic", variable: "--font-tvb-serif", display: "swap" });
export const fontVariables = `${display.variable} ${body.variable} ${serif.variable}`;
