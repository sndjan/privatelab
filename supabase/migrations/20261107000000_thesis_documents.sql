-- Bachelorarbeit, documents: files (PDFs, drafts, templates, anything) in a
-- private bucket, each with title, note and category, optionally linked to a
-- source or a protocol. The browser uploads straight to storage (so the size
-- isn't limited by the app server's request limit) into a folder named after
-- the user's id; the row is written afterwards by a server action. Files are
-- opened through short-lived signed URLs.

-- 50 MB, the most the Supabase free plan allows per file. Any file type.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thesis-documents', 'thesis-documents', false, 52428800, null)
on conflict (id) do nothing;

create policy "thesis-documents: read own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'thesis-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.has_module_access('thesis'))
  );

create policy "thesis-documents: upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'thesis-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.has_module_access('thesis'))
  );

create policy "thesis-documents: delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'thesis-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- storage_path: "<user id>/<random>" in the bucket. file_name: the original
-- name, used for downloads. Replacing the file keeps the row and swaps the path.
create table public.thesis_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  note text not null default '' check (char_length(note) <= 2000),
  category text not null default 'other' check (category in ('literature', 'guideline', 'draft', 'other')),
  storage_path text not null check (storage_path like (user_id::text || '/%') and char_length(storage_path) <= 200),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null default 'application/octet-stream' check (char_length(mime_type) <= 200),
  size_bytes bigint not null check (size_bytes between 0 and 52428800),
  source_id uuid references public.thesis_sources (id) on delete set null,
  protocol_id uuid references public.thesis_protocols (id) on delete set null,
  created_at timestamptz not null default now(),
  file_updated_at timestamptz not null default now()
);

create index thesis_documents_user_id_idx on public.thesis_documents (user_id, created_at desc);
create index thesis_documents_source_id_idx on public.thesis_documents (source_id);
create index thesis_documents_protocol_id_idx on public.thesis_documents (protocol_id);

alter table public.thesis_documents enable row level security;

grant select, insert, update, delete on public.thesis_documents to authenticated;

create or replace function private.owns_thesis_source(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target is null or exists (
    select 1 from public.thesis_sources s where s.id = target and s.user_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_thesis_source(uuid) from public;
grant execute on function private.owns_thesis_source(uuid) to authenticated;

create policy "thesis_documents: own rows" on public.thesis_documents
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('thesis'))
    and private.owns_thesis_source(source_id)
    and private.owns_thesis_protocol(protocol_id)
  );
