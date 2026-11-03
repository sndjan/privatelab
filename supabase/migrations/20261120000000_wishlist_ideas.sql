-- Wunsch-Liste: ideas. Notes on a list for wishes that aren't decided yet
-- ("Rasierer, noch einen aussuchen"). Only the owner sees them: they are not
-- on the share page. "Als Wunsch eintragen" turns one into a wish.

create table public.wishlist_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  list_id uuid not null references public.wishlist_lists (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  created_at timestamptz not null default now()
);

create index wishlist_ideas_list_id_idx on public.wishlist_ideas (list_id);
create index wishlist_ideas_user_id_idx on public.wishlist_ideas (user_id);

alter table public.wishlist_ideas enable row level security;

grant select, insert, update, delete on public.wishlist_ideas to authenticated;

create policy "wishlist_ideas: own rows" on public.wishlist_ideas
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('wishlist')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('wishlist'))
    and private.owns_wishlist(list_id)
  );
