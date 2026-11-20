-- Sport: more data for the module (steps, bed and wake times, VO2max, sets
-- per exercise with template and muscle groups, weight from the
-- Gewicht-Challenge), settings and push subscriptions written through
-- security definer functions, and the hourly reminder job.

-- Daily health gains steps (with Garmin's goal), bed and wake time (local
-- wall clock) and VO2max (only on days it changed).
create or replace view sport.v_daily_health as
with days as (
  select distinct day from sport.garmin_daily
)
select
  d.day,
  (s.raw->'heartRate'->>'restingValue')::int as resting_hr,
  (s.raw->'movement'->'steps'->>'value')::int as steps,
  (sl.raw->>'sleepTimeSeconds')::int as sleep_s,
  (sl.raw->>'deepSleepSeconds')::int as deep_s,
  (sl.raw->>'remSleepSeconds')::int as rem_s,
  (sl.raw->'sleepScores'->'overall'->>'value')::int as sleep_score,
  (h.raw->>'lastNightAvg')::int as hrv,
  (h.raw->>'weeklyAvg')::int as hrv_weekly_avg,
  h.raw->>'status' as hrv_status,
  (h.raw->'baseline'->>'balancedLow')::int as hrv_balanced_low,
  (h.raw->'baseline'->>'balancedUpper')::int as hrv_balanced_upper,
  (s.raw->'movement'->'steps'->>'goal')::int as steps_goal,
  to_timestamp((sl.raw->>'sleepStartTimestampLocal')::bigint / 1000.0) at time zone 'UTC' as bed_local,
  to_timestamp((sl.raw->>'sleepEndTimestampLocal')::bigint / 1000.0) at time zone 'UTC' as wake_local,
  (v.raw->>'vo2MaxPreciseValue')::numeric as vo2max
from days d
left join sport.garmin_daily s on s.day = d.day and s.kind = 'summary'
left join sport.garmin_daily sl on sl.day = d.day and sl.kind = 'sleep'
left join sport.garmin_daily h on h.day = d.day and h.kind = 'hrv'
left join sport.garmin_daily v on v.day = d.day and v.kind = 'vo2max';

-- Per exercise and workout: working sets as [[kg, reps], …] too, and the template.
drop view if exists sport.v_hevy_exercise_sessions;
create view sport.v_hevy_exercise_sessions as
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
  max(reps) filter (where rn = 1) as top_reps,
  min(exercise_template_id) as exercise_template_id,
  jsonb_agg(jsonb_build_array(weight_kg, reps) order by rn) as set_list
from ranked
group by workout_id, day, week, exercise;

-- Everything the module shows, for one viewer (their own weighings).
create or replace function sport.dashboard_json(viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
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
        'hrvLow', h.hrv_balanced_low, 'hrvHigh', h.hrv_balanced_upper, 'steps', h.steps, 'stepsGoal', h.steps_goal,
        'bed', h.bed_local, 'wake', h.wake_local, 'vo2max', h.vo2max) order by h.day)
      from sport.v_daily_health h), '[]'::jsonb),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'workoutId', e.workout_id, 'day', e.day, 'exercise', e.exercise, 'assisted', e.assisted,
        'sets', e.sets, 'reps', e.reps, 'volumeKg', round(e.volume_kg::numeric, 1),
        'topWeightKg', e.top_weight_kg, 'topReps', e.top_reps, 'templateId', e.exercise_template_id,
        'setList', e.set_list) order by e.day)
      from sport.v_hevy_exercise_sessions e), '[]'::jsonb),
    -- Muscle groups of the templates the workouts use.
    'templates', coalesce((
      select jsonb_object_agg(t.template_id, jsonb_build_object(
        'title', t.title, 'primary', t.primary_muscle_group, 'secondary', to_jsonb(t.secondary_muscle_groups)))
      from sport.hevy_exercise_templates t
      where t.template_id in (select distinct exercise_template_id from sport.v_hevy_sets)), '{}'::jsonb),
    'workouts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.workout_id, 'title', w.title, 'start', w.start_time,
        'day', (w.start_time at time zone 'Europe/Berlin')::date,
        'durationS', extract(epoch from (w.end_time - w.start_time))::int) order by w.start_time)
      from sport.hevy_workouts w), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.activity_id::text, 'day', a.start_time_local::date, 'type', a.activity_type, 'name', a.name,
        'km', round((a.distance_m / 1000.0)::numeric, 2), 'durationS', round(a.duration_s::numeric),
        'avgHr', a.avg_hr) order by a.start_time_local)
      from sport.garmin_activities a), '[]'::jsonb),
    'weight', coalesce((
      select jsonb_agg(jsonb_build_object('day', e.date, 'kg', e.weight, 'bodyFat', e.body_fat, 'muscle', e.muscle_mass) order by e.date)
      from public.weight_entries e
      join public.weight_participants p on p.id = e.participant_id
      where p.user_id = viewer), '[]'::jsonb),
    'settings', (
      select jsonb_build_object(
        'sleepMinH', s.sleep_min_h, 'sleepMaxH', s.sleep_max_h, 'sleepGoalH', s.sleep_goal_h,
        'gymPerWeek', s.gym_per_week, 'zone1GoalPct', s.zone1_goal_pct, 'stepsGoal', s.steps_goal,
        'planStart', s.plan_start, 'planChanges', s.plan_changes,
        'notifyMorning', s.notify_morning, 'notifyMorningHour', s.notify_morning_hour, 'notifyWeekly', s.notify_weekly)
      from sport.settings s),
    'pushEndpoints', coalesce((select jsonb_agg(p.endpoint) from sport.push_subscriptions p where p.user_id = viewer), '[]'::jsonb),
    'syncRuns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'startedAt', s.started_at, 'finishedAt', s.finished_at, 'ok', s.ok,
        'errors', (select jsonb_object_agg(k, v) from jsonb_each(s.details) as d(k, v) where k like '%error')) order by s.id desc)
      from (select * from sport.sync_runs order by id desc limit 8) s), '[]'::jsonb)
  );
$$;
revoke all on function sport.dashboard_json(uuid) from public, anon, authenticated;

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
  return sport.dashboard_json((select auth.uid()));
end;
$$;

-- Saves the settings the module sends; keys that are missing stay as they are.
create or replace function public.sport_save_settings(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  changes jsonb := p->'planChanges';
begin
  if not (select private.has_module_access('sport')) then
    raise exception 'no access' using errcode = '42501';
  end if;
  if changes is not null then
    if jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes) > 60 or exists (
      select 1 from jsonb_array_elements(changes) c
      where jsonb_typeof(c->'week') <> 'number' or (c->>'week')::int not between 1 and 200
        or coalesce(c->>'action', '') not in ('repeat', 'skip')
    ) then
      raise exception 'invalid plan changes' using errcode = '22023';
    end if;
  end if;
  update sport.settings set
    sleep_min_h = coalesce((p->>'sleepMinH')::numeric, sleep_min_h),
    sleep_max_h = coalesce((p->>'sleepMaxH')::numeric, sleep_max_h),
    sleep_goal_h = coalesce((p->>'sleepGoalH')::numeric, sleep_goal_h),
    gym_per_week = coalesce((p->>'gymPerWeek')::int, gym_per_week),
    zone1_goal_pct = coalesce((p->>'zone1GoalPct')::int, zone1_goal_pct),
    steps_goal = case when p ? 'stepsGoal' then (p->>'stepsGoal')::int else steps_goal end,
    plan_start = coalesce((p->>'planStart')::date, plan_start),
    plan_changes = coalesce(changes, plan_changes),
    notify_morning = coalesce((p->>'notifyMorning')::boolean, notify_morning),
    notify_morning_hour = coalesce((p->>'notifyMorningHour')::int, notify_morning_hour),
    notify_weekly = coalesce((p->>'notifyWeekly')::boolean, notify_weekly),
    updated_at = now()
  where id;
end;
$$;

-- Stores this browser's push subscription and where the app runs.
create or replace function public.sport_save_push(p_endpoint text, p_p256dh text, p_auth text, p_app_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.has_module_access('sport')) then
    raise exception 'no access' using errcode = '42501';
  end if;
  insert into sport.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, (select auth.uid()), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
  update sport.settings set app_url = p_app_url, updated_at = now() where id;
end;
$$;

create or replace function public.sport_delete_push(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from sport.push_subscriptions where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

-- For the app's /api/sport/notify (service role only): checks the shared
-- secret and returns settings, subscriptions, what was sent and the data.
create or replace function public.sport_notify_context(p_secret text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if p_secret is null or p_secret is distinct from (select decrypted_secret from vault.decrypted_secrets where name = 'sport_sync_secret') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select user_id into owner from sport.push_subscriptions order by created_at limit 1;
  return jsonb_build_object(
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'keys', jsonb_build_object('p256dh', p256dh, 'auth', auth)))
      from sport.push_subscriptions), '[]'::jsonb),
    'sent', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'day', day)) from sport.notify_log where day > current_date - 8), '[]'::jsonb),
    'data', case when owner is null then null else sport.dashboard_json(owner) end
  );
end;
$$;

create or replace function public.sport_notify_done(p_secret text, p_kind text, p_day date, p_detail jsonb, p_expired text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or p_secret is distinct from (select decrypted_secret from vault.decrypted_secrets where name = 'sport_sync_secret') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into sport.notify_log (kind, day, detail) values (p_kind, p_day, p_detail) on conflict (kind, day) do nothing;
  delete from sport.push_subscriptions where endpoint = any (coalesce(p_expired, '{}'));
end;
$$;

revoke all on function public.sport_dashboard() from public, anon;
revoke all on function public.sport_save_settings(jsonb) from public, anon;
revoke all on function public.sport_save_push(text, text, text, text) from public, anon;
revoke all on function public.sport_delete_push(text) from public, anon;
revoke all on function public.sport_notify_context(text) from public, anon, authenticated;
revoke all on function public.sport_notify_done(text, text, date, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.sport_dashboard() to authenticated;
grant execute on function public.sport_save_settings(jsonb) to authenticated;
grant execute on function public.sport_save_push(text, text, text, text) to authenticated;
grant execute on function public.sport_delete_push(text) to authenticated;
grant execute on function public.sport_notify_context(text) to service_role;
grant execute on function public.sport_notify_done(text, text, date, jsonb, text[]) to service_role;

-- Hourly: the app decides (Berlin time) whether a reminder is due.
select cron.schedule('sport-notify-hourly', '7 * * * *', $$
  select net.http_post(
    url := s.app_url || '/api/sport/notify',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sport_sync_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 60000)
  from sport.settings s
  where s.app_url is not null and (s.notify_morning or s.notify_weekly)
    and exists (select 1 from sport.push_subscriptions);
$$);
