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
alter table public.guideline_documents add column if not exists summary text not null default '';
alter table public.guideline_documents add column if not exists topics jsonb not null default '[]'::jsonb;

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
  source_order integer not null default 0,
  table_kind text not null default 'recommendation' check (table_kind in ('recommendation', 'data')),
  table_row_role text not null default 'body' check (table_row_role in ('header', 'section', 'body')),
  table_cells jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guideline_entries add column if not exists source_order integer not null default 0;
alter table public.guideline_entries add column if not exists table_kind text not null default 'recommendation';
alter table public.guideline_entries add column if not exists table_row_role text not null default 'body';
alter table public.guideline_entries add column if not exists table_cells jsonb not null default '[]'::jsonb;

alter table public.guideline_documents enable row level security;
alter table public.guideline_entries enable row level security;

create or replace function public.is_guideline_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com';
$$;

create or replace function public.guideline_admin_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = 'thukhoa2002@gmail.com' limit 1;
$$;

revoke all on function public.is_guideline_admin() from public;
revoke all on function public.guideline_admin_id() from public;
grant execute on function public.is_guideline_admin() to authenticated;
grant execute on function public.guideline_admin_id() to authenticated;

drop policy if exists "read own or shared guideline documents" on public.guideline_documents;
create policy "read own or shared guideline documents" on public.guideline_documents
  for select to authenticated using (
    owner_id = public.guideline_admin_id()
    and (public.is_guideline_admin() or visibility = 'shared')
  );
drop policy if exists "owners create guideline documents" on public.guideline_documents;
create policy "owners create guideline documents" on public.guideline_documents
  for insert to authenticated with check (public.is_guideline_admin() and owner_id = auth.uid());
drop policy if exists "owners update guideline documents" on public.guideline_documents;
create policy "owners update guideline documents" on public.guideline_documents
  for update to authenticated using (public.is_guideline_admin() and owner_id = auth.uid())
  with check (public.is_guideline_admin() and owner_id = auth.uid());
drop policy if exists "owners delete guideline documents" on public.guideline_documents;
create policy "owners delete guideline documents" on public.guideline_documents
  for delete to authenticated using (public.is_guideline_admin() and owner_id = auth.uid());

drop policy if exists "read reviewed shared or own guideline entries" on public.guideline_entries;
create policy "read reviewed shared or own guideline entries" on public.guideline_entries
  for select to authenticated using (
    (public.is_guideline_admin() and owner_id = auth.uid())
    or (
      status = 'reviewed'
      and exists (
        select 1 from public.guideline_documents d
        where d.id = guideline_entries.document_id
          and d.owner_id = public.guideline_admin_id()
          and d.visibility = 'shared'
      )
    )
  );
drop policy if exists "owners create guideline entries" on public.guideline_entries;
create policy "owners create guideline entries" on public.guideline_entries
  for insert to authenticated with check (
    public.is_guideline_admin()
    and owner_id = auth.uid()
    and exists (
      select 1 from public.guideline_documents d
      where d.id = guideline_entries.document_id and d.owner_id = auth.uid()
    )
  );
drop policy if exists "owners update guideline entries" on public.guideline_entries;
create policy "owners update guideline entries" on public.guideline_entries
  for update to authenticated using (public.is_guideline_admin() and owner_id = auth.uid())
  with check (public.is_guideline_admin() and owner_id = auth.uid());
drop policy if exists "owners delete guideline entries" on public.guideline_entries;
create policy "owners delete guideline entries" on public.guideline_entries
  for delete to authenticated using (public.is_guideline_admin() and owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guideline-files', 'guideline-files', false, 41943040, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 41943040, allowed_mime_types = array['application/pdf'];

drop policy if exists "owners upload guideline files" on storage.objects;
create policy "owners upload guideline files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'guideline-files'
    and public.is_guideline_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "owners read guideline files" on storage.objects;
create policy "owners read guideline files" on storage.objects
  for select to authenticated using (
    bucket_id = 'guideline-files'
    and (
      (public.is_guideline_admin() and (storage.foldername(name))[1] = auth.uid()::text)
      or exists (
        select 1 from public.guideline_documents d
        where d.owner_id = public.guideline_admin_id()
          and d.visibility = 'shared'
          and (d.file_path = storage.objects.name or d.supplement_file_path = storage.objects.name)
      )
    )
  );
drop policy if exists "owners delete guideline files" on storage.objects;
create policy "owners delete guideline files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'guideline-files'
    and public.is_guideline_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
