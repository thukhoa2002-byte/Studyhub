-- Delegated MCQ administrators.
-- The owner can grant/revoke access by email. Delegated admins can manage MCQ
-- content but cannot change this access list.
create table if not exists public.mcq_admins (
  email text primary key,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint mcq_admins_email_normalized_check check (email = lower(trim(email)) and email like '%@%')
);

alter table public.mcq_admins enable row level security;

create or replace function public.is_mcq_owner()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com';
$$;

create or replace function public.is_mcq_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_mcq_owner() or exists (
    select 1
    from public.mcq_admins admin
    where admin.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_mcq_owner() from public;
revoke all on function public.is_mcq_admin() from public;
grant execute on function public.is_mcq_owner() to authenticated;
grant execute on function public.is_mcq_admin() to authenticated;

create or replace function public.list_mcq_admins()
returns table(email text, is_owner boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_mcq_owner() then
    raise exception 'Only the MCQ owner can view the access list';
  end if;
  return query
    select access.email, access.is_owner, access.created_at
    from (
      select 'thukhoa2002@gmail.com'::text as email, true as is_owner, null::timestamptz as created_at
      union all
      select admin.email, false, admin.created_at
      from public.mcq_admins admin
      where admin.email <> 'thukhoa2002@gmail.com'
    ) access
    order by access.is_owner desc, access.email asc;
end;
$$;

create or replace function public.add_mcq_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_mcq_owner() then
    raise exception 'Only the MCQ owner can grant access';
  end if;
  if normalized_email = '' or normalized_email not like '%_@_%._%' then
    raise exception 'Invalid email';
  end if;
  if normalized_email = 'thukhoa2002@gmail.com' then return; end if;
  insert into public.mcq_admins(email, added_by)
  values (normalized_email, auth.uid())
  on conflict (email) do nothing;
end;
$$;

create or replace function public.remove_mcq_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_mcq_owner() then
    raise exception 'Only the MCQ owner can revoke access';
  end if;
  if normalized_email = 'thukhoa2002@gmail.com' then
    raise exception 'The MCQ owner cannot be removed';
  end if;
  delete from public.mcq_admins where email = normalized_email;
end;
$$;

revoke all on function public.list_mcq_admins() from public;
revoke all on function public.add_mcq_admin(text) from public;
revoke all on function public.remove_mcq_admin(text) from public;
grant execute on function public.list_mcq_admins() to authenticated;
grant execute on function public.add_mcq_admin(text) to authenticated;
grant execute on function public.remove_mcq_admin(text) to authenticated;

drop policy if exists "authenticated read published mcq banks" on public.mcq_banks;
create policy "authenticated read published mcq banks" on public.mcq_banks
  for select to authenticated using (status = 'published' or public.is_mcq_admin());

drop policy if exists "mcq admin creates banks" on public.mcq_banks;
create policy "mcq admin creates banks" on public.mcq_banks
  for insert to authenticated with check (public.is_mcq_admin() and owner_id = auth.uid());

drop policy if exists "mcq admin updates banks" on public.mcq_banks;
create policy "mcq admin updates banks" on public.mcq_banks
  for update to authenticated using (public.is_mcq_admin())
  with check (public.is_mcq_admin());

drop policy if exists "mcq admin deletes banks" on public.mcq_banks;
create policy "mcq admin deletes banks" on public.mcq_banks
  for delete to authenticated using (public.is_mcq_admin());

drop policy if exists "mcq owner reads access list" on public.mcq_admins;
create policy "mcq owner reads access list" on public.mcq_admins
  for select to authenticated using (public.is_mcq_owner());
