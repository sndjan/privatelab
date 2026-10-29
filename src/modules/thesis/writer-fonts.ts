import { Atkinson_Hyperlegible, Literata, Source_Serif_4 } from "next/font/google";

// Fonts to write in (Schreiben → Ansicht). Not preloaded: the browser only
// fetches the one that is picked.
const sourceSerif = Source_Serif_4({ subsets: ["latin"], preload: false });
const literata = Literata({ subsets: ["latin"], preload: false });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], preload: false });

export const writerFonts = [
  { id: "serif", label: "Serif (Standard)", family: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif" },
  { id: "source-serif", label: "Source Serif", family: sourceSerif.style.fontFamily },
  { id: "literata", label: "Literata", family: literata.style.fontFamily },
  { id: "sans", label: "Instrument Sans", family: "var(--font-sans), sans-serif" },
  { id: "atkinson", label: "Atkinson (gut lesbar)", family: atkinson.style.fontFamily },
  { id: "mono", label: "Monospace", family: "var(--font-mono), monospace" },
] as const;

export type WriterFontId = (typeof writerFonts)[number]["id"];
