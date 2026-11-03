import type { PointerEvent, ReactNode, Ref, SVGProps } from "react";
import { blocksOf, colors, letter, rowLetter, type RowBonus, type Sheet } from "./data";

// The score sheet as SVG, in the look of the game's own sheets: a card with
// white letter tiles (the start column's letter red and the column framed),
// rounded colour boxes with stars, the points rows below, the jokers, and on
// the right the colour bonuses and the boxes for the final score. "Noch mal
// so gut!" adds the row bonuses and hearts on the left, rows P–V on the
// right, golden dice boxes, a heart row and the special dice; "Noch X-Mal!"
// diamonds, a pass bar and X-chips; Kids framed enclosures with animals.
// Units: one box is 10. Fixed colours (it is a picture).

const U = 10;
const T = 9.1; // tile size inside a box
const headH = 8.4;
const display = "var(--font-display), 'Lilita One', system-ui, sans-serif";
const red = "#e5333b";

type Theme = { card: string; tile: string; ink: string; label: string; line: string };

const themes: Record<Sheet["variant"], Theme> = {
  klassisch: { card: "#1d2125", tile: "#ffffff", ink: "#1d2125", label: "#ffffff", line: "rgba(255,255,255,0.5)" },
  sogut: { card: "#cfd3d7", tile: "#ffffff", ink: "#22262a", label: "#4b5157", line: "rgba(34,38,42,0.45)" },
  xmal: { card: "#262b4a", tile: "#ffffff", ink: "#1f2340", label: "#ffffff", line: "rgba(255,255,255,0.5)" },
  kids: { card: "#fff4d6", tile: "#ffffff", ink: "#3a2a12", label: "#3a2a12", line: "rgba(58,42,18,0.4)" },
};

type ScoreLine = { label: string; sign: string; tone: "plain" | "plus" | "minus" };

function scoreLines(sheet: Sheet): ScoreLine[] {
  const lines: ScoreLine[] = [
    { label: "BONUS", sign: "=", tone: "plain" },
    { label: `${letter(0)}–${letter(sheet.cols - 1)}`, sign: "+", tone: "plus" },
  ];
  if (sheet.rowBonuses.length > 0)
    lines.push({ label: `${rowLetter(sheet, 0)}–${rowLetter(sheet, sheet.rows - 1)}`, sign: "+", tone: "plus" });
  if (sheet.hearts > 0) lines.push({ label: "♥", sign: "+", tone: "plus" });
  if (sheet.jokers > 0) lines.push({ label: "! (+1)", sign: "+", tone: "plus" });
  if (sheet.specials > 0) lines.push({ label: "Würfel (+2)", sign: "+", tone: "plus" });
  if (sheet.diamonds.length > 0) lines.push({ label: "◆", sign: "+", tone: "plus" });
  if (sheet.stars.length > 0) lines.push({ label: `★ (−${sheet.starPenalty})`, sign: "−", tone: "minus" });
  return lines;
}

// Where the parts of the sheet go, for a sheet's size and variant.
export function sheetLayout(sheet: Sheet) {
  const so = sheet.rowBonuses.length > 0;
  const pad = 6;
  const gridX = pad + (so ? 21 : 0);
  const gridY = pad + headH + 1.2;
  const gridW = sheet.cols * U;
  const gridH = sheet.rows * U;
  const panelX = gridX + gridW + (so ? 9.5 : 0) + 5;
  const panelW = 40;
  const width = panelX + panelW + pad;

  // Below the grid: points rows (and the heart row), jokers, special dice, pass bar.
  const firstY = gridY + gridH + 1.4;
  const laterY = firstY + 9;
  let y = laterY + 9;
  const heartRowY = so ? y : null;
  if (so) y += 9;
  const jokerY = sheet.jokers > 0 ? y + 2 : null;
  if (jokerY !== null) y = jokerY + 10;
  const specialsY = sheet.specials > 0 ? y + 2 : null;
  if (specialsY !== null) y = specialsY + 10;
  const passY = sheet.passes > 0 ? y + 2 : null;
  if (passY !== null) y = passY + 10;

  // Right panel: colour bonuses, then the score boxes (or the X-chips).
  const scoreRows = scoreLines(sheet);
  const bonusY = gridY;
  const scoreY = bonusY + colors.length * 8.8 + 4;
  const panelBottom = sheet.scoring ? scoreY + scoreRows.length * 9.4 + 12 : scoreY + 6 + Math.ceil(sheet.chips / 3) * 10;
  const leftBottom = so ? gridY + gridH + 1.4 + sheet.hearts * 10 : 0;

  const height = Math.max(y, panelBottom, leftBottom) + pad;
  return { pad, gridX, gridY, gridW, gridH, panelX, panelW, firstY, laterY, heartRowY, jokerY, specialsY, passY, bonusY, scoreY, width, height, scoreRows, so };
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
  const theme = themes[sheet.variant];
  const L = sheetLayout(sheet);
  const stars = new Set(sheet.stars);
  const gold = new Set(sheet.gold);
  const diamonds = new Set(sheet.diamonds);
  const icons = new Map(sheet.icons.map((icon) => [icon.cell, icon.symbol]));
  const at = (col: number) => L.gridX + col * U + (U - T) / 2;
  const startX = L.gridX + sheet.start * U;
  const panelRight = L.panelX + L.panelW;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${L.width} ${L.height}`} xmlns="http://www.w3.org/2000/svg" fontFamily={display} {...props}>
      <rect x={0} y={0} width={L.width} height={L.height} rx={7} fill={theme.card} />

      {/* Column letters. */}
      {Array.from({ length: sheet.cols }, (_, col) => (
        <g key={col} onPointerDown={onHeaderDown && ((event) => onHeaderDown(col, event))} className={onHeaderDown ? "cursor-pointer" : undefined}>
          <Tile x={at(col)} y={L.pad} w={T} h={headH} fill={theme.tile} />
          <Label x={at(col) + T / 2} y={L.pad + headH / 2} size={6} fill={col === sheet.start ? red : theme.ink}>
            {letter(col)}
          </Label>
        </g>
      ))}

      {/* The boxes. */}
      {sheet.cells.map((value, cell) => {
        const col = cell % sheet.cols;
        const row = Math.floor(cell / sheet.cols);
        const x = at(col);
        const y = L.gridY + row * U + (U - T) / 2;
        const color = colors[value];
        const icon = icons.get(cell);
        return (
          <g key={cell} data-cell={cell} onPointerDown={onCellDown && ((event) => onCellDown(cell, event))}>
            <rect x={x} y={y} width={T} height={T} rx={1.7} fill={color.fill} />
            <circle cx={x + T / 2} cy={y + T / 2} r={T * 0.3} fill="#ffffff" fillOpacity={0.22} />
            {stars.has(cell) && !icon && <Star cx={x + T / 2} cy={y + T / 2 + 0.2} r={3.6} edge={color.edge} />}
            {stars.has(cell) && icon && <Star cx={x + T - 2.2} cy={y + 2.2} r={1.9} edge={color.edge} />}
            {gold.has(cell) && <GoldDie x={x + T / 2} y={y + T / 2} size={6.2} />}
            {diamonds.has(cell) && <Diamond cx={x + T / 2} cy={y + T / 2} r={3.4} edge={color.edge} />}
            {icon && (
              <text x={x + T / 2} y={y + T / 2 + 0.4} fontSize={5.6} textAnchor="middle" dominantBaseline="middle" fontFamily="system-ui">
                {icon}
              </text>
            )}
            {highlight?.has(cell) && (
              <rect x={x + 0.5} y={y + 0.5} width={T - 1} height={T - 1} rx={1.4} fill="none" stroke="#ff2d2d" strokeWidth={1} />
            )}
          </g>
        );
      })}

      {sheet.outlines && <Outlines sheet={sheet} x={L.gridX} y={L.gridY} />}

      {/* The start column framed in white. */}
      <rect
        x={startX + 0.15}
        y={L.gridY + 0.15}
        width={U - 0.3}
        height={L.gridH - 0.3}
        rx={2}
        fill="none"
        stroke="#ffffff"
        strokeWidth={0.9}
        pointerEvents="none"
      />

      {/* Rows P–V with their bonuses, and the heart column (Noch mal so gut!). */}
      {L.so &&
        sheet.rowBonuses.map((bonus, row) => {
          const y = L.gridY + row * U + (U - T) / 2;
          return (
            <g key={row}>
              <Tile x={L.pad} y={y} w={7.6} h={T} fill={theme.tile} />
              <Label x={L.pad + 3.8} y={y + T / 2} size={5.2} fill={theme.ink}>
                {sheet.rowScore}
              </Label>
              <Tile x={L.pad + 8.6} y={y} w={T} h={T} fill={theme.tile} />
              <RowBonusIcon kind={bonus} cx={L.pad + 8.6 + T / 2} cy={y + T / 2} />
              <Tile x={L.gridX + L.gridW + 1} y={y} w={7.8} h={T} fill={theme.tile} />
              <Label x={L.gridX + L.gridW + 4.9} y={y + T / 2} size={5.4} fill={theme.ink}>
                {rowLetter(sheet, row)}
              </Label>
            </g>
          );
        })}
      {L.so &&
        Array.from({ length: sheet.hearts }, (_, i) => {
          const cx = L.pad + 8.6;
          const cy = L.gridY + L.gridH + 6 + i * 10;
          return (
            <g key={i}>
              <Heart cx={cx} cy={cy} size={9.4} fill={red} stroke="#ffffff" />
              <Label x={cx} y={cy - 0.4} size={4.4} fill="#ffffff">
                {i + 1}
              </Label>
            </g>
          );
        })}

      {/* Points for completed columns: first / later (and the heart row). */}
      {sheet.points.map(([first, later], col) => (
        <g key={col}>
          <Tile x={at(col)} y={L.firstY} w={T} h={8} fill={theme.tile} />
          <Label x={at(col) + T / 2} y={L.firstY + 4} size={5.6} fill={col === sheet.start ? red : theme.ink}>
            {first}
          </Label>
          <Tile x={at(col)} y={L.laterY} w={T} h={8} fill={theme.tile} />
          <Label x={at(col) + T / 2} y={L.laterY + 4} size={5.6} fill={col === sheet.start ? red : theme.ink}>
            {later}
          </Label>
          {L.heartRowY !== null && (
            <>
              <Tile x={at(col)} y={L.heartRowY} w={T} h={8} fill={theme.tile} />
              <Heart cx={at(col) + T / 2} cy={L.heartRowY + 4} size={6} fill="#f7b9bd" />
            </>
          )}
        </g>
      ))}

      {/* Jokers: ? / ✖ = ! ! ! … */}
      {L.jokerY !== null && <Jokers x={at(0)} y={L.jokerY} count={sheet.jokers} ink={theme.ink} />}

      {/* Special dice (Noch mal so gut!): the first is circled at the start. */}
      {L.specialsY !== null &&
        Array.from({ length: sheet.specials }, (_, i) => {
          const cx = at(0) + 4.6 + i * 10.4;
          const cy = L.specialsY! + 4.6;
          return (
            <g key={i}>
              {i === 0 && <circle cx={cx} cy={cy} r={4.9} fill="none" stroke={theme.ink} strokeWidth={0.7} />}
              <GoldDie x={cx} y={cy} size={6.6} />
            </g>
          );
        })}

      {/* Pass bar (Noch X-Mal!): a box per pass for colour and number. */}
      {L.passY !== null && (
        <g>
          <Label x={at(0) + 6} y={L.passY + 4.6} size={4.4} fill={theme.label}>
            PASS
          </Label>
          {Array.from({ length: sheet.passes }, (_, i) => {
            const x = at(0) + 13 + i * 9.6;
            return (
              <g key={i}>
                <Tile x={x} y={L.passY!} w={8.6} h={9} fill={theme.tile} />
                <line x1={x + 8.6} y1={L.passY!} x2={x} y2={L.passY! + 9} stroke={theme.ink} strokeOpacity={0.35} strokeWidth={0.35} />
              </g>
            );
          })}
        </g>
      )}

      {/* Colour bonuses: first / later. */}
      {colors.map((color, c) => {
        const y = L.bonusY + c * 8.8;
        const x = panelRight - 16.4;
        return (
          <g key={c}>
            <Tile x={x} y={y} w={7.8} h={7.8} fill={color.fill} />
            <Label x={x + 3.9} y={y + 3.9} size={5.4} fill={color.ink}>
              {sheet.bonus[0]}
            </Label>
            <Tile x={x + 8.6} y={y} w={7.8} h={7.8} fill={color.soft} />
            <Label x={x + 12.5} y={y + 3.9} size={5.4} fill={color.ink}>
              {sheet.bonus[1]}
            </Label>
          </g>
        );
      })}

      {/* Final score, or the X-chips. */}
      {sheet.scoring ? (
        <g>
          {L.scoreRows.map((line, i) => {
            const y = L.scoreY + i * 9.4;
            return (
              <g key={i}>
                <text x={panelRight - 21.5} y={y + 4.2} fontSize={3.9} fill={theme.label} textAnchor="end" dominantBaseline="middle">
                  {line.label}
                </text>
                <Tile x={panelRight - 20} y={y} w={20} h={8} fill={theme.tile} />
                <text
                  x={panelRight - 18.2}
                  y={y + 4.3}
                  fontSize={5}
                  fill={line.tone === "plus" ? "#3f8a10" : line.tone === "minus" ? red : theme.ink}
                  dominantBaseline="middle"
                >
                  {line.sign}
                </text>
              </g>
            );
          })}
          <line
            x1={L.panelX + 6}
            y1={L.scoreY + L.scoreRows.length * 9.4 + 1}
            x2={panelRight}
            y2={L.scoreY + L.scoreRows.length * 9.4 + 1}
            stroke={theme.line}
            strokeWidth={0.5}
            strokeDasharray="0.6 1"
          />
          <text x={panelRight - 21.5} y={L.scoreY + L.scoreRows.length * 9.4 + 7.3} fontSize={5.2} fill={theme.label} textAnchor="end" dominantBaseline="middle">
            TOTAL
          </text>
          <Tile x={panelRight - 20} y={L.scoreY + L.scoreRows.length * 9.4 + 2.8} w={20} h={9} fill={theme.tile} />
          <text x={panelRight - 18.2} y={L.scoreY + L.scoreRows.length * 9.4 + 7.5} fontSize={5} fill={theme.ink} dominantBaseline="middle">
            =
          </text>
        </g>
      ) : (
        <g>
          <text x={panelRight} y={L.scoreY + 2} fontSize={4.4} fill={theme.label} textAnchor="end" dominantBaseline="middle">
            X-CHIPS
          </text>
          {Array.from({ length: sheet.chips }, (_, i) => {
            const cx = panelRight - 4.4 - (2 - (i % 3)) * 10;
            const cy = L.scoreY + 10 + Math.floor(i / 3) * 10;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={4.2} fill={theme.tile} />
                <path
                  d={`M${cx - 1.8} ${cy - 1.8}L${cx + 1.8} ${cy + 1.8}M${cx + 1.8} ${cy - 1.8}L${cx - 1.8} ${cy + 1.8}`}
                  stroke={theme.ink}
                  strokeWidth={1}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </g>
      )}

      {title && (
        <text x={L.width - L.pad} y={L.height - 2.2} fontSize={2.6} fill={theme.label} fillOpacity={0.7} textAnchor="end" fontFamily="system-ui, sans-serif">
          {title}
        </text>
      )}
    </svg>
  );
}

function Tile({ x, y, w, h, fill }: { x: number; y: number; w: number; h: number; fill: string }) {
  return <rect x={x} y={y} width={w} height={h} rx={1.6} fill={fill} />;
}

function Label({ x, y, size, fill, children }: { x: number; y: number; size: number; fill: string; children: ReactNode }) {
  return (
    <text x={x} y={y + size * 0.06} fontSize={size} fill={fill} textAnchor="middle" dominantBaseline="middle">
      {children}
    </text>
  );
}

function Star({ cx, cy, r, edge }: { cx: number; cy: number; r: number; edge: string }) {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.47;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return <path d={`M${points.join("L")}Z`} fill="#ffffff" stroke={edge} strokeWidth={0.45} strokeLinejoin="round" />;
}

function Diamond({ cx, cy, r, edge }: { cx: number; cy: number; r: number; edge: string }) {
  return (
    <path
      d={`M${cx} ${cy - r}L${cx + r * 0.85} ${cy - r * 0.2}L${cx} ${cy + r}L${cx - r * 0.85} ${cy - r * 0.2}Z`}
      fill="#ffffff"
      stroke={edge}
      strokeWidth={0.45}
      strokeLinejoin="round"
    />
  );
}

function Heart({ cx, cy, size, fill, stroke }: { cx: number; cy: number; size: number; fill: string; stroke?: string }) {
  const s = size / 24;
  return (
    <path
      transform={`translate(${cx - 12 * s} ${cy - 13 * s}) scale(${s})`}
      d="M12 21s-9.5-5.6-9.5-12A5 5 0 0112 6.1a5 5 0 019.5 2.9C21.5 15.4 12 21 12 21z"
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke ? 1.6 : 0}
    />
  );
}

function GoldDie({ x, y, size }: { x: number; y: number; size: number }) {
  const h = size / 2;
  return (
    <g>
      <rect x={x - h} y={y - h} width={size} height={size} rx={size * 0.26} fill="#e3a640" stroke="#9a6418" strokeWidth={0.4} />
      <line x1={x - h + 0.4} y1={y - h * 0.4} x2={x + h - 0.4} y2={y - h * 0.4} stroke="#f6cf86" strokeWidth={0.6} />
    </g>
  );
}

function Bomb({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx - 0.4} cy={cy + 0.7} r={2.9} fill="#22262a" />
      <path d={`M${cx + 1.4} ${cy - 1.3}l1.2-1.2q0.8-0.6 1.3 0.2`} stroke="#22262a" strokeWidth={0.7} fill="none" strokeLinecap="round" />
      <circle cx={cx - 1.4} cy={cy - 0.3} r={0.7} fill="#ffffff" fillOpacity={0.6} />
    </g>
  );
}

function RowBonusIcon({ kind, cx, cy }: { kind: RowBonus; cx: number; cy: number }) {
  if (kind === "bombe") return <Bomb cx={cx} cy={cy} />;
  if (kind === "herz") return <Heart cx={cx} cy={cy} size={7} fill={red} />;
  return <GoldDie x={cx} y={cy} size={6} />;
}

function Jokers({ x, y, count, ink }: { x: number; y: number; count: number; ink: string }) {
  const width = 25 + count * 7.6;
  return (
    <g>
      <rect x={x} y={y} width={width} height={10} rx={2.6} fill="#ffffff" />
      <rect x={x + 1.6} y={y + 1.6} width={6.8} height={6.8} rx={1.6} fill={ink} />
      <Label x={x + 5} y={y + 5} size={5.2} fill="#ffffff">
        ?
      </Label>
      <Label x={x + 10.6} y={y + 5} size={5.6} fill={ink}>
        /
      </Label>
      <rect x={x + 12.8} y={y + 1.9} width={6.2} height={6.2} rx={1.4} fill="none" stroke={ink} strokeWidth={0.7} />
      <path d={`M${x + 14.4} ${y + 3.5}l3 3m0 -3l-3 3`} stroke={ink} strokeWidth={0.9} strokeLinecap="round" />
      <Label x={x + 21.6} y={y + 5} size={5.4} fill={ink}>
        =
      </Label>
      {Array.from({ length: count }, (_, i) => (
        <g key={i}>
          <circle cx={x + 28 + i * 7.6} cy={y + 5} r={3.3} fill="none" stroke={ink} strokeWidth={0.7} />
          <Label x={x + 28 + i * 7.6} y={y + 5} size={4.6} fill={ink}>
            !
          </Label>
        </g>
      ))}
    </g>
  );
}

// Thick lines between blocks (the enclosures of the Kids sheet).
function Outlines({ sheet, x, y }: { sheet: Sheet; x: number; y: number }) {
  const blockOf = new Array<number>(sheet.cells.length);
  blocksOf(sheet).forEach((block, id) => block.cells.forEach((cell) => (blockOf[cell] = id)));
  const lines: ReactNode[] = [];
  for (let cell = 0; cell < sheet.cells.length; cell++) {
    const col = cell % sheet.cols;
    const row = Math.floor(cell / sheet.cols);
    if (col < sheet.cols - 1 && blockOf[cell] !== blockOf[cell + 1])
      lines.push(<line key={`v${cell}`} x1={x + (col + 1) * U} y1={y + row * U} x2={x + (col + 1) * U} y2={y + (row + 1) * U} />);
    if (row < sheet.rows - 1 && blockOf[cell] !== blockOf[cell + sheet.cols])
      lines.push(<line key={`h${cell}`} x1={x + col * U} y1={y + (row + 1) * U} x2={x + (col + 1) * U} y2={y + (row + 1) * U} />);
  }
  return (
    <g stroke="#3a2a12" strokeWidth={0.9} strokeLinecap="round" pointerEvents="none">
      {lines}
    </g>
  );
}
