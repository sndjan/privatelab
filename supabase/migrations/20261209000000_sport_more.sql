-- Sport: more synced data (Hevy routines and exercise templates with muscle
-- groups), the module's settings (goals, plan changes, reminders) and push
-- subscriptions for reminders. All in the unexposed schema sport; the module
-- reads and writes through security definer functions (next migration).

create table sport.hevy_routines (
  routine_id text primary key,
  title text,
  folder_id bigint,
  updated_at timestamptz,
  raw jsonb not null,
  synced_at timestamptz not null default now()
);

create table sport.hevy_exercise_templates (
  template_id text primary key,
  title text,
  type text,
  primary_muscle_group text,
  secondary_muscle_groups text[] not null default '{}',
  is_custom boolean not null default false,
  raw jsonb not null,
  synced_at timestamptz not null default now()
);

-- One row: goals, the running plan's start and changes, reminders.
create table sport.settings (
  id boolean primary key default true check (id),
  sleep_min_h numeric(3, 1) not null default 7 check (sleep_min_h between 3 and 12),
  sleep_max_h numeric(3, 1) not null default 9 check (sleep_max_h between 3 and 14),
  sleep_goal_h numeric(3, 1) not null default 7.5 check (sleep_goal_h between 3 and 12),
  gym_per_week int not null default 3 check (gym_per_week between 0 and 7),
  zone1_goal_pct int not null default 90 check (zone1_goal_pct between 0 and 100),
  -- null: Garmin's own daily step goal
  steps_goal int check (steps_goal between 1000 and 50000),
  plan_start date not null default '2026-11-23',
  -- [{ "week": 3, "action": "repeat" | "skip" }] in the order they were made
  plan_changes jsonb not null default '[]'::jsonb,
  notify_morning boolean not null default false,
  notify_morning_hour int not null default 7 check (notify_morning_hour between 4 and 11),
  notify_weekly boolean not null default false,
  -- Origin of the app (e.g. https://lab.example.com), saved when reminders are
  -- switched on, so the hourly cron job knows where to call /api/sport/notify.
  app_url text check (app_url ~ '^https://[a-z0-9.-]+(:[0-9]+)?$'),
  updated_at timestamptz not null default now()
);
insert into sport.settings default values;

create table sport.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- What reminders were sent, so each goes out once per day.
create table sport.notify_log (
  kind text not null,
  day date not null,
  sent_at timestamptz not null default now(),
  detail jsonb,
  primary key (kind, day)
);

alter table sport.hevy_routines enable row level security;
alter table sport.hevy_exercise_templates enable row level security;
alter table sport.settings enable row level security;
alter table sport.push_subscriptions enable row level security;
alter table sport.notify_log enable row level security;
