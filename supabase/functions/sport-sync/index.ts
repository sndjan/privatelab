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

async function garmin(days: number, endDate: Date, details: Record<string, unknown>, parts: string[] | null) {
  let h = { Authorization: `Bearer ${await garminToken(details)}` };
  // A cached token that Garmin no longer accepts is dropped and fetched again once.
  try {
    await getJson(`${GARMIN}/activitylist-service/activities/search/activities?start=0&limit=1`, h);
  } catch (e) {
    if (!/^Error: 401/.test(String(e))) throw e;
    await sql`delete from sport.garmin_token`;
    h = { Authorization: `Bearer ${await garminToken(details)}` };
  }
  await syncGarmin(h, days, endDate, details, parts);
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

async function syncGarmin(h: Record<string, string>, days: number, endDate: Date, details: Record<string, unknown>, parts: string[] | null) {
  const end = endDate;
  const start = addDays(end, -days);

  // Activities
  let n = 0;
  for (let off = 0; (!parts || parts.includes("activities")) && off < 5000; off += 100) {
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
    // VO2max (Garmin "maxmet"): one entry per day it changed, under "generic".
    ["vo2max", (s, e) => `/metrics-service/metrics/maxmet/daily/${s}/${e}`],
  ];
  for (const [kind, path] of kinds) {
    if (parts && !parts.includes(kind)) continue;
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

  // Routines (few, so every run) and exercise templates with their muscle
  // groups (several hundred, so once a day or on a backfill).
  let routines = 0;
  for (let page = 1; page <= 50; page++) {
    const res = await getJson(`${HEVY}/v1/routines?page=${page}&pageSize=10`, { "api-key": key });
    const arr: any[] = res?.routines ?? [];
    for (const r of arr) {
      await sql`insert into sport.hevy_routines (routine_id, title, folder_id, updated_at, raw, synced_at)
        values (${r.id}, ${r.title ?? null}, ${r.folder_id ?? null}, ${r.updated_at ?? null}, ${sql.json(r)}, now())
        on conflict (routine_id) do update set title=excluded.title, folder_id=excluded.folder_id, updated_at=excluded.updated_at,
          raw=excluded.raw, synced_at=now()`;
      routines++;
    }
    if (!arr.length || page >= (res?.page_count ?? 0)) break;
  }
  details.hevy_routines = routines;

  const [fresh] = await sql`select count(*)::int as n from sport.hevy_exercise_templates where synced_at > now() - interval '1 day'`;
  if (full || !fresh?.n) {
    let templates = 0;
    for (let page = 1; page <= 50; page++) {
      const res = await getJson(`${HEVY}/v1/exercise_templates?page=${page}&pageSize=100`, { "api-key": key });
      const arr: any[] = res?.exercise_templates ?? [];
      for (const t of arr) {
        await sql`insert into sport.hevy_exercise_templates (template_id, title, type, primary_muscle_group, secondary_muscle_groups, is_custom, raw, synced_at)
          values (${t.id}, ${t.title ?? null}, ${t.type ?? null}, ${t.primary_muscle_group ?? null}, ${t.secondary_muscle_groups ?? []},
            ${t.is_custom ?? false}, ${sql.json(t)}, now())
          on conflict (template_id) do update set title=excluded.title, type=excluded.type, primary_muscle_group=excluded.primary_muscle_group,
            secondary_muscle_groups=excluded.secondary_muscle_groups, is_custom=excluded.is_custom, raw=excluded.raw, synced_at=now()`;
        templates++;
      }
      if (!arr.length || page >= (res?.page_count ?? 0)) break;
    }
    details.hevy_templates = templates;
  }
}

// --- Routines to Hevy (?push=routines) -------------------------------------------
// Called by the Sport module's Gym tab with the viewer's session token. The
// body holds the routine from src/modules/sport/plan.ts (one routine per day);
// exercises without a template id from past workouts are matched by name
// against the synced templates. A routine with the same title in Hevy is
// replaced (PUT), otherwise created (POST). dry=1 only reports what would happen.

type PushSet = {
  type: "normal" | "warmup"; weightKg: number | null; reps: number | null;
  repsMin: number | null; repsMax: number | null; durationS: number | null;
};
type PushExercise = { name: string; templateId: string | null; restSeconds: number | null; notes: string; sets: PushSet[] };
type PushRoutine = { title: string; notes: string; exercises: PushExercise[] };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// The same comparison as sameExercise() in plan.ts: names without brackets
// (equipment, gym name) first, then letters only.
const words = (name: string) => name.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-zäöüß]+/g, " ").trim();
const letters = (name: string) => name.toLowerCase().replace(/[^a-zäöüß]+/g, "");

async function viewerHasAccess(req: Request): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || !apikey) return false;
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey } });
  if (!r.ok) return false;
  const user = await r.json();
  if (!user?.id) return false;
  // private.has_module_access() reads auth.uid() from the request claims.
  const [row] = await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: user.id, role: "authenticated" })}, true)`;
    return tx`select private.has_module_access('sport') as ok`;
  });
  return row?.ok === true;
}

async function hevySend(method: "POST" | "PUT", path: string, key: string, body: unknown) {
  const r = await fetch(`${HEVY}${path}`, {
    method, headers: { Accept: "application/json", "Content-Type": "application/json", "api-key": key }, body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Hevy ${r.status}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

async function pushRoutines(req: Request, dry: boolean) {
  if (!(await viewerHasAccess(req))) return json({ error: "Kein Zugriff." }, 403);
  const key = Deno.env.get("HEVY_API_KEY");
  if (!key) return json({ error: "HEVY_API_KEY fehlt" }, 500);
  let input: { routines?: PushRoutine[] };
  try { input = await req.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
  const routines = (input.routines ?? []).slice(0, 10);
  if (!routines.length) return json({ error: "Keine Routinen." }, 400);

  const templates: { template_id: string; title: string | null }[] =
    await sql`select template_id, title from sport.hevy_exercise_templates order by is_custom desc, template_id`;
  if (!templates.length) return json({ error: "Noch keine Hevy-Übungen synchronisiert. Einmal den Sync laufen lassen." }, 409);
  const titleOf = new Map(templates.map((t) => [t.template_id, t.title]));
  const match = (name: string) =>
    templates.find((t) => t.title && letters(t.title) === letters(name)) ??
    templates.find((t) => t.title && words(t.title) === words(name) && words(name).length > 0) ??
    null;

  // Existing routines by title, live from Hevy (the synced table can be hours old).
  const existing = new Map<string, string>();
  for (let page = 1; page <= 50; page++) {
    const res = await getJson(`${HEVY}/v1/routines?page=${page}&pageSize=10`, { "api-key": key });
    const arr: any[] = res?.routines ?? [];
    for (const r of arr) if (r.title) existing.set(String(r.title).trim().toLowerCase(), r.id);
    if (!arr.length || page >= (res?.page_count ?? 0)) break;
  }

  const results = [];
  for (const routine of routines) {
    const resolved: { exercise: PushExercise; templateId: string }[] = [];
    const missing: string[] = [];
    for (const exercise of routine.exercises ?? []) {
      const templateId = exercise.templateId && titleOf.has(exercise.templateId) ? exercise.templateId : match(exercise.name)?.template_id;
      if (templateId) resolved.push({ exercise, templateId });
      else missing.push(exercise.name);
    }
    const id = existing.get(routine.title.trim().toLowerCase());
    const result: Record<string, unknown> = {
      title: routine.title,
      action: id ? "update" : "create",
      exercises: resolved.map(({ exercise, templateId }) => ({ name: exercise.name, templateId, templateTitle: titleOf.get(templateId) ?? null })),
      missing,
    };
    if (!dry && resolved.length) {
      const exercises = resolved.map(({ exercise, templateId }) => ({
        exercise_template_id: templateId,
        superset_id: null,
        rest_seconds: exercise.restSeconds ?? null,
        notes: exercise.notes || null,
        // Hevy rejects rep_range: null, so sets without a range leave it out.
        sets: (Array.isArray(exercise.sets) ? exercise.sets : []).slice(0, 10).map((set) => ({
          type: set.type === "warmup" ? "warmup" : "normal",
          weight_kg: set.weightKg ?? null,
          reps: set.reps ?? null,
          ...(set.repsMin != null && set.repsMax != null ? { rep_range: { start: set.repsMin, end: set.repsMax } } : {}),
          distance_meters: null,
          duration_seconds: set.durationS ?? null,
          custom_metric: null,
        })),
      }));
      try {
        // PUT takes no folder_id, so a replaced routine stays in its folder.
        const res = id
          ? await hevySend("PUT", `/v1/routines/${id}`, key, { routine: { title: routine.title, notes: routine.notes || null, exercises } })
          : await hevySend("POST", "/v1/routines", key, { routine: { title: routine.title, folder_id: null, notes: routine.notes || "", exercises } });
        // The answer is { routine: {…} } or { routine: [{…}] }, depending on the endpoint.
        const saved = Array.isArray(res?.routine) ? res.routine[0] : res?.routine;
        if (saved?.id) {
          await sql`insert into sport.hevy_routines (routine_id, title, folder_id, updated_at, raw, synced_at)
            values (${saved.id}, ${saved.title ?? null}, ${saved.folder_id ?? null}, ${saved.updated_at ?? null}, ${sql.json(saved)}, now())
            on conflict (routine_id) do update set title=excluded.title, folder_id=excluded.folder_id, updated_at=excluded.updated_at,
              raw=excluded.raw, synced_at=now()`;
        }
      } catch (e) {
        result.error = String(e).replace(/^Error: /, "");
      }
    }
    results.push(result);
  }
  return json({ routines: results });
}

// Query parameters:
//   backfill=1   longer window (days, default 730) and all Hevy pages
//   days=N       window length in days
//   end=YYYY-MM-DD  end of the Garmin window (default today), to backfill in blocks
//   only=garmin|hevy  run just one source
//   parts=activities,summary,sleep,hrv,vo2max  only these Garmin parts (Garmin allows
//               about 100 requests per hour, so long backfills go part by part)
//   push=routines (POST, with a user's session instead of the secret)  write the
//               gym routine to Hevy, see pushRoutines(); dry=1 only previews
async function runSync(o: { full: boolean; days: number; endDate: Date; only: string | null; parts: string[] | null; manual: boolean }) {
  const details: Record<string, unknown> = { full: o.full, days: o.days, end: iso(o.endDate), only: o.only, parts: o.parts, manual: o.manual };
  const [{ id }] = await sql`insert into sport.sync_runs default values returning id`;
  let ok = true;
  const jobs = [["garmin", () => garmin(o.days, o.endDate, details, o.parts)], ["hevy", () => hevy(o.full, details)]] as const;
  for (const [name, fn] of jobs) {
    if (o.only && o.only !== name) continue;
    try { await fn(); } catch (e) { ok = false; details[`${name}_error`] = String(e); }
  }
  await sql`update sport.sync_runs set finished_at = now(), ok = ${ok}, details = ${sql.json(details)} where id = ${id}`;
  return { ok, details };
}

Deno.serve(async (req) => {
  const params = new URL(req.url).searchParams;
  if (params.get("push") === "routines") {
    if (req.method !== "POST") return json({ error: "POST erwartet." }, 405);
    try { return await pushRoutines(req, params.get("dry") === "1"); }
    catch (e) { return json({ error: String(e).replace(/^Error: /, "") }, 502); }
  }
  // Manual refresh from the app ("Aktualisieren"): the viewer's session instead
  // of the secret, last 3 days only, and at most once every 2 minutes.
  if (params.get("manual") === "1") {
    if (req.method !== "POST") return json({ error: "POST erwartet." }, 405);
    if (!(await viewerHasAccess(req))) return json({ error: "Kein Zugriff." }, 403);
    const [recent] = await sql`select 1 from sport.sync_runs where started_at > now() - interval '2 minutes' and (finished_at is null or details->>'manual' = 'true') limit 1`;
    if (recent) return json({ error: "Läuft gerade oder lief eben erst. In zwei Minuten noch einmal." }, 429);
    const only = params.get("only");
    const result = await runSync({ full: false, days: 3, endDate: new Date(), only: only === "garmin" || only === "hevy" ? only : null, parts: null, manual: true });
    return json(result);
  }

  const rows = await sql`select decrypted_secret as secret from vault.decrypted_secrets where name = 'sport_sync_secret'`;
  const secret = rows[0]?.secret;
  if (!secret || req.headers.get("x-sync-secret") !== secret) return new Response("forbidden", { status: 403 });

  const url = new URL(req.url);
  const full = url.searchParams.get("backfill") === "1";
  const days = Number(url.searchParams.get("days") ?? (full ? 730 : 10));
  const endParam = url.searchParams.get("end");
  const endDate = endParam && /^\d{4}-\d{2}-\d{2}$/.test(endParam) ? new Date(`${endParam}T12:00:00Z`) : new Date();
  const only = url.searchParams.get("only");
  const parts = url.searchParams.get("parts")?.split(",").filter(Boolean) ?? null;
  const { ok, details } = await runSync({ full, days, endDate, only, parts, manual: false });
  return new Response(JSON.stringify({ ok, details }), { headers: { "Content-Type": "application/json" } });
});

