// Server-only: turns a screenshot of a product (e.g. from the Amazon app or
// Instagram) into a prefilled wish. Claude Haiku reads title, price and shop
// from the picture and points at the product photo in it; the browser crops
// that spot as the wish's image, and the owner can move the crop.
import Anthropic from "@anthropic-ai/sdk";
import { amazonSearchUrl } from "./amazon";
import { cleanWish, httpUrl, type WishInput } from "./data";

const MODEL = "claude-haiku-5-5";
export const SCREENSHOT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// The product photo, as fractions of the screenshot's width and height.
export type ImageBox = { x: number; y: number; width: number; height: number };
export type ScreenshotResult = { wish: WishInput; imageBox: ImageBox | null; warning: string | null };

const schema = {
  type: "object",
  properties: {
    is_product: { type: "boolean", description: "Whether the screenshot shows a product someone could wish for" },
    title: { type: "string", description: "Short product name in German, without shop name or marketing text" },
    price: { type: ["number", "null"], description: "Current price as a number, null if not visible" },
    currency: { type: "string", description: "ISO 4217 code, e.g. EUR" },
    shop: { type: "string", description: "Shop or app the screenshot is from, e.g. Amazon, Zalando; empty if unknown" },
    url: { type: ["string", "null"], description: "Product URL only if fully readable in the screenshot, else null" },
    note: { type: "string", description: "Optional: one short German line on the chosen variant/size/color, else empty" },
    image_box: {
      anyOf: [
        {
          type: "object",
          properties: {
            x: { type: "number", description: "Left edge, 0 = left border of the screenshot, 1 = right border" },
            y: { type: "number", description: "Top edge, 0 = top border, 1 = bottom border" },
            width: { type: "number", description: "Width as a fraction of the screenshot width" },
            height: { type: "number", description: "Height as a fraction of the screenshot height" },
          },
          required: ["x", "y", "width", "height"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
      description: "Tight box around the main product photo (not the whole page, no text or buttons), null if there is none",
    },
  },
  required: ["is_product", "title", "price", "currency", "shop", "url", "note", "image_box"],
  additionalProperties: false,
} as const;

type Answer = {
  is_product: boolean;
  title: string;
  price: number | null;
  currency: string;
  shop: string;
  url: string | null;
  note: string;
  image_box: ImageBox | null;
};

const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

function cleanBox(box: ImageBox | null): ImageBox | null {
  if (!box) return null;
  const x = clamp(box.x);
  const y = clamp(box.y);
  const width = clamp(box.width);
  const height = clamp(box.height);
  // A box that is tiny or covers almost everything isn't a product photo.
  if (width < 0.05 || height < 0.03 || width * height > 0.95) return null;
  return { x, y, width: Math.min(width, 1 - x), height: Math.min(height, 1 - y) };
}

export async function analyzeScreenshot(file: File): Promise<ScreenshotResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Für Screenshots braucht es einen ANTHROPIC_API_KEY.");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const response = await client.messages
    .create({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system:
      "You fill in one entry of a personal wishlist from a screenshot of a shop, app or social media post. " +
      "Use only what is visible. Never invent a price or a URL: use null when the screenshot doesn't show it.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: file.type as (typeof SCREENSHOT_TYPES)[number], data } },
          { type: "text", text: "Which product is this screenshot about?" },
        ],
      },
    ],
  })
    .catch((error) => {
      console.error("Wishlist screenshot import failed", error);
      throw new Error("Die KI hat nicht geantwortet. Bitte später noch einmal versuchen.");
    });
  const text = response.stop_reason === "end_turn" ? response.content.find((block) => block.type === "text") : undefined;
  let answer: Answer | null = null;
  try {
    answer = text?.type === "text" ? (JSON.parse(text.text) as Answer) : null;
  } catch {
    answer = null;
  }
  if (!answer) throw new Error("Die KI konnte den Screenshot nicht lesen.");

  const title = answer.title.trim() || "Neuer Wunsch";
  const amazon = /amazon/i.test(answer.shop);
  // Without a readable link, an Amazon search still gets guests to the product.
  const url = httpUrl(answer.url) ?? (amazon && answer.title.trim() ? amazonSearchUrl(answer.title) : null);
  const wish = cleanWish({
    title,
    price: answer.price,
    currency: answer.currency,
    note: answer.note,
    url,
  })!;
  const imageBox = cleanBox(answer.image_box);

  const warning = !answer.is_product
    ? "Auf dem Screenshot war kein Produkt zu erkennen. Bitte die Angaben prüfen."
    : !imageBox
      ? "Kein Produktbild gefunden. Du kannst selbst einen Ausschnitt wählen."
      : !httpUrl(answer.url) && amazon
        ? "Der Link führt zur Amazon-Suche. Für den genauen Artikel den Link aus der App einfügen."
        : null;
  return { wish, imageBox, warning };
}
