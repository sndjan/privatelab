-- Fokusküche: a focus timer that cooks a menu while you work.
--
-- fokus_sessions: one row per evening. The timer is stored as seconds counted
-- so far plus, while it runs, the moment it was last started (anchor_at), so
-- any device shows the same clock. focus_seconds only counts focus time
-- (3 × 45 minutes = 8100); the kitchen stands still during a break. A user has
-- at most one unfinished evening; finished ones are the history.
--
-- fokus_settings: sound and notification at the end of a round or break.

insert into public.modules (id, name) values ('fokus', 'Fokusküche')
on conflict (id) do nothing;

create table public.fokus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  menu text not null default 'italienischer-abend' check (char_length(menu) between 1 and 60),
  phase text not null default 'focus' check (phase in ('focus', 'break', 'done')),
  focus_seconds integer not null default 0 check (focus_seconds between 0 and 8100),
  break_seconds integer not null default 0 check (break_seconds between 0 and 900),
  running boolean not null default false,
  anchor_at timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint fokus_sessions_running_has_anchor check (not running or anchor_at is not null)
);

create unique index fokus_sessions_one_open_idx on public.fokus_sessions (user_id) where finished_at is null;
create index fokus_sessions_user_id_finished_at_idx on public.fokus_sessions (user_id, finished_at desc);

create table public.fokus_settings (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  sound boolean not null default true,
  notify boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.fokus_sessions enable row level security;
alter table public.fokus_settings enable row level security;

grant select, insert, update, delete on public.fokus_sessions to authenticated;
grant select, insert, update, delete on public.fokus_settings to authenticated;

create policy "fokus_sessions: own rows" on public.fokus_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('fokus')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('fokus')));

create policy "fokus_settings: own rows" on public.fokus_settings
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('fokus')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('fokus')));
