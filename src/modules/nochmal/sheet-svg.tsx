import { useId, type PointerEvent, type ReactNode, type Ref, type SVGProps } from "react";
import { blocksOf, colors, EMPTY, letter, rowLetter, type RowBonus, type Sheet, type Sticker } from "./data";
import { CartoonDiamond, JokerMark, JokerTile } from "./symbols";
import { ThemedBomb, ThemedBox, ThemedHeart, ThemedStar } from "./themes";
import type { ThemeId } from "./data";

// The score sheet as SVG, in the look of the game's own sheets: a card with
// white letter tiles (the start column's letter red and the column framed),
// rounded colour boxes with stars, the points rows below, the jokers, and on
// the right the colour bonuses and the boxes for the final score. "Noch mal
// so gut!" adds the row bonuses and hearts on the left, rows P–V on the
// right, golden dice boxes, a heart row and the special dice; "Noch X-Mal!"
// diamonds, a pass bar and X-chips; Kids framed enclosures with animals.
// Own pictures (sheet.art) replace the star, golden die and diamond, and can
// fill the card's background. Boxes without a colour yet are drawn dashed.
// The rows of boxes under the columns are set per sheet (sheet.lanes).
// Units: one box is 10. Fixed colours (it is a picture).

const U = 10;
const T = 9.1; // tile size inside a box
const headH = 8.4;
const display = "var(--font-display), 'Lilita One', system-ui, sans-serif";
const red = "#e5333b";
// Outline colour of marks on a box without a colour.
const blank = { edge: "#6f7881" };

type Theme = { card: string; tile: string; ink: string; label: string; line: string; starEdge: string };

const themes: Record<Sheet["variant"], Theme> = {
  klassisch: { card: "#1d2125", tile: "#ffffff", ink: "#1d2125", label: "#ffffff", line: "rgba(255,255,255,0.5)", starEdge: "#ffffff" },
  sogut: { card: "#cfd3d7", tile: "#ffffff", ink: "#22262a", label: "#4b5157", line: "rgba(34,38,42,0.45)", starEdge: "#ffffff" },
  xmal: { card: "#262b4a", tile: "#ffffff", ink: "#1f2340", label: "#ffffff", line: "rgba(255,255,255,0.5)", starEdge: "#ffffff" },
  kids: { card: "#fff4d6", tile: "#ffffff", ink: "#3a2a12", label: "#3a2a12", line: "rgba(58,42,18,0.4)", starEdge: "#3a2a12" },
};

// A line of the final score: a label, or a symbol like on the original
// sheet (heart in a box, circled joker and special die, star) with the points
// per piece.
type ScoreLine = {
  label: string;
  icon?: "bonus" | "heart" | "joker" | "die" | "star" | "diamond";
  sign: string;
  tone: "plain" | "plus" | "minus";
};

function scoreLines(sheet: Sheet): ScoreLine[] {
  const lines: ScoreLine[] = [
    { label: "BONUS", icon: "bonus", sign: "=", tone: "plain" },
    { label: `${letter(0)}–${letter(sheet.cols - 1)}`, sign: "+", tone: "plus" },
  ];
  if (sheet.rowBonuses.length > 0)
    lines.push({ label: `${rowLetter(sheet, 0)}–${rowLetter(sheet, sheet.rows - 1)}`, sign: "+", tone: "plus" });
  if (sheet.hearts > 0) lines.push({ label: "", icon: "heart", sign: "+", tone: "plus" });
  if (sheet.jokers > 0) lines.push({ label: "(+1)", icon: "joker", sign: "+", tone: "plus" });
  if (sheet.specials > 0) lines.push({ label: "(+2)", icon: "die", sign: "+", tone: "plus" });
  if (sheet.diamonds.length > 0) lines.push({ label: "", icon: "diamond", sign: "+", tone: "plus" });
  if (sheet.stars.length > 0) lines.push({ label: `(−${sheet.starPenalty})`, icon: "star", sign: "−", tone: "minus" });
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

  // Below the grid: the rows of boxes (points, hearts, empty boxes), jokers,
  // special dice, pass bar.
  const lanesY = gridY + gridH + 1.4;
  let y = lanesY + sheet.lanes.length * 9;
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
  return { pad, gridX, gridY, gridW, gridH, panelX, panelW, lanesY, jokerY, specialsY, passY, bonusY, scoreY, width, height, scoreRows, so };
}

export function SheetSvg({
  sheet,
  title,
  svgRef,
  highlight,
  onCellDown,
  onHeaderDown,
  onLaneDown,
  onRowBonusDown,
  onStickerDown,
  selectedSticker,
  ...props
}: {
  sheet: Sheet;
  title?: string;
  svgRef?: Ref<SVGSVGElement>;
  // Boxes to outline (e.g. a block that is too big).
  highlight?: Set<number>;
  onCellDown?: (cell: number, event: PointerEvent) => void;
  onHeaderDown?: (col: number, event: PointerEvent) => void;
  // Editing: tapping a place in a row of boxes adds or removes its box (left
  // out boxes are shown dashed then).
  onLaneDown?: (lane: number, col: number, event: PointerEvent) => void;
  // Editing: tapping a row bonus (Noch mal so gut!) switches it.
  onRowBonusDown?: (row: number, event: PointerEvent) => void;
  // Editing: the chosen sticker gets a dashed frame on top to drag it by.
  onStickerDown?: (index: number, event: PointerEvent) => void;
  selectedSticker?: number | null;
} & SVGProps<SVGSVGElement>) {
  const theme = themes[sheet.variant];
  const L = sheetLayout(sheet);
  // Own symbol pictures count only with the "eigenes" theme (unset slots show
  // the original symbols); the background works with every theme.
  const art: Sheet["art"] = sheet.theme === "eigenes" ? sheet.art : { background: sheet.art.background };
  const symbolTheme: ThemeId = sheet.theme === "eigenes" ? "original" : sheet.theme;
  const clipId = useId();
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
      {art.background && (
        <>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={L.width} height={L.height} rx={7} />
          </clipPath>
          <image
            href={art.background}
            x={0}
            y={0}
            width={L.width}
            height={L.height}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
            pointerEvents="none"
          />
          {/* A veil of the card colour keeps the labels readable on busy pictures. */}
          <rect x={0} y={0} width={L.width} height={L.height} rx={7} fill={theme.card} fillOpacity={0.25} pointerEvents="none" />
        </>
      )}

      {/* Stickers behind the sheet (cut off at the card's round edge). */}
      <clipPath id={`${clipId}-card`}>
        <rect x={0} y={0} width={L.width} height={L.height} rx={7} />
      </clipPath>
      <Stickers stickers={sheet.stickers} front={false} clip={`${clipId}-card`} />

      {/* Column letters. */}
      {Array.from({ length: sheet.cols }, (_, col) => (
        <g key={col} onPointerDown={onHeaderDown && ((event) => onHeaderDown(col, event))} className={onHeaderDown ? "cursor-pointer" : undefined}>
          <Tile x={at(col)} y={L.pad} w={T} h={headH} fill={theme.tile} />
          <Label x={at(col) + T / 2} y={L.pad + headH / 2} size={6} fill={col === sheet.start ? red : theme.ink}>
            {letter(col)}
          </Label>
        </g>
      ))}

      {/* Black behind the grid, so the corners where four boxes meet are
          black too (the boxes' own frames draw the lines). */}
      <rect x={L.gridX} y={L.gridY} width={L.gridW} height={L.gridH} rx={2.1} fill="#16191c" />

      {/* The boxes. */}
      {sheet.cells.map((value, cell) => {
        const col = cell % sheet.cols;
        const row = Math.floor(cell / sheet.cols);
        const x = at(col);
        const y = L.gridY + row * U + (U - T) / 2;
        const color = value === EMPTY ? blank : colors[value];
        const icon = icons.get(cell);
        return (
          <g key={cell} data-cell={cell} onPointerDown={onCellDown && ((event) => onCellDown(cell, event))}>
            {value === EMPTY ? (
              <rect
                x={x + 0.25}
                y={y + 0.25}
                width={T - 0.5}
                height={T - 0.5}
                rx={1.6}
                fill="#ffffff"
                fillOpacity={0.92}
                stroke="#9aa39e"
                strokeWidth={0.5}
                strokeDasharray="1.2 0.9"
              />
            ) : (
              <>
                {/* Every box has its own black frame, like the original: neighbours'
                    frames lie on top of each other, so every line is equally
                    thick, and where four boxes meet the round corners leave a
                    small notch. */}
                <rect
                  x={L.gridX + col * U}
                  y={L.gridY + row * U}
                  width={U}
                  height={U}
                  rx={2.1}
                  fill={colors[value].fill}
                  stroke="#16191c"
                  strokeWidth={0.8}
                />
                <circle cx={x + T / 2} cy={y + T / 2} r={T * 0.3} fill="#ffffff" fillOpacity={0.22} />
              </>
            )}
            {stars.has(cell) && !icon && <Star cx={x + T / 2} cy={y + T / 2 + 0.2} r={3.6} edge={value === EMPTY ? color.edge : "#ffffff"} image={art.star} theme={symbolTheme} />}
            {stars.has(cell) && icon && <Star cx={x + T - 2.2} cy={y + 2.2} r={1.9} edge={value === EMPTY ? color.edge : "#ffffff"} image={art.star} theme={symbolTheme} />}
            {gold.has(cell) && <GoldDie x={x + T / 2} y={y + T / 2} size={6.2} image={art.gold} theme={symbolTheme} />}
            {diamonds.has(cell) && <Diamond cx={x + T / 2} cy={y + T / 2} r={3.4} edge={color.edge} image={art.diamond} />}
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

      {/* The start column: its boxes' own frames are white instead of
          black (drawn over the neighbours' frames, which share the line). */}
      {Array.from({ length: sheet.rows }, (_, row) => (
        <rect
          key={row}
          x={startX}
          y={L.gridY + row * U}
          width={U}
          height={U}
          rx={2.1}
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.8}
          pointerEvents="none"
        />
      ))}

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
              <g
                onPointerDown={onRowBonusDown && ((event) => onRowBonusDown(row, event))}
                className={onRowBonusDown ? "cursor-pointer" : undefined}
              >
                <Tile x={L.pad + 8.6} y={y} w={T} h={T} fill={theme.tile} />
                <RowBonusIcon kind={bonus} cx={L.pad + 8.6 + T / 2} cy={y + T / 2} art={art} theme={symbolTheme} />
              </g>
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
              <Heart cx={cx} cy={cy} size={9.4} theme={symbolTheme} image={art.heart} />
              {/* On bones (Hunde) the dark number gets a thin edge in the bone's
                  colour, so it keeps a little distance from the outline. */}
              <text
                x={cx - 0.15}
                y={cy + 0.15 + 4.4 * 0.06}
                fontSize={4.4}
                fill={sheet.theme === "hunde" ? "#4a3418" : "#ffffff"}
                stroke={sheet.theme === "hunde" ? "#f3e6c8" : art.heart ? "#16191c" : "none"}
                strokeWidth={0.9}
                strokeLinejoin="round"
                paintOrder="stroke"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {i + 1}
              </text>
            </g>
          );
        })}

      {/* Rows of boxes under the columns: points for completed columns
          (first / later), the heart row, empty boxes. */}
      {sheet.lanes.map((lane, i) => {
        const y = L.lanesY + i * 9;
        const skip = new Set(lane.skip);
        return (
          <g key={i}>
            {Array.from({ length: sheet.cols }, (_, col) => {
              const down = onLaneDown && ((event: PointerEvent) => onLaneDown(i, col, event));
              if (skip.has(col)) {
                if (!onLaneDown) return null;
                return (
                  <rect
                    key={col}
                    x={at(col) + 0.25}
                    y={y + 0.25}
                    width={T - 0.5}
                    height={7.5}
                    rx={1.5}
                    fill={theme.tile}
                    fillOpacity={0.08}
                    stroke={theme.label}
                    strokeOpacity={0.45}
                    strokeWidth={0.4}
                    strokeDasharray="1.1 0.9"
                    className="cursor-pointer"
                    onPointerDown={down}
                  />
                );
              }
              const golden = lane.gold.includes(col);
              const ink = col === sheet.start || golden ? red : theme.ink;
              return (
                <g key={col} onPointerDown={down} className={onLaneDown ? "cursor-pointer" : undefined}>
                  <Tile x={at(col)} y={y} w={T} h={8} fill={theme.tile} />
                  {golden && <GoldDie x={at(col) + T / 2} y={y + 4} size={6.4} image={art.gold} theme={symbolTheme} />}
                  {golden && (lane.kind === "first" || lane.kind === "later") && (
                    <text
                      x={at(col) + T / 2}
                      y={y + 4.35}
                      fontSize={5.6}
                      fill={red}
                      stroke="#ffffff"
                      strokeWidth={0.7}
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      pointerEvents="none"
                    >
                      {sheet.points[col][lane.kind === "first" ? 0 : 1]}
                    </text>
                  )}
                  {!golden && lane.kind === "first" && (
                    <Label x={at(col) + T / 2} y={y + 4} size={5.6} fill={ink}>
                      {sheet.points[col][0]}
                    </Label>
                  )}
                  {!golden && lane.kind === "later" && (
                    <Label x={at(col) + T / 2} y={y + 4} size={5.6} fill={ink}>
                      {sheet.points[col][1]}
                    </Label>
                  )}
                  {lane.kind === "heart" && !golden && <Heart cx={at(col) + T / 2} cy={y + 4} size={6} pale theme={symbolTheme} image={art.heart} />}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Jokers: ? / X = ! ! ! … */}
      {L.jokerY !== null && <Jokers x={at(0)} y={L.jokerY} count={sheet.jokers} ink={theme.ink} />}

      {/* Special dice (Noch mal so gut!): the first is circled at the start. */}
      {L.specialsY !== null &&
        Array.from({ length: sheet.specials }, (_, i) => {
          const cx = at(0) + 5.4 + i * 10.4 + (i > 0 ? 1.4 : 0);
          const cy = L.specialsY! + 5;
          return (
            <g key={i}>
              {i === 0 && <circle cx={cx} cy={cy} r={5.4} fill="none" stroke="#7d7d7d" strokeWidth={0.55} />}
              <GoldDie x={cx} y={cy} size={6.6} image={art.gold} theme={symbolTheme} />
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
            <Label x={x + 3.9} y={y + 3.9} size={5.4} fill={color.edge}>
              {sheet.bonus[0]}
            </Label>
            <Tile x={x + 8.6} y={y} w={7.8} h={7.8} fill={color.fill} />
            <Label x={x + 12.5} y={y + 3.9} size={5.4} fill={color.edge}>
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
                <ScoreLabel line={line} x={panelRight - 21.5} cy={y + 4} theme={theme} art={art} symbols={symbolTheme} />
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

      {/* Stickers in front of the sheet, and the frame to drag the chosen one. */}
      <Stickers stickers={sheet.stickers} front clip={`${clipId}-card`} />
      {onStickerDown && selectedSticker != null && sheet.stickers[selectedSticker] && (
        <StickerHandle sticker={sheet.stickers[selectedSticker]} onPointerDown={(event) => onStickerDown(selectedSticker, event)} />
      )}

      {title && (
        <text x={L.width - L.pad} y={L.height - 2.2} fontSize={2.6} fill={theme.label} fillOpacity={0.7} textAnchor="end" fontFamily="system-ui, sans-serif">
          {title}
        </text>
      )}
    </svg>
  );
}

// Own pictures placed on the card, each turned around its centre, with an
// outline that follows the picture's shape (transparent PNGs) if wanted.
function Stickers({ stickers, front, clip }: { stickers: Sticker[]; front: boolean; clip: string }) {
  const id = useId();
  if (!stickers.some((sticker) => sticker.front === front)) return null;
  return (
    <g pointerEvents="none" clipPath={`url(#${clip})`}>
      {stickers.map((sticker, i) => {
        if (sticker.front !== front) return null;
        const height = sticker.width * sticker.ratio;
        const filter = `${id}-${i}`;
        const edge = Math.max(0.4, sticker.width * 0.035);
        return (
          <g key={i} transform={`translate(${sticker.x} ${sticker.y}) rotate(${sticker.rotate})`}>
            {sticker.outline && (
              // Grown a little, blurred and cut sharp again: the outline follows
              // the shape with round corners instead of square ones.
              <filter id={filter} x="-25%" y="-25%" width="150%" height="150%">
                <feMorphology in="SourceAlpha" operator="dilate" radius={edge * 0.3} result="thick" />
                <feGaussianBlur in="thick" stdDeviation={edge * 0.95} result="soft" />
                <feComponentTransfer in="soft" result="grown">
                  <feFuncA type="linear" slope={40} intercept={-4} />
                </feComponentTransfer>
                <feFlood floodColor={sticker.outlineColor} />
                <feComposite in2="grown" operator="in" result="edge" />
                <feMerge>
                  <feMergeNode in="edge" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            )}
            <image
              href={sticker.url}
              x={-sticker.width / 2}
              y={-height / 2}
              width={sticker.width}
              height={height}
              preserveAspectRatio="xMidYMid meet"
              filter={sticker.outline ? `url(#${filter})` : undefined}
            />
          </g>
        );
      })}
    </g>
  );
}

function StickerHandle({ sticker, onPointerDown }: { sticker: Sticker; onPointerDown: (event: PointerEvent) => void }) {
  const height = sticker.width * sticker.ratio;
  return (
    <g transform={`translate(${sticker.x} ${sticker.y}) rotate(${sticker.rotate})`} onPointerDown={onPointerDown} className="cursor-move">
      <rect
        x={-sticker.width / 2 - 1}
        y={-height / 2 - 1}
        width={sticker.width + 2}
        height={height + 2}
        rx={3.5}
        fill="#ffffff"
        fillOpacity={0.01}
        stroke="#ff9a2e"
        strokeWidth={0.5}
        strokeDasharray="1.5 1"
      />
    </g>
  );
}

function ScoreLabel({
  line,
  x,
  cy,
  theme,
  art,
  symbols,
}: {
  line: ScoreLine;
  x: number;
  cy: number;
  theme: Theme;
  art: Sheet["art"];
  symbols: ThemeId;
}) {
  if (line.icon === "bonus") {
    // BONUS in the five colours, like the original.
    return (
      <text x={x} y={cy + 0.2} fontSize={4.6} textAnchor="end" dominantBaseline="middle" stroke="#ffffff" strokeWidth={0.5} paintOrder="stroke">
        {"BONUS".split("").map((char, i) => (
          <tspan key={i} fill={colors[i % colors.length].edge}>
            {char}
          </tspan>
        ))}
      </text>
    );
  }
  // Symbol right-aligned, the points per piece left of the box.
  const textX = x;
  const iconX = line.label ? x - 13 : x - 3.8;
  return (
    <g>
      {line.label && (
        <text x={textX} y={cy + 0.2} fontSize={3.9} fill={theme.label} textAnchor="end" dominantBaseline="middle">
          {line.label}
        </text>
      )}
      {line.icon === "heart" && (
        <>
          <Tile x={iconX - 3.8} y={cy - 3.6} w={7.6} h={7.2} fill={theme.tile} />
          <Heart cx={iconX} cy={cy} size={6} theme={symbols} image={art.heart} />
        </>
      )}
      {line.icon === "joker" && <JokerMark cx={iconX} cy={cy} size={6.8} ink={theme.label} />}
      {line.icon === "die" &&
        (art.gold ? (
          <>
            <circle cx={iconX} cy={cy} r={4} fill={theme.tile} stroke={theme.ink} strokeWidth={0.6} />
            <GoldDie x={iconX} y={cy} size={5} image={art.gold} theme={symbols} />
          </>
        ) : (
          <ThemedBox theme={symbols} cx={iconX} cy={cy} size={8.4} ringed />
        ))}
      {line.icon === "star" && <Star cx={iconX} cy={cy} r={3.4} edge={theme.starEdge} image={art.star} solid theme={symbols} />}
      {line.icon === "diamond" && <Diamond cx={iconX} cy={cy} r={3.2} edge={theme.ink} image={art.diamond} />}
    </g>
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

// An own picture in place of a drawn mark, centred and fitted into a square.
function Picture({ href, cx, cy, size }: { href: string; cx: number; cy: number; size: number }) {
  return <image href={href} x={cx - size / 2} y={cy - size / 2} width={size} height={size} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />;
}

// The marks, as the cartoon symbols (symbols.tsx) or the sheet's own pictures.
function Star({
  cx,
  cy,
  r,
  edge,
  image,
  solid,
  theme,
}: {
  cx: number;
  cy: number;
  r: number;
  edge: string;
  image?: string;
  solid?: boolean;
  theme: ThemeId;
}) {
  if (image) return <Picture href={image} cx={cx} cy={cy - 0.2} size={r * 2.1} />;
  return <ThemedStar theme={theme} cx={cx} cy={cy} size={r * 2.25} edge={edge} solid={solid} />;
}

function Diamond({ cx, cy, r, image }: { cx: number; cy: number; r: number; edge?: string; image?: string }) {
  if (image) return <Picture href={image} cx={cx} cy={cy} size={r * 2.1} />;
  return <CartoonDiamond cx={cx} cy={cy} size={r * 2.3} />;
}

function Heart({ cx, cy, size, pale, theme, image }: { cx: number; cy: number; size: number; pale?: boolean; theme: ThemeId; image?: string }) {
  if (image)
    return (
      <g opacity={pale ? 0.45 : 1}>
        <Picture href={image} cx={cx} cy={cy} size={size * 1.05} />
      </g>
    );
  return <ThemedHeart theme={theme} cx={cx} cy={cy + size * 0.04} size={size * 1.12} pale={pale} />;
}

function GoldDie({ x, y, size, image, ringed, theme }: { x: number; y: number; size: number; image?: string; ringed?: boolean; theme: ThemeId }) {
  if (image) return <Picture href={image} cx={x} cy={y} size={size * 1.15} />;
  return <ThemedBox theme={theme} cx={x} cy={y} size={ringed ? size : size * 1.25} ringed={ringed} />;
}

function RowBonusIcon({ kind, cx, cy, art, theme }: { kind: RowBonus; cx: number; cy: number; art: Sheet["art"]; theme: ThemeId }) {
  if (kind === "bombe")
    return art.bomb ? <Picture href={art.bomb} cx={cx} cy={cy} size={7.2} /> : <ThemedBomb theme={theme} cx={cx} cy={cy} size={8} />;
  if (kind === "herz") return <Heart cx={cx} cy={cy} size={7} theme={theme} image={art.heart} />;
  return <GoldDie x={cx} y={cy} size={6} image={art.gold} theme={theme} />;
}

// ? / X = and a circled "!" per joker, on a white bar.
function Jokers({ x, y, count, ink }: { x: number; y: number; count: number; ink: string }) {
  const width = 27.5 + count * 9;
  return (
    <g>
      <rect x={x} y={y} width={width} height={10} rx={2.6} fill="#ffffff" />
      <JokerTile kind="number" cx={x + 5.4} cy={y + 5} size={7.6} />
      <Label x={x + 11.3} y={y + 5} size={5.6} fill={ink}>
        /
      </Label>
      <JokerTile kind="color" cx={x + 17.2} cy={y + 5} size={7.6} />
      <Label x={x + 23.4} y={y + 5} size={5.4} fill={ink}>
        =
      </Label>
      {Array.from({ length: count }, (_, i) => (
        <JokerMark key={i} cx={x + 31 + i * 9} cy={y + 5} size={8} />
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
