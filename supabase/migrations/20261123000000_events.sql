-- Ereignis-Tracker: track things that happen, e.g. being ill or eating meat.
--
-- event_types: what a user tracks. A type is either a moment (one date per
-- entry, several per day allowed) or a span (start and end day; an empty end
-- means it is still going on). Amount (with a unit) and a 1–5 rating are
-- switched on per type. A type can have a goal: at most / at least
-- goal_count per week (Monday–Sunday), month or year; moments count
-- entries, spans count days.
--
-- event_entries: one row per logged event.

insert into public.modules (id, name) values ('events', 'Ereignis-Tracker')
on conflict (id) do nothing;

create table public.event_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  emoji text not null default '📌' check (char_length(emoji) between 1 and 16),
  color text not null default 'blue'
    check (color in ('red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink', 'gray')),
  kind text not null check (kind in ('moment', 'span')),
  track_amount boolean not null default false,
  amount_unit text not null default '' check (char_length(amount_unit) <= 16),
  track_rating boolean not null default false,
  goal_kind text check (goal_kind in ('max', 'min')),
  goal_count integer check (goal_count between 0 and 1000),
  goal_period text check (goal_period in ('week', 'month', 'year')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint event_types_goal_complete check (
    (goal_kind is null and goal_count is null and goal_period is null)
    or (goal_kind is not null and goal_count is not null and goal_period is not null)
  )
);

create index event_types_user_id_position_idx on public.event_types (user_id, position);

create table public.event_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type_id uuid not null references public.event_types (id) on delete cascade,
  start_date date not null,
  end_date date,
  note text not null default '' check (char_length(note) <= 1000),
  amount numeric(12, 2),
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  constraint event_entries_dates check (end_date is null or end_date >= start_date)
);

create index event_entries_user_id_start_date_idx on public.event_entries (user_id, start_date desc);
create index event_entries_type_id_idx on public.event_entries (type_id);

alter table public.event_types enable row level security;
alter table public.event_entries enable row level security;

grant select, insert, update, delete on public.event_types to authenticated;
grant select, insert, update, delete on public.event_entries to authenticated;

create policy "event_types: own rows" on public.event_types
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('events')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('events')));

-- An entry may only point at one of the user's own types.
create policy "event_entries: own rows" on public.event_entries
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('events')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('events'))
    and exists (select 1 from public.event_types t where t.id = type_id and t.user_id = (select auth.uid()))
  );
