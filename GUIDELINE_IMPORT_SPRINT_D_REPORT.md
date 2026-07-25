# Guideline Import Sprint D Report

## Implemented

- Added a separate staging schema for resumable Guideline import jobs, source documents, detected sections, recommendations, issues, terminology and events.
- Added private Storage bucket and admin-only RLS policies.
- Added server import endpoints with PDF/DOCX/OCR/text extraction, all-item detection, AI structure/translation, duplicate checks, review patching, resume and draft-only Core import.
- Added `/admin/guidelines/import` with upload, target selection, item selection, background progress, bilingual review, quality checks and bulk import.
- Added architecture, database, pipeline, UI and test plan documentation.

## Deliberate boundaries

- No Guideline Core migration is rerun or rewritten.
- No public reader, Calculator or Drug logic is changed.
- No legacy `guideline_entries` row is converted automatically.
- No content is published by the import pipeline.

## Verification

`supabase/guideline_import_migration.sql` must be run manually after reviewing the existing staging database. The current worktree includes the migration but does not execute database changes automatically.

Latest local verification:

| Check | Result |
| --- | --- |
| Server syntax check | PASS |
| `server/tests/guidelineImport.test.js` | PASS: 4 tests |
| `server/tests/drugImport.test.js` | PASS: 9 tests |
| Guideline Core tests | PASS: 17 tests |
| Guideline public tests | PASS: 3 tests |
| Guideline publication tests | PASS: 2 tests |
| Calculator engine tests | PASS: 3 tests |
| Calculator validation tests | PASS: 5 tests |
| Calculator-Guideline integrity tests | PASS: 5 tests |
| Visibility tests | PASS: 2 tests |
| Calculator reset test | PASS: 1 test |
| Client build/typecheck | PASS |
| Client lint | PASS with existing warnings outside Sprint D |
| `git diff --check` | PASS |

No Supabase migration or production operation was executed by this change.

## Known limitations

- Long-running processing currently runs as an asynchronous Express task backed by persistent job state; a durable worker/queue is recommended before heavy concurrent imports.
- OCR uses the existing Tesseract fallback and should be manually checked for non-English scanned pages.
- Page image previews/highlight rendering and an editable shared terminology dictionary are prepared in the data model but not a separate UI surface yet.
- `page_metadata` is retained for future per-page previews; the current extraction adapter stores page markers and AI coordinates but does not render page images in the review screen.
- The current background task runs inside the Express process. Persistent job state makes resume safe and recommendation upserts idempotent, but a durable queue/worker is still recommended for concurrent 300+ page imports.
