// Server only: the two AI jobs of the Mülltrenn-Hilfe.
//
// 1. lookUpRules: what a municipality does differently from the national
//    baseline. Claude researches with web search first (free text with
//    sources), then a second call turns that into LocalRules. Two steps,
//    because structured outputs can't be combined with the citations that web
//    search returns.
// 2. classify: a photo and/or a description → which bin, split into parts.
import Anthropic from "@anthropic-ai/sdk";
import {
  baseBins,
  binIds,
  containers,
  rulesForPrompt,
  type EffectiveBin,
  type LocalRules,
  type Source,
  type Verdict,
} from "./bins";
import type { PlaceCandidate } from "./geocode";

const MODEL = "claude-opus-5-5";
// On a refusal, the API re-runs the request on a fallback model by itself.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

const client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const hasAiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

// What a request cost, from the usage the API reports, in US dollars (the API
// bills in dollars). Claude Opus 5.5 list prices per million tokens; web
// search is $10 per 1,000 searches. Thinking counts as output. If a refusal
// was answered by a fallback model, its price may differ a little, so this
// is an estimate ("ca.") rather than the invoice.
const PRICE = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2, search: 0.01 };

export function costOf(usage: Anthropic.Beta.BetaUsage) {
  const tokens =
    usage.input_tokens * PRICE.input +
    usage.output_tokens * PRICE.output +
    (usage.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
    (usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead;
  return tokens / 1_000_000 + (usage.server_tool_use?.web_search_requests ?? 0) * PRICE.search;
}

// German message for a failed request.
function aiError(error: unknown) {
  if (error instanceof Anthropic.RateLimitError) return "Die KI ist gerade ausgelastet. Versuch es gleich noch einmal.";
  if (error instanceof Anthropic.BadRequestError) {
    console.error("Waste AI request rejected:", error.message);
    return `Die KI hat die Anfrage abgelehnt (400: ${error.message.slice(0, 200)}).`;
  }
  if (error instanceof Anthropic.APIError) return `Die KI ist nicht erreichbar (${error.status ?? "Fehler"}).`;
  if (error instanceof SyntaxError) return "Die Antwort der KI war unvollständig.";
  if (error instanceof Error) return error.message;
  return "Die KI ist nicht erreichbar.";
}

function parseJson<T>(response: Anthropic.Beta.BetaMessage): T {
  if (response.stop_reason === "refusal") throw new Error("Die KI hat die Anfrage abgelehnt.");
  if (response.stop_reason !== "end_turn") throw new Error("Die KI hat keine vollständige Antwort geliefert.");
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("Die KI hat keine Antwort geliefert.");
  return JSON.parse(text.text) as T;
}

// --- Local rules ----------------------------------------------------------------

const baselineSummary = Object.values(baseBins)
  .map((bin) => `- ${bin.id} (${bin.name}): ${bin.yes.join("; ")}${bin.no.length ? ` | not: ${bin.no.join("; ")}` : ""}`)
  .join("\n");

const researchSystem = `You research the household waste separation rules of one German municipality for an app that tells residents which bin a thing goes in.
The app already knows the national baseline below. Find out what this municipality does differently or specifically, using the official website of the responsible waste authority (Abfallwirtschaftsbetrieb, Landratsamt, Stadtreinigung, Zweckverband) first, then its Abfall-ABC, A-Z list or app.

National baseline:
${baselineSummary}

Report, in German, as a concise fact list:
- Which authority is responsible, and its website.
- Packaging/Wertstoffe: Gelber Sack, Gelbe Tonne or Wertstofftonne? With a Wertstofftonne, which non-packaging plastics/metals are allowed (e.g. Spielzeug, Töpfe, Elektrokleingeräte)?
- Biotonne: does it exist (everywhere or on request)? Cooked food, meat/fish, bones, bread, kitchen paper, newspaper wrapping, paper bags, "compostable" bags allowed?
- Paper: Papiertonne, bundles or Papiersack? Anything special?
- Glass: containers, colours, special rules.
- Restmüll specifics (e.g. Windelsack, Banderole).
- Altkleider, Elektrokleingeräte, Batterien: where?
- Wertstoffhof/Recyclinghof (name of the nearest or main one), Schadstoffmobil/Problemstoffsammlung.
Only state what the sources say. Write "unbekannt" where you couldn't find something. Don't repeat the baseline where the municipality does the same.`;

const localBinSchema = {
  type: "object",
  properties: {
    id: { type: "string", enum: binIds },
    available: { type: "boolean", description: "false only if the municipality has no such collection (e.g. no Biotonne)" },
    localName: { type: "string", description: "Local name, e.g. 'Wertstofftonne', 'Gelber Sack', 'Recyclinghof Weißenhorn'; empty = baseline name" },
    container: { type: "string", enum: [...containers, ""], description: "How it is collected; empty = like the baseline" },
    extraYes: { type: "array", items: { type: "string" }, description: "Locally allowed in addition to the baseline (short German items)" },
    extraNo: { type: "array", items: { type: "string" }, description: "Locally not allowed although the baseline allows it" },
    note: { type: "string", description: "One short German sentence of local specifics, or empty" },
  },
  required: ["id", "available", "localName", "container", "extraYes", "extraNo", "note"],
  additionalProperties: false,
} as const;

const localRulesSchema = {
  type: "object",
  properties: {
    authority: { type: "string", description: "Responsible waste authority, empty if unknown" },
    authorityUrl: { type: ["string", "null"], description: "Its website, null if unknown" },
    summary: { type: "string", description: "Two German sentences: the most important local specifics" },
    bins: { type: "array", items: localBinSchema, description: "One entry per bin id that differs from the baseline or has a local name" },
    notes: { type: "array", items: { type: "string" }, description: "Other short German notes residents should know" },
  },
  required: ["authority", "authorityUrl", "summary", "bins", "notes"],
  additionalProperties: false,
} as const;

function httpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function cleanRules(input: LocalRules): LocalRules {
  const list = (items: unknown) =>
    (Array.isArray(items) ? items : [])
      .map((item) => String(item).trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 20);
  const seen = new Set<string>();
  return {
    authority: String(input.authority ?? "").trim().slice(0, 200),
    authorityUrl: httpUrl(input.authorityUrl),
    summary: String(input.summary ?? "").trim().slice(0, 600),
    bins: (Array.isArray(input.bins) ? input.bins : [])
      .filter((bin) => (binIds as readonly string[]).includes(bin.id) && !seen.has(bin.id) && seen.add(bin.id))
      .map((bin) => ({
        id: bin.id,
        available: bin.available !== false,
        localName: String(bin.localName ?? "").trim().slice(0, 80),
        container: (containers as readonly string[]).includes(bin.container) ? bin.container : "",
        extraYes: list(bin.extraYes),
        extraNo: list(bin.extraNo),
        note: String(bin.note ?? "").trim().slice(0, 300),
      })),
    notes: list(input.notes),
  };
}

export async function lookUpRules(place: PlaceCandidate): Promise<{ rules: LocalRules; sources: Source[]; costUsd: number }> {
  if (!hasAiKey()) throw new Error("Für die lokalen Regeln braucht es einen ANTHROPIC_API_KEY.");
  const where = `${place.name}${place.postcode ? ` (${place.postcode})` : ""}, ${place.district === place.name ? "kreisfreie Stadt" : `Landkreis ${place.district}`}, ${place.state}`;
  try {
    // Step 1: research. A long search may pause; the turn is sent back as is
    // and the server continues it.
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: `Municipality: ${where}, Germany. What are its waste separation rules?` },
    ];
    // A continued turn returns only the new blocks, so the text and citations
    // of every round are collected.
    let research: Anthropic.Beta.BetaMessage | null = null;
    const blocks: Anthropic.Beta.BetaContentBlock[] = [];
    let costUsd = 0;
    for (let round = 0; round < 4; round++) {
      research = await client().beta.messages.create({
        ...FALLBACK,
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: "medium" },
        system: researchSystem,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 8, user_location: { type: "approximate", country: "DE" } },
        ],
        messages,
      });
      blocks.push(...research.content);
      costUsd += costOf(research.usage);
      if (research.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: research.content });
    }
    if (!research || research.stop_reason === "refusal") throw new Error("Die KI hat die Recherche abgelehnt.");
    if (research.stop_reason === "pause_turn") throw new Error("Die Recherche hat zu lange gedauert.");
    const findings = blocks
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    if (!findings) throw new Error("Die Recherche hat nichts ergeben.");

    // Sources: what the findings cite, else the first search results.
    const sources = new Map<string, Source>();
    for (const block of blocks) {
      if (block.type !== "text") continue;
      for (const citation of block.citations ?? []) {
        if (citation.type === "web_search_result_location" && httpUrl(citation.url)) {
          sources.set(citation.url, { title: citation.title ?? citation.url, url: citation.url });
        }
      }
    }
    if (sources.size === 0) {
      for (const block of blocks) {
        if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
        for (const result of block.content.slice(0, 3)) {
          if (httpUrl(result.url)) sources.set(result.url, { title: result.title || result.url, url: result.url });
        }
      }
    }

    // Step 2: the findings as LocalRules.
    const structured = await client().beta.messages.create({
      ...FALLBACK,
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low", format: { type: "json_schema", schema: localRulesSchema } },
      system:
        "You turn research notes about one German municipality's waste rules into the app's data format. " +
        "Only include bins that differ from the national baseline or have a local name. Use 'available: false' only when the notes say the collection doesn't exist there. " +
        "Ignore anything the notes mark as unknown. All text in German, short items like in the baseline.\n\nNational baseline:\n" +
        baselineSummary,
      messages: [{ role: "user", content: `Municipality: ${where}\n\nResearch notes:\n${findings}` }],
    });
    costUsd += costOf(structured.usage);
    return { rules: cleanRules(parseJson<LocalRules>(structured)), sources: [...sources.values()].slice(0, 8), costUsd };
  } catch (error) {
    throw new Error(aiError(error));
  }
}

// --- Classification -------------------------------------------------------------

const partSchema = {
  type: "object",
  properties: {
    part: { type: "string", description: "The part in German, e.g. 'Aludeckel'" },
    bin: { type: "string", enum: binIds },
    hint: { type: "string", description: "Short German instruction, e.g. 'abziehen', or empty" },
  },
  required: ["part", "bin", "hint"],
  additionalProperties: false,
} as const;

const verdictSchema = {
  type: "object",
  properties: {
    recognized: { type: "boolean", description: "false if no disposable thing can be made out" },
    item: { type: "string", description: "Short German name of the thing, e.g. 'Joghurtbecher mit Aludeckel'" },
    description: {
      type: "string",
      description:
        "1-2 German sentences describing what you see (object, material, colour, labels, state such as empty/dirty), so the user can check you looked at the right thing",
    },
    confidence: { type: "string", enum: ["sicher", "wahrscheinlich", "unsicher"] },
    bin: { type: "string", enum: binIds, description: "Where the thing as a whole (or its main part) goes" },
    parts: {
      type: "array",
      items: partSchema,
      description: "Only if the thing should be split into parts going to different bins; else empty",
    },
    tips: { type: "array", items: { type: "string" }, description: "0-3 short German tips, e.g. 'Ausleeren, nicht spülen'" },
    check: {
      type: "string",
      description: "If not 'sicher': what the user should check and where it goes then, e.g. 'Wenn innen beschichtet → Restmüll'. Else empty",
    },
    hazard: { type: "boolean", description: "Battery, rechargeable, chemicals, paint, spray can with contents, mercury, sharp, etc." },
    hazardNote: { type: "string", description: "If hazard: one German warning sentence, else empty" },
  },
  required: ["recognized", "item", "description", "confidence", "bin", "parts", "tips", "check", "hazard", "hazardNote"],
  additionalProperties: false,
} as const;

const classifySystem = `You help a resident in Germany sort household waste correctly. You get a photo and/or a description of one thing and the waste rules of the resident's municipality (national baseline merged with local differences).
- First describe what you see, factually, so the resident can check you recognized the right thing.
- Decide by material and the local rules. Bins marked NOT AVAILABLE must not be used; pick the local alternative (often Restmüll).
- Split into parts when the parts belong in different bins (lid, sleeve, cup; batteries in a toy). The main bin is where most of it goes.
- Packaging ("Verpackung") goes in gelb only if it is packaging; non-packaging plastics go in gelb only where the local rules say so (Wertstofftonne).
- Batteries, rechargeables, electronics, chemicals, paint, spray cans with contents and the like: never household bins; set hazard and say why.
- Pfand bottles/cans: handel.
- Be honest about uncertainty: "unsicher" when the photo is blurry or the material can't be told, and say in check what decides it.
- If the resident corrected your earlier description, trust their correction about what the thing is.`;

export type ClassifyInput = {
  image: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" } | null;
  text: string;
  correction: string;
  previousDescription: string;
  bins: EffectiveBin[];
  rules: LocalRules | null;
  placeName: string;
};

export async function classify(input: ClassifyInput): Promise<{ verdict: Verdict; costUsd: number }> {
  if (!hasAiKey()) throw new Error("Für die Erkennung braucht es einen ANTHROPIC_API_KEY.");
  const lines = [
    `Municipality: ${input.placeName}`,
    `Waste rules there:\n${rulesForPrompt(input.bins, input.rules)}`,
    input.text && `The resident's description: ${input.text}`,
    input.previousDescription && `Your earlier description of the photo: ${input.previousDescription}`,
    input.correction && `The resident's correction: ${input.correction}`,
    input.image ? "Which bin does the thing in the photo go in?" : "Which bin does this thing go in?",
  ].filter(Boolean);
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) content.push({ type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.data } });
  content.push({ type: "text", text: lines.join("\n\n") });

  let answer: Verdict;
  let costUsd = 0;
  try {
    const response = await client().beta.messages.create({
      ...FALLBACK,
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: verdictSchema } },
      system: classifySystem,
      messages: [{ role: "user", content }],
    });
    costUsd = costOf(response.usage);
    answer = parseJson<Verdict>(response);
  } catch (error) {
    throw new Error(aiError(error));
  }
  return { verdict: cleanVerdict(answer), costUsd };
}

const isBin = (value: unknown): value is (typeof binIds)[number] => (binIds as readonly unknown[]).includes(value);

function cleanVerdict(answer: Verdict): Verdict {
  const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
  return {
    recognized: answer.recognized !== false,
    item: text(answer.item, 120) || "Unbekannter Gegenstand",
    description: text(answer.description, 600),
    confidence: ["sicher", "wahrscheinlich", "unsicher"].includes(answer.confidence) ? answer.confidence : "unsicher",
    bin: isBin(answer.bin) ? answer.bin : "rest",
    parts: (Array.isArray(answer.parts) ? answer.parts : [])
      .filter((part) => isBin(part.bin) && text(part.part, 80))
      .slice(0, 8)
      .map((part) => ({ part: text(part.part, 80), bin: part.bin, hint: text(part.hint, 160) })),
    tips: (Array.isArray(answer.tips) ? answer.tips : []).map((tip) => text(tip, 160)).filter(Boolean).slice(0, 4),
    check: text(answer.check, 300),
    hazard: answer.hazard === true,
    hazardNote: text(answer.hazardNote, 300),
  };
}
