-- Guideline extraction recovery: additive storage for structurally verified
-- source tables and repair batches. Do not run this automatically.
begin;

alter table public.guideline_import_jobs
  add column if not exists repair_of_job_id uuid references public.guideline_import_jobs(id) on delete restrict,
  add column if not exists source_structure_hash text not null default '',
  add column if not exists structural_status text not null default 'unverified'
    check (structural_status in ('unverified', 'extracting', 'invalid', 'ready_for_translation', 'ready_for_review', 'repaired'));

alter table public.guideline_import_sections
  add column if not exists source_section_number text not null default '',
  add column if not exists source_page_end integer check (source_page_end is null or source_page_end > 0),
  add column if not exists source_coordinates jsonb not null default '{}'::jsonb,
  add column if not exists mapping_status text not null default 'unresolved'
    check (mapping_status in ('unresolved', 'source_verified', 'manual_verified', 'blocked'));

create table if not exists public.guideline_import_recommendation_tables (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guideline_import_jobs(id) on delete cascade,
  import_section_id uuid references public.guideline_import_sections(id) on delete restrict,
  source_key text not null,
  table_number text not null default '',
  title_original text not null default '',
  title_vi text not null default '',
  source_page_start integer check (source_page_start is null or source_page_start > 0),
  source_page_end integer check (source_page_end is null or source_page_end > 0),
  source_order integer not null default 0 check (source_order >= 0),
  source_coordinates jsonb not null default '{}'::jsonb,
  headers_original jsonb not null default '[]'::jsonb,
  headers_vi jsonb not null default '[]'::jsonb,
  row_groups jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  source_references jsonb not null default '[]'::jsonb,
  footnotes_original jsonb not null default '[]'::jsonb,
  footnotes_vi jsonb not null default '[]'::jsonb,
  extraction_status text not null default 'detected'
    check (extraction_status in ('detected', 'incomplete', 'recovered', 'reviewed', 'blocked')),
  translation_status text not null default 'pending'
    check (translation_status in ('pending', 'blocked_pending_extraction', 'translated', 'reviewed')),
  source_hash text not null default '',
  original_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, source_key)
);

alter table public.guideline_import_recommendations
  add column if not exists import_table_id uuid references public.guideline_import_recommendation_tables(id) on delete restrict,
  add column if not exists source_table_number text not null default '',
  add column if not exists source_order integer not null default 0 check (source_order >= 0),
  add column if not exists group_order integer not null default 0 check (group_order >= 0),
  add column if not exists row_order integer not null default 0 check (row_order >= 0),
  add column if not exists source_title text not null default '',
  add column if not exists translated_title text not null default '',
  add column if not exists source_audience text not null default '',
  add column if not exists translated_audience text not null default '',
  add column if not exists source_context text not null default '',
  add column if not exists translated_context text not null default '',
  add column if not exists structural_status text not null default 'unresolved'
    check (structural_status in ('unresolved', 'source_verified', 'manual_verified', 'blocked'));

create index if not exists guideline_import_jobs_repair_of_idx on public.guideline_import_jobs (repair_of_job_id);
create index if not exists guideline_import_sections_source_number_idx on public.guideline_import_sections (job_id, source_section_number, display_order);
create index if not exists guideline_import_recommendation_tables_job_idx on public.guideline_import_recommendation_tables (job_id, source_order, source_page_start);
create index if not exists guideline_import_recommendation_tables_status_idx on public.guideline_import_recommendation_tables (job_id, extraction_status, translation_status);
create index if not exists guideline_import_recommendations_table_idx on public.guideline_import_recommendations (import_table_id, group_order, row_order);

drop trigger if exists guideline_import_recommendation_tables_updated_at on public.guideline_import_recommendation_tables;
create trigger guideline_import_recommendation_tables_updated_at
before update on public.guideline_import_recommendation_tables
for each row execute function public.set_guideline_import_updated_at();

alter table public.guideline_import_recommendation_tables enable row level security;
drop policy if exists "guideline admins manage import recommendation tables" on public.guideline_import_recommendation_tables;
create policy "guideline admins manage import recommendation tables"
on public.guideline_import_recommendation_tables for all to authenticated
using (public.is_guideline_admin() and exists (
  select 1 from public.guideline_import_jobs j where j.id = job_id and j.owner_id = auth.uid()
))
with check (public.is_guideline_admin() and exists (
  select 1 from public.guideline_import_jobs j where j.id = job_id and j.owner_id = auth.uid()
));

commit;
