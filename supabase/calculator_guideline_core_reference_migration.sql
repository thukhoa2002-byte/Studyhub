-- Calculator ↔ Guideline Core reference hardening.
-- Run only after guideline_core_migration.sql. This migration is additive to the
-- already-applied calculator foundation migration and intentionally does not
-- transform legacy guideline_entries into clinical recommendations.

begin;

do $$
begin
  if to_regclass('public.guideline_recommendations') is null then
    raise exception 'guideline_recommendations is required; run guideline_core_migration.sql first';
  end if;

  -- Existing legacy relation IDs have no safe automatic mapping to a Core
  -- recommendation. Abort rather than silently weakening or rewriting links.
  if exists (
    select 1
    from public.calculator_guideline_references reference
    where reference.recommendation_id is not null
      and not exists (
        select 1
        from public.guideline_recommendations recommendation
        where recommendation.id = reference.recommendation_id
      )
  ) then
    raise exception 'Legacy calculator_guideline_references require an explicit recommendation mapping before this migration can run';
  end if;
end;
$$;

-- PostgreSQL requires matching unique constraints for the composite foreign
-- keys that prove recommendation ownership by Guideline and optional Section.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.guideline_recommendations'::regclass
      and conname = 'guideline_recommendations_id_guideline_unique'
  ) then
    alter table public.guideline_recommendations
      add constraint guideline_recommendations_id_guideline_unique unique (id, guideline_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.guideline_recommendations'::regclass
      and conname = 'guideline_recommendations_id_section_unique'
  ) then
    alter table public.guideline_recommendations
      add constraint guideline_recommendations_id_section_unique unique (id, section_id);
  end if;
end;
$$;

alter table public.calculator_guideline_references
  drop constraint if exists calculator_guideline_recommendation_belongs_to_guideline_fk,
  drop constraint if exists calculator_guideline_recommendation_belongs_to_section_fk;

alter table public.calculator_guideline_references
  add constraint calculator_guideline_recommendation_belongs_to_guideline_fk
    foreign key (recommendation_id, guideline_id)
    references public.guideline_recommendations(id, guideline_id)
    on delete restrict,
  add constraint calculator_guideline_recommendation_belongs_to_section_fk
    foreign key (recommendation_id, section_id)
    references public.guideline_recommendations(id, section_id)
    on delete restrict;

-- The authenticated-content migration may already define this helper. Replacing
-- it here makes Calculator relation visibility consistently use Guideline Core.
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
    from public.guideline_documents document
    where document.id = p_guideline_id
      and document.status = 'published'
      and (
        (p_section_id is null and p_recommendation_id is null)
        or (p_section_id is not null and p_recommendation_id is null and exists (
          select 1 from public.guideline_sections section
          where section.id = p_section_id
            and section.guideline_id = document.id
            and section.status = 'published'
        ))
        or (p_recommendation_id is not null and exists (
          select 1
          from public.guideline_recommendations recommendation
          join public.guideline_sections section on section.id = recommendation.section_id
          where recommendation.id = p_recommendation_id
            and recommendation.guideline_id = document.id
            and (p_section_id is null or recommendation.section_id = p_section_id)
            and recommendation.status = 'published'
            and recommendation.verification_status = 'verified'
            and section.guideline_id = document.id
            and section.status = 'published'
        ))
      )
  );
$$;

revoke all on function public.can_expose_guideline_reference(uuid, uuid, uuid) from public;
grant execute on function public.can_expose_guideline_reference(uuid, uuid, uuid) to anon, authenticated;

commit;

-- Rollback guidance (execute only after confirming no Core-only relation has
-- been created): restore the two legacy guideline_entries foreign keys, then
-- drop the two guideline_recommendations composite unique constraints. Do not
-- delete calculator_guideline_references or Guideline Core records.
