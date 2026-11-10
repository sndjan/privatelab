"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readReport, readThrowSheets, type Upload } from "./ai";
import { cleanLine, cleanRates, DEFAULT_TEAM, DEFAULT_THRESHOLD, nameKey, type Game, type Report, type Settings, type ThrowSheet } from "./data";

// Games and settings are written with the user's own Supabase client, so RLS
// enforces ownership and access to the 'kegeln' module. Reading a document
// costs an AI request, so it checks the access first.

const MODULE = "kegeln";
type Result<T = object> = (T & { error?: undefined }) | { error: string };

function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

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

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
// Server actions take up to 4 MB here (next.config.ts); the photos are scaled
// down in the browser, PDFs are sent as they are.
const MAX_BYTES = 3_900_000;

async function uploadOf(formData: FormData): Promise<Upload | string> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return "Keine Datei bekommen.";
  if (file.size > MAX_BYTES) return "Die Datei ist zu groß (höchstens 4 MB). Mach lieber ein Foto davon.";
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  if (file.type === "application/pdf") return { kind: "pdf", data };
  if ((IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { kind: "image", data, mediaType: file.type as (typeof IMAGE_TYPES)[number] };
  }
  return "Bitte ein Foto oder eine PDF hochladen.";
}

export async function scanReport(formData: FormData): Promise<Result<{ report: Report }>> {
  const { user, supabase } = await requireAccess();
  const upload = await uploadOf(formData);
  if (typeof upload === "string") return { error: upload };
  const settings = check(await supabase.from("kegel_settings").select("team").eq("user_id", user.id).maybeSingle());
  try {
    return { report: await readReport(upload, settings?.team || DEFAULT_TEAM) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Das Auslesen hat nicht geklappt." };
  }
}

export async function scanThrowSheets(formData: FormData): Promise<Result<{ sheets: ThrowSheet[] }>> {
  await requireAccess();
  const upload = await uploadOf(formData);
  if (typeof upload === "string") return { error: upload };
  try {
    const sheets = await readThrowSheets(upload);
    if (sheets.length === 0) return { error: "Auf dem Zettel war kein Wurfschein zu erkennen." };
    return { sheets };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Das Auslesen hat nicht geklappt." };
  }
}

type GameInput = Omit<Game, "id" | "createdAt"> & { id?: string | null };

export async function saveGame(input: GameInput): Promise<Result<{ id: string }>> {
  const { supabase } = await requireAccess();
  const lines = (Array.isArray(input.lines) ? input.lines : []).slice(0, 20).map(cleanLine).filter((line) => line.name);
  if (lines.length === 0) return { error: "Mindestens ein Spieler fehlt." };
  const matchday = Number(input.matchday);
  const threshold = Math.round(Number(input.threshold));
  const row = {
    played_on: typeof input.playedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.playedOn) ? input.playedOn : null,
    matchday: Number.isInteger(matchday) && matchday > 0 && matchday < 100 ? matchday : null,
    season: text(input.season, 20),
    opponent: text(input.opponent, 120),
    home: typeof input.home === "boolean" ? input.home : null,
    threshold: Number.isFinite(threshold) && threshold > 0 && threshold < 1200 ? threshold : DEFAULT_THRESHOLD,
    rates: cleanRates(input.rates),
    lines,
    note: text(input.note, 1000),
    updated_at: new Date().toISOString(),
  };
  const saved = input.id
    ? check(await supabase.from("kegel_games").update(row).eq("id", text(input.id, 40)).select("id").single())
    : check(await supabase.from("kegel_games").insert(row).select("id").single());
  return { id: saved.id };
}

// Ticks a player off as paid (or not) without touching the rest of the game.
export async function setPaid(gameId: string, index: number, paid: boolean) {
  const { supabase } = await requireAccess();
  const game = check(await supabase.from("kegel_games").select("lines").eq("id", text(gameId, 40)).single());
  const lines = (game.lines as unknown[]).map((line) => cleanLine(line as never));
  if (!lines[index]) throw new Error("No such player");
  lines[index] = { ...lines[index], paid: Boolean(paid) };
  check(await supabase.from("kegel_games").update({ lines, updated_at: new Date().toISOString() }).eq("id", text(gameId, 40)).select("id"));
}

export async function deleteGame(id: string) {
  const { supabase } = await requireAccess();
  check(await supabase.from("kegel_games").delete().eq("id", text(id, 40)).select("id"));
}

export async function saveSettings(input: Settings): Promise<Result> {
  const { user, supabase } = await requireAccess();
  const threshold = Math.round(Number(input.threshold));
  const nicknames: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.nicknames ?? {}).slice(0, 100)) {
    const nick = text(value, 40);
    const clean = nameKey(key);
    if (clean && nick) nicknames[clean] = nick;
  }
  check(
    await supabase
      .from("kegel_settings")
      .upsert({
        user_id: user.id,
        team: text(input.team, 80) || DEFAULT_TEAM,
        threshold: Number.isFinite(threshold) && threshold > 0 && threshold < 1200 ? threshold : DEFAULT_THRESHOLD,
        rates: cleanRates(input.rates),
        nicknames,
        updated_at: new Date().toISOString(),
      })
      .select("user_id"),
  );
  return {};
}
