-- Mülltrenn-Hilfe, follow-up:
--
-- A place can be saved only once per user (two tabs saving it at the same
-- time used to create it twice). Duplicates are merged into the most recently
-- selected one; their scans keep pointing at a place.
--
-- waste_rules.requested_by: who caused the lookup of a municipality, so the
-- app can limit how many new (paid) lookups a user starts per day.

update public.waste_scans s
set place_id = keep.id
from public.waste_places dup
join lateral (
  select p.id from public.waste_places p
  where p.user_id = dup.user_id and p.rules_key = dup.rules_key
  order by p.selected_at desc, p.id desc
  limit 1
) keep on true
where s.place_id = dup.id and dup.id <> keep.id;

delete from public.waste_places dup
using public.waste_places keep
where dup.user_id = keep.user_id
  and dup.rules_key = keep.rules_key
  and (dup.selected_at, dup.id) < (keep.selected_at, keep.id);

alter table public.waste_places
  add constraint waste_places_user_id_rules_key_key unique (user_id, rules_key);

-- The unique index covers lookups by user_id.
drop index if exists public.waste_places_user_id_idx;

alter table public.waste_rules
  add column requested_by uuid references public.profiles (id) on delete set null;

create index waste_rules_requested_by_created_at_idx on public.waste_rules (requested_by, created_at);
