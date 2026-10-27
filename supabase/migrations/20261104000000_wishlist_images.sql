-- Wunsch-Liste, second version: own images and no group gifts.
--
-- Images: a public bucket (guests see the images on the share page without
-- an account; the file names are random). Users upload into a folder named
-- after their user id, only with access to the 'wishlist' module.
--
-- Group gifts are gone: every reservation is one person again. Existing
-- group reservations stay as reservations with all their members.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wishlist-images', 'wishlist-images', true, 2097152, '{image/webp,image/jpeg,image/png}')
on conflict (id) do nothing;

create policy "wishlist-images: read own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'wishlist-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "wishlist-images: upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'wishlist-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.has_module_access('wishlist'))
  );

create policy "wishlist-images: delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'wishlist-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop function if exists public.wishlist_claim(uuid, boolean, text, text);
alter table public.wishlist_claims drop column if exists is_group;

-- Reserves one of a wish for a guest. Locks the wish so two guests can't take
-- the last one at the same time. Returns false when nothing is left.
create or replace function public.wishlist_claim(
  target_item uuid,
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

  insert into public.wishlist_claims (item_id) values (target_item)
  returning id into new_claim;
  insert into public.wishlist_claim_members (claim_id, name, device_hash)
  values (new_claim, guest_name, guest_device_hash);
  return true;
end;
$$;

revoke all on function public.wishlist_claim(uuid, text, text) from public, anon, authenticated;
grant execute on function public.wishlist_claim(uuid, text, text) to service_role;
