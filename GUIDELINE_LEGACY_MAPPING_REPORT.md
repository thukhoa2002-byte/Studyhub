# Guideline Legacy Mapping Report

## Source table

`guideline_entries` currently mixes structured recommendation-like content
with table data and ingestion artifacts. It remains readable/writable by the
legacy compatibility path until migration is proven safe.

## Classification proposal

| Legacy shape | Destination | Rule |
|---|---|---|
| Narrative recommendation | `guideline_recommendations` | Create candidate preserving UUID/provenance; human review required |
| `table_row_role = header` | Future table model or source content | Never create Recommendation automatically |
| `table_row_role = section` | `guideline_sections` candidate | Map only after hierarchy review |
| `table_row_role = body` with table cells | Future structured table model | Preserve cells; do not flatten into Recommendation |
| Notes/footnotes | source content/provenance | Manual classification if clinical action is ambiguous |
| Translated text in provenance | Recommendation localized fields | Preserve original and translated values; review required |
| Unclassified/empty | manual review queue | No clinical inference |

## Legacy drug references

Inventory only; no migration in Sprint B:

- `guideline_entries.drug_id` from the legacy migration;
- `guideline_entries.drug_name` as display text;
- `drugReferences` in the client Guideline model;
- `resolveDrugId` and name matching in legacy `guidelineService`;
- import candidate `guidelineReferences`/`drugReferences` fields.

These are not copied into `guideline_recommendations` and are not converted
to a relation. Future Drug migration requires an official `drugs` entity,
UUID strategy, public policy, provenance review and a separate approved
migration.

## Executable migration approach

1. Read legacy rows in batches.
2. Classify each row deterministically by table role/type and content shape.
3. Insert only unambiguous narrative candidates into a staging/mapping result
   with the original UUID in provenance; do not publish.
4. Mark ambiguous rows for manual review.
5. Preserve all source/page/table metadata.
6. Verify counts and UUID mapping in a transaction.
7. Archive/deprecate legacy usage only after all consumers are migrated.

No destructive deletion and no automatic clinical interpretation are allowed.
