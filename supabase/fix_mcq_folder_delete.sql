-- Run this once in Supabase SQL Editor if deleting an MCQ folder still does
-- not remove the row after the frontend update.

create or replace function public.delete_mcq_folder(p_folder_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_mcq_admin() then
    raise exception 'Only MCQ admins can delete folders';
  end if;

  delete from public.mcq_folders
  where id = p_folder_id;

  if not found then
    raise exception 'MCQ folder not found';
  end if;

  return true;
end;
$$;

revoke all on function public.delete_mcq_folder(uuid) from public;
grant execute on function public.delete_mcq_folder(uuid) to authenticated;
