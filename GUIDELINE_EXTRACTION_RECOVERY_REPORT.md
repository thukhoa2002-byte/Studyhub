# Guideline Extraction Recovery Report

## Status

The recovery changes are local only. No SQL migration, deployment, merge, or publication action was performed.

## Root Cause

The prior importer grouped PDF text by raw extraction order and used title-based fallback when resolving a recommendation's Section. In an ESC two-column document, that can bind a heading from the right column or a neighbouring page region to a table from the left column. Temporary AI keys such as `1001` were then persisted as if they were source structure.

## Recovery Pipeline

1. PDF pages are reconstructed by page coordinates: full-width blocks, left column top-to-bottom, then right column top-to-bottom. Header/footer bands are excluded.
2. Source section numbers are derived from numbered source headings and become canonical import keys. Temporary keys are blocking diagnostics, not display labels.
3. Recommendation-table output must carry a table number, owning `sectionSourceKey`, full rows, Class/LoE, references, footnotes, and page range.
4. Recommendations carry both `sectionSourceKey` and `tableSourceKey`; missing ownership is retained as `missing_section` or `incomplete_table`, never attached to the nearest title.
5. Structural checks run before Core import. Missing source pages, duplicate rows, mixed-language Vietnamese fields, unresolved sections, incomplete tables, and inventory mismatches keep the job paused in `structural_repair_required`.
6. Text is normalized with NFC, soft-hyphen/ligature cleanup, non-breaking-space cleanup, control-character removal, controlled line rejoining, and whitespace normalization before persistence.
7. Recommendation Tables retain a canonical source position: `sourceTableNumber`, `sourcePageStart`, `sourcePageEnd`, and `sourceOrder`. Rows retain `groupOrder` and `rowOrder`. The translation queue may finish in another order, but it cannot alter these source positions.

## Safe Repair Strategy

- Keep the current import batch unchanged for audit.
- Start a repair job with `repair_of_job_id` after the additive recovery migration is applied.
- Compare canonical Section/Table/Recommendation identities by source number, table key, source page and source hash.
- Preserve a manually edited Vietnamese translation only when canonical source identity is proven; otherwise leave it for manual review.
- Do not activate a repaired batch until an admin confirms the comparison and all structural diagnostics are cleared.

## Additive Migration

`supabase/guideline_extraction_recovery_migration.sql` adds only storage for repair lineage, structured Recommendation Tables, source page ranges/coordinates, source-vs-translation fields, and structural state. It does not delete, transform, or overwrite any existing rows.

`supabase/guideline_recommendation_table_order_migration.sql` is a second additive migration prepared for the Core layer. It records canonical table source order and links a Core Recommendation to its owning Recommendation Table with a composite ownership foreign key. It does not rewrite existing published order because that requires source review.

Run only after a database backup and only after reviewing the migration in a staging SQL editor. The current application remains compatible before that migration because table data is retained in the private import job metadata; the new table is the durable canonical target for repaired batches.

## Diagnostics

The importer emits grouped blocking diagnostics for:

- `wrong_section_suspected` (manual/source review required)
- `missing_section`
- `incomplete_table`
- `table_continuation_missing`
- `duplicate_recommendation`
- `mixed_language`
- `missing_source_page`
- `temporary_section_identity`
- `unicode_normalization_required`
- `inventory_mismatch`
- `missing_recommendation_table`

Only source-backed ownership is accepted. No diagnostic is resolved by semantic similarity alone.

## Typography

The active UI stack now loads Inter and Noto Sans across weights 400, 500, 600, 700 and 800, with system fallbacks. Poppins heading weights are explicitly loaded to avoid synthetic bold and preserve Vietnamese diacritics.

## Manual Acceptance Required

For the current PDF batch, an admin must verify in the import review screen:

1. Every recommendation table has the correct numbered source Section.
2. Every row appears exactly once with source page, Class and LoE retained.
3. No unresolved temporary Section identity remains.
4. Table/figure inventory counts reconcile with the source document.
5. Vietnamese title/body fields are complete before Core import.
6. Recommendation Tables, groups, and rows remain in the original source order, including an incomplete table's reserved position. A missing number in a numbered sequence is a blocking inventory issue.

The batch must remain unpublished until those checks pass.
