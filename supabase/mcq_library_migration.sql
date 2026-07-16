-- Public MCQ library. The owner manages delegated MCQ administrators by email.
create extension if not exists pgcrypto;

create table if not exists public.mcq_admins (
  email text primary key,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint mcq_admins_email_normalized_check check (email = lower(trim(email)) and email like '%@%')
);

alter table public.mcq_admins enable row level security;

create table if not exists public.mcq_banks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  questions jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.mcq_banks enable row level security;

create or replace function public.is_mcq_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com'
    or exists (
      select 1 from public.mcq_admins admin
      where admin.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

revoke all on function public.is_mcq_admin() from public;
grant execute on function public.is_mcq_admin() to authenticated;

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

create index if not exists mcq_banks_status_published_idx
  on public.mcq_banks(status, published_at desc, created_at desc);

create or replace function public.list_mcq_bank_states()
returns table(id uuid, status text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select bank.id, bank.status
  from public.mcq_banks bank
  where bank.status in ('draft', 'published', 'archived');
$$;

revoke all on function public.list_mcq_bank_states() from public;
grant execute on function public.list_mcq_bank_states() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mcq-assets', 'mcq-assets', true, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 10485760,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "mcq admin uploads assets" on storage.objects;
create policy "mcq admin uploads assets" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'mcq-assets'
    and public.is_mcq_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "mcq admin updates assets" on storage.objects;
create policy "mcq admin updates assets" on storage.objects
  for update to authenticated using (
    bucket_id = 'mcq-assets'
    and public.is_mcq_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "mcq admin deletes assets" on storage.objects;
create policy "mcq admin deletes assets" on storage.objects
  for delete to authenticated using (
    bucket_id = 'mcq-assets'
    and public.is_mcq_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
