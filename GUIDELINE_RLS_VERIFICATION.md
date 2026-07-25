# Guideline RLS Verification

Phạm vi: Guideline Core mới và các bảng legacy liên quan. Chạy trên staging,
không dùng production.

## Expected policies

### Anonymous

- SELECT chỉ được `guideline_documents.status = 'published'`.
- SELECT chỉ được Section thuộc Guideline published và Section đủ điều kiện.
- SELECT chỉ được Recommendation `status = published` và
  `verification_status = verified` thuộc Guideline/Section public.
- Không INSERT/UPDATE/DELETE bất kỳ Guideline Core record nào.

### Regular authenticated user

- Có cùng public SELECT scope với anonymous.
- Không tạo, sửa, archive, publish hoặc delete Guideline/Section/
  Recommendation/SourceDocument.

### Admin/editor

- Được đọc toàn bộ trạng thái trong phạm vi được ủy quyền.
- Được tạo/sửa/xóa draft, review, verify, publish và archive.
- Database policy vẫn kiểm tra owner/role; hidden UI không được xem là quyền.

## Verification SQL checklist

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'guideline_documents', 'guideline_sections',
    'guideline_recommendations', 'guideline_source_documents'
  );

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'guideline_documents', 'guideline_sections',
    'guideline_recommendations', 'guideline_source_documents'
  )
order by tablename, policyname;
```

## Test data

Use `STAGING_TEST_` in title/slug. Create one Guideline with draft, in_review,
published and archived cases; create reviewed/unverified and published/
archived Recommendation cases.

Expected results:

| Test | Anonymous | Regular user | Admin |
|---|---|---|---|
| Read draft | 0 rows / 404 | 0 rows / 404 | visible |
| Read archived | 0 rows / 404 | 0 rows / 404 | visible |
| Read published verified | visible | visible | visible |
| Create draft | denied | denied | allowed |
| Publish | denied | denied | allowed if valid |
| Archive | denied | denied | allowed |
| Edit published | denied | denied | allowed, resets verification |

Capture SQL response/status and request role. A passing UI state without the
database response is `BLOCKED`, not `PASS`.

## Calculator integrity

Re-run existing Calculator migration/integrity checks and verify that
`calculator_guideline_references` indexes, `NULLS NOT DISTINCT` uniqueness and
FKs are unchanged. This Sprint B does not migrate its legacy
`recommendation_id` FK.
