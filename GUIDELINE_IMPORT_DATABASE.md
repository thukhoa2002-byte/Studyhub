# Guideline Import Database

Migration: `supabase/guideline_import_migration.sql`

Run after `supabase/guideline_core_migration.sql`. The migration is additive and does not delete or rewrite Core/legacy rows. It has not been run automatically by the application.

## Tables

| Table | Purpose |
| --- | --- |
| `guideline_import_jobs` | Job state, target Guideline, language, progress, resume checkpoint and import result |
| `guideline_import_documents` | Private source file, checksum, extracted text, page/OCR metadata |
| `guideline_import_sections` | Detected hierarchy and review state before Core import |
| `guideline_import_recommendations` | Detected original/translated recommendations, evidence, confidence, coordinates and duplicate state |
| `guideline_import_issues` | Blocking/warning quality checks and resolution state |
| `guideline_import_terminology` | Per-job term translations and admin locks |
| `guideline_import_events` | Audit/history for upload, processing, resume and bulk import |

All staging records use UUIDs. `owner_id` is the existing project convention. Core foreign keys are restrictive where importing can reference an existing Guideline. Staging child records are deleted with their own abandoned job; importing never cascades into Core.

## RLS

All seven staging tables have RLS enabled. Only the existing Guideline admin can access a job owned by their own user ID. Anonymous and regular users have no staging policies. Storage is private and restricted to the admin's user-ID folder.

## Import safety

- A job may target an existing Guideline or create a new Core Guideline.
- Accepted records are inserted as Core draft/unverified records.
- Blocking issues, missing content and exact/possible duplicates stop bulk import.
- Existing Core records are not overwritten.
- Source provenance is retained in the new Core document citation/provenance and optional source-document metadata.

## Verification

After applying the migration, verify that all table names exist, all tables have RLS enabled, no `anon` policy exists on staging tables, and the private Storage bucket is not public.
