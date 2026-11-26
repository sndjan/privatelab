-- Kegelkasse: "bezahlt" counts for a whole season, not for each match.
--
-- kegel_season_paid: one row per player who has paid for a season. player is
-- the normalized name (nameKey in src/modules/kegeln/data.ts), season the
-- games' season text ('' = games without a season). No row = not paid.
--
-- Players already ticked off in every one of their matches in a season count
-- as paid for that season. The old per-match "paid" flags stay
-- in kegel_games.lines but are no longer read.

create table if not exists public.kegel_season_paid (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  season text not null check (char_length(season) <= 20),
  player text not null check (char_length(player) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (user_id, season, player)
);

alter table public.kegel_season_paid enable row level security;

grant select, insert, delete on public.kegel_season_paid to authenticated;

drop policy if exists "kegel_season_paid: own rows" on public.kegel_season_paid;
create policy "kegel_season_paid: own rows" on public.kegel_season_paid
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('kegeln')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('kegeln')));

-- Same key as nameKey: lower case without accents, ß as ss, the name parts
-- sorted and joined with a space.
insert into public.kegel_season_paid (user_id, season, player)
select g.user_id, g.season, k.player
from public.kegel_games g
cross join lateral jsonb_array_elements(g.lines) as l(line)
cross join lateral (
  select string_agg(part, ' ' order by part collate "C") as player
  from regexp_split_to_table(
    replace(translate(lower(l.line ->> 'name'), 'äöüàáâãèéêëìíîïòóôõùúûñç', 'aouaaaaeeeeiiiioooouuunc'), 'ß', 'ss'),
    '[^a-z]+'
  ) as part
  where part <> ''
) k
where k.player is not null
group by g.user_id, g.season, k.player
having bool_and(coalesce((l.line ->> 'paid')::boolean, false))
on conflict do nothing;
