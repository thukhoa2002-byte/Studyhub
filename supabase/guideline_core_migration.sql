-- Guideline Core Sprint B.
-- Prerequisites: guidelines_migration.sql and calculator_foundation_migration.sql.
-- Non-destructive: keeps guideline_entries and legacy file columns.

begin;

create extension if not exists pgcrypto;

-- A Guideline draft may be created manually without a file or source URL.
alter table public.guideline_documents
  alter column source_url drop not null,
  alter column publication_year drop not null;

alter table public.guideline_documents
  add column if not exists doi text,
  add column if not exists citation text,
  add column if not exists provenance jsonb not null default '[]'::jsonb,
  add column if not exists status text,
  add column if not exists published_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists published_by uuid references auth.users(id) on delete set null,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists review_note text not null default '';

alter table public.guideline_documents
  alter column status set default 'draft';

update public.guideline_documents
set status = case when visibility = 'shared' then 'published' else 'draft' end
where status is null;

update public.guideline_documents
set published_at = coalesce(published_at, updated_at, now())
where status = 'published' and published_at is null;

alter table public.guideline_documents
  alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'guideline_documents_status_check'
      and conrelid = 'public.guideline_documents'::regclass
  ) then
    alter table public.guideline_documents
      add constraint guideline_documents_status_check
      check (status in ('draft', 'in_review', 'published', 'archived'));
  end if;
end
$$;

-- Preserve the existing section UUIDs while enabling hierarchy and lifecycle.
alter table public.guideline_sections
  add column if not exists parent_section_id uuid,
  add column if not exists section_number text,
  add column if not exists status text;

alter table public.guideline_sections
  alter column status set default 'draft';

update public.guideline_sections s
set status = coalesce(d.status, 'draft')
from public.guideline_documents d
where d.id = s.guideline_id and s.status is null;

update public.guideline_sections
set status = 'draft'
where status is null;

alter table public.guideline_sections
  alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'guideline_sections_status_check'
      and conrelid = 'public.guideline_sections'::regclass
  ) then
    alter table public.guideline_sections
      add constraint guideline_sections_status_check
      check (status in ('draft', 'in_review', 'published', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'guideline_sections_parent_belongs_to_guideline_fk'
      and conrelid = 'public.guideline_sections'::regclass
  ) then
    alter table public.guideline_sections
      add constraint guideline_sections_parent_belongs_to_guideline_fk
      foreign key (parent_section_id, guideline_id)
      references public.guideline_sections(id, guideline_id)
      on delete restrict;
  end if;
end
$$;

create index if not exists guideline_sections_parent_idx
  on public.guideline_sections (guideline_id, parent_section_id, display_order);
create index if not exists guideline_sections_status_idx
  on public.guideline_sections (guideline_id, status, display_order);

-- Optional source metadata; a Guideline has no FK requirement to this table.
create table if not exists public.guideline_source_documents (
  id uuid primary key default gen_random_uuid(),
  guideline_id uuid not null references public.guideline_documents(id) on delete restrict,
  owner_id uuid references auth.users(id) on delete set null,
  original_filename text not null default '',
  storage_path text not null,
  mime_type text not null default '',
  source_kind text not null default 'supporting'
    check (source_kind in ('primary', 'supplement', 'supporting', 'html', 'xml', 'manual')),
  checksum text not null default '',
  page_count integer check (page_count is null or page_count > 0),
  extraction_status text not null default 'not_started'
    check (extraction_status in ('not_started', 'queued', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guideline_id, storage_path)
);

create index if not exists guideline_source_documents_guideline_idx
  on public.guideline_source_documents (guideline_id, source_kind);

insert into public.guideline_source_documents
  (guideline_id, owner_id, original_filename, storage_path, mime_type, source_kind)
select id, owner_id, split_part(file_path, '/', 3), file_path, 'application/pdf', 'primary'
from public.guideline_documents
where nullif(file_path, '') is not null
on conflict (guideline_id, storage_path) do nothing;

insert into public.guideline_source_documents
  (guideline_id, owner_id, original_filename, storage_path, mime_type, source_kind)
select id, owner_id, split_part(supplement_file_path, '/', 3), supplement_file_path, 'application/pdf', 'supplement'
from public.guideline_documents
where nullif(supplement_file_path, '') is not null
on conflict (guideline_id, storage_path) do nothing;

create table if not exists public.guideline_recommendations (
  id uuid primary key default gen_random_uuid(),
  guideline_id uuid not null references public.guideline_documents(id) on delete restrict,
  section_id uuid,
  owner_id uuid references auth.users(id) on delete set null,
  title text not null default '',
  recommendation_text_original text not null default '',
  recommendation_text_vi text not null default '',
  rationale_vi text not null default '',
  recommendation_class text not null default '',
  evidence_level text not null default '',
  evidence_system text not null default '',
  population text not null default '',
  intervention text not null default '',
  comparator text not null default '',
  outcome text not null default '',
  conditions text not null default '',
  contraindications text not null default '',
  source_page integer check (source_page is null or source_page > 0),
  source_quote text not null default '',
  source_anchor text not null default '',
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'needs_review', 'verified', 'rejected')),
  review_note text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'reviewed', 'published', 'archived')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guideline_recommendations_section_belongs_to_guideline_fk
    foreign key (section_id, guideline_id)
    references public.guideline_sections(id, guideline_id)
    on delete restrict
);

create index if not exists guideline_recommendations_guideline_idx
  on public.guideline_recommendations (guideline_id, status, sort_order);
create index if not exists guideline_recommendations_section_idx
  on public.guideline_recommendations (section_id, status, sort_order);
create index if not exists guideline_recommendations_verification_idx
  on public.guideline_recommendations (verification_status, status);
create index if not exists guideline_recommendations_reviewed_by_idx
  on public.guideline_recommendations (reviewed_by);

create or replace function public.set_guideline_core_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists guideline_documents_updated_at on public.guideline_documents;
create trigger guideline_documents_updated_at
before update on public.guideline_documents
for each row execute function public.set_guideline_core_updated_at();

drop trigger if exists guideline_sections_updated_at on public.guideline_sections;
create trigger guideline_sections_updated_at
before update on public.guideline_sections
for each row execute function public.set_guideline_core_updated_at();

drop trigger if exists guideline_source_documents_updated_at on public.guideline_source_documents;
create trigger guideline_source_documents_updated_at
before update on public.guideline_source_documents
for each row execute function public.set_guideline_core_updated_at();

drop trigger if exists guideline_recommendations_updated_at on public.guideline_recommendations;
create trigger guideline_recommendations_updated_at
before update on public.guideline_recommendations
for each row execute function public.set_guideline_core_updated_at();

create or replace function public.validate_guideline_recommendation_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  guideline_status text;
  section_status text;
  has_source boolean;
begin
  if new.status = 'published' then
    if new.verification_status <> 'verified' then
      raise exception 'Recommendation must be verified before publication';
    end if;
    if nullif(btrim(coalesce(new.title, '')), '') is null
       and nullif(btrim(coalesce(new.recommendation_text_vi, '')), '') is null
       and nullif(btrim(coalesce(new.recommendation_text_original, '')), '') is null then
      raise exception 'Recommendation needs display text before publication';
    end if;
    if new.section_id is null then
      raise exception 'Published recommendation must belong to a section';
    end if;

    select d.status into guideline_status
    from public.guideline_documents d
    where d.id = new.guideline_id;
    if guideline_status <> 'published' then
      raise exception 'Parent Guideline must be published first';
    end if;

    select s.status into section_status
    from public.guideline_sections s
    where s.id = new.section_id and s.guideline_id = new.guideline_id;
    if section_status <> 'published' then
      raise exception 'Parent Section must be published first';
    end if;

    select exists (
      select 1 from public.guideline_source_documents sd
      where sd.guideline_id = new.guideline_id
    ) or exists (
      select 1 from public.guideline_documents d
      where d.id = new.guideline_id
        and (
          nullif(btrim(coalesce(d.source_url, '')), '') is not null
          or nullif(btrim(coalesce(d.doi, '')), '') is not null
          or nullif(btrim(coalesce(d.citation, '')), '') is not null
          or jsonb_array_length(coalesce(d.provenance, '[]'::jsonb)) > 0
        )
    ) into has_source;
    if not has_source and nullif(btrim(coalesce(new.source_quote, '')), '') is null
       and nullif(btrim(coalesce(new.source_anchor, '')), '') is null
       and new.source_page is null then
      raise exception 'Recommendation needs source traceability before publication';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guideline_recommendations_publication_validation on public.guideline_recommendations;
create trigger guideline_recommendations_publication_validation
before insert or update of status, verification_status, guideline_id, section_id,
  title, recommendation_text_original, recommendation_text_vi, source_page,
  source_quote, source_anchor on public.guideline_recommendations
for each row execute function public.validate_guideline_recommendation_publication();

create or replace function public.validate_guideline_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_source boolean;
  has_eligible_child boolean;
begin
  if new.status = 'published' then
    if nullif(btrim(coalesce(new.title, '')), '') is null then
      raise exception 'Guideline title is required before publication';
    end if;
    if new.publication_year is null and nullif(btrim(coalesce(new.version_label, '')), '') is null then
      raise exception 'Guideline needs publication year or version before publication';
    end if;
    select exists (
      select 1 from public.guideline_source_documents sd where sd.guideline_id = new.id
    ) or nullif(btrim(coalesce(new.source_url, '')), '') is not null
      or nullif(btrim(coalesce(new.doi, '')), '') is not null
      or nullif(btrim(coalesce(new.citation, '')), '') is not null
      or nullif(btrim(coalesce(new.file_path, '')), '') is not null
      or jsonb_array_length(coalesce(new.provenance, '[]'::jsonb)) > 0
    into has_source;
    if not has_source then
      raise exception 'Guideline needs source traceability before publication';
    end if;

    select exists (
      select 1 from public.guideline_sections s
      where s.guideline_id = new.id and s.status = 'published'
    ) or exists (
      select 1 from public.guideline_recommendations r
      where r.guideline_id = new.id
        and r.status = 'published'
        and r.verification_status = 'verified'
    ) into has_eligible_child;
    if not has_eligible_child then
      raise exception 'Guideline needs an eligible published section or recommendation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guideline_documents_publication_validation on public.guideline_documents;
create trigger guideline_documents_publication_validation
before insert or update of status, title, publication_year, version_label,
  source_url, doi, citation, file_path, provenance on public.guideline_documents
for each row execute function public.validate_guideline_publication();

alter table public.guideline_documents enable row level security;
alter table public.guideline_sections enable row level security;
alter table public.guideline_source_documents enable row level security;
alter table public.guideline_recommendations enable row level security;

-- Remove the old visibility-only document policies. PostgreSQL combines
-- permissive policies with OR, so leaving them would expose archived shared
-- documents alongside the new status policy.
drop policy if exists "read own or shared guideline documents" on public.guideline_documents;
drop policy if exists "public reads shared guideline documents" on public.guideline_documents;
drop policy if exists "owners create guideline documents" on public.guideline_documents;
drop policy if exists "owners update guideline documents" on public.guideline_documents;
drop policy if exists "owners delete guideline documents" on public.guideline_documents;

drop policy if exists "public reads published guideline core" on public.guideline_documents;
create policy "public reads published guideline core" on public.guideline_documents
  for select to anon, authenticated using (status = 'published');
drop policy if exists "guideline admins read all core" on public.guideline_documents;
create policy "guideline admins read all core" on public.guideline_documents
  for select to authenticated using (public.is_guideline_admin());
drop policy if exists "guideline admins create core" on public.guideline_documents;
create policy "guideline admins create core" on public.guideline_documents
  for insert to authenticated with check (public.is_guideline_admin() and owner_id = auth.uid());
drop policy if exists "guideline admins update core" on public.guideline_documents;
create policy "guideline admins update core" on public.guideline_documents
  for update to authenticated using (public.is_guideline_admin()) with check (public.is_guideline_admin());
drop policy if exists "guideline admins delete draft core" on public.guideline_documents;
create policy "guideline admins delete draft core" on public.guideline_documents
  for delete to authenticated using (public.is_guideline_admin() and status = 'draft');

drop policy if exists "public reads published guideline sections" on public.guideline_sections;
create policy "public reads published guideline sections" on public.guideline_sections
  for select to anon, authenticated using (
    status = 'published'
    and exists (
      select 1 from public.guideline_documents d
      where d.id = guideline_sections.guideline_id and d.status = 'published'
    )
  );
drop policy if exists "guideline admins read all sections" on public.guideline_sections;
create policy "guideline admins read all sections" on public.guideline_sections
  for select to authenticated using (public.is_guideline_admin());
drop policy if exists "guideline admins create sections" on public.guideline_sections;
create policy "guideline admins create sections" on public.guideline_sections
  for insert to authenticated with check (public.is_guideline_admin() and owner_id = auth.uid());
drop policy if exists "guideline admins update sections" on public.guideline_sections;
create policy "guideline admins update sections" on public.guideline_sections
  for update to authenticated using (public.is_guideline_admin()) with check (public.is_guideline_admin());
drop policy if exists "guideline admins delete sections" on public.guideline_sections;
create policy "guideline admins delete sections" on public.guideline_sections
  for delete to authenticated using (public.is_guideline_admin() and status = 'draft');

drop policy if exists "public reads published guideline recommendations" on public.guideline_recommendations;
create policy "public reads published guideline recommendations" on public.guideline_recommendations
  for select to anon, authenticated using (
    status = 'published'
    and verification_status = 'verified'
    and exists (
      select 1 from public.guideline_documents d
      where d.id = guideline_recommendations.guideline_id and d.status = 'published'
    )
    and exists (
      select 1 from public.guideline_sections s
      where s.id = guideline_recommendations.section_id
        and s.guideline_id = guideline_recommendations.guideline_id
        and s.status = 'published'
    )
  );
drop policy if exists "guideline admins read all recommendations" on public.guideline_recommendations;
create policy "guideline admins read all recommendations" on public.guideline_recommendations
  for select to authenticated using (public.is_guideline_admin());
drop policy if exists "guideline admins create recommendations" on public.guideline_recommendations;
create policy "guideline admins create recommendations" on public.guideline_recommendations
  for insert to authenticated with check (public.is_guideline_admin() and owner_id = auth.uid());
drop policy if exists "guideline admins update recommendations" on public.guideline_recommendations;
create policy "guideline admins update recommendations" on public.guideline_recommendations
  for update to authenticated using (public.is_guideline_admin()) with check (public.is_guideline_admin());
drop policy if exists "guideline admins delete draft recommendations" on public.guideline_recommendations;
create policy "guideline admins delete draft recommendations" on public.guideline_recommendations
  for delete to authenticated using (public.is_guideline_admin() and status = 'draft');

drop policy if exists "public reads published guideline source metadata" on public.guideline_source_documents;
create policy "public reads published guideline source metadata" on public.guideline_source_documents
  for select to anon, authenticated using (
    exists (
      select 1 from public.guideline_documents d
      where d.id = guideline_source_documents.guideline_id and d.status = 'published'
    )
  );
drop policy if exists "guideline admins read all source metadata" on public.guideline_source_documents;
create policy "guideline admins read all source metadata" on public.guideline_source_documents
  for select to authenticated using (public.is_guideline_admin());
drop policy if exists "guideline admins create source metadata" on public.guideline_source_documents;
create policy "guideline admins create source metadata" on public.guideline_source_documents
  for insert to authenticated with check (public.is_guideline_admin() and owner_id = auth.uid());
drop policy if exists "guideline admins update source metadata" on public.guideline_source_documents;
create policy "guideline admins update source metadata" on public.guideline_source_documents
  for update to authenticated using (public.is_guideline_admin()) with check (public.is_guideline_admin());
drop policy if exists "guideline admins delete source metadata" on public.guideline_source_documents;
create policy "guideline admins delete source metadata" on public.guideline_source_documents
  for delete to authenticated using (public.is_guideline_admin());

commit;
