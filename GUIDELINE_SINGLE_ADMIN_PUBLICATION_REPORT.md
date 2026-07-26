# Guideline Single-Admin Publication Workflow

## Implemented locally

- Recommendation publication no longer requires `verification_status = verified`.
- Verification and review fields remain stored as optional audit metadata for legacy data.
- Public recommendation reads are filtered by `status = published`; the parent Guideline and Section policies remain required.
- The Guideline action bar includes **Xuất bản tất cả mục hợp lệ**.
- Each non-archived Section includes **Xuất bản mục**. It publishes the Section, publishes the parent Guideline when eligible, then publishes only valid draft Recommendations in that Section.
- Bulk operations are idempotent: published Recommendations are skipped, drafts that fail validation remain drafts, and blocker details are returned to the editor.

## Recommendation tables

The existing Core schema has no persisted Recommendation Table entity. Imported tables remain import-job metadata and must not be treated as `guideline_entries`.

`supabase/guideline_single_admin_publication_migration.sql` introduces the independent `guideline_recommendation_tables` container and its RLS policy. It is intentionally **not executed**. Table-level bulk UI must be enabled only after this migration is applied, so existing environments do not issue requests to a missing table or silently use a legacy fallback.

## Safety

- No SQL was executed.
- No deployment, merge, or push was performed.
- The migration is additive, transactional, uses `ON DELETE RESTRICT`, and does not alter `guideline_entries`.
- Existing Calculator relations are untouched.

## Verification

- `npm test`: PASS
- `npx tsc -b`: PASS
- `npm run lint`: PASS with existing out-of-scope warnings
- `npm run build`: PASS with existing chunk-size warnings
- `git diff --check`: PASS
