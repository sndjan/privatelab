import type { Sheet } from "./data";
import { SheetSvg } from "./sheet-svg";

// How many sheets go on one A4 page, and how big each one is printed.
export const perPageOptions = [
  { id: 1, name: "1 pro A4", hint: "groß, A4 quer", landscape: true, cols: 1, rows: 1 },
  { id: 2, name: "2 pro A4", hint: "A5, wie ein Block", landscape: false, cols: 1, rows: 2 },
  { id: 4, name: "4 pro A4", hint: "A6, klein", landscape: true, cols: 2, rows: 2 },
] as const;

export type PerPage = (typeof perPageOptions)[number]["id"];

const margin = 7;

// The sheets for all players, only printed (hidden on screen). Everyone plays
// on the same layout, so it is the same sheet over and over; dashed lines
// show where to cut.
export function PrintSheets({ sheet, name, perPage, copies }: { sheet: Sheet; name: string; perPage: PerPage; copies: number }) {
  const option = perPageOptions.find((entry) => entry.id === perPage)!;
  const pageW = (option.landscape ? 297 : 210) - 2 * margin;
  const pageH = (option.landscape ? 210 : 297) - 2 * margin;
  const slotW = pageW / option.cols;
  const slotH = pageH / option.rows;
  const pages = Math.max(1, Math.ceil(copies / perPage));

  return (
    <div className="hidden text-black print:block" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      <style>{`@page { size: A4 ${option.landscape ? "landscape" : "portrait"}; margin: ${margin}mm; }`}</style>
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
          {Array.from({ length: Math.min(perPage, copies - page * perPage) }, (_, slot) => (
            <div
              key={slot}
              style={{
                width: `${slotW}mm`,
                height: `${slotH}mm`,
                padding: "3mm",
                outline: perPage > 1 ? "0.2mm dashed #999" : undefined,
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
