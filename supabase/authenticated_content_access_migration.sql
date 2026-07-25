-- Authenticated content boundary for StudyHub.
-- Additive migration. Run after guideline_core_migration.sql and
-- calculator_foundation_migration.sql. This file is intentionally not run by
-- the application and does not create or alter the Drug schema.

begin;

-- Anonymous users receive catalog previews through narrow security-definer
-- functions, never through the content tables.
create or replace function public.list_public_guideline_previews()
returns table (
  id uuid,
  title text,
  society text,
  condition text,
  publication_year integer,
  version_label text,
  summary text,
  topics jsonb,
  status text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.title, d.society, d.condition, d.publication_year,
    d.version_label, d.summary, d.topics, d.status, d.published_at
  from public.guideline_documents d
  where d.status = 'published'
  order by d.publication_year desc nulls last, d.created_at desc;
$$;

create or replace function public.list_public_calculator_previews()
returns table (
  id uuid,
  slug text,
  short_name text,
  name jsonb,
  description jsonb,
  specialty_id text,
  category_id text,
  status text,
  version text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.slug, c.short_name, c.name, c.description,
    c.specialty_id, c.category_id, c.status, c.version, c.updated_at
  from public.calculators c
  where c.status = 'published'
  order by c.updated_at desc;
$$;

revoke all on function public.list_public_guideline_previews() from public;
revoke all on function public.list_public_calculator_previews() from public;
grant execute on function public.list_public_guideline_previews() to anon, authenticated;
grant execute on function public.list_public_calculator_previews() to anon, authenticated;

-- Legacy entries stay available only to authenticated users and only under a
-- published parent. They are never the public Guideline Core read model.
drop policy if exists "read reviewed shared or own guideline entries" on public.guideline_entries;
drop policy if exists "public reads reviewed shared guideline entries" on public.guideline_entries;
drop policy if exists "authenticated reads published legacy guideline entries" on public.guideline_entries;
create policy "authenticated reads published legacy guideline entries"
  on public.guideline_entries for select to authenticated
  using (
    exists (
      select 1 from public.guideline_documents d
      where d.id = guideline_entries.document_id and d.status = 'published'
    )
  );

-- Full Core content is authenticated-only. Admin policies from the Core
-- migration remain in place and still provide access to every lifecycle state.
drop policy if exists "public reads published guideline core" on public.guideline_documents;
drop policy if exists "public reads shared guideline documents" on public.guideline_documents;
drop policy if exists "read own or shared guideline documents" on public.guideline_documents;
drop policy if exists "authenticated reads published guideline core" on public.guideline_documents;
create policy "authenticated reads published guideline core"
  on public.guideline_documents for select to authenticated
  using (status = 'published');

drop policy if exists "public reads published guideline sections" on public.guideline_sections;
drop policy if exists "public reads shared guideline sections" on public.guideline_sections;
drop policy if exists "authenticated reads published guideline sections" on public.guideline_sections;
create policy "authenticated reads published guideline sections"
  on public.guideline_sections for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.guideline_documents d
      where d.id = guideline_sections.guideline_id and d.status = 'published'
    )
  );

drop policy if exists "public reads published guideline recommendations" on public.guideline_recommendations;
drop policy if exists "authenticated reads published guideline recommendations" on public.guideline_recommendations;
create policy "authenticated reads published guideline recommendations"
  on public.guideline_recommendations for select to authenticated
  using (
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

drop policy if exists "public reads published guideline source metadata" on public.guideline_source_documents;
drop policy if exists "authenticated reads published guideline source metadata" on public.guideline_source_documents;
create policy "authenticated reads published guideline source metadata"
  on public.guideline_source_documents for select to authenticated
  using (exists (
    select 1 from public.guideline_documents d
    where d.id = guideline_source_documents.guideline_id and d.status = 'published'
  ));

-- Calculator formulas and inputs are protected content. The public catalog
-- uses list_public_calculator_previews() instead.
drop policy if exists "public reads published calculators" on public.calculators;
drop policy if exists "authenticated reads published calculators" on public.calculators;
create policy "authenticated reads published calculators"
  on public.calculators for select to authenticated
  using (status = 'published' or public.is_calculator_admin());

-- Preserve the Calculator relation schema, but prevent anonymous relation
-- reads and evaluate eligibility using Guideline Core rather than legacy rows.
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
    select 1 from public.guideline_documents d
    where d.id = p_guideline_id
      and d.status = 'published'
      and (
        (p_section_id is null and p_recommendation_id is null and exists (
          select 1 from public.guideline_sections s
          where s.guideline_id = d.id and s.status = 'published'
        ))
        or (p_section_id is not null and p_recommendation_id is null and exists (
          select 1 from public.guideline_sections s
          where s.id = p_section_id and s.guideline_id = d.id and s.status = 'published'
        ))
        or (p_recommendation_id is not null and exists (
          select 1 from public.guideline_recommendations r
          join public.guideline_sections s on s.id = r.section_id
          where r.id = p_recommendation_id
            and r.guideline_id = d.id
      and (p_section_id is null or r.section_id = p_section_id)
            and r.status = 'published'
            and r.verification_status = 'verified'
            and s.guideline_id = d.id
            and s.status = 'published'
        ))
      )
  );
$$;

drop policy if exists "public reads published calculator guideline references" on public.calculator_guideline_references;
drop policy if exists "authenticated reads published calculator guideline references" on public.calculator_guideline_references;
create policy "authenticated reads published calculator guideline references"
  on public.calculator_guideline_references for select to authenticated
  using (
    public.is_calculator_admin()
    or (
      exists (select 1 from public.calculators c where c.id = calculator_guideline_references.calculator_id and c.status = 'published')
      and public.can_expose_guideline_reference(guideline_id, section_id, recommendation_id)
    )
  );

commit;

-- Rollback guidance: restore the previous named public policies only after
-- confirming that the preview RPCs are deployed and no protected payload is
-- exposed. Do not drop content tables or revoke authenticated policies.
