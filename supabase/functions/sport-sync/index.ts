import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2 });
const GARMIN = "https://personal.connectapi.garmin.com";
const HEVY = "https://api.hevyapp.com";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

async function getJson(url: string, headers: Record<string, string>) {
  const r = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${url.split("?")[0]}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

// Find every object carrying a calendar date anywhere in a response.
function collectDaily(node: unknown, out: Map<string, unknown>) {
  if (Array.isArray(node)) { node.forEach((n) => collectDaily(n, out)); return; }
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    const d = (o.calendarDate ?? o.calendarDay ?? o.date) as string | undefined;
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) { out.set(d.slice(0, 10), o); return; }
    Object.values(o).forEach((v) => collectDaily(v, out));
  }
}

// The token is valid for 24 hours and the token endpoint is rate-limited, so
// it is kept in sport.garmin_token and reused for 23 hours.
async function garminToken(details: Record<string, unknown>): Promise<string> {
  const [cached] = await sql`select token from sport.garmin_token where fetched_at > now() - interval '23 hours'`;
  if (cached?.token) { details.garmin_token = "cached"; return cached.token; }
  const token = await fetchGarminToken(details);
  await sql`insert into sport.garmin_token (id, token, fetched_at) values (true, ${token}, now())
    on conflict (id) do update set token = excluded.token, fetched_at = now()`;
  details.garmin_token = "new";
  return token;
}

async function garmin(days: number, endDate: Date, details: Record<string, unknown>) {
  let h = { Authorization: `Bearer ${await garminToken(details)}` };
  // A cached token that Garmin no longer accepts is dropped and fetched again once.
  try {
    await getJson(`${GARMIN}/activitylist-service/activities/search/activities?start=0&limit=1`, h);
  } catch (e) {
    if (!/^Error: 401/.test(String(e))) throw e;
    await sql`delete from sport.garmin_token`;
    h = { Authorization: `Bearer ${await garminToken(details)}` };
  }
  await syncGarmin(h, days, endDate, details);
}

async function fetchGarminToken(details: Record<string, unknown>): Promise<string> {
  const key = Deno.env.get("GARMIN_API_KEY");
  if (!key) throw new Error("GARMIN_API_KEY fehlt");
  const tr = await fetch(`${GARMIN}/personalapitoken-service/personal-api/personal-api-key/token`, {
    method: "POST", headers: { Accept: "*/*", Authorization: `ApiKey ${key}` },
  });
  const tokenText = (await tr.text()).trim();
  if (!tr.ok) throw new Error(`Garmin Token ${tr.status}: ${tokenText.slice(0, 200)}`);
  // The token comes back as plain text or as JSON, depending on the API version.
  let token = tokenText.replace(/^"|"$/g, "");
  if (tokenText.startsWith("{")) {
    const j = JSON.parse(tokenText);
    token = j.access_token ?? j.accessToken ?? j.token ?? j.jwt ?? "";
    details.garmin_token_keys = Object.keys(j);
  }
  if (!token) throw new Error("Garmin Token: leere Antwort");
  return token;
}

async function syncGarmin(h: Record<string, string>, days: number, endDate: Date, details: Record<string, unknown>) {
  const end = endDate;
  const start = addDays(end, -days);

  // Activities
  let n = 0;
  for (let off = 0; off < 5000; off += 100) {
    const list = await getJson(
      `${GARMIN}/activitylist-service/activities/search/activities?start=${off}&limit=100&startDate=${iso(start)}&endDate=${iso(end)}`, h);
    const arr: any[] = Array.isArray(list) ? list : (list?.activityList ?? list?.activities ?? []);
    if (n === 0 && arr[0]) details.garmin_activity_keys = Object.keys(arr[0]);
    for (const a of arr) {
      await sql`insert into sport.garmin_activities
        (activity_id, start_time_local, activity_type, name, distance_m, duration_s, avg_hr, max_hr, calories, elevation_gain_m, raw, synced_at)
        values (${a.activityId}, ${a.startTimeLocal ?? null}, ${a.activityType?.typeKey ?? null}, ${a.activityName ?? null},
          ${a.distance ?? null}, ${a.duration ?? null}, ${a.averageHR ?? null}, ${a.maxHR ?? null},
          ${a.calories ?? null}, ${a.elevationGain ?? null}, ${sql.json(a)}, now())
        on conflict (activity_id) do update set start_time_local=excluded.start_time_local, activity_type=excluded.activity_type,
          name=excluded.name, distance_m=excluded.distance_m, duration_s=excluded.duration_s, avg_hr=excluded.avg_hr,
          max_hr=excluded.max_hr, calories=excluded.calories, elevation_gain_m=excluded.elevation_gain_m, raw=excluded.raw, synced_at=now()`;
      n++;
    }
    if (arr.length < 100) break;
  }
  details.garmin_activities = n;

  // Daily data in 28-day chunks
  const kinds: [string, (s: string, e: string) => string][] = [
    ["summary", (s, e) => `/usersummary-service/v2/dailysummaries?startDate=${s}&endDate=${e}`],
    ["sleep", (s, e) => `/sleep-service/sleep/dailySleepSummariesByDate?startDate=${s}&endDate=${e}`],
    ["hrv", (s, e) => `/hrv-service/hrv/daily/${s}/${e}`],
  ];
  for (const [kind, path] of kinds) {
    let cnt = 0;
    try {
      for (let s = start; s <= end; s = addDays(s, 28)) {
        const e = addDays(s, 27) > end ? end : addDays(s, 27);
        const res = await getJson(GARMIN + path(iso(s), iso(e)), h);
        const m = new Map<string, unknown>();
        collectDaily(res, m);
        if (!details[`garmin_${kind}_sample`] && m.size) details[`garmin_${kind}_sample`] = Object.keys([...m.values()][0] as object);
        if (!m.size && res && !details[`garmin_${kind}_unparsed`]) details[`garmin_${kind}_unparsed`] = JSON.stringify(res).slice(0, 500);
        for (const [day, raw] of m) {
          await sql`insert into sport.garmin_daily (day, kind, raw, synced_at) values (${day}, ${kind}, ${sql.json(raw as any)}, now())
            on conflict (day, kind) do update set raw=excluded.raw, synced_at=now()`;
          cnt++;
        }
      }
    } catch (err) { details[`garmin_${kind}_error`] = String(err); }
    details[`garmin_${kind}`] = cnt;
  }
}

async function hevy(full: boolean, details: Record<string, unknown>) {
  const key = Deno.env.get("HEVY_API_KEY");
  if (!key) throw new Error("HEVY_API_KEY fehlt");
  let n = 0;
  for (let page = 1; page <= (full ? 500 : 3); page++) {
    const res = await getJson(`${HEVY}/v1/workouts?page=${page}&pageSize=10`, { "api-key": key });
    const arr: any[] = res?.workouts ?? [];
    for (const w of arr) {
      await sql`insert into sport.hevy_workouts (workout_id, title, start_time, end_time, updated_at, raw, synced_at)
        values (${w.id}, ${w.title ?? null}, ${w.start_time ?? null}, ${w.end_time ?? null}, ${w.updated_at ?? null}, ${sql.json(w)}, now())
        on conflict (workout_id) do update set title=excluded.title, start_time=excluded.start_time, end_time=excluded.end_time,
          updated_at=excluded.updated_at, raw=excluded.raw, synced_at=now()`;
      n++;
    }
    if (!arr.length || page >= (res?.page_count ?? 0)) break;
  }
  details.hevy_workouts = n;
}

// Query parameters:
//   backfill=1   longer window (days, default 730) and all Hevy pages
//   days=N       window length in days
//   end=YYYY-MM-DD  end of the Garmin window (default today), to backfill in blocks
//   only=garmin|hevy  run just one source
Deno.serve(async (req) => {
  const rows = await sql`select decrypted_secret as secret from vault.decrypted_secrets where name = 'sport_sync_secret'`;
  const secret = rows[0]?.secret;
  if (!secret || req.headers.get("x-sync-secret") !== secret) return new Response("forbidden", { status: 403 });

  const url = new URL(req.url);
  const full = url.searchParams.get("backfill") === "1";
  const days = Number(url.searchParams.get("days") ?? (full ? 730 : 10));
  const endParam = url.searchParams.get("end");
  const endDate = endParam && /^\d{4}-\d{2}-\d{2}$/.test(endParam) ? new Date(`${endParam}T12:00:00Z`) : new Date();
  const only = url.searchParams.get("only");
  const details: Record<string, unknown> = { full, days, end: iso(endDate), only };
  const [{ id }] = await sql`insert into sport.sync_runs default values returning id`;
  let ok = true;
  const jobs = [["garmin", () => garmin(days, endDate, details)], ["hevy", () => hevy(full, details)]] as const;
  for (const [name, fn] of jobs) {
    if (only && only !== name) continue;
    try { await fn(); } catch (e) { ok = false; details[`${name}_error`] = String(e); }
  }
  await sql`update sport.sync_runs set finished_at = now(), ok = ${ok}, details = ${sql.json(details)} where id = ${id}`;
  return new Response(JSON.stringify({ ok, details }), { headers: { "Content-Type": "application/json" } });
});

