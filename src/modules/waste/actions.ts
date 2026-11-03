"use server";

import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { classify, cleanRules, lookUpRules } from "./ai";
import { effectiveBins, STALE_PENDING_MS, type LocalRules, type Verdict } from "./bins";
import { reversePlace, rulesKey, searchPlaces, type PlaceCandidate } from "./geocode";

// Places and scans are written with the user's own Supabase client, so RLS
// enforces ownership and access to the 'waste' module. The shared rules cache
// is written with the secret key, after the checks below.

const MODULE = "waste";
const BUCKET = "waste-thumbs";
type Result<T = object> = (T & { error?: undefined }) | { error: string };

function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

// Everything here costs AI or geocoding requests, so it is only for users
// with access to the module.
async function requireAccess() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const supabase = await createClient();
  if (!user.isAdmin) {
    const access = check(
      await supabase.from("module_access").select("module_id").eq("user_id", user.id).eq("module_id", MODULE).maybeSingle(),
    );
    if (!access) throw new Error("No access");
  }
  return { user, supabase };
}

const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

function cleanCandidate(input: PlaceCandidate): PlaceCandidate | null {
  const place = {
    name: text(input?.name, 120),
    district: text(input?.district, 120),
    state: text(input?.state, 60),
    postcode: text(input?.postcode, 10),
  };
  return place.name && place.state ? { ...place, district: place.district || place.name } : null;
}

// --- Finding a place ------------------------------------------------------------

export async function findPlaces(query: string): Promise<Result<{ places: PlaceCandidate[] }>> {
  await requireAccess();
  const q = text(query, 100);
  if (q.length < 2) return { error: "Bitte eine Postleitzahl oder einen Ort eingeben." };
  try {
    return { places: await searchPlaces(q) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Die Ortssuche hat nicht geklappt." };
  }
}

export async function locatePlace(lat: number, lon: number): Promise<Result<{ place: PlaceCandidate }>> {
  await requireAccess();
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { error: "Ungültiger Standort." };
  try {
    const place = await reversePlace(lat, lon);
    if (!place) return { error: "An diesem Standort wurde kein Ort in Deutschland gefunden." };
    return { place };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Der Standort konnte nicht bestimmt werden." };
  }
}

// --- Local rules ----------------------------------------------------------------

// Runs the lookup after the response, so the user can go on while Claude
// searches (a minute or two); the browser polls the rules row meanwhile.
function scheduleLookup(key: string, place: PlaceCandidate) {
  after(async () => {
    const admin = createAdminClient();
    try {
      const { rules, sources } = await lookUpRules(place);
      await admin
        .from("waste_rules")
        .update({ status: "ready", rules, sources, error: null, fetched_at: new Date().toISOString() })
        .eq("key", key);
    } catch (error) {
      console.error(`Waste rules lookup for ${key} failed`, error);
      const message = error instanceof Error ? error.message : "Die Recherche ist fehlgeschlagen.";
      await admin.from("waste_rules").update({ status: "failed", error: message.slice(0, 500) }).eq("key", key);
    }
  });
}

// Makes sure the municipality has a rules row and starts the lookup for a new
// one. Two users adding the same place at once start only one lookup.
async function ensureRules(place: PlaceCandidate) {
  const key = rulesKey(place);
  const admin = createAdminClient();
  const inserted = check(
    await admin
      .from("waste_rules")
      .upsert({ key, name: place.name, district: place.district, state: place.state }, { onConflict: "key", ignoreDuplicates: true })
      .select("key"),
  );
  if (inserted.length > 0) scheduleLookup(key, place);
  else await claimLookup(key, false);
  return key;
}

// Starts the lookup again: for a failed or stuck one, anyone; for one that
// worked (refresh), only admins. Returns false if there is nothing to do.
async function claimLookup(key: string, refresh: boolean) {
  const admin = createAdminClient();
  const stale = new Date(Date.now() - STALE_PENDING_MS).toISOString();
  const allowed = [`status.eq.failed`, `and(status.eq.pending,started_at.lt."${stale}")`, ...(refresh ? ["status.eq.ready"] : [])];
  const claimed = check(
    await admin
      .from("waste_rules")
      .update({ status: "pending", error: null, started_at: new Date().toISOString() })
      .eq("key", key)
      .or(allowed.join(","))
      .select("name, district, state"),
  );
  if (claimed.length === 0) return false;
  const postcode = check(await admin.from("waste_places").select("postcode").eq("rules_key", key).limit(1)).at(0)?.postcode ?? "";
  scheduleLookup(key, { ...claimed[0], postcode });
  return true;
}

export async function retryRules(key: string): Promise<Result> {
  const { user } = await requireAccess();
  if (!(await claimLookup(text(key, 300), user.isAdmin))) return { error: "Die Regeln werden gerade schon abgerufen." };
  return {};
}

// Hand edits by the admin (e.g. after checking the authority's website).
export async function saveRules(key: string, rules: LocalRules): Promise<Result> {
  const { user } = await requireAccess();
  if (!user.isAdmin) return { error: "Nur Admins können die Regeln bearbeiten." };
  const admin = createAdminClient();
  check(
    await admin
      .from("waste_rules")
      .update({ rules: cleanRules(rules), status: "ready", error: null, edited_at: new Date().toISOString() })
      .eq("key", text(key, 300)),
  );
  return {};
}

// --- Places ---------------------------------------------------------------------

export async function addPlace(input: PlaceCandidate, label: string): Promise<Result<{ id: string }>> {
  const { supabase } = await requireAccess();
  const place = cleanCandidate(input);
  if (!place) return { error: "Dieser Ort ist unvollständig." };
  const key = await ensureRules(place);
  const existing = check(await supabase.from("waste_places").select("id").eq("rules_key", key).limit(1)).at(0);
  if (existing) {
    // Already saved: just switch to it.
    check(await supabase.from("waste_places").update({ selected_at: new Date().toISOString() }).eq("id", existing.id));
    return { id: existing.id };
  }
  const created = check(
    await supabase
      .from("waste_places")
      .insert({ ...place, label: text(label, 40), rules_key: key })
      .select("id")
      .single(),
  );
  return { id: created.id };
}

export async function selectPlace(id: string) {
  const { supabase } = await requireAccess();
  check(await supabase.from("waste_places").update({ selected_at: new Date().toISOString() }).eq("id", id));
}

export async function renamePlace(id: string, label: string) {
  const { supabase } = await requireAccess();
  check(await supabase.from("waste_places").update({ label: text(label, 40) }).eq("id", id));
}

// Scans of the place stay in the history (with the place's name).
export async function deletePlace(id: string) {
  const { supabase } = await requireAccess();
  check(await supabase.from("waste_places").delete().eq("id", id));
}

// --- Sorting a thing ------------------------------------------------------------

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// The browser sends the photo scaled down for the AI and a small thumbnail
// for the history. With scanId, the user corrected an earlier answer: the
// same scan is updated instead of adding a new one.
export async function sortThing(formData: FormData): Promise<Result<{ scanId: string; verdict: Verdict }>> {
  const { user, supabase } = await requireAccess();
  const photo = formData.get("photo");
  const thumb = formData.get("thumb");
  const description = text(formData.get("text"), 500);
  const correction = text(formData.get("correction"), 500);
  const previousDescription = text(formData.get("previous"), 600);
  const scanId = text(formData.get("scanId"), 40) || null;

  const image =
    photo instanceof File && photo.size > 0
      ? (PHOTO_TYPES as readonly string[]).includes(photo.type) && photo.size <= 1_500_000
        ? { data: Buffer.from(await photo.arrayBuffer()).toString("base64"), mediaType: photo.type as (typeof PHOTO_TYPES)[number] }
        : null
      : null;
  if (photo instanceof File && photo.size > 0 && !image) return { error: "Das Foto konnte nicht verarbeitet werden." };
  if (!image && !description) return { error: "Bitte ein Foto aufnehmen oder den Gegenstand beschreiben." };

  const place = check(
    await supabase
      .from("waste_places")
      .select("id, name, label, district, state, rules_key")
      .eq("id", text(formData.get("placeId"), 40))
      .maybeSingle(),
  );
  if (!place) return { error: "Bitte zuerst einen Ort wählen." };
  const rulesRow = check(await supabase.from("waste_rules").select("rules").eq("key", place.rules_key).maybeSingle());
  const rules = (rulesRow?.rules ?? null) as LocalRules | null;

  let verdict: Verdict;
  try {
    verdict = await classify({
      image,
      text: description,
      correction,
      previousDescription,
      bins: effectiveBins(rules),
      rules,
      placeName: `${place.name}, ${place.district === place.name ? "" : `${place.district}, `}${place.state}`,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Die Erkennung hat nicht geklappt." };
  }

  const input = [description, correction && `Korrektur: ${correction}`].filter(Boolean).join(" · ").slice(0, 1000);
  if (scanId) {
    check(await supabase.from("waste_scans").update({ result: verdict, input }).eq("id", scanId));
    return { scanId, verdict };
  }

  // A missing thumbnail only costs the picture in the history.
  let thumbPath: string | null = null;
  if (thumb instanceof File && thumb.size > 0 && thumb.size <= 200_000 && ["image/webp", "image/jpeg"].includes(thumb.type)) {
    const path = `${user.id}/${crypto.randomUUID()}.${thumb.type === "image/webp" ? "webp" : "jpg"}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, thumb, { contentType: thumb.type });
    if (!error) thumbPath = path;
  }
  const created = check(
    await supabase
      .from("waste_scans")
      .insert({ place_id: place.id, place_name: place.label || place.name, input, result: verdict, thumb_path: thumbPath })
      .select("id")
      .single(),
  );
  return { scanId: created.id, verdict };
}

export async function deleteScan(id: string) {
  const { supabase } = await requireAccess();
  const scan = check(await supabase.from("waste_scans").select("thumb_path").eq("id", id).maybeSingle());
  if (!scan) return;
  check(await supabase.from("waste_scans").delete().eq("id", id));
  if (scan.thumb_path) await supabase.storage.from(BUCKET).remove([scan.thumb_path]);
}
