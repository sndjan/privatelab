// Server only. What the browser cache loads for the Kegelkasse (see
// src/lib/query/data.ts): the settings, every saved game and who has paid
// for which season (as paidKey values).
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import { cleanLine, cleanRates, defaultSettings, paidKey, type Game, type Settings } from "./data";

type GameRow = {
  id: string;
  played_on: string | null;
  matchday: number | null;
  season: string;
  opponent: string;
  home: boolean | null;
  threshold: number;
  rates: unknown;
  lines: unknown;
  note: string;
  created_at: string;
};

export const kegelnLoaders = {
  all: async (_, user): Promise<{ settings: Settings; games: Game[]; paid: string[] }> => {
    const supabase = await createClient();
    const [{ data: settings }, { data: games }, { data: paid }] = await Promise.all([
      supabase.from("kegel_settings").select("team, threshold, rates, nicknames").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("kegel_games")
        .select("id, played_on, matchday, season, opponent, home, threshold, rates, lines, note, created_at")
        .order("played_on", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase.from("kegel_season_paid").select("season, player").eq("user_id", user.id),
    ]);
    return {
      settings: settings
        ? {
            team: settings.team || defaultSettings.team,
            threshold: settings.threshold ?? defaultSettings.threshold,
            rates: cleanRates(settings.rates),
            nicknames: (settings.nicknames ?? {}) as Record<string, string>,
          }
        : defaultSettings,
      games: ((games ?? []) as GameRow[]).map((row) => ({
        id: row.id,
        playedOn: row.played_on,
        matchday: row.matchday,
        season: row.season,
        opponent: row.opponent,
        home: row.home,
        threshold: row.threshold,
        rates: cleanRates(row.rates as never),
        lines: (Array.isArray(row.lines) ? row.lines : []).map((line) => cleanLine(line)),
        note: row.note,
        createdAt: row.created_at,
      })),
      // player is already a nameKey; paidKey keys it again, which keeps it.
      paid: (paid ?? []).map((row: { season: string; player: string }) => paidKey(row.season, row.player)),
    };
  },
} satisfies Record<string, Loader>;
