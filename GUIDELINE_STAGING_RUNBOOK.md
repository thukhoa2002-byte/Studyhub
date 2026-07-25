# Guideline Staging Runbook

Trạng thái: chuẩn bị, chưa thực thi.
Mục tiêu: chạy và xác minh Sprint B trên Supabase staging, không chạy
production.

## Prerequisites

1. Backup database staging hoặc tạo snapshot theo công cụ Supabase.
2. Xác nhận project ref là Supabase staging.
3. Xác nhận branch/build đang dùng migration Sprint B.
4. Xác nhận admin `thukhoa2002@gmail.com` tồn tại trong `auth.users`.
5. Chưa chạy nếu ba lỗi trong `GUIDELINE_MIGRATION_VERIFICATION_REPORT.md`
   chưa được xử lý hoặc chấp thuận.

## SQL execution order

Chạy trong Supabase SQL Editor theo thứ tự:

```text
1. supabase/guidelines_migration.sql
2. supabase/calculator_foundation_migration.sql
3. supabase/guideline_core_migration.sql
```

File Sprint B có `BEGIN`/`COMMIT`, nên DDL/data backfill trong chính file đó
được thực hiện trong một transaction. Nếu lỗi trước `COMMIT`, chạy `ROLLBACK`
hoặc đóng query theo hướng dẫn SQL Editor; không tự chạy lại một phần file.

## Locking/downtime risk

- `ALTER TABLE` lấy lock ngắn trên `guideline_documents` và
  `guideline_sections`; thời gian phụ thuộc query đang chạy.
- `UPDATE` backfill status có thể lock các row Guideline hiện có.
- `CREATE INDEX` không dùng `CONCURRENTLY`, nên có thể chặn ghi trong thời
  gian tạo index. Với dữ liệu nhỏ rủi ro thấp; với production không chạy file.
- Tạo trigger/policy không yêu cầu downtime nhưng chờ transaction commit.

## Pre-migration snapshot

Chạy và lưu kết quả trước migration:

```sql
select id, owner_id, title, visibility, publication_year, version_label,
       source_url, file_path, supplement_file_path, updated_at
from public.guideline_documents
order by id;

select id, document_id, section_id, table_kind, table_row_role, status,
       page_reference, source_order
from public.guideline_entries
order by document_id, source_order, id;

select id, guideline_id, slug, title, display_order
from public.guideline_sections
order by guideline_id, display_order, id;

select id, calculator_id, guideline_id, section_id, recommendation_id,
       relation_type, display_order
from public.calculator_guideline_references
order by calculator_id, display_order, id;
```

## Structural verification SQL

```sql
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'guideline_documents', 'guideline_sections',
    'guideline_source_documents', 'guideline_recommendations',
    'guideline_entries', 'calculator_guideline_references'
  )
order by table_name, ordinal_position;

select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'guideline_documents', 'guideline_sections',
    'guideline_source_documents', 'guideline_recommendations'
  )
order by c.relname;

select conrelid::regclass as table_name,
       conname,
       contype,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.guideline_documents'::regclass,
  'public.guideline_sections'::regclass,
  'public.guideline_source_documents'::regclass,
  'public.guideline_recommendations'::regclass
)
order by table_name, conname;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'guideline_documents', 'guideline_sections',
    'guideline_source_documents', 'guideline_recommendations',
    'calculator_guideline_references'
  )
order by tablename, indexname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'guideline_documents', 'guideline_sections',
    'guideline_source_documents', 'guideline_recommendations'
  )
order by tablename, policyname;

select to_regclass('public.guideline_documents') as guideline_documents,
       to_regclass('public.guideline_entries') as guideline_entries,
       to_regclass('public.guideline_sections') as guideline_sections,
       to_regclass('public.guideline_source_documents') as guideline_source_documents,
       to_regclass('public.guideline_recommendations') as guideline_recommendations,
       to_regclass('public.calculator_guideline_references') as calculator_guideline_references;
```

Expected: all tables exist, UUID PK/FKs are present, parent/child FKs are
`RESTRICT`, the unique Calculator relation index definition is unchanged, and
`rls_forced` is explicitly reviewed rather than assumed.

## Transactional workflow verification

Run as a database/admin role in a disposable transaction. This verifies
constraints and triggers, not JWT RLS. Replace the email if the staging admin
differs.

```sql
begin;

do $$
declare
  v_admin uuid;
  v_guideline uuid;
  v_parent uuid;
  v_child uuid;
  v_recommendation uuid;
begin
  select id into v_admin from auth.users
  where lower(email) = 'thukhoa2002@gmail.com' limit 1;
  if v_admin is null then raise exception 'Admin user not found'; end if;

  insert into public.guideline_documents
    (owner_id, title, society, condition, publication_year, version_label,
     source_url, visibility, status, citation)
  values
    (v_admin, 'STAGING_TEST_Guideline', 'STAGING_TEST', 'Khác', null,
     'STAGING_TEST_v1', null, 'private', 'draft', 'STAGING_TEST manual citation')
  returning id into v_guideline;

  insert into public.guideline_sections
    (guideline_id, owner_id, slug, title, title_vi, status)
  values
    (v_guideline, v_admin, 'overview', 'STAGING_TEST Overview', 'Tổng quan', 'draft')
  returning id into v_parent;

  insert into public.guideline_sections
    (guideline_id, owner_id, parent_section_id, slug, title, title_vi, status)
  values
    (v_guideline, v_admin, v_parent, 'details', 'STAGING_TEST Details', 'Chi tiết', 'draft')
  returning id into v_child;

  insert into public.guideline_recommendations
    (guideline_id, section_id, owner_id, title,
     recommendation_text_original, recommendation_text_vi,
     verification_status, status, source_quote)
  values
    (v_guideline, v_child, v_admin, 'STAGING_TEST Recommendation',
     'Do this', 'Thực hiện', 'unverified', 'draft', 'STAGING_TEST quote')
  returning id into v_recommendation;

  if not exists (
    select 1 from public.guideline_recommendations
    where id = v_recommendation and status = 'draft'
  ) then raise exception 'Draft recommendation was not created'; end if;

  -- Publication should fail: no source URL/record and no published section.
  begin
    update public.guideline_documents set status = 'published' where id = v_guideline;
    raise exception 'Expected publication validation error was not raised';
  exception when others then
    if sqlerrm not like '%source traceability%' then raise; end if;
  end;

  -- Make the record eligible and verify the recommendation.
  update public.guideline_documents
  set source_url = 'https://example.test/STAGING_TEST', status = 'in_review'
  where id = v_guideline;
  update public.guideline_sections set status = 'published' where id in (v_parent, v_child);
  update public.guideline_documents set status = 'published' where id = v_guideline;
  update public.guideline_recommendations
  set verification_status = 'verified', status = 'reviewed', reviewed_by = v_admin,
      reviewed_at = now()
  where id = v_recommendation;
  update public.guideline_recommendations set status = 'published' where id = v_recommendation;

  if exists (
    select 1 from public.guideline_recommendations
    where id = v_recommendation and status <> 'published'
  ) then raise exception 'Eligible recommendation did not publish'; end if;

  insert into public.guideline_source_documents
    (guideline_id, owner_id, original_filename, storage_path, mime_type, source_kind)
  values
    (v_guideline, v_admin, 'STAGING_TEST.pdf', 'STAGING_TEST/manual.pdf', 'application/pdf', 'supporting');

  update public.guideline_documents set status = 'archived' where id = v_guideline;
  if exists (select 1 from public.guideline_documents where id = v_guideline and status <> 'archived') then
    raise exception 'Guideline was not archived';
  end if;

  -- Known current defect: without a DB state trigger this may succeed if the
  -- parent still has source/eligible children. Expected after the fix: ERROR.
  -- update public.guideline_documents set status = 'published' where id = v_guideline;
end
$$;

rollback;
```

The SQL intentionally comments out the archived-to-published assertion until
the missing DB transition guard is approved. It must be enabled after the
minimal migration fix, with expected result `ERROR`.

## Legacy preservation verification

Run before and after migration and compare IDs/counts:

```sql
select count(*) as legacy_entry_count, count(distinct id) as legacy_entry_ids
from public.guideline_entries;

select count(*) as recommendation_count
from public.guideline_recommendations;

select id, table_kind, table_row_role, status
from public.guideline_entries
where table_kind = 'data' or table_row_role in ('header', 'section');
```

Expected: legacy row count/IDs unchanged; no Recommendation is created from a
legacy row by `guideline_core_migration.sql`.

## RLS verification

Do not use SQL Editor as proof of anonymous/user RLS: SQL Editor commonly runs
as a privileged database role. Use the browser Network panel or REST requests
with the actual anon key/JWT.

Required cases:

- anonymous: published visible; draft/in_review/archived hidden; unverified
  Recommendation hidden; all writes denied;
- regular user: same public read scope; all writes denied;
- admin: all statuses visible; CRUD/review/publish/archive allowed by policy;
- editor: currently NOT RUN/BLOCKED because no editor role/claim exists in the
  current authorization model; do not treat the admin email as editor proof.

Record HTTP status, request URL, JWT role and response body. UI-hidden data is
not evidence of RLS.

Also inspect `calculator_guideline_references` after archiving a Guideline.
The current Calculator foundation helper is legacy visibility/entry based and
must be marked FAIL if it still returns a relation for an archived Guideline.

## Rollback

If the migration fails before `COMMIT`, do not run partial statements; execute:

```sql
rollback;
```

After a committed migration, do not run an unguarded DROP. First backup and
confirm no new Sprint B records are needed. A guarded down transaction must
check that `guideline_recommendations` and `guideline_source_documents` contain
no post-migration records, then remove only Sprint B policies/triggers/tables
and added columns. Because the current migration has no migration marker, an
automatic post-commit down script cannot safely distinguish backfilled source
rows from later user rows. This is a rollback limitation and must be resolved
before production use.

The safe rollback SQL currently available is therefore:

```sql
-- Use only when the Sprint B migration transaction has not committed.
rollback;
```

For a committed migration, use this guarded object rollback only after a
backup and manual confirmation that both new tables are empty. It intentionally
does not drop Guideline columns because some of them may have existed before
Sprint B (`provenance` in particular):

```sql
begin;

do $$
begin
  if to_regclass('public.guideline_recommendations') is not null
     and exists (select 1 from public.guideline_recommendations) then
    raise exception 'Rollback blocked: guideline_recommendations is not empty';
  end if;
  if to_regclass('public.guideline_source_documents') is not null
     and exists (select 1 from public.guideline_source_documents) then
    raise exception 'Rollback blocked: guideline_source_documents is not empty';
  end if;
end
$$;

drop trigger if exists guideline_documents_publication_validation on public.guideline_documents;
drop trigger if exists guideline_recommendations_publication_validation on public.guideline_recommendations;
drop trigger if exists guideline_documents_updated_at on public.guideline_documents;
drop trigger if exists guideline_sections_updated_at on public.guideline_sections;
drop trigger if exists guideline_source_documents_updated_at on public.guideline_source_documents;
drop trigger if exists guideline_recommendations_updated_at on public.guideline_recommendations;

drop function if exists public.validate_guideline_publication();
drop function if exists public.validate_guideline_recommendation_publication();

drop table if exists public.guideline_recommendations;
drop table if exists public.guideline_source_documents;

alter table public.guideline_sections
  drop constraint if exists guideline_sections_parent_belongs_to_guideline_fk;
alter table public.guideline_sections
  drop constraint if exists guideline_sections_status_check;

-- Review the pre-migration schema snapshot before manually dropping any
-- added columns on guideline_documents/guideline_sections.

rollback;
```

The final `ROLLBACK` makes this block a dry-run. Replace it with `COMMIT` only
after the snapshot confirms the columns were introduced by Sprint B and the
new tables are empty. This is intentionally not an automatic production down
migration.
