-- Fix MCQ insert/update permissions for the owner and delegated MCQ admins.
-- Run this whole file once in Supabase SQL Editor.

create or replace function public.is_mcq_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    (select lower(email) from auth.users where id = auth.uid()),
    ''
  )) = 'thukhoa2002@gmail.com'
    or exists (
      select 1
      from public.mcq_admins admin
      where admin.email = lower(coalesce(
        nullif(auth.jwt() ->> 'email', ''),
        (select lower(email) from auth.users where id = auth.uid()),
        ''
      ))
    );
$$;

revoke all on function public.is_mcq_admin() from public;
grant execute on function public.is_mcq_admin() to authenticated;

alter table public.mcq_banks enable row level security;

drop policy if exists "mcq admin creates banks" on public.mcq_banks;
create policy "mcq admin creates banks" on public.mcq_banks
  for insert to authenticated
  with check (
    public.is_mcq_admin()
    and owner_id = auth.uid()
  );

drop policy if exists "mcq admin updates banks" on public.mcq_banks;
create policy "mcq admin updates banks" on public.mcq_banks
  for update to authenticated
  using (public.is_mcq_admin())
  with check (public.is_mcq_admin());

drop policy if exists "authenticated read published mcq banks" on public.mcq_banks;
create policy "authenticated read published mcq banks" on public.mcq_banks
  for select to authenticated
  using (status = 'published' or public.is_mcq_admin());
