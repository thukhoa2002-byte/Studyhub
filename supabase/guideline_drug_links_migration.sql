-- Link guideline table rows to centralized Thuốc IDs and retain import provenance.
alter table public.guideline_documents add column if not exists table_name text not null default '';
alter table public.guideline_documents add column if not exists table_number text not null default '';
alter table public.guideline_documents add column if not exists summary text not null default '';
alter table public.guideline_documents add column if not exists topics jsonb not null default '[]'::jsonb;
alter table public.guideline_documents add column if not exists provenance jsonb not null default '[]'::jsonb;

alter table public.guideline_entries add column if not exists drug_id text;
alter table public.guideline_entries add column if not exists provenance jsonb not null default '[]'::jsonb;

create index if not exists guideline_entries_drug_id_idx on public.guideline_entries (drug_id);
