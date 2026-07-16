-- Private guideline library with page-level citations and human review.
create extension if not exists pgcrypto;

create table if not exists public.guideline_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  society text not null default 'ESC',
  condition text not null check (condition in ('ACS', 'HF', 'AF', 'Khác')),
  publication_year integer not null check (publication_year between 1900 and 2200),
  version_label text not null default '',
  source_url text not null,
  file_path text,
  supplement_file_path text,
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guideline_documents add column if not exists supplement_file_path text;

create table if not exists public.guideline_entries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.guideline_documents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  topic text not null default '',
  drug_name text not null,
  clinical_context text not null default '',
  recommendation_summary text not null,
  dose text not null default '',
  renal_adjustment text not null default '',
  hepatic_adjustment text not null default '',
  contraindications text not null default '',
  monitoring text not null default '',
  recommendation_class text not null default '',
  evidence_level text not null default '',
  page_reference text not null,
  status text not null default 'draft' check (status in ('draft', 'reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guideline_documents enable row level security;
alter table public.guideline_entries enable row level security;

drop policy if exists "read own or shared guideline documents" on public.guideline_documents;
create policy "read own or shared guideline documents" on public.guideline_documents
  for select to authenticated using (owner_id = auth.uid() or visibility = 'shared');
drop policy if exists "owners create guideline documents" on public.guideline_documents;
create policy "owners create guideline documents" on public.guideline_documents
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "owners update guideline documents" on public.guideline_documents;
create policy "owners update guideline documents" on public.guideline_documents
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owners delete guideline documents" on public.guideline_documents;
create policy "owners delete guideline documents" on public.guideline_documents
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "read reviewed shared or own guideline entries" on public.guideline_entries;
create policy "read reviewed shared or own guideline entries" on public.guideline_entries
  for select to authenticated using (
    owner_id = auth.uid()
    or (
      status = 'reviewed'
      and exists (
        select 1 from public.guideline_documents d
        where d.id = guideline_entries.document_id and d.visibility = 'shared'
      )
    )
  );
drop policy if exists "owners create guideline entries" on public.guideline_entries;
create policy "owners create guideline entries" on public.guideline_entries
  for insert to authenticated with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.guideline_documents d
      where d.id = guideline_entries.document_id and d.owner_id = auth.uid()
    )
  );
drop policy if exists "owners update guideline entries" on public.guideline_entries;
create policy "owners update guideline entries" on public.guideline_entries
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owners delete guideline entries" on public.guideline_entries;
create policy "owners delete guideline entries" on public.guideline_entries
  for delete to authenticated using (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guideline-files', 'guideline-files', false, 26214400, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 26214400, allowed_mime_types = array['application/pdf'];

drop policy if exists "owners upload guideline files" on storage.objects;
create policy "owners upload guideline files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'guideline-files' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "owners read guideline files" on storage.objects;
create policy "owners read guideline files" on storage.objects
  for select to authenticated using (
    bucket_id = 'guideline-files' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "owners delete guideline files" on storage.objects;
create policy "owners delete guideline files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'guideline-files' and (storage.foldername(name))[1] = auth.uid()::text
  );
