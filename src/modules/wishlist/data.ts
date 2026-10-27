// Shared types and helpers of the wishlist (no server or client APIs here).

export type Wish = {
  id: string;
  title: string;
  url: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string;
  note: string;
  quantity: number;
  favorite: boolean;
};

export type WishInput = Omit<Wish, "id">;

export const wishColumns = "id, title, url, image_url, price, currency, note, quantity, favorite";

export type WishRow = {
  id: string;
  title: string;
  url: string | null;
  image_url: string | null;
  price: number | string | null;
  currency: string;
  note: string;
  quantity: number;
  favorite: boolean;
};

export function toWish(row: WishRow): Wish {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    imageUrl: row.image_url,
    // numeric comes back as a string from PostgREST.
    price: row.price === null ? null : Number(row.price),
    currency: row.currency,
    note: row.note,
    quantity: row.quantity,
    favorite: row.favorite,
  };
}

// Herzenswünsche first, then the newest.
export function sortWishes<T extends { favorite: boolean }>(wishes: T[]) {
  return [...wishes].sort((a, b) => Number(b.favorite) - Number(a.favorite));
}

export function formatPrice(price: number | null, currency: string) {
  if (price === null) return null;
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency}`;
  }
}

// "29,99", "1.299,00 €", "29.99" → number. Empty or unreadable → null.
export function parsePrice(value: string): number | null {
  let text = value.replace(/[^\d.,]/g, "");
  if (!text) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) text = text.replace(/\./g, "").replace(",", ".");
  else text = text.replace(/,/g, "");
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 && number < 1e8 ? Math.round(number * 100) / 100 : null;
}

export function httpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString().slice(0, 2000) : null;
  } catch {
    return null;
  }
}

export type WishFields = Partial<Record<keyof WishInput, unknown>>;

// Validates whatever comes from a form or the AI into a storable wish.
export function cleanWish(input: WishFields): WishInput | null {
  const title = String(input.title ?? "").trim().slice(0, 200);
  if (!title) return null;
  const price = typeof input.price === "number" ? input.price : parsePrice(String(input.price ?? ""));
  const currency = String(input.currency ?? "EUR").trim().toUpperCase();
  const quantity = Math.round(Number(input.quantity ?? 1));
  return {
    title,
    url: httpUrl(input.url),
    imageUrl: httpUrl(input.imageUrl),
    price: price !== null && Number.isFinite(price) && price >= 0 && price < 1e8 ? Math.round(price * 100) / 100 : null,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "EUR",
    note: String(input.note ?? "").trim().slice(0, 1000),
    quantity: Number.isFinite(quantity) ? Math.min(99, Math.max(1, quantity)) : 1,
    favorite: input.favorite === true,
  };
}

export function toRow(wish: WishInput) {
  return {
    title: wish.title,
    url: wish.url,
    image_url: wish.imageUrl,
    price: wish.price,
    currency: wish.currency,
    note: wish.note,
    quantity: wish.quantity,
    favorite: wish.favorite,
  };
}

// --- Share links --------------------------------------------------------------

// Same format as private.wishlist_share_token() in the database: 10 of 32
// characters that can't be mixed up. Old links are UUIDs and keep working.
const TOKEN_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";

export function newShareToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (byte) => TOKEN_ALPHABET[byte % 32]).join("");
}

export const isShareToken = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-z-]{10,36}$/.test(value);

// --- Reservations -------------------------------------------------------------

// What a guest sees of one reservation. mine = made from this browser.
// The owner never sees reservations (only the givers' names once received).
export type GuestClaim = {
  id: string;
  mine: boolean;
  names: string[];
};

export function displayName(name: string) {
  return name.trim() || "Jemand";
}

export function joinNames(names: string[]) {
  const list = names.map(displayName);
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} und ${list[list.length - 1]}`;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${date.slice(0, 10)}T12:00:00`),
  );
}
