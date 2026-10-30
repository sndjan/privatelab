-- Tennistraining: variations per exercise, the kids' year of birth, the
-- group's Play+Stay stage and the coach's principles for planning.
--
-- variations: {"easier", "harder", "fewer", "more"}, one short text each
-- (how the exercise gets easier or harder, or fits fewer or more kids).
-- birth_year: the kid's "Jahrgang"; the app shows the age they turn this year.
-- stage: Play+Stay stage of the group ('red' Kleinfeld, 'orange' Midcourt,
-- 'green' Großfeld, 'yellow' for older kids); null = not set.
-- tennis_settings.principles: rules the AI follows when it plans or invents
-- exercises (e.g. the 8-second rule); '' = the app's defaults.

alter table public.tennis_exercises
  add column variations jsonb not null default '{}' check (jsonb_typeof(variations) = 'object' and pg_column_size(variations) <= 4000);

alter table public.tennis_players
  add column birth_year smallint check (birth_year between 1990 and 2030);

alter table public.tennis_groups
  add column stage text check (stage in ('red', 'orange', 'green', 'yellow'));

create table public.tennis_settings (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  principles text not null default '' check (char_length(principles) <= 4000),
  updated_at timestamptz not null default now()
);

alter table public.tennis_settings enable row level security;

grant select, insert, update, delete on public.tennis_settings to authenticated;

create policy "tennis_settings: own row" on public.tennis_settings
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('tennis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('tennis')));
