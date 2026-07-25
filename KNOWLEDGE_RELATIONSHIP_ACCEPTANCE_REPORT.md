# Knowledge Relationship Acceptance Report

Status: LOCAL IMPLEMENTATION COMPLETE - STAGING BLOCKED

This file records local test results, migration preflight, staging migration results and the combined end-to-end acceptance run. No relation migration has been executed by this sprint document.

Current constraints:

- SQL has not run; `drugs` and both relation tables are not assumed to exist in any environment.
- No legacy `guideline_entries.drug_id`, `guidelineLinks`, name matching or localStorage data is mapped.
- Database/RLS/public eligibility remains BLOCKED until the additive migration is applied manually.

## Local acceptance

- Canonical Drug UI paths call `drugDatabaseService` and never write localStorage: PASS.
- Recommendation relation picker calls `knowledgeRelationService`, not relation tables: PASS.
- Drug and Calculator reverse lookup derive Guideline/Section through Recommendations: PASS.
- Duplicate, stale-target and metadata validation contracts: PASS.
- `npm test`: PASS (49 tests).
- `npx tsc -b`: PASS.
- `npm run lint`: PASS with 9 pre-existing warnings outside this scope.
- `npm run build`: PASS.
- `git diff --check`: PASS.

## Remaining acceptance blockers

- Run `supabase/knowledge_relationship_foundation_migration.sql` manually only after database backup and migration review.
- Verify RLS with anonymous, authenticated user and admin sessions.
- Verify database uniqueness, hierarchy checks and reverse lookup on staging.
- Do not enable the blocked legacy Drug import route until it writes canonical rows.
