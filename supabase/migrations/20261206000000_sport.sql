-- Sport: Garmin Connect (Personal API) and Hevy, synced every 6 hours by the
-- edge function "sport-sync" (supabase/functions/sport-sync). The raw API
-- answers are kept in jsonb; views further down shape them for the module.
-- The schema is not exposed to anon/authenticated: the module reads it
-- through security definer functions that check module access.

create schema if not exists sport;
revoke all on schema sport from anon, authenticated;

create table sport.garmin_activities (
  activity_id bigint primary key,
  start_time_local timestamp,
  activity_type text,
  name text,
  distance_m double precision,
  duration_s double precision,
  avg_hr double precision,
  max_hr double precision,
  calories double precision,
  elevation_gain_m double precision,
  raw jsonb not null,
  synced_at timestamptz not null default now()
);
create index on sport.garmin_activities (start_time_local desc);

create table sport.garmin_daily (
  day date not null,
  kind text not null, -- 'summary' | 'sleep' | 'hrv'
  raw jsonb not null,
  synced_at timestamptz not null default now(),
  primary key (day, kind)
);

create table sport.hevy_workouts (
  workout_id text primary key,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  updated_at timestamptz,
  raw jsonb not null,
  synced_at timestamptz not null default now()
);
create index on sport.hevy_workouts (start_time desc);

create table sport.sync_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  details jsonb
);

alter table sport.garmin_activities enable row level security;
alter table sport.garmin_daily enable row level security;
alter table sport.hevy_workouts enable row level security;
alter table sport.sync_runs enable row level security;

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Vault secret and cron job (run once per project, <REF> = project ref):
-- select vault.create_secret(encode(extensions.gen_random_bytes(24),'hex'), 'sport_sync_secret', 'Shared secret for sport-sync');
-- select cron.schedule('sport-sync-6h', '17 */6 * * *', $$ select net.http_post(
--   url := 'https://<REF>.supabase.co/functions/v1/sport-sync',
--   headers := jsonb_build_object('Content-Type','application/json','x-sync-secret',
--     (select decrypted_secret from vault.decrypted_secrets where name='sport_sync_secret')),
--   body := '{}'::jsonb, timeout_milliseconds := 120000); $$);
