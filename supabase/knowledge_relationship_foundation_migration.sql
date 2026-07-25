-- Recommendation-centred knowledge integration.
-- Prerequisites: guideline_core_migration.sql, calculator_foundation_migration.sql,
-- and calculator_guideline_core_reference_migration.sql when legacy calculator
-- references exist. This migration is additive and must be run manually on staging.

begin;

create extension if not exists pgcrypto;

create table if not exists public.drugs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  slug text not null unique,
  generic_name text not null,
  title_vi text not null default '',
  content jsonb not null default '{}'::jsonb,
  drug_class text not null default '',
  specialties jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'reviewed', 'published', 'archived')),
  source_verified boolean not null default false,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drugs_status_updated_idx on public.drugs (status, updated_at desc);
create index if not exists drugs_generic_name_idx on public.drugs (generic_name);

-- Discovery is intentionally limited to a safe preview. Full Drug records remain
-- available only to authenticated users through the RLS policy below.
create or replace function public.list_public_drug_previews()
returns table (
  id uuid,
  slug text,
  generic_name text,
  title_vi text,
  drug_class text,
  specialties jsonb,
  status text,
  published_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select d.id, d.slug, d.generic_name, d.title_vi, d.drug_class, d.specialties, d.status, d.published_at
  from public.drugs d
  where d.status = 'published'
  order by d.updated_at desc;
$$;
grant execute on function public.list_public_drug_previews() to anon, authenticated;

create table if not exists public.recommendation_drug_references (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.guideline_recommendations(id) on delete restrict,
  drug_id uuid not null references public.drugs(id) on delete restrict,
  relation_type text not null check (relation_type in ('recommended', 'alternative', 'contraindicated', 'caution', 'dose_adjustment', 'monitoring', 'interaction', 'mentioned', 'supporting_therapy')),
  context_text text not null default '',
  source_location text not null default '',
  display_order integer not null default 0 check (display_order >= 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (recommendation_id, drug_id, relation_type)
);

create table if not exists public.recommendation_calculator_references (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.guideline_recommendations(id) on delete restrict,
  calculator_id uuid not null references public.calculators(id) on delete restrict,
  relation_type text not null check (relation_type in ('risk_stratification', 'diagnostic_support', 'severity_assessment', 'treatment_decision', 'dose_calculation', 'prognosis', 'monitoring', 'classification', 'mentioned')),
  context_text text not null default '',
  source_location text not null default '',
  display_order integer not null default 0 check (display_order >= 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (recommendation_id, calculator_id, relation_type)
);

create index if not exists recommendation_drug_references_recommendation_idx on public.recommendation_drug_references (recommendation_id, display_order);
create index if not exists recommendation_drug_references_drug_idx on public.recommendation_drug_references (drug_id, display_order);
create index if not exists recommendation_calculator_references_recommendation_idx on public.recommendation_calculator_references (recommendation_id, display_order);
create index if not exists recommendation_calculator_references_calculator_idx on public.recommendation_calculator_references (calculator_id, display_order);

create or replace function public.set_knowledge_relation_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists drugs_updated_at on public.drugs;
create trigger drugs_updated_at before update on public.drugs for each row execute function public.set_knowledge_relation_updated_at();
drop trigger if exists recommendation_drug_references_updated_at on public.recommendation_drug_references;
create trigger recommendation_drug_references_updated_at before update on public.recommendation_drug_references for each row execute function public.set_knowledge_relation_updated_at();
drop trigger if exists recommendation_calculator_references_updated_at on public.recommendation_calculator_references;
create trigger recommendation_calculator_references_updated_at before update on public.recommendation_calculator_references for each row execute function public.set_knowledge_relation_updated_at();

alter table public.drugs enable row level security;
alter table public.recommendation_drug_references enable row level security;
alter table public.recommendation_calculator_references enable row level security;

create or replace function public.can_expose_knowledge_recommendation(p_recommendation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.guideline_recommendations r
    join public.guideline_documents d on d.id = r.guideline_id and d.status = 'published'
    join public.guideline_sections s on s.id = r.section_id and s.guideline_id = d.id and s.status = 'published'
    where r.id = p_recommendation_id and r.status = 'published' and r.verification_status = 'verified'
  );
$$;

drop policy if exists "authenticated reads published drugs" on public.drugs;
create policy "authenticated reads published drugs" on public.drugs for select to authenticated using (status = 'published' or public.is_guideline_admin());
drop policy if exists "drug admins manage drugs" on public.drugs;
create policy "drug admins manage drugs" on public.drugs for all to authenticated using (public.is_guideline_admin()) with check (public.is_guideline_admin());
drop policy if exists "authenticated reads public recommendation drug references" on public.recommendation_drug_references;
create policy "authenticated reads public recommendation drug references" on public.recommendation_drug_references for select to authenticated using (public.is_guideline_admin() or (status = 'active' and public.can_expose_knowledge_recommendation(recommendation_id) and exists (select 1 from public.drugs d where d.id = drug_id and d.status = 'published')));
drop policy if exists "guideline admins manage recommendation drug references" on public.recommendation_drug_references;
create policy "guideline admins manage recommendation drug references" on public.recommendation_drug_references for all to authenticated using (public.is_guideline_admin()) with check (public.is_guideline_admin());
drop policy if exists "authenticated reads public recommendation calculator references" on public.recommendation_calculator_references;
create policy "authenticated reads public recommendation calculator references" on public.recommendation_calculator_references for select to authenticated using (public.is_calculator_admin() or (status = 'active' and public.can_expose_knowledge_recommendation(recommendation_id) and exists (select 1 from public.calculators c where c.id = calculator_id and c.status = 'published')));
drop policy if exists "calculator admins manage recommendation calculator references" on public.recommendation_calculator_references;
create policy "calculator admins manage recommendation calculator references" on public.recommendation_calculator_references for all to authenticated using (public.is_calculator_admin()) with check (public.is_calculator_admin());

commit;

-- No legacy data is transformed. Roll back new objects only before live data is
-- accepted; do not drop legacy Guideline or Calculator tables as a rollback.
