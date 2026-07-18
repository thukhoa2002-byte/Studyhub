create table if not exists public.reference_books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text not null default '',
  publication_year integer,
  source_file_path text not null,
  text_pdf_path text,
  ocr_layout jsonb,
  status text not null default 'private' check (status in ('private', 'shared')),
  processing_status text not null default 'ready' check (processing_status in ('ready', 'processing', 'failed')),
  processing_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reference_books add column if not exists publication_year integer;
alter table public.reference_books add column if not exists ocr_layout jsonb;
alter table public.reference_books add column if not exists parent_id uuid references public.reference_books(id) on delete set null;
alter table public.reference_books add column if not exists item_type text not null default 'book' check (item_type in ('book', 'folder'));
alter table public.reference_books alter column source_file_path drop not null;

create index if not exists reference_books_owner_created_idx on public.reference_books(owner_id, created_at desc);
create index if not exists reference_books_parent_idx on public.reference_books(parent_id, created_at asc);
alter table public.reference_books enable row level security;

drop policy if exists "read own or shared reference books" on public.reference_books;
drop policy if exists "owners create reference books" on public.reference_books;
drop policy if exists "owners update reference books" on public.reference_books;
drop policy if exists "owners delete reference books" on public.reference_books;
create policy "read own or shared reference books" on public.reference_books for select using (owner_id = auth.uid() or status = 'shared');
create policy "owners create reference books" on public.reference_books for insert to authenticated with check (owner_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com');
create policy "owners update reference books" on public.reference_books for update to authenticated using (owner_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com') with check (owner_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com');
create policy "owners delete reference books" on public.reference_books for delete to authenticated using (owner_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com');

insert into storage.buckets (id, name, public) values ('reference-books', 'reference-books', false) on conflict (id) do nothing;
drop policy if exists "read own or shared reference files" on storage.objects;
drop policy if exists "owners upload reference files" on storage.objects;
drop policy if exists "owners delete reference files" on storage.objects;
create policy "read own or shared reference files" on storage.objects for select using (
  bucket_id = 'reference-books' and exists (select 1 from public.reference_books b where b.owner_id = auth.uid() or b.status = 'shared')
);
create policy "owners upload reference files" on storage.objects for insert to authenticated with check (bucket_id = 'reference-books' and (storage.foldername(name))[1] = auth.uid()::text and lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com');
create policy "owners delete reference files" on storage.objects for delete to authenticated using (bucket_id = 'reference-books' and (storage.foldername(name))[1] = auth.uid()::text and lower(coalesce(auth.jwt() ->> 'email', '')) = 'thukhoa2002@gmail.com');
