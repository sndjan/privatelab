-- Work time module ("Arbeitszeit-Tracker"): settings with an opening
-- overtime balance, work time models (hours per weekday and vacation days
-- per month, valid from a date), days that differ from the standard, and
-- vacation blocks. Every user only sees their own rows, and only with access
-- to the 'worktime' module.

insert into public.modules (id, name) values ('worktime', 'Arbeitszeit-Tracker')
on conflict (id) do nothing;

-- opening_balance_minutes is the overtime balance at the end of opening_date;
-- days after it are counted on top. Times are minutes since midnight.
-- christmas_mode: how 24.12. and 31.12. count ('work', 'half' or 'off').
create table public.worktime_settings (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  employer text check (char_length(employer) <= 60),
  opening_balance_minutes integer not null default 0 check (opening_balance_minutes between -100000 and 100000),
  opening_date date,
  default_start_minute integer not null default 450 check (default_start_minute between 0 and 1439),
  default_break_minutes integer not null default 60 check (default_break_minutes between 0 and 240),
  christmas_mode text not null default 'work' check (christmas_mode in ('work', 'half', 'off')),
  updated_at timestamptz not null default now()
);

-- A model is valid from valid_from until the next model starts.
-- weekday_minutes: target minutes for Monday to Sunday.
create table public.worktime_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  valid_from date not null,
  label text not null default '' check (char_length(label) <= 60),
  weekday_minutes integer[] not null
    check (
      cardinality(weekday_minutes) = 7
      and array_position(weekday_minutes, null) is null
      and 0 <= all (weekday_minutes)
      and 960 >= all (weekday_minutes)
    ),
  vacation_days_per_month numeric(4, 2) not null default 2 check (vacation_days_per_month between 0 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, valid_from)
);

-- Only days that differ from the standard are stored. kind 'work' has times;
-- 'sick' counts as the target met; 'overtime_off' is a day off paid from overtime.
create table public.worktime_days (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('work', 'sick', 'overtime_off')),
  start_minute integer,
  end_minute integer,
  break_minutes integer not null default 0,
  primary key (user_id, day),
  check (
    kind <> 'work' or (
      start_minute between 0 and 1439
      and end_minute between 1 and 1440
      and end_minute > start_minute
      and break_minutes >= 0
      and break_minutes < end_minute - start_minute
    )
  )
);

create table public.worktime_vacations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text check (char_length(note) <= 120),
  in_calendar boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 366)
);

create index worktime_vacations_user_id_idx on public.worktime_vacations (user_id, start_date);

alter table public.worktime_settings enable row level security;
alter table public.worktime_periods enable row level security;
alter table public.worktime_days enable row level security;
alter table public.worktime_vacations enable row level security;

grant select, insert, update, delete on
  public.worktime_settings,
  public.worktime_periods,
  public.worktime_days,
  public.worktime_vacations
to authenticated;

create policy "worktime_settings: own rows" on public.worktime_settings
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('worktime')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('worktime')));

create policy "worktime_periods: own rows" on public.worktime_periods
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('worktime')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('worktime')));

create policy "worktime_days: own rows" on public.worktime_days
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('worktime')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('worktime')));

create policy "worktime_vacations: own rows" on public.worktime_vacations
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('worktime')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('worktime')));

-- Starting data for the admin: +33.5 h overtime up to 26.10.2026, Werkstudent
-- (1 vacation day per month) until August, full time (2 per month) from
-- September, and the vacation taken in 2026.

insert into public.worktime_settings (user_id, employer, opening_balance_minutes, opening_date)
select id, 'IconCXM', 2010, date '2026-10-26' from public.profiles where is_admin
on conflict (user_id) do nothing;

insert into public.worktime_periods (user_id, valid_from, label, weekday_minutes, vacation_days_per_month)
select id, date '2026-01-01', 'Werkstudent', array[480, 480, 480, 480, 480, 0, 0], 1 from public.profiles where is_admin
union all
select id, date '2026-09-01', 'Vollzeit 40 h', array[480, 480, 480, 480, 480, 0, 0], 2 from public.profiles where is_admin
on conflict (user_id, valid_from) do nothing;

insert into public.worktime_vacations (user_id, start_date, end_date, in_calendar)
select p.id, v.start_date, v.end_date, true
from public.profiles p
cross join (
  values
    (date '2026-04-10', date '2026-04-10'),
    (date '2026-06-10', date '2026-06-10'),
    (date '2026-07-10', date '2026-07-10'),
    (date '2026-09-28', date '2026-10-09')
) as v (start_date, end_date)
where p.is_admin
  and not exists (select 1 from public.worktime_vacations w where w.user_id = p.id);
