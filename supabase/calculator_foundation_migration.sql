-- Calculator foundation and typed Guideline relation support.
-- Data-only safe: no seed and no destructive statements.
-- Prerequisite: supabase/guidelines_migration.sql must have created
-- guideline_documents and guideline_entries first.

create extension if not exists pgcrypto;

create table if not exists public.calculators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  slug text not null,
  short_name text not null default '',
  name jsonb not null default '{"vi":"","en":""}'::jsonb,
  description jsonb not null default '{"vi":"","en":""}'::jsonb,
  purpose jsonb not null default '{"vi":"","en":""}'::jsonb,
  calculator_type text not null check (calculator_type in ('score', 'equation', 'criteria', 'algorithm')),
  specialty_id text,
  category_id text,
  handler_key text,
  calculation_mode text not null default 'automatic' check (calculation_mode in ('automatic', 'submit')),
  input_fields jsonb not null default '[]'::jsonb,
  scoring_rules jsonb not null default '[]'::jsonb,
  formula_display jsonb not null default '{"vi":"","en":""}'::jsonb,
  formula_variables jsonb not null default '[]'::jsonb,
  result_definitions jsonb not null default '[]'::jsonb,
  when_to_use jsonb not null default '{"vi":[],"en":[]}'::jsonb,
  when_not_to_use jsonb not null default '{"vi":[],"en":[]}'::jsonb,
  limitations jsonb not null default '{"vi":[],"en":[]}'::jsonb,
  warnings jsonb not null default '{"vi":[],"en":[]}'::jsonb,
  evidence_references jsonb not null default '[]'::jsonb,
  version text not null default '1.0.0',
  calculation_version text not null default '1.0.0',
  content_revision integer not null default 1 check (content_revision > 0),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'reviewed', 'published', 'archived')),
  source_verified boolean not null default false,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calculators_slug_format_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint calculators_published_metadata_check check (status <> 'published' or published_at is not null)
);

create unique index if not exists calculators_slug_unique_idx on public.calculators (slug);
create index if not exists calculators_status_updated_idx on public.calculators (status, updated_at desc);
create index if not exists calculators_owner_idx on public.calculators (owner_id);
create index if not exists calculators_handler_idx on public.calculators (handler_key);

-- The current app derives sections from guideline entries. This table gives
-- section_id a real UUID parent before calculator references are introduced.
create table if not exists public.guideline_sections (
  id uuid primary key default gen_random_uuid(),
  guideline_id uuid not null references public.guideline_documents(id) on delete restrict,
  owner_id uuid references auth.users(id) on delete set null,
  slug text not null,
  title text not null default '',
  title_vi text not null default '',
  summary text not null default '',
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guideline_id, slug),
  unique (id, guideline_id)
);

create index if not exists guideline_sections_guideline_idx on public.guideline_sections (guideline_id, display_order);

alter table public.guideline_entries
  add column if not exists section_id uuid references public.guideline_sections(id) on delete restrict;

create unique index if not exists guideline_entries_id_document_unique_idx
  on public.guideline_entries (id, document_id);
create unique index if not exists guideline_entries_id_section_unique_idx
  on public.guideline_entries (id, section_id);
create index if not exists guideline_entries_section_idx on public.guideline_entries (section_id);

create table if not exists public.calculator_guideline_references (
  id uuid primary key default gen_random_uuid(),
  calculator_id uuid not null references public.calculators(id) on delete cascade,
  guideline_id uuid not null references public.guideline_documents(id) on delete restrict,
  section_id uuid,
  recommendation_id uuid,
  relation_type text not null check (relation_type in (
    'recommended-use',
    'risk-assessment',
    'diagnostic-support',
    'dose-support',
    'monitoring',
    'related'
  )),
  context jsonb not null default '{"vi":"","en":""}'::jsonb,
  required boolean not null default false,
  display_order integer not null default 0 check (display_order >= 0),
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calculator_guideline_section_belongs_to_guideline_fk
    foreign key (section_id, guideline_id)
    references public.guideline_sections(id, guideline_id)
    on delete restrict,
  constraint calculator_guideline_recommendation_belongs_to_guideline_fk
    foreign key (recommendation_id, guideline_id)
    references public.guideline_entries(id, document_id)
    on delete restrict,
  constraint calculator_guideline_recommendation_belongs_to_section_fk
    foreign key (recommendation_id, section_id)
    references public.guideline_entries(id, section_id)
    on delete restrict
);

-- NULLS NOT DISTINCT makes nullable section/recommendation values participate
-- in duplicate detection instead of allowing repeated NULL combinations.
create unique index if not exists calculator_guideline_references_identity_idx
  on public.calculator_guideline_references (
    calculator_id,
    guideline_id,
    section_id,
    recommendation_id,
    relation_type
  ) nulls not distinct;
create index if not exists calculator_guideline_references_calculator_idx on public.calculator_guideline_references (calculator_id);
create index if not exists calculator_guideline_references_guideline_idx on public.calculator_guideline_references (guideline_id);
create index if not exists calculator_guideline_references_section_idx on public.calculator_guideline_references (section_id);
create index if not exists calculator_guideline_references_recommendation_idx on public.calculator_guideline_references (recommendation_id);
create index if not exists calculator_guideline_references_relation_idx on public.calculator_guideline_references (relation_type);

create or replace function public.is_calculator_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com';
$$;

create or replace function public.can_expose_guideline_reference(
  p_guideline_id uuid,
  p_section_id uuid default null,
  p_recommendation_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guideline_documents d
    where d.id = p_guideline_id
      and d.visibility = 'shared'
      and (
        (
          p_section_id is null
          and p_recommendation_id is null
          and exists (select 1 from public.guideline_entries e where e.document_id = d.id)
          and not exists (
            select 1 from public.guideline_entries e
            where e.document_id = d.id and e.status <> 'reviewed'
          )
        )
        or (
          p_recommendation_id is null
          and exists (
            select 1
            from public.guideline_entries e
            where e.document_id = d.id
              and e.section_id = p_section_id
              and e.status = 'reviewed'
          )
        )
        or (
          p_recommendation_id is not null
          and exists (
            select 1 from public.guideline_entries e
            where e.id = p_recommendation_id
              and e.document_id = d.id
              and e.status = 'reviewed'
              and (p_section_id is null or e.section_id = p_section_id)
          )
        )
      )
  );
$$;

revoke all on function public.is_calculator_admin() from public;
revoke all on function public.can_expose_guideline_reference(uuid, uuid, uuid) from public;
grant execute on function public.is_calculator_admin() to anon, authenticated;
grant execute on function public.can_expose_guideline_reference(uuid, uuid, uuid) to anon, authenticated;

alter table public.calculators enable row level security;
alter table public.guideline_sections enable row level security;
alter table public.calculator_guideline_references enable row level security;

drop policy if exists "public reads published calculators" on public.calculators;
create policy "public reads published calculators" on public.calculators
  for select to anon, authenticated using (
    status = 'published'
    or public.is_calculator_admin()
    or owner_id = auth.uid()
  );
drop policy if exists "calculator admins create calculators" on public.calculators;
create policy "calculator admins create calculators" on public.calculators
  for insert to authenticated with check (public.is_calculator_admin() and owner_id = auth.uid());
drop policy if exists "calculator admins update calculators" on public.calculators;
create policy "calculator admins update calculators" on public.calculators
  for update to authenticated using (public.is_calculator_admin()) with check (public.is_calculator_admin());
drop policy if exists "calculator admins delete calculators" on public.calculators;
create policy "calculator admins delete calculators" on public.calculators
  for delete to authenticated using (public.is_calculator_admin() and status = 'draft' and published_at is null);

drop policy if exists "public reads shared guideline sections" on public.guideline_sections;
create policy "public reads shared guideline sections" on public.guideline_sections
  for select to anon using (
    exists (
      select 1 from public.guideline_documents d
      where d.id = guideline_sections.guideline_id and d.visibility = 'shared'
    )
    and exists (
      select 1 from public.guideline_entries e
      where e.section_id = guideline_sections.id and e.status = 'reviewed'
    )
  );
drop policy if exists "admins read all guideline sections" on public.guideline_sections;
create policy "admins read all guideline sections" on public.guideline_sections
  for select to authenticated using (public.is_guideline_admin() or owner_id = auth.uid());

-- The existing Guideline model publishes through shared visibility plus
-- reviewed entries. It has no document-level status column, so expose those
-- records explicitly instead of inventing status = 'published'.
drop policy if exists "public reads shared guideline documents" on public.guideline_documents;
create policy "public reads shared guideline documents" on public.guideline_documents
  for select to anon using (visibility = 'shared');
drop policy if exists "public reads reviewed shared guideline entries" on public.guideline_entries;
create policy "public reads reviewed shared guideline entries" on public.guideline_entries
  for select to anon using (
    status = 'reviewed'
    and exists (
      select 1 from public.guideline_documents d
      where d.id = guideline_entries.document_id and d.visibility = 'shared'
    )
  );

drop policy if exists "public reads published calculator guideline references" on public.calculator_guideline_references;
create policy "public reads published calculator guideline references" on public.calculator_guideline_references
  for select to anon, authenticated using (
    public.is_calculator_admin()
    or (
      exists (
      select 1 from public.calculators c
      where c.id = calculator_guideline_references.calculator_id and c.status = 'published'
      )
      and public.can_expose_guideline_reference(guideline_id, section_id, recommendation_id)
    )
  );
drop policy if exists "calculator admins create guideline references" on public.calculator_guideline_references;
create policy "calculator admins create guideline references" on public.calculator_guideline_references
  for insert to authenticated with check (public.is_calculator_admin() and owner_id = auth.uid());
drop policy if exists "calculator admins update guideline references" on public.calculator_guideline_references;
create policy "calculator admins update guideline references" on public.calculator_guideline_references
  for update to authenticated using (public.is_calculator_admin()) with check (public.is_calculator_admin());
drop policy if exists "calculator admins delete guideline references" on public.calculator_guideline_references;
create policy "calculator admins delete guideline references" on public.calculator_guideline_references
  for delete to authenticated using (public.is_calculator_admin());
