-- Tennis trainer module ("Tennistraining"): a collection of exercises with a
-- court diagram each, training groups with favorite exercises, and planned
-- sessions. Every user only sees their own rows, and only with access to the
-- 'tennis' module.

insert into public.modules (id, name) values ('tennis', 'Tennistraining')
on conflict (id) do nothing;

-- start_time and minutes prefill a new session for the group.
create table public.tennis_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  note text not null default '' check (char_length(note) <= 500),
  start_time time not null default '16:00',
  minutes integer not null default 60 check (minutes between 15 and 180),
  created_at timestamptz not null default now()
);

create index tennis_groups_user_id_idx on public.tennis_groups (user_id);

-- diagram: { "items": [...] } as described in src/modules/tennis/data.ts.
-- tips: short cues to call out while the kids play.
create table public.tennis_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phase text not null default 'technique' check (phase in ('warmup', 'technique', 'game', 'cooldown')),
  minutes integer not null default 10 check (minutes between 5 and 60),
  summary text not null default '' check (char_length(summary) <= 200),
  description text not null default '' check (char_length(description) <= 2000),
  tips text[] not null default '{}' check (cardinality(tips) <= 6),
  focus text[] not null default '{}' check (cardinality(focus) <= 8),
  diagram jsonb not null default '{"items": []}' check (pg_column_size(diagram) <= 20000),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);

create index tennis_exercises_user_id_idx on public.tennis_exercises (user_id);

create table public.tennis_favorites (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  group_id uuid not null references public.tennis_groups (id) on delete cascade,
  exercise_id uuid not null references public.tennis_exercises (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, exercise_id)
);

create index tennis_favorites_exercise_id_idx on public.tennis_favorites (exercise_id);
create index tennis_favorites_user_id_idx on public.tennis_favorites (user_id);

-- plan: [{ "exerciseId": uuid, "minutes": 10 }, ...] in order. Items of
-- deleted exercises are skipped when shown.
create table public.tennis_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  group_id uuid references public.tennis_groups (id) on delete set null,
  date date not null,
  start_time time not null,
  minutes integer not null check (minutes between 5 and 300),
  focus text check (char_length(focus) <= 40),
  plan jsonb not null default '[]' check (jsonb_typeof(plan) = 'array' and pg_column_size(plan) <= 10000),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create index tennis_sessions_user_id_idx on public.tennis_sessions (user_id, date desc);
create index tennis_sessions_group_id_idx on public.tennis_sessions (group_id);

alter table public.tennis_groups enable row level security;
alter table public.tennis_exercises enable row level security;
alter table public.tennis_favorites enable row level security;
alter table public.tennis_sessions enable row level security;

grant select, insert, update, delete on
  public.tennis_groups,
  public.tennis_exercises,
  public.tennis_favorites,
  public.tennis_sessions
to authenticated;

-- Rows that point at another row must point at the same user's row.

create or replace function private.owns_tennis_group(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target is null or exists (
    select 1 from public.tennis_groups g where g.id = target and g.user_id = (select auth.uid())
  );
$$;

create or replace function private.owns_tennis_exercise(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tennis_exercises e where e.id = target and e.user_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_tennis_group(uuid) from public;
revoke all on function private.owns_tennis_exercise(uuid) from public;
grant execute on function private.owns_tennis_group(uuid) to authenticated;
grant execute on function private.owns_tennis_exercise(uuid) to authenticated;

create policy "tennis_groups: own rows" on public.tennis_groups
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('tennis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('tennis')));

create policy "tennis_exercises: own rows" on public.tennis_exercises
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('tennis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('tennis')));

create policy "tennis_favorites: own rows" on public.tennis_favorites
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('tennis')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('tennis'))
    and private.owns_tennis_group(group_id)
    and private.owns_tennis_exercise(exercise_id)
  );

create policy "tennis_sessions: own rows" on public.tennis_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('tennis')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('tennis'))
    and private.owns_tennis_group(group_id)
  );
