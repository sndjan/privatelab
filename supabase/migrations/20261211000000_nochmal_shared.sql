-- Noch-mal-Blätter: everyone with access to the module sees everyone's sheets
-- (to look at, print and copy); only the owner changes or deletes a sheet.
--
-- author is a short name to show on others' sheets: the part of the owner's
-- email before the @, set by a trigger (profiles are only readable for
-- oneself, so the list can't look it up).

alter table public.nochmal_sheets add column author text not null default '';

create or replace function private.nochmal_set_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author := coalesce((select split_part(p.email, '@', 1) from public.profiles p where p.id = new.user_id), '');
  return new;
end;
$$;

revoke all on function private.nochmal_set_author() from public;

create trigger nochmal_sheets_set_author
  before insert on public.nochmal_sheets
  for each row execute function private.nochmal_set_author();

update public.nochmal_sheets s
set author = split_part(p.email, '@', 1)
from public.profiles p
where p.id = s.user_id;

drop policy "nochmal_sheets: own rows" on public.nochmal_sheets;

create policy "nochmal_sheets: read all with access" on public.nochmal_sheets
  for select to authenticated
  using ((select private.has_module_access('nochmal')));

create policy "nochmal_sheets: insert own" on public.nochmal_sheets
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select private.has_module_access('nochmal')));

create policy "nochmal_sheets: update own" on public.nochmal_sheets
  for update to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('nochmal')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('nochmal')));

create policy "nochmal_sheets: delete own" on public.nochmal_sheets
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('nochmal')));

create index nochmal_sheets_updated_at_idx on public.nochmal_sheets (updated_at desc);
