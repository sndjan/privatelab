-- Wunsch-Liste: own wishlists with a public share link. Guests open the link
-- without an account and reserve a wish (alone or as a group gift), so nobody
-- gives the same present twice.
--
-- Lists and wishes are the owner's rows (RLS as in the other modules).
-- Reservations are not readable through the Data API at all: the share page
-- and the owner view read and write them on the server with the secret key,
-- so the owner never sees who reserved a wish until it is marked received,
-- and guests only reach a list through its share token.

insert into public.modules (id, name) values ('wishlist', 'Wunsch-Liste')
on conflict (id) do nothing;

-- share_token is the secret part of the public link /w/<token>. Creating a
-- new one makes the old link stop working.
create table public.wishlist_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  occasion_date date,
  share_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index wishlist_lists_user_id_idx on public.wishlist_lists (user_id);

-- quantity: how many of it may be given (e.g. 2 glasses); every reservation
-- takes one. favorite = Herzenswunsch. received_at set = archived, with the
-- names of the givers copied into received_from.
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  list_id uuid not null references public.wishlist_lists (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  url text check (char_length(url) <= 2000),
  image_url text check (char_length(image_url) <= 2000),
  price numeric(10, 2) check (price >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  note text not null default '' check (char_length(note) <= 1000),
  quantity integer not null default 1 check (quantity between 1 and 99),
  favorite boolean not null default false,
  received_at timestamptz,
  received_from text[] not null default '{}' check (cardinality(received_from) <= 50),
  created_at timestamptz not null default now()
);

create index wishlist_items_list_id_idx on public.wishlist_items (list_id);
create index wishlist_items_user_id_idx on public.wishlist_items (user_id);

-- One reservation takes one of the wish's quantity. A group reservation is
-- open for others to join ("zusammen schenken").
create table public.wishlist_claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.wishlist_items (id) on delete cascade,
  is_group boolean not null default false,
  created_at timestamptz not null default now()
);

create index wishlist_claims_item_id_idx on public.wishlist_claims (item_id);

-- The people behind a reservation. device_hash is the SHA-256 of a random
-- token in the guest's cookie: only that browser can undo the reservation.
create table public.wishlist_claim_members (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.wishlist_claims (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 60),
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (claim_id, device_hash)
);

create index wishlist_claim_members_device_hash_idx on public.wishlist_claim_members (device_hash);

alter table public.wishlist_lists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.wishlist_claims enable row level security;
alter table public.wishlist_claim_members enable row level security;

grant select, insert, update, delete on public.wishlist_lists, public.wishlist_items to authenticated;
-- No policies and no grants: only the secret key (service_role) reaches these.
revoke all on public.wishlist_claims, public.wishlist_claim_members from anon, authenticated;

create or replace function private.owns_wishlist(list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wishlist_lists l where l.id = list and l.user_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_wishlist(uuid) from public;
grant execute on function private.owns_wishlist(uuid) to authenticated;

create policy "wishlist_lists: own rows" on public.wishlist_lists
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('wishlist')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('wishlist')));

create policy "wishlist_items: own rows" on public.wishlist_items
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('wishlist')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('wishlist'))
    and private.owns_wishlist(list_id)
  );

-- Reserves one of a wish for a guest. Locks the wish so two guests can't take
-- the last one at the same time. Returns false when nothing is left.
create or replace function public.wishlist_claim(
  target_item uuid,
  group_gift boolean,
  guest_name text,
  guest_device_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  available integer;
  new_claim uuid;
begin
  select i.quantity into available
  from public.wishlist_items i
  where i.id = target_item and i.received_at is null
  for update;
  if available is null then
    return false;
  end if;

  if (select count(*) from public.wishlist_claims c where c.item_id = target_item) >= available then
    return false;
  end if;

  insert into public.wishlist_claims (item_id, is_group) values (target_item, group_gift)
  returning id into new_claim;
  insert into public.wishlist_claim_members (claim_id, name, device_hash)
  values (new_claim, guest_name, guest_device_hash);
  return true;
end;
$$;

revoke all on function public.wishlist_claim(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.wishlist_claim(uuid, boolean, text, text) to service_role;
