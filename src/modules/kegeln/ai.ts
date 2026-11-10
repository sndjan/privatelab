// Server only: Claude reads the Spielbericht and the Wurfscheine from a photo
// or PDF. It only transcribes numbers; what they cost is worked out in
// data.ts, where it can be checked and changed.
import Anthropic from "@anthropic-ai/sdk";
import type { Report, ReportPlayer, SheetSet, ThrowSheet } from "./data";

// The cheapest model: reading printed numbers off a sheet doesn't need more,
// and the sums in data.ts catch what it misreads.
const MODEL = "claude-haiku-5-5";

const client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const hasAiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

export type Upload =
  | { kind: "image"; data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }
  | { kind: "pdf"; data: string };

function aiError(error: unknown) {
  if (error instanceof Anthropic.RateLimitError) return "Die KI ist gerade ausgelastet. Versuch es gleich noch einmal.";
  if (error instanceof Anthropic.BadRequestError) {
    console.error("Kegeln AI request rejected:", error.message);
    return `Die KI hat die Anfrage abgelehnt (400: ${error.message.slice(0, 200)}).`;
  }
  if (error instanceof Anthropic.APIError) return `Die KI ist nicht erreichbar (${error.status ?? "Fehler"}).`;
  if (error instanceof SyntaxError) return "Die Antwort der KI war unvollständig.";
  if (error instanceof Error) return error.message;
  return "Die KI ist nicht erreichbar.";
}

async function ask<T>(upload: Upload, system: string, prompt: string, schema: Record<string, unknown>): Promise<T> {
  if (!hasAiKey()) throw new Error("Zum Auslesen braucht es einen ANTHROPIC_API_KEY.");
  const file: Anthropic.ContentBlockParam =
    upload.kind === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: upload.data } }
      : { type: "image", source: { type: "base64", media_type: upload.mediaType, data: upload.data } };
  try {
    // Streamed: the SDK refuses a non-streamed request whose max_tokens could
    // take longer than 10 minutes.
    const response = await client()
      .messages.stream({
        model: MODEL,
        max_tokens: 32000,
        output_config: { effort: "medium", format: { type: "json_schema", schema } },
        system,
        messages: [{ role: "user", content: [file, { type: "text", text: prompt }] }],
      })
      .finalMessage();
    if (response.stop_reason === "refusal") throw new Error("Die KI hat die Anfrage abgelehnt.");
    if (response.stop_reason !== "end_turn") throw new Error("Die KI hat keine vollständige Antwort geliefert.");
    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") throw new Error("Die KI hat keine Antwort geliefert.");
    return JSON.parse(text.text) as T;
  } catch (error) {
    throw new Error(aiError(error));
  }
}

const int = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

// --- Spielbericht ---------------------------------------------------------------

const setSchema = {
  type: "object",
  properties: {
    volle: { type: "integer" },
    abr: { type: "integer" },
    fe: { type: "integer", description: "Fehlwürfe (column Fe)" },
    ges: { type: "integer" },
    sp: { type: "number", description: "Satzpunkte (column SP): 0, 0.5 or 1" },
  },
  required: ["volle", "abr", "fe", "ges", "sp"],
  additionalProperties: false,
} as const;

const reportSchema = {
  type: "object",
  properties: {
    season: { type: "string", description: "e.g. '2026-27', empty if not printed" },
    matchday: { type: ["integer", "null"], description: "Spieltag number" },
    date: { type: ["string", "null"], description: "Match date as YYYY-MM-DD" },
    home: { type: "string", description: "Gastgeber / Heim team name" },
    guest: { type: "string", description: "Gast team name" },
    ourSide: { type: "string", enum: ["home", "guest", "unknown"] },
    players: {
      type: "array",
      description: "Only the players of OUR team, top to bottom",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "As printed, 'Surname, Firstname'" },
          sets: { type: "array", items: setSchema, description: "The 4 Sätze / Durchgänge, top to bottom" },
          volle: { type: "integer", description: "Printed total row" },
          abr: { type: "integer" },
          fe: { type: "integer" },
          ges: { type: "integer" },
          sp: { type: "number" },
          mp: { type: ["number", "null"], description: "Mannschaftspunkt of this player: 1, 0.5 or 0; null if not printed" },
          handMarks: { type: "string", description: "Handwritten letters or marks next to this player's name or block, e.g. 'M' (upper or lower case); empty if none" },
          substitute: { type: "boolean", description: "true if this player was substituted in during the match" },
        },
        required: ["name", "sets", "volle", "abr", "fe", "ges", "sp", "mp", "handMarks", "substitute"],
        additionalProperties: false,
      },
    },
    notes: { type: "string", description: "Anything unclear or unreadable, in German; empty if all is clear" },
  },
  required: ["season", "matchday", "date", "home", "guest", "ourSide", "players", "notes"],
  additionalProperties: false,
} as const;

const reportSystem = `You transcribe a German nine-pin bowling (Sportkegeln, 120 Wurf) match report ("Spielbericht", e.g. from the BSKV) from a photo or PDF.
Layout: the home team ("Gastgeber"/"Heim") is on the left, the guest team ("Gast") on the right. Each player has a block with 4 rows (Sätze/Durchgänge, 30 throws each) and a bold total row. Left blocks read: Volle, Abr, Fe, Ges, SP, MP. Right blocks are mirrored: MP, SP, Ges, Fe, Abr, Volle. MP (Mannschaftspunkt, 1, 0.5 or 0) is printed once per player, in the middle of the block.
Return only the players of the team the user names. Read every digit carefully: per set Volle + Abr = Ges, and the total row is the sum of the sets; use that to check yourself, but transcribe what is printed. Handwritten additions (like an "M" next to a name) belong in handMarks. If a block lists two players because of a substitution, return both: the starting player with the block's figures and the substitute with sets [] and zeros, substitute true.
Ignore the opponent's players and the report's footer.`;

type RawReport = {
  season: string;
  matchday: number | null;
  date: string | null;
  home: string;
  guest: string;
  ourSide: string;
  players: {
    name: string;
    sets: { volle: number; abr: number; fe: number; ges: number; sp: number }[];
    volle: number;
    abr: number;
    fe: number;
    ges: number;
    sp: number;
    mp: number | null;
    handMarks: string;
    substitute: boolean;
  }[];
  notes: string;
};

export async function readReport(upload: Upload, team: string): Promise<Report> {
  const raw = await ask<RawReport>(
    upload,
    reportSystem,
    `Our team's name contains "${team}". Transcribe the report for our team.`,
    reportSchema,
  );
  const warnings: string[] = [];
  if (text(raw.notes, 400)) warnings.push(text(raw.notes, 400));
  const players: ReportPlayer[] = (Array.isArray(raw.players) ? raw.players : []).slice(0, 12).map((player) => {
    const name = text(player.name, 80) || "Unbekannt";
    const sets = (Array.isArray(player.sets) ? player.sets : []).slice(0, 4).map((set) => ({
      volle: int(set.volle),
      abr: int(set.abr),
      fe: int(set.fe),
      ges: int(set.ges),
      sp: Number(set.sp) || 0,
    }));
    // The printed totals count; the sets are only there to check them.
    if (sets.length > 0) {
      const fe = sets.reduce((sum, set) => sum + set.fe, 0);
      const ges = sets.reduce((sum, set) => sum + set.ges, 0);
      if (fe !== int(player.fe)) warnings.push(`${name}: Fehler der Sätze ergeben ${fe}, in der Summe steht ${int(player.fe)}.`);
      if (ges !== int(player.ges)) warnings.push(`${name}: Sätze ergeben ${ges} Kegel, in der Summe steht ${int(player.ges)}.`);
      sets.forEach((set, index) => {
        if (set.volle + set.abr !== set.ges) warnings.push(`${name}, Satz ${index + 1}: ${set.volle} + ${set.abr} ist nicht ${set.ges}.`);
      });
    }
    const mp = player.mp === null || player.mp === undefined ? null : Number(player.mp);
    return {
      name,
      sets,
      errors: int(player.fe),
      total: int(player.ges),
      mp: mp === null || ![0, 0.5, 1].includes(mp) ? null : mp,
      // A handwritten "M" next to the name marks a Maß.
      mass: /\bm\b/i.test(text(player.handMarks, 40)),
      substitute: player.substitute === true,
    };
  });
  if (players.length === 0) warnings.push(`Keine Spieler von „${team}“ gefunden.`);
  const date = typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null;
  const matchday = Number.isInteger(raw.matchday) && (raw.matchday as number) > 0 && (raw.matchday as number) < 100 ? raw.matchday : null;
  return {
    season: text(raw.season, 20),
    matchday,
    date,
    home: text(raw.home, 120),
    guest: text(raw.guest, 120),
    ourSide: raw.ourSide === "home" || raw.ourSide === "guest" ? raw.ourSide : "unknown",
    players,
    warnings,
  };
}

// --- Wurfschein -----------------------------------------------------------------

const sheetSchema = {
  type: "object",
  properties: {
    sheets: {
      type: "array",
      description: "One entry per player sheet in the document",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Player name as printed" },
          sets: {
            type: "array",
            description: "The Sätze top to bottom (usually 4)",
            items: {
              type: "object",
              properties: {
                throws: { type: "array", items: { type: "integer" }, description: "The 30 bold results in throw order 1..30; a Fehlwurf (F) is 0" },
                volle: { type: ["integer", "null"], description: "Printed 'Volle (15)' value of this Satz" },
                abraeumer: { type: ["integer", "null"], description: "Printed 'Abräumer (15)' value" },
                gesamt: { type: ["integer", "null"], description: "Printed 'Gesamt' of this Satz" },
              },
              required: ["throws", "volle", "abraeumer", "gesamt"],
              additionalProperties: false,
            },
          },
        },
        required: ["name", "sets"],
        additionalProperties: false,
      },
    },
  },
  required: ["sheets"],
  additionalProperties: false,
} as const;

const sheetSystem = `You transcribe German nine-pin bowling throw sheets ("Wurfschein", e.g. printed by CCKv2) from a photo or PDF.
Each sheet belongs to one player (name at the top) and has 4 Sätze. Each Satz has a header (Satz n, Bahn, Volle (15), Abräumer (15), Fehlwurf, Gesamt) and 30 throws in two rows of 15: throws 1-15 are "in die Vollen", 16-30 "Abräumen". Under each pin diagram is a small grey throw number and a bold result (0-9); a diagram marked F is a Fehlwurf with result 0.
Return the bold results in order. Check yourself: throws 1-15 add up to Volle, throws 16-30 to Abräumer. Parts of the paper may be in shadow; read them carefully.`;

export async function readThrowSheets(upload: Upload): Promise<ThrowSheet[]> {
  const raw = await ask<{ sheets: { name: string; sets: SheetSet[] }[] }>(
    upload,
    sheetSystem,
    "Transcribe every player sheet in this document.",
    sheetSchema,
  );
  const nullable = (value: unknown) => (value === null || value === undefined ? null : int(value));
  return (Array.isArray(raw.sheets) ? raw.sheets : []).slice(0, 12).map((sheet) => ({
    name: text(sheet.name, 80),
    sets: (Array.isArray(sheet.sets) ? sheet.sets : []).slice(0, 4).map((set) => ({
      throws: (Array.isArray(set.throws) ? set.throws : []).slice(0, 30).map((pins) => Math.min(9, int(pins))),
      volle: nullable(set.volle),
      abraeumer: nullable(set.abraeumer),
      gesamt: nullable(set.gesamt),
    })),
  }));
}
