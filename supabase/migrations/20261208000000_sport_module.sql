-- Sport module: reads the synced Garmin and Hevy data (schema sport) through
-- one security definer function. The data belongs to the owner of the
-- Garmin/Hevy keys, so the module stays private: only admins and users with a
-- module_access row may call it (none are granted by default).

insert into public.modules (id, name) values ('sport', 'Sport')
on conflict (id) do nothing;

-- The Garmin token is valid for 24 hours and its endpoint is rate-limited, so
-- sport-sync keeps it here and reuses it.
create table if not exists sport.garmin_token (
  id boolean primary key default true check (id),
  token text not null,
  fetched_at timestamptz not null default now()
);
alter table sport.garmin_token enable row level security;

-- One row per Hevy exercise per workout: working sets, volume and top set.
-- Assisted exercises log the assistance as weight (less is better).
create or replace view sport.v_hevy_exercise_sessions as
with sets as (
  select * from sport.v_hevy_sets where set_type is distinct from 'warmup'
),
ranked as (
  select s.*,
    row_number() over (partition by workout_id, exercise
      order by case when exercise ~* 'unterstützt|assisted' then -coalesce(weight_kg, 0) else coalesce(weight_kg, 0) end desc,
        reps desc nulls last) as rn
  from sets s
)
select
  workout_id,
  day,
  week,
  exercise,
  exercise ~* 'unterstützt|assisted' as assisted,
  count(*) as sets,
  sum(coalesce(reps, 0)) as reps,
  sum(coalesce(weight_kg, 0) * coalesce(reps, 0)) as volume_kg,
  max(weight_kg) filter (where rn = 1) as top_weight_kg,
  max(reps) filter (where rn = 1) as top_reps
from ranked
group by workout_id, day, week, exercise;

create or replace function public.sport_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.has_module_access('sport')) then
    raise exception 'no access' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'runs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.activity_id::text, 'start', r.start_time_local, 'day', r.day, 'type', r.activity_type,
        'name', r.name, 'km', round(r.km::numeric, 3), 'durationS', round(r.duration_s::numeric),
        'avgHr', r.avg_hr, 'maxHr', r.max_hr, 'easyS', round(r.easy_s::numeric), 'hardS', round(r.hard_s::numeric),
        'zoneSource', r.zone_source) order by r.start_time_local)
      from sport.v_runs r), '[]'::jsonb),
    'health', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', h.day, 'restingHr', h.resting_hr, 'sleepS', h.sleep_s, 'deepS', h.deep_s, 'remS', h.rem_s,
        'sleepScore', h.sleep_score, 'hrv', h.hrv, 'hrvWeekly', h.hrv_weekly_avg, 'hrvStatus', h.hrv_status,
        'hrvLow', h.hrv_balanced_low, 'hrvHigh', h.hrv_balanced_upper) order by h.day)
      from sport.v_daily_health h), '[]'::jsonb),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'workoutId', e.workout_id, 'day', e.day, 'exercise', e.exercise, 'assisted', e.assisted,
        'sets', e.sets, 'reps', e.reps, 'volumeKg', round(e.volume_kg::numeric, 1),
        'topWeightKg', e.top_weight_kg, 'topReps', e.top_reps) order by e.day)
      from sport.v_hevy_exercise_sessions e), '[]'::jsonb),
    'workouts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.workout_id, 'title', w.title, 'start', w.start_time,
        'day', (w.start_time at time zone 'Europe/Berlin')::date,
        'durationS', extract(epoch from (w.end_time - w.start_time))::int) order by w.start_time)
      from sport.hevy_workouts w), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.activity_id::text, 'day', a.start_time_local::date, 'type', a.activity_type, 'name', a.name,
        'km', round((a.distance_m / 1000.0)::numeric, 2), 'durationS', round(a.duration_s::numeric)) order by a.start_time_local)
      from sport.garmin_activities a), '[]'::jsonb),
    'syncRuns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'startedAt', s.started_at, 'finishedAt', s.finished_at, 'ok', s.ok,
        'errors', (select jsonb_object_agg(k, v) from jsonb_each(s.details) as d(k, v) where k like '%error')) order by s.id desc)
      from (select * from sport.sync_runs order by id desc limit 8) s), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.sport_dashboard() from public, anon;
grant execute on function public.sport_dashboard() to authenticated;
