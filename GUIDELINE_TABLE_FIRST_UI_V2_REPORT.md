# Guideline Table-First UI V2

## Scope

The public Guideline detail now reads a table-first presentation adapter. It does not alter Guideline Core, recommendation identities, knowledge relations, RLS, routing contracts, or Admin editing workflows.

## Public Renderer Replaced

`client/src/components/GuidelineDataPage.tsx` previously rendered every published source section as a card and nested detached recommendation cards under it. The detail route now loads the public table-first model and renders only complete, published Recommendation Tables with verified, published rows.

## New Components

- `GuidelineTableFirstView`: page-level Table-First composition and resource navigation.
- `RecommendationTableRenderer`: one complete clinical table surface.
- `RecommendationTableHeader`: table title, source section and source-page context.
- `RecommendationGroupBlock`: compact group heading within the owning table.
- `RecommendationRow`: semantic desktop row with Recommendation, Class and LoE columns.
- `RecommendationClassBadge` and `EvidenceLevelBadge`: shared semantic badge components.
- `StructuredTableRenderer`: isolated renderer ready for published clinically important structured tables once a canonical public source exists.

## Adapter and Eligibility

`client/src/services/guidelineTableFirstPublicAdapter.ts` builds the read-only hierarchy:

`Guideline -> Recommendation Table -> Recommendation Group -> Recommendation Row`.

It requires explicit `recommendation_table_id` and `recommendation_group_id`; an unmapped row is omitted rather than attached to a guessed section or group. Tables require a published parent guideline, published source section, published complete table, published group, and verified/published rows. Rows are ordered by `sort_order`; groups by `group_order`; tables by source page, source table number and source order.

The public service uses explicit published-table and published-group repository reads. If the additive table/group migrations are not available in an environment, their requests resolve to no table resources rather than falling back to `guideline_entries` or detached section cards.

## Language and Deep Links

Vietnamese mode requires translated row text. English mode requires source text. Bilingual mode uses Vietnamese primary text and the English source beneath it. Missing translation does not silently mix an English table title/body into Vietnamese output.

Existing recommendation URLs remain valid. A deep link resolves the owning source section, scrolls to the visible desktop/mobile row, focuses it and applies the existing temporary highlight. Table blocks expose `recommendation-table-{tableId}` anchors; rows retain `recommendation-{recommendationId}` on desktop and an equivalent mobile target.

## Structured Tables

No canonical public structured-table entity exists in the current Core data model. `structuredTables` is intentionally empty, and incomplete or title-only data is not shown as a finished table. Adding a canonical source later can populate this renderer without changing Recommendation ownership.

## Data-Quality Blockers

- `guideline_recommendation_tables` and `guideline_recommendation_groups` must exist and have complete/published data before a guideline has visible public tables.
- Every public row needs a verified status, published status, explicit table/group ownership and source-language/translated text for the selected language.
- Unmapped legacy sections/entries, title-only tables, incomplete groups and ambiguous ownership remain hidden rather than being inferred.

## Verification

No SQL, deployment or merge was run for this UI refactor. The required local command results are reported in the handover after the full suite runs.
