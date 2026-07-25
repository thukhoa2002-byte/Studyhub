# Lifecycle And Destructive Actions Report

## Scope

Applies the lifecycle contract to Drug, Calculator, Guideline, Guideline Section, and Guideline Recommendation. No Drug/Calculator formula or Guideline Core schema was redesigned.

## Before And After

| Entity | Before | After |
| --- | --- | --- |
| Drug | Archive existed; restore/delete behavior was incomplete. | Archived records can return to draft, republish through validation, or be permanently deleted only when no Recommendation relation remains. |
| Calculator | Draft deletion and archive existed; archived recovery was incomplete. | Archived records can restore to draft or republish; hard delete checks Guideline and Recommendation relations. |
| Guideline | Archived was treated as terminal in UI. | Archived Guideline can restore, republish through publication policy, or be deleted only with an empty dependency graph. |
| Section | Draft-only delete UI. | Archived Sections can restore or republish; deletion is blocked by children, Recommendations, legacy entries, and Calculator references. |
| Recommendation | Draft-only delete UI. | Archived Recommendations can restore or republish; deletion is blocked by Drug, Calculator, and Calculator-Guideline references. |

Intermediate `in_review` and `reviewed` states remain supported where they already exist. They do not bypass the main draft/published/archived rule.

Archive is only available from `published`; draft, in-review, and reviewed records must return to draft or publish before archival.

## Delete Blockers

- Drug: active or archived `recommendation_drug_references`.
- Calculator: `calculator_guideline_references` and `recommendation_calculator_references`.
- Guideline: Sections, Recommendations, source documents, legacy `guideline_entries`, and Calculator-Guideline references.
- Section: child Sections, Recommendations, legacy entries, and Calculator-Guideline references.
- Recommendation: Recommendation-Drug, Recommendation-Calculator, and Calculator-Guideline references.

The service returns the exact counts. The UI requires `DELETE` before permanent removal. Published records must be archived first. No handler silently deletes a relation.

## Migration

`supabase/knowledge_relationship_foundation_migration.sql` now creates target foreign keys using `ON DELETE RESTRICT` for fresh installations.

`supabase/lifecycle_destructive_actions_migration.sql` is additive for databases that already ran the earlier foundation migrations. It:

- adds database lifecycle transition triggers;
- permits `archived -> draft` and `archived -> published` while application services still enforce publication validation;
- replaces target relation foreign keys with `ON DELETE RESTRICT`;
- permits admin deletion of `draft` or `archived` Guideline/Section/Recommendation/Calculator records only.

The migration is transactional and has not been run. It neither deletes data nor removes relations. The rollback is object-level: remove its triggers/function and restore the prior delete policies/FK behavior only if that old behavior is deliberately required.

## UI Actions

- Draft: Publish, Delete.
- Published: Archive.
- Archived: Restore to Draft, Republish, Delete Permanently.

Republish calls the existing publish service, so validation failures retain the archived status and display the underlying blockers.

## Manual Verification Checklist

1. Create a draft Drug, Calculator, Guideline, Section, and Recommendation.
2. Publish each only when its publication blockers are satisfied.
3. Archive each published record; verify it disappears from public list/detail/relation reads.
4. Confirm linked relations still appear in admin but do not disappear from the database.
5. Restore to draft; verify it remains private.
6. Republish; verify public visibility returns only after all validation passes.
7. Attempt permanent delete with a linked relation or child Section; expect a precise blocker error.
8. Remove/archive the blocking relationship through its own workflow, then retry deletion.
9. Confirm a published record cannot be permanently deleted before archive.

## Status

- SQL: not run.
- Deployment: not performed.
- Commit/push: not performed.
