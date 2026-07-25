# Guideline Staging Execution Report

Ngày: 2026-07-24
Môi trường: Supabase staging
Trạng thái: NOT RUN

## Migration

| Item | Status | Evidence |
|---|---|---|
| Backup/snapshot | NOT RUN | Chưa được thực hiện |
| `guidelines_migration.sql` | NOT RUN | Chưa chạy trong sprint này |
| `calculator_foundation_migration.sql` | NOT RUN | Chưa chạy trong sprint này |
| `guideline_core_migration.sql` | BLOCKED | Audit có 5 defect/limitation cần quyết định trước |

## Structural verification

| Item | Status | Evidence |
|---|---|---|
| Core tables/columns | NOT RUN | Chờ staging migration |
| UUID/FK/RESTRICT | NOT RUN | Chờ SQL verification |
| Section hierarchy | NOT RUN | Chờ SQL verification |
| Status/verification constraints | NOT RUN | Chờ SQL verification |
| Indexes/timestamps | NOT RUN | Chờ SQL verification |
| Calculator-Guideline unchanged | NOT RUN | Chờ SQL verification |
| Legacy UUID/count preservation | NOT RUN | Chờ before/after snapshots |

## RLS verification

| Actor/test | Status | Evidence |
|---|---|---|
| Anonymous public read | NOT RUN | Cần REST/Network evidence |
| Anonymous restricted read denied | NOT RUN | Cần draft/in_review/archived requests |
| Anonymous writes denied | NOT RUN | Cần POST/PATCH/DELETE response |
| Regular user public read | NOT RUN | Cần authenticated JWT evidence |
| Regular user writes denied | NOT RUN | Cần POST/PATCH/DELETE response |
| Admin CRUD/review/publish/archive | NOT RUN | Cần admin JWT evidence |
| Editor role | BLOCKED | Chưa có editor role/claim riêng |
| `FORCE ROW LEVEL SECURITY` | BLOCKED | Migration hiện chỉ `ENABLE` |
| Legacy entry archive isolation | BLOCKED | Legacy public policy chưa bị thu hồi |
| Calculator relation archive isolation | BLOCKED | Helper hiện dùng visibility/legacy entries |

## Workflow

| Flow | Status |
|---|---|
| Manual Guideline without source file | NOT RUN |
| Section and child section | NOT RUN |
| Draft Recommendation | NOT RUN |
| Invalid publication blocked | NOT RUN |
| Review/verify/publish | NOT RUN |
| Archive hidden from public | NOT RUN |
| Optional source provenance | NOT RUN |
| Legacy table row remains unmapped | NOT RUN |
| Rollback | NOT RUN |
| Archived -> published blocked at DB | BLOCKED |

## Defects before execution

1. Legacy `guideline_entries` public policy checks `visibility = shared` and
   entry `status = reviewed`, not the new document `status = published`.
2. RLS is enabled but not forced.
3. Database trigger does not enforce the lifecycle transition map; the service
   layer blocks archived-to-published, but direct SQL can bypass it when other
   publication requirements are already satisfied.
4. Calculator-Guideline public helper still evaluates the legacy Guideline
   visibility/entry model, so archived Core Guideline isolation is not proven.
5. No separate editor role/claim is defined; only the admin email policy is
   currently available.
6. The migration has no marker for pre-existing columns/backfilled rows, so a
   fully automatic post-commit down migration is not safe.

No migration was executed, no data was changed, and no commit/push was made in
this verification step.
