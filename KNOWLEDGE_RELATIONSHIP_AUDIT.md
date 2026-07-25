# Knowledge Relationship Audit

## Current state

| Area | Active state | Finding |
| --- | --- | --- |
| Guideline Core | `guideline_documents` -> `guideline_sections` -> `guideline_recommendations` | UUID-backed and suitable as the canonical clinical knowledge hierarchy. |
| Legacy Guideline | `guideline_entries` | Still stores imported rows and legacy recommendation-like records. It must not be used for new relations. |
| Calculator | `calculators` and `calculator_guideline_references` | Calculator is UUID-backed. The relation table has an existing migration path to Guideline Core, but is not the final Recommendation-centered model. |
| Drug | `drugData.ts`, `thuocService`, `localStorage` | No canonical database entity exists. IDs are generated strings, so no safe foreign key can target the current model. |
| Legacy Drug links | `guideline_entries.drug_id`, `Drug.guidelineLinks` | Both are legacy/local only. Neither is valid for a normalized active relation. |

## Direct Supabase access

Calculator and Guideline Core already use repository/service layers. Drug does not: `thuocService` reads seed data and browser local storage. The Drug runtime must move to a repository/service before it can participate in a database relation.

## Required foundation delta

1. Create UUID-backed `drugs` as the canonical Drug entity.
2. Create `recommendation_drug_references` and `recommendation_calculator_references`.
3. Use `guideline_recommendations` as the only active clinical relation target.
4. Retain `guideline_entries`, `guideline_entries.drug_id`, `Drug.guidelineLinks`, and `calculator_guideline_references` as legacy until explicit, non-ambiguous migration mappings exist.
5. Do not infer a Recommendation from titles, drug names, or table rows.

## Known migration constraint

`calculator_guideline_core_reference_migration.sql` changes the existing legacy Calculator table to reference Guideline Core. It must be reviewed as part of the final staging migration order; this sprint will not create a competing second Calculator legacy migration.
