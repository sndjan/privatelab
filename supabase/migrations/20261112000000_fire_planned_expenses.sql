-- FIRE module: planned one-off expenses, e.g. "Auto, März 2028, 25.000 €".
-- The projection takes them out of net worth in their month, so money that
-- is already spoken for doesn't count towards the FIRE number.

create table public.fire_planned_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  amount numeric(14, 2) not null check (amount > 0),
  -- First day of the month the money is spent.
  month date not null check (extract(day from month) = 1),
  created_at timestamptz not null default now()
);

create index fire_planned_expenses_user_id_idx on public.fire_planned_expenses (user_id, month);

alter table public.fire_planned_expenses enable row level security;

grant select, insert, update, delete on public.fire_planned_expenses to authenticated;

create policy "fire_planned_expenses: own rows" on public.fire_planned_expenses
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('fire')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('fire')));
