-- Public media used inside imported Anki cards.
-- Each authenticated account can only write inside its own top-level folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'anki-media',
  'anki-media',
  true,
  31457280,
  array[
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read Anki media" on storage.objects;
create policy "Public can read Anki media"
on storage.objects for select
using (bucket_id = 'anki-media');

drop policy if exists "Users can upload own Anki media" on storage.objects;
create policy "Users can upload own Anki media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'anki-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own Anki media" on storage.objects;
create policy "Users can update own Anki media"
on storage.objects for update to authenticated
using (
  bucket_id = 'anki-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'anki-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own Anki media" on storage.objects;
create policy "Users can delete own Anki media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'anki-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
