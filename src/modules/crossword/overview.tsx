"use client";

import { ExternalLinkIcon, PrinterIcon } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import type { Crossword } from "./puzzles";

const subscribe = () => () => {};

// One QR code per puzzle as SVG markup, made in the browser because the
// link needs this site's address.
function useQrCodes(urls: string[]) {
  const [codes, setCodes] = useState<string[]>([]);
  const joined = urls.join("\n");
  useEffect(() => {
    if (!joined) return;
    let active = true;
    Promise.all(
      joined.split("\n").map((url) => QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" })),
    ).then((svgs) => {
      if (active) setCodes(svgs);
    });
    return () => {
      active = false;
    };
  }, [joined]);
  return codes;
}

function MiniGrid({ puzzle }: { puzzle: Crossword }) {
  return (
    <div
      className="grid w-28 shrink-0 gap-px rounded bg-foreground/80 p-px"
      style={{ gridTemplateColumns: `repeat(${puzzle.cols}, 1fr)` }}
      aria-hidden
    >
      {puzzle.grid.flatMap((line, r) =>
        [...line].map((ch, c) => <div key={`${r},${c}`} className={ch === "." ? "aspect-square" : "aspect-square bg-card"} />),
      )}
    </div>
  );
}

export function CrosswordOverview({ puzzles }: { puzzles: Crossword[] }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const urls = origin ? puzzles.map((p) => `${origin}/k/${p.code}`) : [];
  const codes = useQrCodes(urls);

  return (
    <>
      <div className="space-y-6 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {puzzles.length} Rätsel. Jedes öffnet sich nur über seinen geheimen Link, ohne Anmeldung.
            </p>
          </div>
          <Button onClick={() => window.print()} disabled={codes.length < puzzles.length}>
            <PrinterIcon /> QR-Codes drucken
          </Button>
        </div>

        <ul className="grid gap-4 md:grid-cols-2">
          {puzzles.map((puzzle, i) => {
            const personal = puzzle.words.filter((w) => w.personal);
            return (
              <li key={puzzle.code} className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
                <div className="flex items-start gap-4">
                  <MiniGrid puzzle={puzzle} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="font-semibold">{puzzle.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {puzzle.words.length} Wörter, {puzzle.cols} × {puzzle.rows} Felder
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Persönlich: </span>
                      {personal.map((w) => w.answer).join(", ")}
                    </p>
                  </div>
                  {codes[i] && (
                    <div
                      className="hidden size-24 shrink-0 rounded bg-white sm:block [&_svg]:size-full"
                      dangerouslySetInnerHTML={{ __html: codes[i] }}
                    />
                  )}
                </div>
                <p className="truncate rounded-md bg-muted px-3 py-2 font-mono text-xs">{urls[i] ?? `/k/${puzzle.code}`}</p>
                <div className="flex flex-wrap gap-2">
                  {urls[i] && <CopyButton text={urls[i]} label="Link kopieren" />}
                  <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
                    <a href={`/k/${puzzle.code}`} target="_blank" rel="noreferrer">
                      <ExternalLinkIcon /> Öffnen
                    </a>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Printed only: two puzzles per A4 page, a dashed line to cut along. */}
      <div className="hidden text-black print:block">
        <style>{"@page { size: A4 portrait; margin: 10mm; }"}</style>
        {puzzles.map((puzzle, i) => (
          <div
            key={puzzle.code}
            className="flex flex-col items-center justify-center gap-[6mm] text-center"
            style={{
              height: "138mm",
              borderBottom: i % 2 === 0 && i < puzzles.length - 1 ? "0.3mm dashed #999" : undefined,
              breakAfter: i % 2 === 1 && i < puzzles.length - 1 ? "page" : "auto",
              breakInside: "avoid",
            }}
          >
            <p style={{ fontSize: "22pt", fontWeight: 700 }}>{puzzle.title}</p>
            {codes[i] && (
              <div style={{ width: "85mm", height: "85mm" }} className="[&_svg]:size-full" dangerouslySetInnerHTML={{ __html: codes[i] }} />
            )}
            <p style={{ fontSize: "12pt" }}>Mit dem Handy scannen und lösen</p>
          </div>
        ))}
      </div>
    </>
  );
}
