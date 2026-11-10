-- Packliste: one-off items and the inventory at the destination.
--
-- packing_items.once: added for this trip only ("Nur diesmal", e.g. a gift).
-- Resetting the list deletes the ticked ones; the editor doesn't show them.
--
-- packing_lists.place_id: the place the list packs for (e.g. "Nach Stuttgart"
-- → Stuttgart). The list then shows that place's inventory, so what is
-- already there and what has to come along are in one place. Changing the
-- numbers there changes the inventory itself.

alter table public.packing_items add column if not exists once boolean not null default false;

alter table public.packing_lists
  add column if not exists place_id uuid references public.packing_places (id) on delete set null;

create index if not exists packing_lists_place_id_idx on public.packing_lists (place_id);

create or replace function private.owns_packing_place(place uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select place is null or exists (
    select 1 from public.packing_places p where p.id = place and p.user_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_packing_place(uuid) from public;
grant execute on function private.owns_packing_place(uuid) to authenticated;

drop policy if exists "packing_lists: own rows" on public.packing_lists;
create policy "packing_lists: own rows" on public.packing_lists
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('packing')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('packing'))
    and private.owns_packing_place(place_id)
  );

-- Existing lists named "Nach <Ort>" get that place.
update public.packing_lists l
set place_id = p.id
from public.packing_places p
where l.place_id is null
  and p.user_id = l.user_id
  and lower(l.name) = lower('Nach ' || p.name);
