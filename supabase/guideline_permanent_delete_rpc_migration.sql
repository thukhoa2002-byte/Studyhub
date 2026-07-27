-- Atomic permanent deletion for an archived/draft Guideline.
-- Preflight:
--   1. Back up the database.
--   2. Confirm all referenced tables from the Table-First migrations exist.
--   3. Verify public.is_guideline_admin() recognizes the owner account.
-- Storage objects are intentionally not deleted by this function.

create or replace function public.delete_guideline_permanently(p_guideline_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if auth.uid() is null or not public.is_guideline_admin() then
    raise exception 'Không có quyền xóa Guideline.';
  end if;

  select status into v_status
  from public.guideline_documents
  where id = p_guideline_id
  for update;

  if not found then
    return false;
  end if;

  if v_status not in ('draft', 'archived') then
    raise exception 'Chỉ Guideline bản nháp hoặc đã lưu trữ mới được xóa vĩnh viễn.';
  end if;

  delete from public.recommendation_drug_references
  where recommendation_id in (
    select id from public.guideline_recommendations where guideline_id = p_guideline_id
  );

  delete from public.recommendation_calculator_references
  where recommendation_id in (
    select id from public.guideline_recommendations where guideline_id = p_guideline_id
  );

  delete from public.calculator_guideline_references
  where guideline_id = p_guideline_id;

  delete from public.guideline_recommendations
  where guideline_id = p_guideline_id;

  delete from public.guideline_recommendation_groups
  where guideline_id = p_guideline_id;

  delete from public.guideline_recommendation_tables
  where guideline_id = p_guideline_id;

  delete from public.guideline_clinical_tables
  where guideline_id = p_guideline_id;

  delete from public.guideline_entries
  where document_id = p_guideline_id;

  delete from public.guideline_source_documents
  where guideline_id = p_guideline_id;

  delete from public.guideline_sections
  where guideline_id = p_guideline_id;

  delete from public.guideline_documents
  where id = p_guideline_id;

  return true;
end;
$$;

revoke all on function public.delete_guideline_permanently(uuid) from public;
grant execute on function public.delete_guideline_permanently(uuid) to authenticated;

-- Rollback:
-- drop function if exists public.delete_guideline_permanently(uuid);
