-- Formula and clinical reference tools managed by the site owner.
create table if not exists public.reference_formulas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  usage text not null default '',
  formula_html text not null default '',
  status text not null default 'shared' check (status in ('private', 'shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reference_formulas_title_check check (length(trim(title)) > 0)
);

alter table public.reference_formulas enable row level security;

drop policy if exists "read shared or own reference formulas" on public.reference_formulas;
create policy "read shared or own reference formulas" on public.reference_formulas
  for select to anon, authenticated
  using (status = 'shared' or owner_id = auth.uid());

drop policy if exists "owner creates reference formulas" on public.reference_formulas;
create policy "owner creates reference formulas" on public.reference_formulas
  for insert to authenticated
  with check (owner_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com');

drop policy if exists "owner updates reference formulas" on public.reference_formulas;
create policy "owner updates reference formulas" on public.reference_formulas
  for update to authenticated
  using (owner_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com')
  with check (owner_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com');

drop policy if exists "owner deletes reference formulas" on public.reference_formulas;
create policy "owner deletes reference formulas" on public.reference_formulas
  for delete to authenticated
  using (owner_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com');
