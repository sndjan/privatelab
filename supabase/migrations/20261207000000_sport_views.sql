-- Sport: views for the dashboard. Weeks start on Monday (ISO). Garmin
-- activity times are local already; Hevy times are converted to Berlin time.

-- Runs: every Garmin activity whose type contains "running" (running,
-- treadmill_running, indoor_running, trail_running, ...).
-- Zone 1 of the running plan is "under 145 bpm". Garmin only reports time per
-- Garmin zone (hrTimeInZone_1..5), so the time in Garmin zones 1 + 2 counts as
-- easy. With the current Garmin zones that is roughly under 149 bpm; set the
-- top of Garmin zone 2 to 145 bpm in Garmin Connect to make it exact.
-- Runs without zone times count completely as easy when their average heart
-- rate is under 145 bpm, otherwise completely as above.
create or replace view sport.v_runs as
select
  a.activity_id,
  a.start_time_local,
  a.start_time_local::date as day,
  date_trunc('week', a.start_time_local)::date as week,
  a.activity_type,
  a.name,
  a.distance_m / 1000.0 as km,
  a.duration_s,
  a.avg_hr,
  a.max_hr,
  case when a.duration_s > 0 and a.distance_m > 0 then a.duration_s / (a.distance_m / 1000.0) end as pace_s_per_km,
  case
    when a.raw ? 'hrTimeInZone_1' then 'zones'
    when a.avg_hr is not null then 'avg_hr'
    else 'none'
  end as zone_source,
  case
    when a.raw ? 'hrTimeInZone_1' then
      coalesce((a.raw->>'hrTimeInZone_1')::double precision, 0) + coalesce((a.raw->>'hrTimeInZone_2')::double precision, 0)
    when a.avg_hr < 145 then a.duration_s
    when a.avg_hr is not null then 0
  end as easy_s,
  case
    when a.raw ? 'hrTimeInZone_1' then
      coalesce((a.raw->>'hrTimeInZone_3')::double precision, 0) + coalesce((a.raw->>'hrTimeInZone_4')::double precision, 0)
      + coalesce((a.raw->>'hrTimeInZone_5')::double precision, 0)
    when a.avg_hr >= 145 then a.duration_s
    when a.avg_hr is not null then 0
  end as hard_s
from sport.garmin_activities a
where a.activity_type like '%running%';

-- Running kilometres, time and zone split per week.
create or replace view sport.v_run_weekly as
select
  week,
  count(*) as runs,
  sum(km) as km,
  sum(duration_s) / 60.0 as minutes,
  sum(easy_s) / 60.0 as easy_minutes,
  sum(hard_s) / 60.0 as hard_minutes,
  sum(duration_s) filter (where zone_source = 'none') / 60.0 as no_hr_minutes,
  max(km) as longest_km,
  max(duration_s) / 60.0 as longest_minutes
from sport.v_runs
group by week;

-- Resting heart rate, sleep and HRV per day.
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
  (h.raw->'baseline'->>'balancedUpper')::int as hrv_balanced_upper
from days d
left join sport.garmin_daily s on s.day = d.day and s.kind = 'summary'
left join sport.garmin_daily sl on sl.day = d.day and sl.kind = 'sleep'
left join sport.garmin_daily h on h.day = d.day and h.kind = 'hrv';

-- One row per Hevy set (warm-up sets included, marked by set_type).
create or replace view sport.v_hevy_sets as
select
  w.workout_id,
  w.title as workout_title,
  (w.start_time at time zone 'Europe/Berlin')::date as day,
  date_trunc('week', w.start_time at time zone 'Europe/Berlin')::date as week,
  e.value->>'title' as exercise,
  e.value->>'exercise_template_id' as exercise_template_id,
  s.value->>'type' as set_type,
  (s.value->>'weight_kg')::double precision as weight_kg,
  (s.value->>'reps')::int as reps
from sport.hevy_workouts w
cross join lateral jsonb_array_elements(w.raw->'exercises') e
cross join lateral jsonb_array_elements(e.value->'sets') s;

-- Volume (kg x reps) per week and exercise, working sets only (no warm-up).
-- Assisted exercises (e.g. "Klimmzüge (Unterstützt)") log the assistance as
-- weight, so their volume is not comparable; they are flagged.
create or replace view sport.v_hevy_volume_weekly as
select
  week,
  exercise,
  exercise ~* 'unterstützt|assisted' as assisted,
  count(*) as sets,
  sum(reps) as reps,
  sum(coalesce(weight_kg, 0) * coalesce(reps, 0)) as volume_kg,
  max(weight_kg) as top_weight_kg
from sport.v_hevy_sets
where set_type is distinct from 'warmup'
group by week, exercise;

-- Training per day: runs and other Garmin activities, plus gym from Hevy
-- (Garmin strength_training counts as gym too).
create or replace view sport.v_training_days as
with acts as (
  select start_time_local::date as day,
    activity_type like '%running%' as is_run,
    activity_type = 'strength_training' as is_gym,
    not (activity_type like '%running%' or activity_type = 'strength_training') as is_other
  from sport.garmin_activities
  union all
  select (start_time at time zone 'Europe/Berlin')::date, false, true, false
  from sport.hevy_workouts
)
select day,
  date_trunc('week', day)::date as week,
  bool_or(is_run) as run,
  bool_or(is_gym) as gym,
  bool_or(is_other) as other
from acts
group by day;

-- Training days per week.
create or replace view sport.v_training_days_weekly as
select week,
  count(*) as training_days,
  count(*) filter (where run) as run_days,
  count(*) filter (where gym) as gym_days,
  count(*) filter (where other) as other_days
from sport.v_training_days
group by week;
