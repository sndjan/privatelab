-- Core schema for Private Lab: profiles, modules and per-user module access.

-- Helper functions live in a schema that is not exposed through the Data API.
create schema if not exists private;
grant usage on schema private to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- One row per module in src/modules/registry.ts.
-- visibility: 'private' = only users with access, 'public' = anyone can view.
create table public.modules (
  id text primary key,
  name text not null,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now()
);

-- role: 'user' = uses the module with their own data, 'viewer' = read-only.
create table public.module_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  module_id text not null references public.modules (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

create index module_access_module_id_idx on public.module_access (module_id);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies can read profiles/module_access
-- without recursive RLS; each one only answers for the calling user)
-- ---------------------------------------------------------------------------

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create or replace function private.has_module_access(target_module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or exists (
      select 1 from public.module_access a
      where a.user_id = (select auth.uid()) and a.module_id = target_module
    );
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.has_module_access(text) from public;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.has_module_access(text) to authenticated;

-- Create a profile row whenever an auth user is created (e.g. by the admin page).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.modules enable row level security;
alter table public.module_access enable row level security;

grant select on public.profiles, public.module_access to authenticated;
grant select on public.modules to anon, authenticated;

-- Profiles: users see themselves, admins see everyone. No user-facing writes;
-- is_admin is only changed via SQL or the secret key.
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or (select private.is_admin()));

-- Modules: public modules are visible to everyone, private ones to users with access.
create policy "modules: read public" on public.modules
  for select to anon, authenticated
  using (visibility = 'public');

create policy "modules: read with access" on public.modules
  for select to authenticated
  using ((select private.has_module_access(id)));

-- Module access: users see their own grants, admins see all.
create policy "module_access: read own or admin" on public.module_access
  for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Seed modules
-- ---------------------------------------------------------------------------

insert into public.modules (id, name) values
  ('books', 'Books'),
  ('fire', 'FIRE')
on conflict (id) do nothing;
