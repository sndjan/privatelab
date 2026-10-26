-- FIRE module: per-user settings, accounts and monthly account balances.
-- Every user only sees their own rows, and only with access to the 'fire' module.

create table public.fire_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  monthly_income numeric(14, 2) not null default 0 check (monthly_income >= 0),
  monthly_expenses numeric(14, 2) not null default 0 check (monthly_expenses >= 0),
  -- Percentages, e.g. 4 = 4 %.
  withdrawal_rate numeric(5, 2) not null default 4 check (withdrawal_rate > 0 and withdrawal_rate <= 20),
  expected_return numeric(5, 2) not null default 5 check (expected_return > -50 and expected_return <= 50),
  updated_at timestamptz not null default now()
);

-- kind 'debt' balances are entered as positive numbers and subtracted from net worth.
create table public.fire_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'investment'
    check (kind in ('investment', 'cash', 'pension', 'property', 'debt')),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index fire_accounts_user_id_idx on public.fire_accounts (user_id);

-- One balance per account and month; month is always the first day of the month.
create table public.fire_balances (
  account_id uuid not null references public.fire_accounts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  balance numeric(14, 2) not null,
  primary key (account_id, month)
);

create index fire_balances_user_id_month_idx on public.fire_balances (user_id, month);

alter table public.fire_settings enable row level security;
alter table public.fire_accounts enable row level security;
alter table public.fire_balances enable row level security;

grant select, insert, update, delete on public.fire_settings, public.fire_accounts, public.fire_balances to authenticated;

create policy "fire_settings: own rows" on public.fire_settings
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('fire')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('fire')));

create policy "fire_accounts: own rows" on public.fire_accounts
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('fire')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('fire')));

-- The balance's account must belong to the same user.
create policy "fire_balances: own rows" on public.fire_balances
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('fire')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('fire'))
    and exists (
      select 1 from public.fire_accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
  );
