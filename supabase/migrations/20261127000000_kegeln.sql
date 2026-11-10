-- Kegelkasse: what each player of a bowling team pays after a match.
--
-- kegel_settings: the team's name (to find our side on the Spielbericht), the
-- threshold for "unter" and the amounts in cents, plus short names per player
-- (keyed by the normalized name, see nameKey in src/modules/kegeln/data.ts).
--
-- kegel_games: one row per match. lines holds one object per player
-- (started, errors, total, mp, mass, twos, golden, sheet, paid). The amounts
-- and threshold are copied into the game, so changing the settings later
-- doesn't change what was owed for earlier matches.

insert into public.modules (id, name) values ('kegeln', 'Kegelkasse')
on conflict (id) do nothing;

create table if not exists public.kegel_settings (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  team text not null default 'Jedesheim' check (char_length(team) between 1 and 80),
  threshold integer not null default 550 check (threshold between 1 and 1199),
  rates jsonb not null default '{"start":100,"point":100,"mass":250,"error":30,"golden":30,"two":50,"under":100}',
  nicknames jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.kegel_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  played_on date,
  matchday integer check (matchday between 1 and 99),
  season text not null default '' check (char_length(season) <= 20),
  opponent text not null default '' check (char_length(opponent) <= 120),
  home boolean,
  threshold integer not null default 550 check (threshold between 1 and 1199),
  rates jsonb not null,
  lines jsonb not null default '[]' check (jsonb_typeof(lines) = 'array'),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kegel_games_user_id_played_on_idx on public.kegel_games (user_id, played_on desc);

alter table public.kegel_settings enable row level security;
alter table public.kegel_games enable row level security;

grant select, insert, update, delete on public.kegel_settings to authenticated;
grant select, insert, update, delete on public.kegel_games to authenticated;

drop policy if exists "kegel_settings: own rows" on public.kegel_settings;
create policy "kegel_settings: own rows" on public.kegel_settings
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('kegeln')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('kegeln')));

drop policy if exists "kegel_games: own rows" on public.kegel_games;
create policy "kegel_games: own rows" on public.kegel_games
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('kegeln')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('kegeln')));
