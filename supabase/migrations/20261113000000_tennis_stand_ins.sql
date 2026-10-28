-- Tennistraining: who usually coaches a group, and the dates I stand in.
-- coach '' = I coach the group myself (its weekday counts as my training
-- day); otherwise the name of the regular coach, and only the stand-in
-- dates are mine.

alter table public.tennis_groups
  add column coach text not null default '' check (char_length(coach) <= 60);

create table public.tennis_stand_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  group_id uuid not null references public.tennis_groups (id) on delete cascade,
  date date not null,
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (group_id, date)
);

create index tennis_stand_ins_user_id_idx on public.tennis_stand_ins (user_id, date);

alter table public.tennis_stand_ins enable row level security;

grant select, insert, update, delete on public.tennis_stand_ins to authenticated;

create policy "tennis_stand_ins: own rows" on public.tennis_stand_ins
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('tennis')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('tennis'))
    and private.owns_tennis_group(group_id)
  );
