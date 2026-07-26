# Guideline Recommendation Table Admin Rework

## Current pseudo-section usage

The prior Admin editor used `guideline_sections` as both source hierarchy and the primary editing screen. The intended canonical table container is `guideline_recommendation_tables`, defined by the earlier single-admin migration, but it is not assumed to exist in every environment until that migration has been applied. Recommendation groups had no canonical core entity.

## Classification and compatibility

- `source_section`: existing `guideline_sections`; retained unchanged as canonical ownership metadata.
- `recommendation_table`: existing `guideline_recommendation_tables`; now the primary Admin tab and card.
- `recommendation_group`: new, explicit entity proposed in `supabase/guideline_recommendation_groups_migration.sql`; not executed.
- `invalid_or_unresolved`: a recommendation without `recommendation_table_id` or an unresolvable group remains displayed as a clearly labelled virtual ungrouped item. It is not silently converted.

Stable source-section, table, recommendation and relation IDs are preserved. Existing Recommendation ↔ Drug and Recommendation ↔ Calculator links still target the unchanged recommendation UUID.

## Admin behavior

- The primary tab is **Bảng khuyến cáo** and its count is table count.
- **Mục nguồn** is a separate secondary structure tab.
- One expandable card represents one Recommendation Table, ordered by `source_order`, source page and display order.
- Each card shows owner source section, source pages, title pair, completeness, publication status and nested groups/rows.
- New tables can be created with explicit source metadata. New groups are only created through the proposed group entity. New rows are assigned to the selected table and group.
- Table bulk publication is table-scoped, idempotent for published rows, and blocks an incomplete table before changing status.

## Migration and rollback

`supabase/guideline_recommendation_groups_migration.sql` is additive and has not been run. Required order is: `guideline_single_admin_publication_migration.sql`, then `guideline_recommendation_table_order_migration.sql`, then `guideline_recommendation_groups_migration.sql`. It creates groups, adds nullable `recommendation_group_id`, and enforces `(recommendation_group_id, recommendation_table_id)` ownership with `ON DELETE RESTRICT`.

Until the first prerequisite exists, the new Admin tab shows a migration-required message and does not fall back to legacy `guideline_entries` or pseudo-Sections.

Rollback is documented at the bottom of that migration and must only be used if no group rows or recommendation-group links are needed. No legacy section or recommendation is renamed, deleted, or rewritten.

## Verification

The new local test checks tab terminology/count, hierarchy ownership, group-table integrity and table-scoped bulk behavior. No SQL, deployment or merge was run for this change.
