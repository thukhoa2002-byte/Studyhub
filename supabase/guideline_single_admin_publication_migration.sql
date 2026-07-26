-- Single-admin publication workflow. This migration is additive and MUST NOT be
-- run automatically. It intentionally leaves legacy review metadata readable.
begin;

-- Review metadata stays available for audit, but is no longer a publication gate.
create or replace function public.validate_guideline_recommendation_publication()
returns trigger language plpgsql security definer set search_path = public as $$
declare guideline_status text; section_status text; has_source boolean;
begin
  if new.status = 'published' then
    if nullif(btrim(coalesce(new.title, '')), '') is null
      and nullif(btrim(coalesce(new.recommendation_text_original, '')), '') is null
      and nullif(btrim(coalesce(new.recommendation_text_vi, '')), '') is null then
      raise exception 'Recommendation display text is required before publication';
    end if;
    if new.section_id is null then raise exception 'Published recommendation must belong to a section'; end if;
    select status into guideline_status from public.guideline_documents where id = new.guideline_id;
    if guideline_status <> 'published' then raise exception 'Parent Guideline must be published first'; end if;
    select status into section_status from public.guideline_sections where id = new.section_id and guideline_id = new.guideline_id;
    if section_status <> 'published' then raise exception 'Parent Section must be published first'; end if;
    select exists (select 1 from public.guideline_source_documents sd where sd.guideline_id = new.guideline_id)
      or exists (select 1 from public.guideline_documents d where d.id = new.guideline_id and (
        nullif(btrim(coalesce(d.source_url, '')), '') is not null or nullif(btrim(coalesce(d.doi, '')), '') is not null
        or nullif(btrim(coalesce(d.citation, '')), '') is not null or jsonb_array_length(coalesce(d.provenance, '[]'::jsonb)) > 0)) into has_source;
    if not has_source and nullif(btrim(coalesce(new.source_quote, '')), '') is null
      and nullif(btrim(coalesce(new.source_anchor, '')), '') is null and new.source_page is null then
      raise exception 'Recommendation needs source traceability before publication';
    end if;
  end if;
  return new;
end;
$$;

-- Public reads follow the simplified status lifecycle, not historical review state.
drop policy if exists "public reads published guideline recommendations" on public.guideline_recommendations;
create policy "public reads published guideline recommendations" on public.guideline_recommendations
  for select to anon, authenticated using (
    status = 'published' and exists (select 1 from public.guideline_documents d where d.id = guideline_recommendations.guideline_id and d.status = 'published')
    and exists (select 1 from public.guideline_sections s where s.id = guideline_recommendations.section_id and s.guideline_id = guideline_recommendations.guideline_id and s.status = 'published')
  );

-- A table is a first-class container. Existing guideline_entries stay untouched.
create table if not exists public.guideline_recommendation_tables (
  id uuid primary key default gen_random_uuid(),
  guideline_id uuid not null references public.guideline_documents(id) on delete restrict,
  section_id uuid not null,
  owner_id uuid references auth.users(id) on delete set null,
  table_number text not null default '',
  title text not null default '',
  title_vi text not null default '',
  source_page integer,
  source_quote text not null default '',
  source_anchor text not null default '',
  is_complete boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, guideline_id, section_id),
  foreign key (section_id, guideline_id) references public.guideline_sections(id, guideline_id) on delete restrict
);
create index if not exists guideline_recommendation_tables_guideline_idx on public.guideline_recommendation_tables(guideline_id, display_order);
create index if not exists guideline_recommendation_tables_section_idx on public.guideline_recommendation_tables(section_id, display_order);
alter table public.guideline_recommendation_tables enable row level security;
drop policy if exists "public reads published guideline recommendation tables" on public.guideline_recommendation_tables;
create policy "public reads published guideline recommendation tables" on public.guideline_recommendation_tables for select to anon, authenticated using (
  status = 'published' and exists (select 1 from public.guideline_documents d where d.id = guideline_recommendation_tables.guideline_id and d.status = 'published')
  and exists (select 1 from public.guideline_sections s where s.id = guideline_recommendation_tables.section_id and s.status = 'published')
);
drop policy if exists "guideline admins manage recommendation tables" on public.guideline_recommendation_tables;
create policy "guideline admins manage recommendation tables" on public.guideline_recommendation_tables for all to authenticated using (public.is_guideline_admin()) with check (public.is_guideline_admin());

commit;

-- Rollback (run only after confirming no new table rows are needed):
-- begin; drop table if exists public.guideline_recommendation_tables; rollback;
