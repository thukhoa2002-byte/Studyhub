-- Table-only Guideline model. This migration is additive in intent and MUST be
-- run manually only after the existing recommendation-table migrations.
-- It keeps guideline_sections as optional source provenance and never deletes
-- existing tables, rows, recommendations, relations, or UUIDs.
begin;

do $$
begin
  if to_regclass('public.guideline_recommendation_tables') is null
    or to_regclass('public.guideline_recommendation_groups') is null then
    raise exception 'Apply guideline recommendation-table and group migrations before guideline_table_only_model_migration';
  end if;
end $$;

-- Composite ownership previously embedded section_id. Keep source section as
-- nullable provenance and make Guideline + table the canonical owner.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.guideline_recommendation_tables'::regclass
      and conname = 'guideline_recommendation_tables_id_guideline_key'
  ) then
    alter table public.guideline_recommendation_tables
      add constraint guideline_recommendation_tables_id_guideline_key unique (id, guideline_id);
  end if;
end $$;

alter table public.guideline_recommendation_groups
  drop constraint if exists guideline_recommendation_groups_recommendation_table_id_guideline_id_section_id_fkey;
alter table public.guideline_recommendations
  drop constraint if exists guideline_recommendations_table_owner_fk;

alter table public.guideline_recommendation_tables
  alter column section_id drop not null;
alter table public.guideline_recommendation_groups
  alter column section_id drop not null;
alter table public.guideline_recommendations
  alter column section_id drop not null;

alter table public.guideline_recommendation_groups
  drop constraint if exists guideline_recommendation_groups_table_owner_fk,
  drop constraint if exists guideline_recommendation_groups_source_section_fk;
alter table public.guideline_recommendation_groups
  add constraint guideline_recommendation_groups_table_owner_fk
    foreign key (recommendation_table_id, guideline_id)
    references public.guideline_recommendation_tables (id, guideline_id)
    on delete restrict;

alter table public.guideline_recommendation_groups
  add constraint guideline_recommendation_groups_source_section_fk
    foreign key (section_id, guideline_id)
    references public.guideline_sections (id, guideline_id)
    on delete restrict;

alter table public.guideline_recommendations
  add constraint guideline_recommendations_table_owner_fk
    foreign key (recommendation_table_id, guideline_id)
    references public.guideline_recommendation_tables (id, guideline_id)
    on delete restrict;

-- Clinical tables are separate structured resources. They preserve table
-- content but never create Recommendation rows implicitly.
create table if not exists public.guideline_clinical_tables (
  id uuid primary key default gen_random_uuid(),
  guideline_id uuid not null references public.guideline_documents(id) on delete restrict,
  section_id uuid,
  owner_id uuid references auth.users(id) on delete set null,
  table_number text not null default '',
  title text not null default '',
  title_vi text not null default '',
  short_description text not null default '',
  source_page_start integer check (source_page_start is null or source_page_start > 0),
  source_page_end integer check (source_page_end is null or source_page_end > 0),
  source_order integer not null default 0 check (source_order >= 0),
  headers_original jsonb not null default '[]'::jsonb,
  headers_vi jsonb not null default '[]'::jsonb,
  rows_original jsonb not null default '[]'::jsonb,
  rows_vi jsonb not null default '[]'::jsonb,
  footnotes_original jsonb not null default '[]'::jsonb,
  footnotes_vi jsonb not null default '[]'::jsonb,
  is_complete boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, guideline_id),
  foreign key (section_id, guideline_id)
    references public.guideline_sections(id, guideline_id) on delete restrict
);

alter table public.guideline_clinical_tables enable row level security;
drop policy if exists "public reads published guideline clinical tables" on public.guideline_clinical_tables;
create policy "public reads published guideline clinical tables" on public.guideline_clinical_tables
  for select to anon, authenticated using (
    status = 'published' and is_complete = true
    and exists (select 1 from public.guideline_documents d where d.id = guideline_clinical_tables.guideline_id and d.status = 'published')
  );
drop policy if exists "guideline admins manage clinical tables" on public.guideline_clinical_tables;
create policy "guideline admins manage clinical tables" on public.guideline_clinical_tables
  for all to authenticated using (public.is_guideline_admin()) with check (public.is_guideline_admin());

-- Publication is table-first: a published source Section is no longer a gate.
create or replace function public.validate_guideline_recommendation_publication()
returns trigger language plpgsql security definer set search_path = public as $$
declare guideline_status text; has_source boolean;
begin
  if new.status = 'published' then
    if nullif(btrim(coalesce(new.title, '')), '') is null
      and nullif(btrim(coalesce(new.recommendation_text_original, '')), '') is null
      and nullif(btrim(coalesce(new.recommendation_text_vi, '')), '') is null then
      raise exception 'Recommendation display text is required before publication';
    end if;
    if new.recommendation_table_id is null then
      raise exception 'Published recommendation must belong to a recommendation table';
    end if;
    select status into guideline_status from public.guideline_documents where id = new.guideline_id;
    if guideline_status <> 'published' then raise exception 'Parent Guideline must be published first'; end if;
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

drop policy if exists "public reads published guideline recommendation tables" on public.guideline_recommendation_tables;
create policy "public reads published guideline recommendation tables" on public.guideline_recommendation_tables
  for select to anon, authenticated using (
    status = 'published' and is_complete = true
    and exists (select 1 from public.guideline_documents d where d.id = guideline_recommendation_tables.guideline_id and d.status = 'published')
  );

drop policy if exists "public reads published guideline recommendations" on public.guideline_recommendations;
create policy "public reads published guideline recommendations" on public.guideline_recommendations
  for select to anon, authenticated using (
    status = 'published'
    and exists (select 1 from public.guideline_documents d where d.id = guideline_recommendations.guideline_id and d.status = 'published')
    and exists (select 1 from public.guideline_recommendation_tables t where t.id = guideline_recommendations.recommendation_table_id and t.guideline_id = guideline_recommendations.guideline_id and t.status = 'published' and t.is_complete = true)
  );

create index if not exists guideline_recommendation_tables_provenance_idx
  on public.guideline_recommendation_tables (guideline_id, source_order, source_page_start);
create index if not exists guideline_recommendation_groups_table_order_idx
  on public.guideline_recommendation_groups (recommendation_table_id, group_order);
create index if not exists guideline_clinical_tables_source_order_idx
  on public.guideline_clinical_tables (guideline_id, source_order, source_page_start);

commit;

-- Preflight: verify there are no orphan table/group/recommendation owners.
-- select t.id from public.guideline_recommendation_tables t left join public.guideline_documents d on d.id=t.guideline_id where d.id is null;
-- select g.id from public.guideline_recommendation_groups g left join public.guideline_recommendation_tables t on t.id=g.recommendation_table_id and t.guideline_id=g.guideline_id where t.id is null;
-- select r.id from public.guideline_recommendations r where r.recommendation_table_id is not null and not exists (select 1 from public.guideline_recommendation_tables t where t.id=r.recommendation_table_id and t.guideline_id=r.guideline_id);
-- Rollback: if this migration fails, PostgreSQL rolls back the whole transaction.
-- For an explicit rollback after success, first confirm guideline_clinical_tables
-- has no production rows, then drop that table and only the new
-- *_table_owner_fk / *_source_section_fk constraints. Restore NOT NULL only
-- after section_id has been backfilled for all legacy recommendation rows.
--
-- Rollback: drop only the new *_table_owner_fk / *_source_section_fk constraints,
-- restore the prior composite foreign keys, restore NOT NULL after backfilling
-- section_id, then restore the two previous public policies from their source migrations.
