-- Sport: the viewer's first name for the year review ("Jan · 2026"), taken
-- from their person in the Gewicht-Challenge.
create or replace function public.sport_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.has_module_access('sport')) then
    raise exception 'no access' using errcode = '42501';
  end if;
  return sport.dashboard_json((select auth.uid()))
    || jsonb_build_object('viewerName', (select p.name from public.weight_participants p where p.user_id = (select auth.uid())));
end;
$$;
