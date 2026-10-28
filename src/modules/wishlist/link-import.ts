// Server-only: turns a shop link into a prefilled wish. Loads the page, reads
// what shops publish for link previews (Open Graph, JSON-LD Product), and lets
// Claude Haiku pick title, price, image and a short note from it. Shops that
// block servers (Amazon often does) leave only the URL and whatever text was
// shared with it (the Amazon app shares "<title> https://amzn.eu/d/…"), from
// which Haiku takes the title; the owner reviews everything before saving.
import Anthropic from "@anthropic-ai/sdk";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { amazonAsin, cleanAmazonUrl, isAmazon, isAmazonShortLink, withoutAffiliate } from "./amazon";
import { cleanWish, httpUrl, parsePrice, type WishFields, type WishInput } from "./data";

const MODEL = "claude-haiku-5-5";
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 8000;

export type LinkResult = { wish: WishInput; images: string[]; warning: string | null };

// --- Fetching -------------------------------------------------------------------

function privateAddress(address: string) {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith("::ffff:")) return privateAddress(lower.slice(7));
    return lower === "::1" || lower === "::" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
  }
  const [a, b] = address.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  );
}

// Only public hosts: the server must not be usable to reach its own network.
async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) throw new Error("blocked host");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => privateAddress(address))) throw new Error("blocked host");
}

// trail collects every URL on the way, so a short link that redirects to a
// blocked page still tells us where it led.
async function fetchPage(start: string, trail: string[]) {
  let url = new URL(start);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  // Redirects are followed by hand so every hop is checked.
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(url);
    trail.push(url.toString());
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.6",
      },
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!(response.headers.get("content-type") ?? "").includes("html")) throw new Error("not html");

    const reader = response.body?.getReader();
    if (!reader) throw new Error("empty");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    const html = new TextDecoder().decode(Buffer.concat(chunks));
    // Amazon answers servers with a captcha page (status 200).
    if (isAmazon(url.toString()) && /validateCaptcha|api-services-support@amazon/i.test(html)) throw new Error("captcha");
    return { html, url: url.toString() };
  }
  throw new Error("too many redirects");
}

// --- Reading the page ---------------------------------------------------------

function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? decodeEntities(match[2] ?? match[3] ?? match[4] ?? "").trim() : null;
}

// <meta property|name="…" content="…"> as a map (first value wins).
function metaTags(html: string) {
  const meta = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (attribute(tag, "property") ?? attribute(tag, "name") ?? attribute(tag, "itemprop"))?.toLowerCase();
    const content = attribute(tag, "content");
    if (key && content && !meta.has(key)) meta.set(key, content);
  }
  return meta;
}

type Product = { name?: string; price?: string; currency?: string; images: string[]; description?: string };

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function imageUrls(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((entry) => (typeof entry === "string" ? entry : (entry as { url?: unknown; contentUrl?: unknown })?.url ?? (entry as { contentUrl?: unknown })?.contentUrl))
    .filter((entry): entry is string => typeof entry === "string");
}

// The first schema.org Product in the page's JSON-LD blocks.
function jsonLdProduct(html: string): Product | null {
  const queue: unknown[] = [];
  for (const [, body] of html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      queue.push(JSON.parse(body.trim()));
    } catch {
      // Broken JSON-LD is common; skip it.
    }
  }
  for (let index = 0; index < queue.length && index < 500; index++) {
    const node = queue[index];
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    if (!node || typeof node !== "object") continue;
    const record = node as Record<string, unknown>;
    if (record["@graph"]) queue.push(record["@graph"]);
    const types = [record["@type"]].flat().map(String);
    if (!types.includes("Product") && !types.includes("ProductGroup")) continue;
    const offer = first(record.offers) as Record<string, unknown> | undefined;
    const price = offer?.price ?? offer?.lowPrice ?? (first(offer?.priceSpecification) as Record<string, unknown>)?.price;
    return {
      name: typeof record.name === "string" ? record.name : undefined,
      price: price !== undefined ? String(price) : undefined,
      currency: typeof offer?.priceCurrency === "string" ? offer.priceCurrency : undefined,
      images: imageUrls(record.image),
      description: typeof record.description === "string" ? record.description : undefined,
    };
  }
  return null;
}

function visibleText(html: string) {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function readPage(html: string, pageUrl: string) {
  const meta = metaTags(html);
  const product = jsonLdProduct(html);
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const absolute = (value: string | undefined | null) => {
    if (!value) return null;
    try {
      return httpUrl(new URL(value, pageUrl).toString());
    } catch {
      return null;
    }
  };
  // Amazon has no JSON-LD; its main image and title have fixed ids.
  const landing = html.match(/<img\b[^>]*id\s*=\s*["']landingImage["'][^>]*>/i)?.[0];
  const amazonTitle = html.match(/id\s*=\s*["']productTitle["'][^>]*>([\s\S]*?)</i)?.[1];
  const images = [
    ...(product?.images ?? []),
    landing ? attribute(landing, "data-old-hires") || attribute(landing, "src") : null,
    meta.get("og:image:secure_url"),
    meta.get("og:image"),
    meta.get("twitter:image"),
    meta.get("image"),
  ]
    .map(absolute)
    .filter((image): image is string => image !== null);

  return {
    facts: {
      url: pageUrl,
      pageTitle: title || null,
      productTitle: amazonTitle ? decodeEntities(amazonTitle).replace(/\s+/g, " ").trim() || null : null,
      ogTitle: meta.get("og:title") ?? null,
      ogDescription: meta.get("og:description") ?? meta.get("description") ?? null,
      metaPrice: meta.get("product:price:amount") ?? meta.get("og:price:amount") ?? meta.get("price") ?? null,
      metaCurrency: meta.get("product:price:currency") ?? meta.get("og:price:currency") ?? meta.get("pricecurrency") ?? null,
      product,
    },
    images: [...new Set(images)].slice(0, 8),
    text: visibleText(html).slice(0, 6000),
  };
}

// --- Asking Claude ---------------------------------------------------------------

const schema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short product name in German, without shop name or marketing text" },
    price: { type: ["number", "null"], description: "Current price as a number, null if unknown" },
    currency: { type: "string", description: "ISO 4217 code, e.g. EUR" },
    image_url: { type: ["string", "null"], description: "One of the candidate image URLs, null if none fits" },
    note: { type: "string", description: "Optional: one short German line on variant/size/color, else empty" },
  },
  required: ["title", "price", "currency", "image_url", "note"],
  additionalProperties: false,
} as const;

type Answer = { title: string; price: number | null; currency: string; image_url: string | null; note: string };

async function askClaude(input: string): Promise<Answer | null> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system:
      "You fill in one entry of a personal wishlist from a shop page. Use only facts from the page data. " +
      "Never invent a price or an image: use null when the data doesn't show it. " +
      "If only the URL is available, derive the product name from the shared text or the URL path and leave price and image null.",
    messages: [{ role: "user", content: input }],
  });
  if (response.stop_reason !== "end_turn") return null;
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") return null;
  try {
    return JSON.parse(text.text) as Answer;
  } catch {
    return null;
  }
}

// The page's own data, for when no API key is set or the AI fails.
function fromFacts(facts: ReturnType<typeof readPage>["facts"], images: string[]): WishFields {
  return {
    title: facts.product?.name ?? facts.productTitle ?? facts.ogTitle ?? facts.pageTitle ?? "",
    price: parsePrice(facts.product?.price ?? facts.metaPrice ?? ""),
    currency: facts.product?.currency ?? facts.metaCurrency ?? "EUR",
    imageUrl: images[0] ?? null,
  };
}

function titleFromUrl(url: string) {
  const { hostname, pathname } = new URL(url);
  const words = pathname
    .split("/")
    .map((part) => decodeURIComponent(part).replace(/\.\w+$/, ""))
    .filter((part) => /[a-z]{3}/i.test(part) && !/^(dp|p|product|products|artikel|item|gp)$/i.test(part))
    .sort((a, b) => b.length - a.length)[0];
  return words ? words.replace(/[-_+]+/g, " ").trim() : hostname.replace(/^www\./, "");
}

// Where an Amazon short link leads. amzn.to links from SiteStripe carry the
// creator's partner tag, so they are expanded (and cleaned) before saving.
export async function expandShortLink(url: string) {
  if (!isAmazonShortLink(url)) return url;
  let current = new URL(url);
  try {
    for (let hop = 0; hop < 5 && !isAmazon(current.toString()); hop++) {
      await assertPublicHost(current);
      const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) break;
      current = new URL(location, current);
    }
  } catch {
    // Unreachable: keep the short link out rather than an unknown tag.
  }
  return isAmazon(current.toString()) ? withoutAffiliate(current.toString()) : null;
}

// Amazon's product photo by ASIN. Amazon answers unknown ones with a tiny
// placeholder GIF, so only a real JPEG counts.
async function amazonImage(asin: string) {
  const url = `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_.jpg`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("jpeg")) return null;
    return (await response.arrayBuffer()).byteLength > 1000 ? url : null;
  } catch {
    return null;
  }
}

// input is a link or a whole shared text ("Schau dir das an: … https://…").
export async function analyzeLink(input: string): Promise<LinkResult> {
  const found = input.match(/https?:\/\/[^\s<>"]+/i)?.[0].replace(/[.,;:!?)\]]+$/, "");
  let url = httpUrl(found ?? input);
  if (!url) throw new Error("Das ist kein gültiger Link.");
  const shared = found ? input.replace(found, " ").replace(/\s+/g, " ").replace(/[\s.,;:]+$/, "").trim().slice(0, 500) : "";

  let page: ReturnType<typeof readPage> | null = null;
  const trail: string[] = [];
  try {
    const { html, url: finalUrl } = await fetchPage(url, trail);
    page = readPage(html, finalUrl);
  } catch {
    page = null;
  }
  // Where a short link led, even if that page was blocked.
  const landed = page?.facts.url ?? trail[trail.length - 1] ?? url;
  if (isAmazon(landed)) url = cleanAmazonUrl(landed);
  else if (isAmazonShortLink(url)) url = (await expandShortLink(url)) ?? url;

  const asin = amazonAsin(url);
  const images = page?.images ?? [];
  if (asin && images.length === 0) {
    const image = await amazonImage(asin);
    if (image) images.push(image);
  }

  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  let answer: Answer | null = null;
  if (hasKey) {
    const sharedText = shared ? `\n\nText shared together with the link:\n${shared}` : "";
    const input = page
      ? `Page data:\n${JSON.stringify(page.facts, null, 1)}\n\nCandidate images:\n${images.join("\n") || "(none)"}${sharedText}\n\nPage text (start):\n${page.text}`
      : `The shop could not be loaded. Only the URL is known:\n${url}${sharedText}`;
    try {
      answer = await askClaude(input);
    } catch (error) {
      console.error("Wishlist AI import failed", error);
    }
  }

  const base = page ? fromFacts(page.facts, images) : { title: shared || titleFromUrl(url), imageUrl: images[0] ?? null };
  // The AI may only pick an image the page really had.
  const aiImage = answer?.image_url && images.includes(answer.image_url) ? answer.image_url : null;
  const wish = cleanWish({
    ...base,
    ...(answer && {
      title: answer.title || base.title,
      price: answer.price ?? base.price ?? null,
      currency: answer.currency || base.currency,
      imageUrl: aiImage ?? base.imageUrl ?? null,
      note: answer.note,
    }),
    url,
  }) ?? cleanWish({ title: titleFromUrl(url), url })!;

  const missing = wish.imageUrl ? "den Preis" : "Preis und Bild";
  const warning = !page
    ? asin
      ? `Amazon gibt die Seite nicht an Server heraus. Bitte ${missing} ergänzen, am einfachsten mit einem Screenshot aus der Amazon-App.`
      : `Der Shop hat die Seite nicht herausgegeben. Bitte ${missing} selbst ergänzen.`
    : !hasKey
      ? "Kein ANTHROPIC_API_KEY gesetzt: nur die Vorschau-Daten der Seite übernommen."
      : !answer
        ? "Die KI hat nicht geantwortet: nur die Vorschau-Daten der Seite übernommen."
        : null;

  return { wish, images, warning };
}
