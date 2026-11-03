// Noch-mal-Blätter: own score sheets for the dice game "Noch mal!" (Schmidt
// Spiele). A sheet is a grid of coloured boxes in the five dice colours,
// grouped into connected blocks of the same colour, with stars, a start
// column and the points for completed columns and colours. Shared by the
// browser (generator, editor) and the server (actions clean what they store).

export const colors = [
  { name: "Grün", fill: "#62b85c", ink: "#ffffff" },
  { name: "Gelb", fill: "#f4cf3c", ink: "#3b2f00" },
  { name: "Blau", fill: "#4aa0dc", ink: "#ffffff" },
  { name: "Rosa", fill: "#ee8db4", ink: "#ffffff" },
  { name: "Orange", fill: "#f29a3a", ink: "#ffffff" },
] as const;

export type Sheet = {
  version: 1;
  cols: number;
  rows: number;
  // Column index where the first cross has to go (H on the original sheet).
  start: number;
  // Colour index (0–4) of every box, row by row.
  cells: number[];
  // Indexes of the boxes with a star (−2 if still empty at the end).
  stars: number[];
  // Per column: points for the first to complete it, and for everyone later.
  points: [number, number][];
  // Points for completing a colour: first, later.
  bonus: [number, number];
  // Number of jokers ("!") each player may use.
  jokers: number;
  starPenalty: number;
  // Which game the sheet is made for (decides the extra parts below).
  variant: VariantId;
  // Noch mal so gut!: per row (P, Q, …) the points for completing it and the
  // bonus for the first to do so. Empty: rows don't score.
  rowBonuses: RowBonus[];
  rowScore: number;
  // Hearts to circle in the heart column (Noch mal so gut!), 0 for none.
  hearts: number;
  // Golden dice boxes: crossing one unlocks a special die (Noch mal so gut!).
  gold: number[];
  // Special dice in the row below the jokers; the first is circled at the start.
  specials: number;
  // Boxes with a diamond (Noch X-Mal!).
  diamonds: number[];
  // Boxes of the pass bar to note a colour and number (Noch X-Mal!).
  passes: number;
  // X-chips to strike off (Noch X-Mal!), 0 for none.
  chips: number;
  // Pictures in boxes, e.g. the animals of the enclosures (Kids).
  icons: { cell: number; symbol: string }[];
  // Thick lines around every block (the enclosures of the Kids sheet).
  outlines: boolean;
  // The boxes for the final score at the bottom.
  scoring: boolean;
};

export const limits = {
  cols: { min: 5, max: 25 },
  rows: { min: 4, max: 12 },
  jokers: { min: 0, max: 16 },
  hearts: { min: 0, max: 10 },
  specials: { min: 0, max: 16 },
  passes: { min: 0, max: 20 },
  chips: { min: 0, max: 20 },
  diamonds: { min: 0, max: 30 },
};

// --- Variants of the game -------------------------------------------------------
//
// Each variant is the sheet of one game of the family with the parts its rules
// need. The rules found online are incomplete for the newer games, so the
// numbers are starting points that can be changed on the sheet.

export type VariantId = "klassisch" | "sogut" | "xmal" | "kids";
export type RowBonus = "wuerfel" | "bombe" | "herz";
export const rowBonusKinds: RowBonus[] = ["wuerfel", "bombe", "herz"];

export type Variant = {
  id: VariantId;
  name: string;
  hint: string;
  options: Partial<GeneratorOptions>;
  rows: boolean;
  hearts: number;
  gold: number;
  specials: number;
  diamonds: number;
  passes: number;
  chips: number;
  kids: boolean;
  scoring: boolean;
};

export const variants: Variant[] = [
  {
    id: "klassisch",
    name: "Noch mal!",
    hint: "Das Original: Spalten, Farben, Sterne, 8 Joker",
    options: { cols: 15, rows: 7, blockStyle: "gemischt", maxBlock: 6, starsPerColumn: 1, jokers: 8 },
    rows: false,
    hearts: 0,
    gold: 0,
    specials: 0,
    diamonds: 0,
    passes: 0,
    chips: 0,
    kids: false,
    scoring: true,
  },
  {
    id: "sogut",
    name: "Noch mal so gut!",
    hint: "Zeilen P–V, Herzen, goldene Würfelfelder, Sonderwürfel, 6 Joker",
    options: { cols: 15, rows: 7, blockStyle: "gemischt", maxBlock: 6, starsPerColumn: 1, jokers: 6 },
    rows: true,
    hearts: 5,
    gold: 8,
    specials: 10,
    diamonds: 0,
    passes: 0,
    chips: 0,
    kids: false,
    scoring: true,
  },
  {
    id: "xmal",
    name: "Noch X-Mal!",
    hint: "Mit Diamanten, Pass-Leiste und 10 X-Chips (Regeln nicht geprüft)",
    options: { cols: 15, rows: 7, blockStyle: "gemischt", maxBlock: 6, starsPerColumn: 1, jokers: 8 },
    rows: false,
    hearts: 0,
    gold: 0,
    specials: 0,
    diamonds: 10,
    passes: 10,
    chips: 10,
    kids: false,
    scoring: false,
  },
  {
    id: "kids",
    name: "Kids",
    hint: "Weniger, größere Kästchen, Gehege mit Tieren",
    options: { cols: 9, rows: 6, blockStyle: "klein", maxBlock: 4, starsPerColumn: 1, jokers: 4 },
    rows: false,
    hearts: 0,
    gold: 0,
    specials: 0,
    diamonds: 0,
    passes: 0,
    chips: 0,
    kids: true,
    scoring: true,
  },
];

export const variantOf = (id: string) => variants.find((variant) => variant.id === id) ?? variants[0];

export const animals = ["🐘", "🦁", "🦒", "🐒", "🐧", "🦓", "🐻", "🐼", "🦛", "🐊", "🦜", "🐢", "🦩", "🐫", "🦘", "🐨"];

// Row bonuses top to bottom: special die, bomb, heart, bomb, special die,
// heart, bomb – repeated for taller sheets.
export function rowBonuses(rows: number): RowBonus[] {
  const pattern: RowBonus[] = ["wuerfel", "bombe", "herz", "bombe", "wuerfel", "herz", "bombe"];
  return Array.from({ length: rows }, (_, row) => pattern[row % pattern.length]);
}

// Letters of the rows continue after the columns' (P–V on a 15-column sheet).
export const rowLetter = (sheet: Pick<Sheet, "cols">, row: number) => letter(sheet.cols + row);

export type SizePreset = { id: string; name: string; hint: string; cols: number; rows: number };

export const sizePresets: SizePreset[] = [
  { id: "mini", name: "Mini", hint: "schnelle Runde, ca. 10 Min.", cols: 9, rows: 5 },
  { id: "kompakt", name: "Kompakt", hint: "etwas kürzer", cols: 11, rows: 6 },
  { id: "klassisch", name: "Klassisch", hint: "Größe wie im Original", cols: 15, rows: 7 },
  { id: "gross", name: "Groß", hint: "längere Partie", cols: 19, rows: 8 },
  { id: "riesig", name: "Riesig", hint: "für Profis", cols: 23, rows: 9 },
];

// A–Z, then AA, AB, … for very wide sheets.
export const letter = (n: number): string =>
  n < 26 ? String.fromCharCode(65 + n) : letter(Math.floor(n / 26) - 1) + String.fromCharCode(65 + (n % 26));
export const index = (sheet: Pick<Sheet, "cols">, col: number, row: number) => row * sheet.cols + col;

// --- Points ---------------------------------------------------------------------

// Columns pay more the further they are from the start column: 1/0 for the
// start column, 2/1 near it, 3/2 further out and 5/3 for the outermost ones
// (on a 15-column sheet with H as start: A 5/3, B–D 3/2, E–G 2/1, H 1/0).
export function columnPoints(cols: number, start: number): [number, number][] {
  const reach = Math.max(start, cols - 1 - start, 1);
  return Array.from({ length: cols }, (_, col) => {
    const distance = Math.abs(col - start);
    if (distance === 0) return [1, 0];
    if (col === 0 || col === cols - 1) return [5, 3];
    return distance / reach <= 0.45 ? [2, 1] : [3, 2];
  });
}

// --- Generator ----------------------------------------------------------------

export type BlockStyle = "klein" | "gemischt" | "gross";

export const blockStyles: { id: BlockStyle; name: string; hint: string; weights: number[] }[] = [
  { id: "klein", name: "Viele kleine", hint: "Leichter, schnell viele Kreuze", weights: [3, 4, 3, 2, 1, 0.5] },
  { id: "gemischt", name: "Gemischt", hint: "Wie man es kennt", weights: [1.2, 2, 3, 3, 2, 1] },
  { id: "gross", name: "Große Blöcke", hint: "Schwerer, mehr Planung", weights: [0.4, 1, 2, 3, 3, 3] },
];

export type GeneratorOptions = {
  variant: VariantId;
  cols: number;
  rows: number;
  blockStyle: BlockStyle;
  maxBlock: number;
  starsPerColumn: number;
  jokers: number;
  seed: number;
};

export const defaultOptions: GeneratorOptions = {
  variant: "klassisch",
  cols: 15,
  rows: 7,
  blockStyle: "gemischt",
  maxBlock: 6,
  starsPerColumn: 1,
  jokers: 8,
  seed: 1,
};

// A small seeded random generator (mulberry32): the same seed gives the same sheet.
export function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rand: () => number) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function neighbours(cols: number, rows: number, cell: number) {
  const col = cell % cols;
  const row = Math.floor(cell / cols);
  const result: number[] = [];
  if (col > 0) result.push(cell - 1);
  if (col < cols - 1) result.push(cell + 1);
  if (row > 0) result.push(cell - cols);
  if (row < rows - 1) result.push(cell + cols);
  return result;
}

function pickSize(weights: number[], maxBlock: number, rand: () => number) {
  const usable = weights.slice(0, maxBlock);
  const total = usable.reduce((sum, weight) => sum + weight, 0);
  let roll = rand() * total;
  for (let i = 0; i < usable.length; i++) {
    roll -= usable[i];
    if (roll <= 0) return i + 1;
  }
  return usable.length;
}

// Splits the grid into connected blocks: start at a random free box and grow
// at random until the block has the size rolled for it. A lone box left over
// joins a neighbouring block that still has room.
function partition(cols: number, rows: number, weights: number[], maxBlock: number, rand: () => number) {
  const total = cols * rows;
  const blockOf = new Array<number>(total).fill(-1);
  const blocks: number[][] = [];
  for (const seedCell of shuffle(
    Array.from({ length: total }, (_, i) => i),
    rand,
  )) {
    if (blockOf[seedCell] !== -1) continue;
    const size = pickSize(weights, maxBlock, rand);
    const block = [seedCell];
    blockOf[seedCell] = blocks.length;
    while (block.length < size) {
      const frontier = block.flatMap((cell) => neighbours(cols, rows, cell)).filter((cell) => blockOf[cell] === -1);
      if (frontier.length === 0) break;
      const next = frontier[Math.floor(rand() * frontier.length)];
      blockOf[next] = blocks.length;
      block.push(next);
    }
    blocks.push(block);
  }
  // Merge lone boxes the weights did not ask for.
  const singles = weights[0] / weights.slice(0, maxBlock).reduce((sum, weight) => sum + weight, 0);
  blocks.forEach((block, id) => {
    if (block.length !== 1 || rand() < singles) return;
    const target = shuffle(neighbours(cols, rows, block[0]), rand)
      .map((cell) => blockOf[cell])
      .find((other) => other !== id && blocks[other].length > 0 && blocks[other].length < maxBlock);
    if (target === undefined) return;
    blocks[target].push(block[0]);
    blockOf[block[0]] = target;
    block.length = 0;
  });
  const kept = blocks.filter((block) => block.length > 0);
  kept.forEach((block, id) => block.forEach((cell) => (blockOf[cell] = id)));
  return { blocks: kept, blockOf };
}

// Colours the blocks so that every colour has (almost) the same number of
// boxes and touching blocks never share a colour (they would merge into one
// bigger block). Backtracking, biggest blocks first.
function colour(cols: number, rows: number, blocks: number[][], blockOf: number[], rand: () => number) {
  const total = cols * rows;
  const quota = colors.map((_, c) => Math.floor(total / colors.length) + (c < total % colors.length ? 1 : 0));
  const touching = blocks.map((block, id) => {
    const set = new Set<number>();
    for (const cell of block) for (const next of neighbours(cols, rows, cell)) if (blockOf[next] !== id) set.add(blockOf[next]);
    return [...set];
  });
  const order = blocks.map((_, id) => id).sort((a, b) => blocks[b].length - blocks[a].length || rand() - 0.5);
  const assigned = new Array<number>(blocks.length).fill(-1);
  const left = [...quota];
  let budget = 40000;

  function place(at: number): boolean {
    if (at === order.length) return true;
    if (--budget < 0) return false;
    const id = order[at];
    const size = blocks[id].length;
    for (const c of shuffle([0, 1, 2, 3, 4], rand)) {
      if (left[c] < size || touching[id].some((other) => assigned[other] === c)) continue;
      assigned[id] = c;
      left[c] -= size;
      if (place(at + 1)) return true;
      assigned[id] = -1;
      left[c] += size;
    }
    return false;
  }

  if (!place(0)) return null;
  const cells = new Array<number>(total);
  blocks.forEach((block, id) => block.forEach((cell) => (cells[cell] = assigned[id])));
  return cells;
}

// Per column `perColumn` stars on different rows, spread evenly over the
// colours and at most one per block.
function placeStars(cols: number, rows: number, cells: number[], blockOf: number[], perColumn: number, rand: () => number) {
  if (perColumn <= 0) return [];
  const total = cols * perColumn;
  const quota = colors.map((_, c) => Math.floor(total / colors.length) + (c < total % colors.length ? 1 : 0));
  const stars: number[] = [];
  const usedBlocks = new Set<number>();
  let budget = 20000;

  function column(col: number, inColumn: number): boolean {
    if (col === cols) return true;
    if (inColumn === perColumn) return column(col + 1, 0);
    if (--budget < 0) return false;
    for (const row of shuffle(
      Array.from({ length: rows }, (_, r) => r),
      rand,
    )) {
      const cell = row * cols + col;
      const c = cells[cell];
      if (quota[c] === 0 || usedBlocks.has(blockOf[cell]) || stars.includes(cell)) continue;
      quota[c]--;
      usedBlocks.add(blockOf[cell]);
      stars.push(cell);
      if (column(col, inColumn + 1)) return true;
      stars.pop();
      usedBlocks.delete(blockOf[cell]);
      quota[c]++;
    }
    return false;
  }

  return column(0, 0) ? stars.sort((a, b) => a - b) : [];
}

// Golden dice boxes spread over the sheet: different columns and rows where
// possible, never on a star or in the start column.
function placeGold(cols: number, rows: number, stars: number[], blockOf: number[], count: number, rand: () => number) {
  const result: number[] = [];
  const usedCols = new Set<number>([Math.floor(cols / 2)]);
  const usedBlocks = new Set<number>();
  for (const cell of shuffle(
    Array.from({ length: cols * rows }, (_, i) => i),
    rand,
  )) {
    if (result.length >= count) break;
    const col = cell % cols;
    if (usedCols.has(col) || stars.includes(cell) || usedBlocks.has(blockOf[cell])) continue;
    usedCols.add(col);
    if (col > 0) usedCols.add(col - 1);
    if (col < cols - 1) usedCols.add(col + 1);
    usedBlocks.add(blockOf[cell]);
    result.push(cell);
  }
  return result.sort((a, b) => a - b);
}

// Diamonds in different columns, never on a star.
function placeDiamonds(cols: number, rows: number, stars: number[], count: number, rand: () => number) {
  const columns = shuffle(
    Array.from({ length: cols }, (_, col) => col),
    rand,
  ).slice(0, count);
  return columns
    .map((col) => {
      const free = Array.from({ length: rows }, (_, row) => row * cols + col).filter((cell) => !stars.includes(cell));
      return free[Math.floor(rand() * free.length)];
    })
    .filter((cell) => cell !== undefined)
    .sort((a, b) => a - b);
}

// One animal per enclosure (block), in a box without a star where possible.
function placeAnimals(blocks: number[][], stars: number[], rand: () => number) {
  const pool = shuffle(animals, rand);
  return blocks.map((block, i) => {
    const free = block.filter((cell) => !stars.includes(cell));
    const choices = free.length > 0 ? free : block;
    return { cell: choices[Math.floor(rand() * choices.length)], symbol: pool[i % pool.length] };
  });
}

export function generate(options: GeneratorOptions): Sheet {
  const cols = clamp(Math.round(options.cols), limits.cols.min, limits.cols.max);
  const rows = clamp(Math.round(options.rows), limits.rows.min, limits.rows.max);
  const maxBlock = clamp(Math.round(options.maxBlock), 2, 6);
  const weights = (blockStyles.find((style) => style.id === options.blockStyle) ?? blockStyles[1]).weights;
  const start = Math.floor(cols / 2);
  const starsPerColumn = clamp(Math.round(options.starsPerColumn), 0, Math.min(2, rows));

  // Try new partitions until the colouring works out and the start column
  // shows enough different colours.
  let fallback: Sheet | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const rand = random(options.seed * 7919 + attempt);
    const { blocks, blockOf } = partition(cols, rows, weights, maxBlock, rand);
    const cells = colour(cols, rows, blocks, blockOf, rand);
    if (!cells) continue;
    const stars = placeStars(cols, rows, cells, blockOf, starsPerColumn, rand);
    const variant = variantOf(options.variant);
    const sheet: Sheet = {
      version: 1,
      cols,
      rows,
      start,
      cells,
      stars,
      points: columnPoints(cols, start),
      bonus: [5, 3],
      jokers: clamp(Math.round(options.jokers), limits.jokers.min, limits.jokers.max),
      starPenalty: 2,
      variant: variant.id,
      rowBonuses: variant.rows ? rowBonuses(rows) : [],
      rowScore: 5,
      hearts: variant.hearts,
      gold: placeGold(cols, rows, stars, blockOf, variant.gold, rand),
      specials: variant.specials,
      diamonds: placeDiamonds(cols, rows, stars, Math.min(variant.diamonds, cols), rand),
      passes: variant.passes,
      chips: variant.chips,
      icons: variant.kids ? placeAnimals(blocks, stars, rand) : [],
      outlines: variant.kids,
      scoring: variant.scoring,
    };
    const startColours = new Set(Array.from({ length: rows }, (_, row) => cells[row * cols + start])).size;
    const starsOk = starsPerColumn === 0 || stars.length === cols * starsPerColumn;
    if (startColours >= Math.min(colors.length, rows) - 1 && starsOk) return sheet;
    fallback ??= sheet;
  }
  return fallback ?? emptySheet(cols, rows);
}

export function emptySheet(cols: number, rows: number): Sheet {
  const start = Math.floor(cols / 2);
  return {
    version: 1,
    cols,
    rows,
    start,
    cells: Array.from({ length: cols * rows }, (_, i) => (i % cols) % colors.length),
    stars: [],
    points: columnPoints(cols, start),
    bonus: [5, 3],
    jokers: 8,
    starPenalty: 2,
    variant: "klassisch",
    rowBonuses: [],
    rowScore: 5,
    hearts: 0,
    gold: [],
    specials: 0,
    diamonds: [],
    passes: 0,
    chips: 0,
    icons: [],
    outlines: false,
    scoring: true,
  };
}

// --- Checks ------------------------------------------------------------------------

export type Block = { color: number; cells: number[] };

// The blocks as a player sees them: touching boxes of the same colour.
export function blocksOf(sheet: Sheet): Block[] {
  const seen = new Array<boolean>(sheet.cells.length).fill(false);
  const result: Block[] = [];
  for (let cell = 0; cell < sheet.cells.length; cell++) {
    if (seen[cell]) continue;
    const color = sheet.cells[cell];
    const cells = [cell];
    seen[cell] = true;
    for (let i = 0; i < cells.length; i++) {
      for (const next of neighbours(sheet.cols, sheet.rows, cells[i])) {
        if (!seen[next] && sheet.cells[next] === color) {
          seen[next] = true;
          cells.push(next);
        }
      }
    }
    result.push({ color, cells });
  }
  return result;
}

export type Check = { ok: boolean; text: string };

// What makes a sheet playable, for the panel next to the editor.
export function checks(sheet: Sheet): Check[] {
  const counts = colors.map((_, c) => sheet.cells.filter((value) => value === c).length);
  const blocks = blocksOf(sheet);
  const biggest = Math.max(...blocks.map((block) => block.cells.length));
  const startColours = new Set(Array.from({ length: sheet.rows }, (_, row) => sheet.cells[index(sheet, sheet.start, row)])).size;
  const starColours = colors.map((_, c) => sheet.stars.filter((cell) => sheet.cells[cell] === c).length);
  const starColumns = new Set(sheet.stars.map((cell) => cell % sheet.cols)).size;
  const spread = Math.max(...counts) - Math.min(...counts);

  return [
    {
      ok: spread <= 1,
      text: `Felder pro Farbe: ${counts.map((count, c) => `${colors[c].name} ${count}`).join(", ")}`,
    },
    {
      ok: biggest <= 6,
      text:
        biggest <= 6
          ? `Größter Block: ${biggest} Kästchen`
          : `Ein Block hat ${biggest} Kästchen – mehr als 6 ist mit den Würfeln sehr zäh`,
    },
    {
      ok: startColours >= Math.min(colors.length, sheet.rows) - 1,
      text: `Startspalte ${letter(sheet.start)} hat ${startColours} von 5 Farben`,
    },
    {
      ok: sheet.stars.length === 0 || (starColumns === sheet.cols && Math.max(...starColours) - Math.min(...starColours) <= 1),
      text:
        sheet.stars.length === 0
          ? "Keine Sterne"
          : `${sheet.stars.length} Sterne in ${starColumns} von ${sheet.cols} Spalten (${starColours.join("/")} pro Farbe)`,
    },
  ];
}

// The most a player can score (every column first, every colour first, all
// jokers unused) – a feel for how big the sheet plays.
export function maxScore(sheet: Sheet) {
  return (
    sheet.points.reduce((sum, [first]) => sum + first, 0) +
    sheet.rowBonuses.length * sheet.rowScore +
    colors.length * sheet.bonus[0] +
    sheet.jokers
  );
}

// --- Cleaning (the server stores only what passes this) ---------------------------

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const int = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? clamp(Math.round(value), min, max) : fallback;

export function cleanSheet(input: unknown): Sheet {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const cols = int(raw.cols, limits.cols.min, limits.cols.max, 15);
  const rows = int(raw.rows, limits.rows.min, limits.rows.max, 7);
  const total = cols * rows;
  const start = int(raw.start, 0, cols - 1, Math.floor(cols / 2));
  const rawCells = Array.isArray(raw.cells) ? raw.cells : [];
  const cells = Array.from({ length: total }, (_, i) => int(rawCells[i], 0, colors.length - 1, (i % cols) % colors.length));
  const stars = [...new Set((Array.isArray(raw.stars) ? raw.stars : []).map((cell) => int(cell, -1, total - 1, -1)))]
    .filter((cell) => cell >= 0)
    .sort((a, b) => a - b);
    const rawPoints = Array.isArray(raw.points) ? raw.points : [];
  const defaults = columnPoints(cols, start);
  const points = defaults.map((fallback, col): [number, number] => {
    const pair = Array.isArray(rawPoints[col]) ? rawPoints[col] : fallback;
    return [int(pair[0], 0, 20, fallback[0]), int(pair[1], 0, 20, fallback[1])];
  });
  const rawBonus = Array.isArray(raw.bonus) ? raw.bonus : [];
  const variant = variantOf(typeof raw.variant === "string" ? raw.variant : "klassisch");
  const rawRows = Array.isArray(raw.rowBonuses) ? raw.rowBonuses : [];
  const cellList = (value: unknown) =>
    [...new Set((Array.isArray(value) ? value : []).map((cell) => int(cell, -1, total - 1, -1)))]
      .filter((cell) => cell >= 0)
      .sort((a, b) => a - b);
  const icons = (Array.isArray(raw.icons) ? raw.icons : [])
    .map((icon) => (icon && typeof icon === "object" ? (icon as Record<string, unknown>) : {}))
    .map((icon) => ({ cell: int(icon.cell, -1, total - 1, -1), symbol: typeof icon.symbol === "string" ? icon.symbol.slice(0, 8) : "" }))
    .filter((icon, i, all) => icon.cell >= 0 && icon.symbol && all.findIndex((other) => other.cell === icon.cell) === i);
  return {
    version: 1,
    cols,
    rows,
    start,
    cells,
    stars,
    points,
    bonus: [int(rawBonus[0], 0, 20, 5), int(rawBonus[1], 0, 20, 3)],
    jokers: int(raw.jokers, limits.jokers.min, limits.jokers.max, 8),
    starPenalty: int(raw.starPenalty, 0, 10, 2),
    variant: variant.id,
    rowBonuses:
      rawRows.length > 0
        ? Array.from({ length: rows }, (_, row) =>
            rowBonusKinds.includes(rawRows[row] as RowBonus) ? (rawRows[row] as RowBonus) : rowBonuses(rows)[row],
          )
        : [],
    rowScore: int(raw.rowScore, 0, 20, 5),
    hearts: int(raw.hearts, limits.hearts.min, limits.hearts.max, 0),
    gold: cellList(raw.gold).slice(0, limits.diamonds.max),
    specials: int(raw.specials, limits.specials.min, limits.specials.max, 0),
    diamonds: cellList(raw.diamonds).slice(0, limits.diamonds.max),
    passes: int(raw.passes, limits.passes.min, limits.passes.max, 0),
    chips: int(raw.chips, limits.chips.min, limits.chips.max, 0),
    icons,
    outlines: raw.outlines === true,
    scoring: raw.scoring !== false,
  };
}

// Changing the size keeps what still fits and fills new boxes with a pattern.
export function resize(sheet: Sheet, cols: number, rows: number): Sheet {
  const cells: number[] = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++)
      cells.push(col < sheet.cols && row < sheet.rows ? sheet.cells[index(sheet, col, row)] : (col + row) % colors.length);
  const move = (cell: number) => {
    const col = cell % sheet.cols;
    const row = Math.floor(cell / sheet.cols);
    return col < cols && row < rows ? row * cols + col : -1;
  };
  const stars = sheet.stars.map(move).filter((cell) => cell >= 0);
  const diamonds = sheet.diamonds.map(move).filter((cell) => cell >= 0);
  const gold = sheet.gold.map(move).filter((cell) => cell >= 0);
  const icons = sheet.icons.map((icon) => ({ ...icon, cell: move(icon.cell) })).filter((icon) => icon.cell >= 0);
  const start = Math.min(sheet.start, cols - 1);
  return {
    ...sheet,
    cols,
    rows,
    start,
    cells,
    stars,
    diamonds,
    gold,
    icons,
    points: columnPoints(cols, start),
    rowBonuses: sheet.rowBonuses.length > 0 ? rowBonuses(rows) : [],
  };
}
