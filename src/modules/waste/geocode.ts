// Server only: finds German municipalities with OpenStreetMap's Nominatim
// (free, no key). Its usage policy asks for an identifying User-Agent and at
// most one request per second, so the app only asks on a button press, never
// while typing. https://operations.osmfoundation.org/policies/nominatim/

const BASE = "https://nominatim.openstreetmap.org";
const HEADERS = { "User-Agent": "PrivateLab-Muelltrenn-Hilfe/1.0", "Accept-Language": "de" };

// A municipality as the app stores it. district is the Landkreis, or the city
// itself for a kreisfreie Stadt.
export type PlaceCandidate = { name: string; district: string; state: string; postcode: string };

type NominatimAddress = Partial<
  Record<"city" | "town" | "village" | "municipality" | "hamlet" | "county" | "state" | "postcode" | "country_code", string>
>;
type NominatimResult = { address?: NominatimAddress };

function toCandidate(address: NominatimAddress | undefined): PlaceCandidate | null {
  if (!address || address.country_code !== "de") return null;
  const name = address.city ?? address.town ?? address.village ?? address.municipality ?? address.hamlet;
  if (!name) return null;
  // Berlin, Hamburg and Bremen are states without a separate state field.
  const state = address.state ?? name;
  return {
    name: name.slice(0, 120),
    district: (address.county ?? name).slice(0, 120),
    state: state.slice(0, 60),
    postcode: (address.postcode ?? "").split(/[;,]/)[0].trim().slice(0, 10),
  };
}

// The cache key of a municipality's rules (see waste_rules).
export function rulesKey(place: PlaceCandidate) {
  return [place.state, place.district, place.name].map((part) => part.trim().toLowerCase()).join("|");
}

async function get(path: string, params: Record<string, string>) {
  const url = `${BASE}${path}?${new URLSearchParams({ format: "jsonv2", addressdetails: "1", ...params })}`;
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10_000), cache: "no-store" }).catch(() => null);
  if (!response?.ok) throw new Error("Die Ortssuche ist gerade nicht erreichbar. Bitte gleich noch einmal versuchen.");
  return response.json() as Promise<unknown>;
}

// Postcode or place name → up to 6 distinct municipalities in Germany.
export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const results = (await get("/search", { q: query, countrycodes: "de", limit: "10" })) as NominatimResult[];
  const seen = new Set<string>();
  const candidates: PlaceCandidate[] = [];
  for (const result of Array.isArray(results) ? results : []) {
    const candidate = toCandidate(result.address);
    if (!candidate) continue;
    const key = rulesKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }
  return candidates.slice(0, 6);
}

// GPS position → the municipality there. Zoom 14 (suburb level) still names
// small villages; the address lists village/town/city and county above it.
export async function reversePlace(lat: number, lon: number): Promise<PlaceCandidate | null> {
  const result = (await get("/reverse", { lat: String(lat), lon: String(lon), zoom: "14" })) as NominatimResult;
  return toCandidate(result?.address);
}
