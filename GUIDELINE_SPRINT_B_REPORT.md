# Guideline Sprint B Report

Ngày bắt đầu: 2026-07-24
Phạm vi: Schema, repository, service, validation, publication rules và migration planning.

## Deliverables

- [x] Schema delta defined in `GUIDELINE_SCHEMA_DESIGN.md`.
- [x] Publication rules defined in `GUIDELINE_PUBLICATION_POLICY.md`.
- [x] RLS verification checklist defined in `GUIDELINE_RLS_VERIFICATION.md`.
- [x] Legacy mapping defined in `GUIDELINE_LEGACY_MAPPING_REPORT.md`.
- [x] Source implementation for repositories, validation, publication and public query services.
- [x] Idempotent migration created in `supabase/guideline_core_migration.sql`.
- [x] Local build/typecheck/lint/test verification.

## Source files

Created:

- `client/src/services/guidelineCoreTypes.ts`
- `client/src/services/guidelineRepository.ts`
- `client/src/services/guidelineSectionRepository.ts`
- `client/src/services/guidelineRecommendationRepository.ts`
- `client/src/services/guidelineSourceDocumentRepository.ts`
- `client/src/services/guidelineValidation.ts`
- `client/src/services/guidelinePublicationService.ts`
- `client/src/services/guidelinePublicService.ts`
- `client/src/services/guidelineLegacyMigrationService.ts`
- Guideline Core validation, legacy mapping and migration-policy tests.

Updated:

- `client/package.json` with `test:guideline-core`.

## Migration

Created `supabase/guideline_core_migration.sql`.

- Adds Guideline lifecycle/source metadata without removing legacy columns.
- Adds Section hierarchy/status.
- Creates optional `guideline_source_documents`.
- Creates independent `guideline_recommendations` with composite Section FK.
- Adds updated-at triggers, publication validation triggers and RLS.
- Drops old visibility-only document policies so archived shared records are
  not exposed by permissive-policy OR behavior.
- Does not alter Calculator relation FKs/uniqueness and does not create Drug
  tables or relations.
- Has not been run on staging in this Sprint B turn.

## Local verification

- `npm run test:guideline-core`: PASS, 10 tests.
- `npm run test:guideline-publication`: PASS, 2 tests.
- `npm run test:calculators`: PASS, 3 tests.
- `npm run test:calculator-validation`: PASS, 5 tests.
- `npm run test:calculator-integrity`: PASS, 5 tests.
- `npm run test:visibility`: PASS, 2 tests.
- `npm run build` (typecheck + Vite build): PASS.
- `npm run lint`: PASS with 7 pre-existing React warnings outside Sprint B.

## Remaining before Sprint B is complete

- Run the migration on Supabase staging after backup.
- Run structural/RLS/manual verification from `GUIDELINE_RLS_VERIFICATION.md`.
- Verify existing Calculator-Guideline staging behavior after migration.
- Review ambiguous legacy mappings before any data migration.
- Create commit(s) after repository write permission is available.

## Scope guard

Không triển khai Admin structured editor, public Guideline redesign, Drug,
Calculator logic hoặc Calculator relation migration. `guideline_entries`
được giữ làm legacy data cho tới khi mapping được review.

## Risks and gates

- Existing public behavior currently uses `visibility = shared` plus reviewed
  entries. The new status policy requires a controlled backfill and staging
  verification.
- Calculator references still use legacy entry IDs. Migrating those FKs is a
  separate approved step.
- Table rows must not be promoted to Recommendations without human review.

## Completion criteria

Sprint B chỉ hoàn tất khi schema migration có rollback, repository/service
không truy cập Supabase từ React page, validation/publication tests pass, RLS
được xác minh trên staging và Calculator integrity tests vẫn pass.
