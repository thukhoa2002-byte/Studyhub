-- Canonical source ordering for recommendation tables. This migration is
-- additive and intentionally NOT executed by application code.
begin;

alter table public.guideline_recommendation_tables
  add column if not exists source_table_number text not null default '',
  add column if not exists source_page_start integer check (source_page_start is null or source_page_start > 0),
  add column if not exists source_page_end integer check (source_page_end is null or source_page_end > 0),
  add column if not exists source_order integer not null default 0 check (source_order >= 0);

alter table public.guideline_recommendations
  add column if not exists recommendation_table_id uuid;

alter table public.guideline_recommendations
  drop constraint if exists guideline_recommendations_table_owner_fk;

alter table public.guideline_recommendations
  add constraint guideline_recommendations_table_owner_fk
  foreign key (recommendation_table_id, guideline_id, section_id)
  references public.guideline_recommendation_tables (id, guideline_id, section_id)
  on delete restrict;

create index if not exists guideline_recommendation_tables_source_order_idx
  on public.guideline_recommendation_tables (guideline_id, source_order, source_page_start);

create index if not exists guideline_recommendations_table_source_order_idx
  on public.guideline_recommendations (recommendation_table_id, sort_order);

-- Existing recommendation sort_order receives a deterministic source-derived
-- value during new imports. Existing published records are deliberately not
-- rewritten here because their source order requires review.

commit;

-- Rollback (only if no consumers rely on the new ordering fields):
-- begin;
-- drop index if exists public.guideline_recommendation_tables_source_order_idx;
-- drop index if exists public.guideline_recommendations_table_source_order_idx;
-- alter table public.guideline_recommendations drop constraint if exists guideline_recommendations_table_owner_fk;
-- alter table public.guideline_recommendations drop column if exists recommendation_table_id;
-- alter table public.guideline_recommendation_tables
--   drop column if exists source_order,
--   drop column if exists source_page_end,
--   drop column if exists source_page_start,
--   drop column if exists source_table_number;
-- commit;
