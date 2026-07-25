-- StudyHub Sprint D: Guideline Import Pipeline staging schema.
-- Run after guideline_core_migration.sql. This migration is intentionally
-- separate from Guideline Core: import work is private, resumable and never
-- publishes content automatically.

begin;

create extension if not exists pgcrypto;

create table if not exists public.guideline_import_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  target_guideline_id uuid references public.guideline_documents(id) on delete restrict,
  import_mode text not null default 'create_new'
    check (import_mode in ('create_new', 'existing_guideline')),
  source_language text not null default 'en',
  target_language text not null default 'vi',
  preserve_english_terminology boolean not null default true,
  preserve_abbreviations boolean not null default true,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'analysing', 'ready_for_review', 'processing', 'review', 'ready_to_import', 'importing', 'completed', 'paused', 'failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  current_stage text not null default 'upload',
  total_pages integer check (total_pages is null or total_pages > 0),
  processed_pages integer not null default 0 check (processed_pages >= 0),
  source_metadata jsonb not null default '{}'::jsonb,
  analysis_metadata jsonb not null default '{}'::jsonb,
  imported_guideline_id uuid references public.guideline_documents(id) on delete restrict,
  error_message text not null default '',
  resume_token text not null default '',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guideline_import_documents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guideline_import_jobs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  original_filename text not null,
  mime_type text not null default 'application/octet-stream',
  source_language text not null default 'en',
  storage_path text not null,
  checksum text not null default '',
  file_size bigint not null default 0 check (file_size >= 0),
  page_count integer check (page_count is null or page_count > 0),
  ocr_required boolean not null default false,
  ocr_status text not null default 'not_started'
    check (ocr_status in ('not_started', 'queued', 'processing', 'completed', 'failed')),
  extracted_text text not null default '',
  page_metadata jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id)
);

create table if not exists public.guideline_import_sections (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guideline_import_jobs(id) on delete cascade,
  parent_section_id uuid references public.guideline_import_sections(id) on delete restrict,
  source_key text not null default '',
  title_original text not null default '',
  title_vi text not null default '',
  summary_original text not null default '',
  summary_vi text not null default '',
  level integer not null default 0 check (level >= 0),
  source_page integer check (source_page is null or source_page > 0),
  source_anchor text not null default '',
  display_order integer not null default 0 check (display_order >= 0),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'accepted', 'rejected', 'needs_review')),
  duplicate_status text not null default 'new'
    check (duplicate_status in ('new', 'exact', 'possible', 'update')),
  original_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guideline_import_recommendations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guideline_import_jobs(id) on delete cascade,
  import_section_id uuid references public.guideline_import_sections(id) on delete restrict,
  source_key text not null default '',
  title_original text not null default '',
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
  coordinates jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'accepted', 'rejected', 'needs_review')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'needs_review', 'verified', 'rejected')),
  duplicate_status text not null default 'new'
    check (duplicate_status in ('new', 'exact', 'possible', 'update')),
  duplicate_target_id uuid references public.guideline_recommendations(id) on delete restrict,
  issue_count integer not null default 0 check (issue_count >= 0),
  display_order integer not null default 0 check (display_order >= 0),
  original_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guideline_import_issues (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guideline_import_jobs(id) on delete cascade,
  section_id uuid references public.guideline_import_sections(id) on delete cascade,
  recommendation_id uuid references public.guideline_import_recommendations(id) on delete cascade,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'error', 'blocking')),
  issue_code text not null,
  message text not null,
  source_page integer check (source_page is null or source_page > 0),
  resolved boolean not null default false,
  resolution_note text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.guideline_import_terminology (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guideline_import_jobs(id) on delete cascade,
  source_term text not null,
  preferred_translation text not null default '',
  locked boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, source_term)
);

create table if not exists public.guideline_import_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.guideline_import_jobs(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  stage text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists guideline_import_jobs_owner_idx on public.guideline_import_jobs (owner_id, updated_at desc);
create index if not exists guideline_import_jobs_status_idx on public.guideline_import_jobs (status, updated_at desc);
create index if not exists guideline_import_documents_job_idx on public.guideline_import_documents (job_id);
create index if not exists guideline_import_sections_job_idx on public.guideline_import_sections (job_id, parent_section_id, display_order);
create index if not exists guideline_import_sections_review_idx on public.guideline_import_sections (job_id, review_status);
create index if not exists guideline_import_recommendations_job_idx on public.guideline_import_recommendations (job_id, import_section_id, display_order, review_status);
create index if not exists guideline_import_recommendations_duplicate_idx on public.guideline_import_recommendations (job_id, duplicate_status);
create index if not exists guideline_import_issues_job_idx on public.guideline_import_issues (job_id, resolved, severity);
create index if not exists guideline_import_events_job_idx on public.guideline_import_events (job_id, created_at desc);

create or replace function public.set_guideline_import_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists guideline_import_jobs_updated_at on public.guideline_import_jobs;
create trigger guideline_import_jobs_updated_at before update on public.guideline_import_jobs for each row execute function public.set_guideline_import_updated_at();
drop trigger if exists guideline_import_documents_updated_at on public.guideline_import_documents;
create trigger guideline_import_documents_updated_at before update on public.guideline_import_documents for each row execute function public.set_guideline_import_updated_at();
drop trigger if exists guideline_import_sections_updated_at on public.guideline_import_sections;
create trigger guideline_import_sections_updated_at before update on public.guideline_import_sections for each row execute function public.set_guideline_import_updated_at();
drop trigger if exists guideline_import_recommendations_updated_at on public.guideline_import_recommendations;
create trigger guideline_import_recommendations_updated_at before update on public.guideline_import_recommendations for each row execute function public.set_guideline_import_updated_at();
drop trigger if exists guideline_import_terminology_updated_at on public.guideline_import_terminology;
create trigger guideline_import_terminology_updated_at before update on public.guideline_import_terminology for each row execute function public.set_guideline_import_updated_at();

alter table public.guideline_import_jobs enable row level security;
alter table public.guideline_import_documents enable row level security;
alter table public.guideline_import_sections enable row level security;
alter table public.guideline_import_recommendations enable row level security;
alter table public.guideline_import_issues enable row level security;
alter table public.guideline_import_terminology enable row level security;
alter table public.guideline_import_events enable row level security;

drop policy if exists "guideline admins manage import jobs" on public.guideline_import_jobs;
create policy "guideline admins manage import jobs" on public.guideline_import_jobs for all to authenticated using (public.is_guideline_admin() and owner_id = auth.uid()) with check (public.is_guideline_admin() and owner_id = auth.uid());
drop policy if exists "guideline admins manage import documents" on public.guideline_import_documents;
create policy "guideline admins manage import documents" on public.guideline_import_documents for all to authenticated using (public.is_guideline_admin() and owner_id = auth.uid()) with check (public.is_guideline_admin() and owner_id = auth.uid());
drop policy if exists "guideline admins manage import sections" on public.guideline_import_sections;
create policy "guideline admins manage import sections" on public.guideline_import_sections for all to authenticated using (public.is_guideline_admin() and exists (select 1 from public.guideline_import_jobs j where j.id = job_id and j.owner_id = auth.uid())) with check (public.is_guideline_admin() and exists (select 1 from public.guideline_import_jobs j where j.id = job_id and j.owner_id = auth.uid()));
drop policy if exists "guideline admins manage import recommendations" on public.guideline_import_recommendations;
create policy "guideline admins manage import recommendations" on public.guideline_import_recommendations for all to authenticated using (public.is_guideline_admin() and exists (select 1 from public.guideline_import_jobs j where j.id = job_id and j.owner_id = auth.uid())) with check (public.is_guideline_admin() and exists (select 1 from public.guideline_import_jobs j where j.id = job_id and j.owner_id = auth.uid()));
drop policy if exists "guideline admins manage import issues" on public.guideline_import_issues;
create policy "guideline admins manage import issues" on public.guideline_import_issues for all to authenticated using (public.is_guideline_admin() and exists (select 1 from public.guideline_import_jobs j where j.id = job_id and j.owner_id = auth.uid())) with check (public.is_guideline_admin() and exists (select 1 from public.guideline_import_jobs j where j.id = job_id and j.owner_id = auth.uid()));
drop policy if exists "guideline admins manage import terminology" on public.guideline_import_terminology;
create policy "guideline admins manage import terminology" on public.guideline_import_terminology for all to authenticated using (public.is_guideline_admin() and exists (select 1 from public.guideline_import_jobs j where j.id = job_id and j.owner_id = auth.uid())) with check (public.is_guideline_admin() and exists (select 1 from public.guideline_import_jobs j where j.id = job_id and j.owner_id = auth.uid()));
drop policy if exists "guideline admins read import events" on public.guideline_import_events;
create policy "guideline admins read import events" on public.guideline_import_events for select to authenticated using (public.is_guideline_admin() and exists (select 1 from public.guideline_import_jobs j where j.id = job_id and j.owner_id = auth.uid()));
drop policy if exists "guideline admins create import events" on public.guideline_import_events;
create policy "guideline admins create import events" on public.guideline_import_events for insert to authenticated with check (public.is_guideline_admin() and actor_id = auth.uid() and exists (select 1 from public.guideline_import_jobs j where j.id = job_id and j.owner_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guideline-imports', 'guideline-imports', false, 104857600, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown', 'text/plain', 'text/html', 'application/xhtml+xml'
])
on conflict (id) do update set public = false, file_size_limit = 104857600;

drop policy if exists "guideline admins upload import documents" on storage.objects;
create policy "guideline admins upload import documents" on storage.objects for insert to authenticated with check (bucket_id = 'guideline-imports' and public.is_guideline_admin() and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "guideline admins read import documents" on storage.objects;
create policy "guideline admins read import documents" on storage.objects for select to authenticated using (bucket_id = 'guideline-imports' and public.is_guideline_admin() and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "guideline admins delete import documents" on storage.objects;
create policy "guideline admins delete import documents" on storage.objects for delete to authenticated using (bucket_id = 'guideline-imports' and public.is_guideline_admin() and (storage.foldername(name))[1] = auth.uid()::text);

commit;
