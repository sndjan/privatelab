import type { Sheet } from "./data";
import { fontVariables } from "./fonts";
import { SheetSvg } from "./sheet-svg";

// How many sheets go on one page, and how big each one is printed: from the
// small pad (A6) to the big table format on A3.
export const perPageOptions = [
  { id: "a3", name: "Groß", hint: "1 pro A3", paper: "A3", landscape: true, cols: 1, rows: 1 },
  { id: "1", name: "A4", hint: "1 pro A4", paper: "A4", landscape: true, cols: 1, rows: 1 },
  { id: "2", name: "Block", hint: "2 pro A4 (A5)", paper: "A4", landscape: false, cols: 1, rows: 2 },
  { id: "4", name: "Klein", hint: "4 pro A4 (A6)", paper: "A4", landscape: true, cols: 2, rows: 2 },
] as const;

export type PerPage = (typeof perPageOptions)[number]["id"];

const margin = 7;
const papers = { A4: { w: 210, h: 297 }, A3: { w: 297, h: 420 } };

export function printPages(perPage: PerPage, copies: number) {
  const option = perPageOptions.find((entry) => entry.id === perPage)!;
  return Math.max(1, Math.ceil(copies / (option.cols * option.rows)));
}

// The sheets for all players, only printed (hidden on screen). Everyone plays
// on the same layout, so it is the same sheet over and over; dashed lines
// show where to cut.
export function PrintSheets({ sheet, name, perPage, copies }: { sheet: Sheet; name: string; perPage: PerPage; copies: number }) {
  const option = perPageOptions.find((entry) => entry.id === perPage)!;
  const paper = papers[option.paper];
  const pageW = (option.landscape ? paper.h : paper.w) - 2 * margin;
  const pageH = (option.landscape ? paper.w : paper.h) - 2 * margin;
  const slots = option.cols * option.rows;
  const pages = printPages(perPage, copies);

  return (
    <div className={`${fontVariables} hidden text-black print:block`} style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      <style>{`@page { size: ${option.paper} ${option.landscape ? "landscape" : "portrait"}; margin: ${margin}mm; }`}</style>
      {Array.from({ length: pages }, (_, page) => (
        <div
          key={page}
          className="grid"
          style={{
            width: `${pageW}mm`,
            height: `${pageH}mm`,
            gridTemplateColumns: `repeat(${option.cols}, 1fr)`,
            gridTemplateRows: `repeat(${option.rows}, 1fr)`,
            breakAfter: page < pages - 1 ? "page" : "auto",
          }}
        >
          {Array.from({ length: Math.min(slots, copies - page * slots) }, (_, slot) => (
            <div
              key={slot}
              style={{
                width: `${pageW / option.cols}mm`,
                height: `${pageH / option.rows}mm`,
                padding: slots > 1 ? "3mm" : 0,
                outline: slots > 1 ? "0.2mm dashed #999" : undefined,
                boxSizing: "border-box",
              }}
            >
              <SheetSvg sheet={sheet} title={name} style={{ display: "block", width: "100%", height: "100%" }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
