-- Hierarchical folders for the MCQ library.
-- Deleting a folder keeps its banks and moves them to the root.

create table if not exists public.mcq_folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  parent_id uuid references public.mcq_folders(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint mcq_folders_title_check check (length(trim(title)) > 0),
  constraint mcq_folders_not_self_parent check (parent_id is null or parent_id <> id)
);

alter table public.mcq_folders enable row level security;

alter table public.mcq_banks
  add column if not exists folder_id uuid references public.mcq_folders(id) on delete set null;

create index if not exists mcq_folders_parent_idx
  on public.mcq_folders(parent_id, created_at asc);

create index if not exists mcq_banks_folder_idx
  on public.mcq_banks(folder_id, created_at desc);

drop policy if exists "authenticated read published mcq folders" on public.mcq_folders;
create policy "authenticated read published mcq folders" on public.mcq_folders
  for select to authenticated
  using (status = 'published' or public.is_mcq_admin());

drop policy if exists "mcq admin creates folders" on public.mcq_folders;
create policy "mcq admin creates folders" on public.mcq_folders
  for insert to authenticated
  with check (public.is_mcq_admin() and owner_id = auth.uid());

drop policy if exists "mcq admin updates folders" on public.mcq_folders;
create policy "mcq admin updates folders" on public.mcq_folders
  for update to authenticated
  using (public.is_mcq_admin())
  with check (public.is_mcq_admin());

drop policy if exists "mcq admin deletes folders" on public.mcq_folders;
create policy "mcq admin deletes folders" on public.mcq_folders
  for delete to authenticated
  using (public.is_mcq_admin());
