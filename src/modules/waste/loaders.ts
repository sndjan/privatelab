// Server only. What the browser cache loads for the Mülltrenn-Hilfe (see
// src/lib/query/data.ts).
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import { hasAiKey } from "./ai";
import { STALE_PENDING_MS, type LocalRules, type RulesStatus, type Source, type Verdict } from "./bins";

const BUCKET = "waste-thumbs";

export type Place = {
  id: string;
  label: string;
  name: string;
  district: string;
  state: string;
  postcode: string;
  rulesKey: string;
};

export type Rules = {
  key: string;
  status: RulesStatus;
  // A pending lookup that has run too long; it can be started again.
  stuck: boolean;
  rules: LocalRules | null;
  sources: Source[];
  error: string | null;
  fetchedAt: string | null;
  editedAt: string | null;
};

export type Scan = {
  id: string;
  placeName: string;
  input: string;
  verdict: Verdict;
  thumbUrl: string | null;
  createdAt: string;
};

type PlaceRow = { id: string; label: string; name: string; district: string; state: string; postcode: string; rules_key: string };
type RulesRow = {
  key: string;
  status: RulesStatus;
  rules: LocalRules | null;
  sources: Source[] | null;
  error: string | null;
  started_at: string;
  fetched_at: string | null;
  edited_at: string | null;
};
type ScanRow = { id: string; place_name: string; input: string; result: Verdict; thumb_path: string | null; created_at: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function loadScans(supabase: Supabase, limit: number): Promise<Scan[]> {
  const { data } = await supabase
    .from("waste_scans")
    .select("id, place_name, input, result, thumb_path, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as ScanRow[];
  const paths = rows.map((row) => row.thumb_path).filter((path): path is string => Boolean(path));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
    for (const entry of signed ?? []) if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return rows.map((row) => ({
    id: row.id,
    placeName: row.place_name,
    input: row.input,
    verdict: row.result,
    thumbUrl: row.thumb_path ? (urls.get(row.thumb_path) ?? null) : null,
    createdAt: row.created_at,
  }));
}

export const wasteLoaders = {
  // The saved places (current one first), the rules of the current place and
  // the latest scans.
  home: async (_params, user) => {
    const supabase = await createClient();
    const [{ data: placeRows }, recent] = await Promise.all([
      supabase
        .from("waste_places")
        .select("id, label, name, district, state, postcode, rules_key")
        .order("selected_at", { ascending: false }),
      loadScans(supabase, 5),
    ]);
    const places = ((placeRows ?? []) as PlaceRow[]).map(
      (row): Place => ({
        id: row.id,
        label: row.label,
        name: row.name,
        district: row.district,
        state: row.state,
        postcode: row.postcode,
        rulesKey: row.rules_key,
      }),
    );
    let rules: Rules | null = null;
    if (places[0]) {
      const { data } = await supabase
        .from("waste_rules")
        .select("key, status, rules, sources, error, started_at, fetched_at, edited_at")
        .eq("key", places[0].rulesKey)
        .maybeSingle<RulesRow>();
      if (data) {
        rules = {
          key: data.key,
          status: data.status,
          stuck: data.status === "pending" && Date.now() - new Date(data.started_at).getTime() > STALE_PENDING_MS,
          rules: data.rules,
          sources: data.sources ?? [],
          error: data.error,
          fetchedAt: data.fetched_at,
          editedAt: data.edited_at,
        };
      }
    }
    return { places, rules, recent, isAdmin: user.isAdmin, hasAiKey: hasAiKey() };
  },
  history: async () => loadScans(await createClient(), 200),
} satisfies Record<string, Loader>;
