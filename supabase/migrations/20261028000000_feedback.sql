-- Feedback from signed-in users about the app: bugs, ideas, anything else.
-- Users can send feedback and see their own; admins see and manage all of it.
--
-- To pull it, e.g. in the SQL editor:
--   select f.created_at, p.email, f.kind, f.page, f.message
--   from public.feedback f left join public.profiles p on p.id = f.user_id
--   where f.status = 'new' order by f.created_at;

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  kind text not null default 'idea' check (kind in ('bug', 'idea', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  -- Where the feedback was sent from, e.g. '/m/fire'.
  page text check (char_length(page) <= 300),
  user_agent text check (char_length(user_agent) <= 500),
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);

create index feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

grant select, insert, update, delete on public.feedback to authenticated;

create policy "feedback: send own" on public.feedback
  for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'new');

create policy "feedback: read own, admins read all" on public.feedback
  for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

create policy "feedback: admins update" on public.feedback
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "feedback: admins delete" on public.feedback
  for delete to authenticated
  using ((select private.is_admin()));
