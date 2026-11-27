-- Kanzlei-Planer: a personal work planner for a tax office. Clients are only
-- 5-digit numbers (the mapping to names lives outside the app). Claude plans
-- the day and reads chat messages; every change it proposes is confirmed by
-- the user and written here, so the data never lives only in a chat.
--
-- kanzlei_settings:  one row per user: net minutes per weekday, the split
--                    into orders / daily business / buffer, defaults.
-- kanzlei_types:     freely extensible kinds of work, each either an
--                    "auftrag" (client order) or an "aufgabe" (small task).
-- kanzlei_items:     orders and tasks. A task may belong to an order.
-- kanzlei_recurring: templates that create an order per month, quarter or
--                    year (FiBu, Lohn, …).
-- kanzlei_absences:  vacation and other days off.
-- kanzlei_history:   every change with the row before and after, for undo.
-- kanzlei_plans:     the day plan Claude made, one per user and day.

insert into public.modules (id, name) values ('kanzlei', 'Kanzlei-Planer')
on conflict (id) do nothing;

create table public.kanzlei_settings (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  -- Net minutes Monday … Sunday.
  day_minutes integer[] not null default '{480,480,480,450,300,0,0}'
    check (array_length(day_minutes, 1) = 7),
  start_time text not null default '08:00' check (start_time ~ '^\d{2}:\d{2}$'),
  break_minutes integer not null default 30 check (break_minutes between 0 and 240),
  share_orders integer not null default 60 check (share_orders between 0 and 100),
  share_daily integer not null default 30 check (share_daily between 0 and 100),
  share_buffer integer not null default 10 check (share_buffer between 0 and 100),
  followup_workdays integer not null default 10 check (followup_workdays between 1 and 120),
  task_minutes integer not null default 10 check (task_minutes between 1 and 600),
  holiday_state text not null default 'BW' check (holiday_state in ('BW', 'BY')),
  updated_at timestamptz not null default now()
);

create table public.kanzlei_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind text not null check (kind in ('auftrag', 'aufgabe')),
  default_minutes integer not null default 60 check (default_minutes between 0 and 10000),
  color text not null default 'gray',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index kanzlei_types_user_idx on public.kanzlei_types (user_id, position);

create table public.kanzlei_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  client text not null default '' check (client ~ '^(\d{5})?$'),
  type_id uuid references public.kanzlei_types (id) on delete set null,
  title text not null default '' check (char_length(title) <= 120),
  rhythm text not null check (rhythm in ('monthly', 'quarterly', 'yearly')),
  estimate_minutes integer not null default 60 check (estimate_minutes between 0 and 10000),
  -- Deadlines as days after the end of the period (e.g. 10 for the UStVA).
  internal_offset_days integer check (internal_offset_days between -366 and 730),
  legal_offset_days integer check (legal_offset_days between -366 and 730),
  -- The first day of the next period to create an order for.
  next_period date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.kanzlei_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('auftrag', 'aufgabe')),
  client text not null default '' check (client ~ '^(\d{5})?$'),
  type_id uuid references public.kanzlei_types (id) on delete set null,
  title text not null default '' check (char_length(title) <= 200),
  period text not null default '' check (char_length(period) <= 40),
  status text not null,
  -- 1 dringend, 2 normal, 3 niedrig.
  priority smallint not null default 2 check (priority between 1 and 3),
  deadline_legal date,
  deadline_internal date,
  estimate_minutes integer not null default 0 check (estimate_minutes between 0 and 100000),
  remaining_minutes integer not null default 0 check (remaining_minutes between 0 and 100000),
  docs_at date,
  follow_up date,
  -- Fixed for this day by the user.
  planned_for date,
  next_step text not null default '' check (char_length(next_step) <= 300),
  -- Private note, never sent to the AI.
  note text not null default '' check (char_length(note) <= 4000),
  parent_id uuid references public.kanzlei_items (id) on delete set null,
  depends_on uuid references public.kanzlei_items (id) on delete set null,
  recurring_id uuid references public.kanzlei_recurring (id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kanzlei_items_status check (
    (kind = 'auftrag' and status in ('warte_unterlagen', 'teilweise', 'bearbeitbar', 'in_bearbeitung',
      'warte_rueckmeldung', 'kontrolle', 'nachbearbeitung', 'erledigt'))
    or (kind = 'aufgabe' and status in ('offen', 'wartet', 'erledigt'))
  )
);

create index kanzlei_items_user_idx on public.kanzlei_items (user_id, status);
create unique index kanzlei_items_recurring_period_idx on public.kanzlei_items (recurring_id, period)
  where recurring_id is not null;

create table public.kanzlei_absences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  label text not null default 'Urlaub' check (char_length(label) <= 60),
  created_at timestamptz not null default now(),
  constraint kanzlei_absences_dates check (end_date >= start_date)
);

create table public.kanzlei_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_id uuid,
  source text not null check (source in ('user', 'ki', 'auto')),
  summary text not null check (char_length(summary) <= 300),
  before jsonb,
  after jsonb,
  undone boolean not null default false,
  created_at timestamptz not null default now()
);

create index kanzlei_history_user_idx on public.kanzlei_history (user_id, created_at desc);

create table public.kanzlei_plans (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null,
  plan jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

do $$
declare
  t text;
begin
  foreach t in array array['kanzlei_settings', 'kanzlei_types', 'kanzlei_recurring', 'kanzlei_items',
    'kanzlei_absences', 'kanzlei_history', 'kanzlei_plans']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy "%s: own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id and (select private.has_module_access(''kanzlei'')))
         with check ((select auth.uid()) = user_id and (select private.has_module_access(''kanzlei'')))',
      t, t);
  end loop;
end $$;
