// Kegelkasse: what each player of the team pays after a match, worked out
// from the Spielbericht (and, for home matches, the Wurfscheine). Pure
// helpers, used by the browser and the server.

// Amounts in cents, so sums never round wrong.
export type Rates = {
  start: number; // Startgebühr, for everyone who played
  point: number; // Mannschaftspunkt (MP) lost
  mass: number; // Maß, marked by hand with an "M" next to the name
  error: number; // per Fehlwurf
  golden: number; // per Goldener (see analyzeSheet)
  two: number; // per Zweier ins Volle
  under: number; // total below the threshold
};

export const defaultRates: Rates = { start: 100, point: 100, mass: 250, error: 30, golden: 30, two: 50, under: 100 };
export const DEFAULT_THRESHOLD = 550;
export const DEFAULT_TEAM = "Jedesheim";

export type Settings = {
  team: string;
  threshold: number;
  rates: Rates;
  // Short names for the table, by the name's key (see nameKey), e.g. "Benni".
  nicknames: Record<string, string>;
};

export const defaultSettings: Settings = { team: DEFAULT_TEAM, threshold: DEFAULT_THRESHOLD, rates: defaultRates, nicknames: {} };

// One player of a match. Counts come from the documents and can be changed
// by hand before saving.
export type Line = {
  name: string; // as on the Spielbericht, "Amon, Benjamin"
  started: boolean;
  errors: number;
  total: number | null; // Gesamt (Kegel), null = unknown
  mp: number | null; // Mannschaftspunkte: 1, 0.5 or 0; null = unknown
  mass: boolean;
  twos: number;
  golden: number;
  // True once a Wurfschein was read for this player, so twos and golden
  // are known rather than 0 by default.
  sheet: boolean;
  paid: boolean;
};

export type Game = {
  id: string;
  playedOn: string | null; // YYYY-MM-DD
  matchday: number | null;
  season: string;
  opponent: string;
  home: boolean | null;
  threshold: number;
  rates: Rates;
  lines: Line[];
  note: string;
  createdAt: string;
};

export type Fees = Record<keyof Rates, number> & { sum: number };

export const columns: { id: keyof Rates; label: string; short: string }[] = [
  { id: "start", label: "Startgebühr", short: "Start" },
  { id: "point", label: "Punkt verloren", short: "Punkt" },
  { id: "mass", label: "Maß", short: "Maß" },
  { id: "error", label: "Fehler", short: "Fehler" },
  { id: "golden", label: "Goldener", short: "Gold." },
  { id: "two", label: "2er", short: "2er" },
  { id: "under", label: "unter", short: "unter" },
];

export function feesOf(line: Line, rates: Rates, threshold: number): Fees {
  const played = line.started;
  const fees = {
    start: played ? rates.start : 0,
    // A draw (0,5 MP) is not a lost point.
    point: played && line.mp !== null && line.mp < 0.5 ? rates.point : 0,
    mass: line.mass ? rates.mass : 0,
    error: Math.max(0, line.errors) * rates.error,
    golden: Math.max(0, line.golden) * rates.golden,
    two: Math.max(0, line.twos) * rates.two,
    under: played && line.total !== null && line.total < threshold ? rates.under : 0,
  };
  return { ...fees, sum: Object.values(fees).reduce((a, b) => a + b, 0) };
}

export const gameSum = (game: Pick<Game, "lines" | "rates" | "threshold">) =>
  game.lines.reduce((sum, line) => sum + feesOf(line, game.rates, game.threshold).sum, 0);

export const openSum = (game: Pick<Game, "lines" | "rates" | "threshold">) =>
  game.lines.filter((line) => !line.paid).reduce((sum, line) => sum + feesOf(line, game.rates, game.threshold).sum, 0);

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
export const formatEuro = (cents: number) => euro.format(cents / 100);

// "0,30" or "1" → cents; null for anything else.
export function parseEuro(value: string): number | null {
  const clean = value.replace(/€/g, "").replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

// --- Names ----------------------------------------------------------------------

// The same person is "Amon, Benjamin" on the Spielbericht and "AMON, BENJAMIN"
// (or "Benjamin Amon") on the Wurfschein: compare the sorted name parts.
export function nameKey(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .split(/[^a-z]+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

export function displayName(name: string, nicknames: Record<string, string>) {
  return nicknames[nameKey(name)]?.trim() || name;
}

// The index of the line a Wurfschein's name belongs to, or -1. Falls back to
// the surname alone when only one line has it.
export function matchLine(lines: Pick<Line, "name">[], name: string) {
  const key = nameKey(name);
  const exact = lines.findIndex((line) => nameKey(line.name) === key);
  if (exact >= 0) return exact;
  const parts = new Set(key.split(" "));
  const candidates = lines
    .map((line, index) => ({ index, shared: nameKey(line.name).split(" ").filter((part) => parts.has(part)).length }))
    .filter((entry) => entry.shared > 0)
    .sort((a, b) => b.shared - a.shared);
  if (candidates.length === 1 || (candidates.length > 1 && candidates[0].shared > candidates[1].shared)) return candidates[0].index;
  return -1;
}

// --- Wurfschein -----------------------------------------------------------------

// One Satz (Durchgang) of 30 throws: 15 in die Vollen, then 15 Abräumen.
export type SheetSet = { throws: number[]; volle: number | null; abraeumer: number | null; gesamt: number | null };

export type SheetResult = {
  twos: number;
  golden: number;
  // Where they happened, e.g. "Satz 3, Wurf 6", for checking against the paper.
  twoAt: string[];
  goldenAt: string[];
  warnings: string[];
};

// Zweier ins Volle: a 2 in the first 15 throws of a Satz.
// Goldener: the last throw of a Satz is a 0 while only one pin was standing.
// In the Abräumen, the pins standing follow from the throws: 9 at the start,
// minus what fell, set up again once all 9 are down. A Fehlwurf counts 0 and
// leaves the pins as they were.
export function analyzeSheet(sets: SheetSet[]): SheetResult {
  const result: SheetResult = { twos: 0, golden: 0, twoAt: [], goldenAt: [], warnings: [] };
  sets.forEach((set, index) => {
    const label = `Satz ${index + 1}`;
    const throws = set.throws;
    if (throws.length !== 30) {
      result.warnings.push(`${label}: ${throws.length} statt 30 Würfe gelesen.`);
    }
    throws.slice(0, 15).forEach((pins, i) => {
      if (pins === 2) {
        result.twos += 1;
        result.twoAt.push(`${label}, Wurf ${i + 1}`);
      }
    });
    const volle = throws.slice(0, 15).reduce((a, b) => a + b, 0);
    const abraeumer = throws.slice(15, 30).reduce((a, b) => a + b, 0);
    if (set.volle !== null && set.volle !== volle) result.warnings.push(`${label}: Volle ergeben ${volle}, auf dem Zettel steht ${set.volle}.`);
    if (set.abraeumer !== null && set.abraeumer !== abraeumer)
      result.warnings.push(`${label}: Abräumer ergeben ${abraeumer}, auf dem Zettel steht ${set.abraeumer}.`);

    if (throws.length < 30) return;
    let standing = 9;
    for (let i = 15; i < 29; i++) {
      standing -= throws[i];
      if (standing < 0) {
        result.warnings.push(`${label}: Wurf ${i + 1} hat mehr Kegel als noch standen.`);
        standing = 0;
      }
      if (standing === 0) standing = 9;
    }
    if (standing === 1 && throws[29] === 0) {
      result.golden += 1;
      result.goldenAt.push(`${label}, Wurf 30`);
    }
  });
  return result;
}

// --- Reading results ------------------------------------------------------------

// What the AI reads from a Spielbericht, already checked (see ai.ts).
export type ReportPlayer = {
  name: string;
  sets: { volle: number; abr: number; fe: number; ges: number; sp: number }[];
  errors: number;
  total: number;
  mp: number | null;
  mass: boolean;
  substitute: boolean;
};

export type Report = {
  season: string;
  matchday: number | null;
  date: string | null;
  home: string;
  guest: string;
  ourSide: "home" | "guest" | "unknown";
  players: ReportPlayer[];
  warnings: string[];
};

export type ThrowSheet = { name: string; sets: SheetSet[] };

export function linesFromReport(report: Report): Line[] {
  return report.players.map((player) => ({
    name: player.name,
    started: true,
    errors: player.errors,
    total: player.total,
    mp: player.mp,
    mass: player.mass,
    twos: 0,
    golden: 0,
    sheet: false,
    paid: false,
  }));
}

export const emptyLine = (name = ""): Line => ({
  name,
  started: true,
  errors: 0,
  total: null,
  mp: null,
  mass: false,
  twos: 0,
  golden: 0,
  sheet: false,
  paid: false,
});

// Season from a date: from July on it is the next season, "2026-27".
export function seasonOf(date: string | null) {
  const day = date ? new Date(`${date}T12:00:00`) : new Date();
  const year = day.getFullYear();
  const start = day.getMonth() >= 6 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function cleanRates(input: Partial<Rates> | null | undefined): Rates {
  const rates = { ...defaultRates };
  for (const key of Object.keys(defaultRates) as (keyof Rates)[]) {
    const value = Math.round(Number(input?.[key]));
    if (Number.isFinite(value) && value >= 0 && value <= 100_00) rates[key] = value;
  }
  return rates;
}

const count = (value: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(value) || 0)));

export function cleanLine(input: Partial<Line>): Line {
  const total = input.total === null || input.total === undefined || String(input.total) === "" ? null : count(input.total, 1200);
  const mp = input.mp === null || input.mp === undefined ? null : [0, 0.5, 1].includes(Number(input.mp)) ? Number(input.mp) : null;
  return {
    name: String(input.name ?? "").trim().slice(0, 80),
    started: input.started !== false,
    errors: count(input.errors, 99),
    total,
    mp,
    mass: input.mass === true,
    twos: count(input.twos, 99),
    golden: count(input.golden, 9),
    sheet: input.sheet === true,
    paid: input.paid === true,
  };
}
