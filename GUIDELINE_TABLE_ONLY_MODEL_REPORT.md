# Guideline Table-Only Model Report

## Scope

The primary Guideline workflow is now table-only:

```text
Guideline
  -> Recommendation Table
    -> Recommendation Group
      -> Recommendation Row
  -> Clinical Table
```

`guideline_sections` is retained only for optional source provenance. It is not
a publication, translation, navigation, or public-rendering gate.

## Section Dependencies Found

- The import pipeline still stores source sections where the PDF exposes a
  stable source heading. They are provenance only.
- Recommendation Tables and Groups may retain `section_id` for tracing a
  source page. Both are nullable in the proposed migration.
- Recommendation records may retain `section_id` as provenance. It is made
  nullable by the proposed migration.
- The previous source-section editor implementation remains in the codebase as
  compatibility code, but it is not exposed in the primary Admin tabs or
  routes.
- Public table-first mapping only uses a source section to enrich optional
  source metadata. A missing or unpublished source section never hides a
  valid published table.

## Primary Workflow Changes

- Admin tabs: `Thông tin chung`, `Bảng khuyến cáo`, `Bảng lâm sàng`, `Nguồn`.
- The primary Admin resource is `Bảng khuyến cáo`; the tab count is table
  count, not source-section count.
- Recommendation Tables support optional source-section provenance only.
- Clinical Tables are an independent resource and never create formal
  Recommendations from their rows.
- Bulk publication for a source section is disabled. Publication is scoped to
  the Guideline, a Recommendation Table, or an individual Recommendation.
- The import pipeline translates and creates Recommendation Tables and selected
  Clinical Tables; source prose is not queued as a primary translation unit.
- The public reader renders only published complete Recommendation Tables and
  published complete Clinical Tables. Generic source-section cards are absent.
- Public catalog reads the preview DTO even for signed-in users. Detailed table
  data is loaded only for an authenticated detail view.

## Provenance, Ordering And Deep Links

- Table/group/row order is derived from source order, page order, group order,
  and row order, never database creation time.
- Source Section number/title and page range remain optional read-only source
  metadata for Admin diagnostics.
- Recommendation IDs remain canonical. Existing Drug and Calculator reverse
  links retain recommendation deep-link resolution through the owning table.
- Calculator Guideline labels now resolve through the table-first public reader.

## Proposed Migration

`supabase/guideline_table_only_model_migration.sql` is additive and has **not
been executed**. It:

- makes source-section ownership nullable for tables, groups and
  recommendations;
- replaces Section-containing table/group ownership constraints with
  Guideline-and-table ownership constraints using `ON DELETE RESTRICT`;
- creates `guideline_clinical_tables` with source ordering, original and
  Vietnamese structured table content, completeness and lifecycle fields;
- applies table-first public RLS rules;
- keeps all legacy sections, records, UUIDs, source metadata, recommendations
  and knowledge relations intact.

Preflight before any future execution must verify that the prior
Recommendation Table and Group migrations exist and that no orphaned
table/group/recommendation ownership records exist. The migration is wrapped
in one transaction. If it fails, PostgreSQL rolls back the partial changes.

## Legacy Compatibility

No legacy pseudo-Section has been silently converted. Existing source
sections can be classified later as source provenance, recommendation-table
provenance, recommendation-group provenance, or unresolved. Ambiguous records
remain review-required. Manual translations and stable Recommendation IDs are
not rewritten.

## Verification

Run locally on 2026-07-26:

- `client npm test`: PASS (all suites)
- `server guideline import and extraction recovery tests`: PASS (30 tests)
- `client npx tsc -b`: PASS
- `client npm run lint`: PASS with pre-existing out-of-scope warnings
- `client npm run build`: PASS
- `git diff --check`: PASS

## Explicit Non-Actions

- No SQL was run.
- No staging or production deployment was performed.
- No merge was performed.
- No Guideline Core, Drug, Calculator, RLS, authentication, AppShell, or
  knowledge-relation schema was redesigned.
