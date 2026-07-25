-- Apply after Guideline Core, Calculator Foundation and Knowledge Relationship Foundation.
-- Additive only. This migration never deletes data or relations.
begin;

create or replace function public.enforce_studyhub_lifecycle_transition()
returns trigger language plpgsql as $$
begin
  if new.status = old.status then return new; end if;
  if (old.status = 'draft' and new.status in ('in_review', 'reviewed', 'published'))
     or (old.status = 'in_review' and new.status in ('draft', 'reviewed', 'published'))
     or (old.status = 'reviewed' and new.status in ('draft', 'in_review', 'published'))
     or (old.status = 'published' and new.status = 'archived')
     or (old.status = 'archived' and new.status in ('draft', 'published')) then
    return new;
  end if;
  raise exception 'Invalid lifecycle transition: % -> %', old.status, new.status;
end;
$$;

drop trigger if exists guideline_documents_lifecycle_transition on public.guideline_documents;
create trigger guideline_documents_lifecycle_transition before update of status on public.guideline_documents for each row execute function public.enforce_studyhub_lifecycle_transition();
drop trigger if exists guideline_sections_lifecycle_transition on public.guideline_sections;
create trigger guideline_sections_lifecycle_transition before update of status on public.guideline_sections for each row execute function public.enforce_studyhub_lifecycle_transition();
drop trigger if exists guideline_recommendations_lifecycle_transition on public.guideline_recommendations;
create trigger guideline_recommendations_lifecycle_transition before update of status on public.guideline_recommendations for each row execute function public.enforce_studyhub_lifecycle_transition();
drop trigger if exists calculators_lifecycle_transition on public.calculators;
create trigger calculators_lifecycle_transition before update of status on public.calculators for each row execute function public.enforce_studyhub_lifecycle_transition();
drop trigger if exists drugs_lifecycle_transition on public.drugs;
create trigger drugs_lifecycle_transition before update of status on public.drugs for each row execute function public.enforce_studyhub_lifecycle_transition();

alter table public.recommendation_drug_references drop constraint if exists recommendation_drug_references_drug_id_fkey;
alter table public.recommendation_drug_references add constraint recommendation_drug_references_drug_id_fkey foreign key (drug_id) references public.drugs(id) on delete restrict;
alter table public.recommendation_calculator_references drop constraint if exists recommendation_calculator_references_calculator_id_fkey;
alter table public.recommendation_calculator_references add constraint recommendation_calculator_references_calculator_id_fkey foreign key (calculator_id) references public.calculators(id) on delete restrict;

drop policy if exists "guideline admins delete draft core" on public.guideline_documents;
create policy "guideline admins delete draft or archived core" on public.guideline_documents for delete to authenticated using (public.is_guideline_admin() and status in ('draft', 'archived'));
drop policy if exists "guideline admins delete sections" on public.guideline_sections;
create policy "guideline admins delete draft or archived sections" on public.guideline_sections for delete to authenticated using (public.is_guideline_admin() and status in ('draft', 'archived'));
drop policy if exists "guideline admins delete draft recommendations" on public.guideline_recommendations;
create policy "guideline admins delete draft or archived recommendations" on public.guideline_recommendations for delete to authenticated using (public.is_guideline_admin() and status in ('draft', 'archived'));
drop policy if exists "calculator admins delete calculators" on public.calculators;
create policy "calculator admins delete draft or archived calculators" on public.calculators for delete to authenticated using (public.is_calculator_admin() and status in ('draft', 'archived'));

commit;

-- Rollback: drop the five lifecycle triggers/function, restore the prior delete
-- policies from the foundation migrations, and restore CASCADE only if the old
-- relationship semantics are deliberately required. Do not delete live rows.
