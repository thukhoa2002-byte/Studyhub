-- Recommendation groups are a first-class child of one Recommendation Table.
-- Prerequisite: guideline_single_admin_publication_migration.sql and
-- guideline_recommendation_table_order_migration.sql have both completed.
-- This migration is additive and is NOT executed by application code.
begin;

create table if not exists public.guideline_recommendation_groups (
  id uuid primary key default gen_random_uuid(),
  guideline_id uuid not null,
  section_id uuid not null,
  recommendation_table_id uuid not null,
  owner_id uuid references auth.users(id) on delete set null,
  source_heading text not null default '',
  title_vi text not null default '',
  context text not null default '',
  source_page integer check (source_page is null or source_page > 0),
  group_order integer not null default 0 check (group_order >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, recommendation_table_id),
  unique (recommendation_table_id, group_order),
  foreign key (recommendation_table_id, guideline_id, section_id)
    references public.guideline_recommendation_tables (id, guideline_id, section_id)
    on delete restrict
);

alter table public.guideline_recommendations
  add column if not exists recommendation_group_id uuid;

alter table public.guideline_recommendations
  drop constraint if exists guideline_recommendations_group_owner_fk;

alter table public.guideline_recommendations
  add constraint guideline_recommendations_group_owner_fk
  foreign key (recommendation_group_id, recommendation_table_id)
  references public.guideline_recommendation_groups (id, recommendation_table_id)
  on delete restrict;

create index if not exists guideline_recommendation_groups_table_order_idx
  on public.guideline_recommendation_groups (recommendation_table_id, group_order);
create index if not exists guideline_recommendations_group_order_idx
  on public.guideline_recommendations (recommendation_group_id, sort_order);

alter table public.guideline_recommendation_groups enable row level security;
drop policy if exists "public reads published guideline recommendation groups" on public.guideline_recommendation_groups;
create policy "public reads published guideline recommendation groups"
  on public.guideline_recommendation_groups for select to anon, authenticated using (
    status = 'published'
    and exists (select 1 from public.guideline_recommendation_tables t where t.id = recommendation_table_id and t.status = 'published')
  );
drop policy if exists "guideline admins manage recommendation groups" on public.guideline_recommendation_groups;
create policy "guideline admins manage recommendation groups"
  on public.guideline_recommendation_groups for all to authenticated
  using (public.is_guideline_admin()) with check (public.is_guideline_admin());

commit;

-- Object-level rollback. Only run after confirming no rows rely on these IDs:
-- begin;
-- alter table public.guideline_recommendations drop constraint if exists guideline_recommendations_group_owner_fk;
-- alter table public.guideline_recommendations drop column if exists recommendation_group_id;
-- drop table if exists public.guideline_recommendation_groups;
-- commit;
