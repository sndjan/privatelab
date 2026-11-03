import type { PointerEvent, Ref, SVGProps } from "react";
import { colors, letter, type Sheet } from "./data";

// The score sheet as SVG: column letters (the start column dark), the
// coloured boxes with their stars, the column points (first circled, later
// plain), and a footer with the colour bonuses, the jokers and the boxes
// for the final score. Units: a box is 10 wide. Fixed colours (it is a
// picture), so it looks the same in light and dark mode and in print.

const C = 10;
const head = 8;
const gap = 2.5;
const lineHeight = 11;

type Token = { width: number; draw: (x: number, y: number) => React.ReactNode };

export function sheetSize(sheet: Sheet) {
  const lines = layoutFooter(sheet).length;
  return { width: sheet.cols * C, height: head + sheet.rows * C + 16 + lines * lineHeight + 1 };
}

function layoutFooter(sheet: Sheet) {
  const tokens: Token[] = [];
  colors.forEach((color, c) =>
    tokens.push({
      width: 21,
      draw: (x, y) => (
        <g key={`bonus${c}`}>
          <rect x={x} y={y + 1} width={7} height={7} rx={1.2} fill={color.fill} stroke="#1c1917" strokeWidth={0.3} />
          <circle cx={x + 11.5} cy={y + 4.5} r={3.3} fill="#ffffff" stroke="#1c1917" strokeWidth={0.35} />
          <text x={x + 11.5} y={y + 4.7} fontSize={3.8} fontWeight={700} textAnchor="middle" dominantBaseline="middle">
            {sheet.bonus[0]}
          </text>
          <text x={x + 18} y={y + 4.7} fontSize={3.8} textAnchor="middle" dominantBaseline="middle">
            {sheet.bonus[1]}
          </text>
        </g>
      ),
    }),
  );

  // Jokers in rows of up to 8.
  for (let from = 0; from < sheet.jokers; from += 8) {
    const count = Math.min(8, sheet.jokers - from);
    tokens.push({
      width: count * 7,
      draw: (x, y) => (
        <g key={`joker${from}`}>
          {Array.from({ length: count }, (_, i) => (
            <g key={i}>
              <circle cx={x + 3.4 + i * 7} cy={y + 4.5} r={3.1} fill="#ffffff" stroke="#1c1917" strokeWidth={0.35} />
              <text x={x + 3.4 + i * 7} y={y + 4.8} fontSize={4.4} fontWeight={800} textAnchor="middle" dominantBaseline="middle">
                !
              </text>
            </g>
          ))}
        </g>
      ),
    });
  }

  // The score boxes: on one line when the sheet is wide enough, else they wrap.
  const box = (label: string, sign?: string): Token => ({
    width: sign ? 17 : 13,
    draw: (x, y) => (
      <g key={label}>
        <rect x={x} y={y} width={13} height={9} rx={1.2} fill="#ffffff" stroke="#1c1917" strokeWidth={0.35} />
        <text x={x + 1.1} y={y + 2.4} fontSize={2.1} fill="#57534e">
          {label}
        </text>
        {sign && (
          <text x={x + 15} y={y + 4.8} fontSize={4.5} fontWeight={700} textAnchor="middle" dominantBaseline="middle">
            {sign}
          </text>
        )}
      </g>
    ),
  });
  const score = [box("Farben", "+"), box("Spalten", "+"), box("! übrig", "−"), box(`★ leer ×${sheet.starPenalty}`, "="), box("Summe")];
  const scoreWidth = score.reduce((sum, token) => sum + token.width, 0);
  if (scoreWidth <= sheet.cols * C) {
    tokens.push({
      width: scoreWidth,
      draw: (x, y) => {
        let at = x;
        return (
          <g key="score">
            {score.map((token) => {
              const node = token.draw(at, y);
              at += token.width;
              return node;
            })}
          </g>
        );
      },
    });
  } else tokens.push(...score);

  // Flow the tokens into lines as wide as the grid.
  const width = sheet.cols * C;
  const lines: { token: Token; x: number }[][] = [[]];
  let x = 0;
  for (const token of tokens) {
    if (x > 0 && x + token.width > width) {
      lines.push([]);
      x = 0;
    }
    lines[lines.length - 1].push({ token, x });
    x += token.width + gap;
  }
  return lines;
}

function starPath(cx: number, cy: number, outer: number) {
  const inner = outer * 0.45;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
}

export function SheetSvg({
  sheet,
  title,
  svgRef,
  highlight,
  onCellDown,
  onHeaderDown,
  ...props
}: {
  sheet: Sheet;
  title?: string;
  svgRef?: Ref<SVGSVGElement>;
  // Boxes to outline (e.g. a block that is too big).
  highlight?: Set<number>;
  onCellDown?: (cell: number, event: PointerEvent) => void;
  onHeaderDown?: (col: number, event: PointerEvent) => void;
} & SVGProps<SVGSVGElement>) {
  const { width, height } = sheetSize(sheet);
  const pad = 2;
  const stars = new Set(sheet.stars);
  const gridBottom = head + sheet.rows * C;
  const lines = layoutFooter(sheet);
  const footerTop = gridBottom + 16;

  return (
    <svg
      ref={svgRef}
      viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`}
      xmlns="http://www.w3.org/2000/svg"
      fontFamily="system-ui, sans-serif"
      {...props}
    >
      <rect x={-pad} y={-pad} width={width + 2 * pad} height={height + 2 * pad} fill="#ffffff" />
      {title && (
        <text x={width} y={-0.4} fontSize={2.4} fill="#a8a29e" textAnchor="end">
          {title}
        </text>
      )}

      {Array.from({ length: sheet.cols }, (_, col) => {
        const isStart = col === sheet.start;
        return (
          <g key={col} onPointerDown={onHeaderDown && ((event) => onHeaderDown(col, event))} className={onHeaderDown ? "cursor-pointer" : undefined}>
            <rect
              x={col * C + 1}
              y={0.5}
              width={C - 2}
              height={head - 1.5}
              rx={1.2}
              fill={isStart ? "#1c1917" : "#ffffff"}
              stroke="#1c1917"
              strokeWidth={0.35}
            />
            <text
              x={col * C + C / 2}
              y={head / 2 - 0.1}
              fontSize={4.4}
              fontWeight={700}
              fill={isStart ? "#ffffff" : "#1c1917"}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {letter(col)}
            </text>
          </g>
        );
      })}

      {sheet.cells.map((value, cell) => {
        const col = cell % sheet.cols;
        const row = Math.floor(cell / sheet.cols);
        const x = col * C;
        const y = head + row * C;
        const color = colors[value];
        return (
          <g key={cell} data-cell={cell} onPointerDown={onCellDown && ((event) => onCellDown(cell, event))}>
            <rect x={x + 0.45} y={y + 0.45} width={C - 0.9} height={C - 0.9} rx={1} fill={color.fill} stroke="#1c1917" strokeWidth={0.3} />
            {stars.has(cell) && (
              <path d={starPath(x + C / 2, y + C / 2 + 0.3, 3.4)} fill="#ffffff" stroke="#1c1917" strokeWidth={0.35} strokeLinejoin="round" />
            )}
            {highlight?.has(cell) && (
              <rect x={x + 0.9} y={y + 0.9} width={C - 1.8} height={C - 1.8} rx={0.8} fill="none" stroke="#dc2626" strokeWidth={0.8} />
            )}
          </g>
        );
      })}
      {/* The start column framed. */}
      <rect
        x={sheet.start * C + 0.1}
        y={head + 0.1}
        width={C - 0.2}
        height={sheet.rows * C - 0.2}
        rx={1.2}
        fill="none"
        stroke="#1c1917"
        strokeWidth={0.7}
        pointerEvents="none"
      />

      {sheet.points.map(([first, later], col) => (
        <g key={col}>
          <circle cx={col * C + C / 2} cy={gridBottom + 4.5} r={3.4} fill="#ffffff" stroke="#1c1917" strokeWidth={0.35} />
          <text x={col * C + C / 2} y={gridBottom + 4.7} fontSize={3.8} fontWeight={700} textAnchor="middle" dominantBaseline="middle">
            {first}
          </text>
          <text x={col * C + C / 2} y={gridBottom + 11.5} fontSize={3.6} textAnchor="middle" dominantBaseline="middle">
            {later}
          </text>
        </g>
      ))}

      {lines.flatMap((line, at) => line.map(({ token, x }) => token.draw(x, footerTop + at * lineHeight)))}
    </svg>
  );
}
