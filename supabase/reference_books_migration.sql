create table if not exists public.reference_books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text not null default '',
  publication_year integer,
  source_file_path text not null,
  text_pdf_path text,
  status text not null default 'private' check (status in ('private', 'shared')),
  processing_status text not null default 'ready' check (processing_status in ('ready', 'processing', 'failed')),
  processing_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reference_books add column if not exists publication_year integer;

create index if not exists reference_books_owner_created_idx on public.reference_books(owner_id, created_at desc);
alter table public.reference_books enable row level security;

create policy "read own or shared reference books" on public.reference_books for select using (owner_id = auth.uid() or status = 'shared');
create policy "owners create reference books" on public.reference_books for insert with check (owner_id = auth.uid());
create policy "owners update reference books" on public.reference_books for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete reference books" on public.reference_books for delete using (owner_id = auth.uid());

insert into storage.buckets (id, name, public) values ('reference-books', 'reference-books', false) on conflict (id) do nothing;
create policy "read own or shared reference files" on storage.objects for select using (
  bucket_id = 'reference-books' and exists (select 1 from public.reference_books b where b.owner_id = auth.uid() or b.status = 'shared')
);
create policy "owners upload reference files" on storage.objects for insert with check (bucket_id = 'reference-books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owners delete reference files" on storage.objects for delete using (bucket_id = 'reference-books' and (storage.foldername(name))[1] = auth.uid()::text);
