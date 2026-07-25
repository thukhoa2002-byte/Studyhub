# Calculator Acceptance Report

Date: 2026-07-24

## Local implementation

| Check | Status | Evidence |
| --- | --- | --- |
| Active pages avoid legacy `calculatorService` | PASS | `AdminCalculatorPage`, `AdminCalculatorImportPage`, and `CalculatorPublicPage` use database service/repository paths only. |
| Direct Supabase calls in Calculator React pages | PASS | No runtime Supabase import/call remains in the three active Calculator page components. |
| Shared admin/public calculation engine | PASS | Admin preview, test runner and public detail call `calculateCalculator()`. |
| Inputs, canonical units and validation | PASS | `unitConversion.ts`, engine tests and unit-conversion tests. |
| Publication blockers | PASS | `validateCalculatorPublish()` and validation tests. |
| Calculator -> Guideline Core query model | PASS in source | Repository reads `guideline_recommendations`, sections and documents. |
| Core Recommendation FK in database | BLOCKED | Existing foundation migration FK targets `guideline_entries`; apply the separate preflight migration first. |

## Automated results

- `npm run test:calculators`: PASS, 6 tests.
- `npm run test:calculator-units`: PASS, 3 tests.
- `npm run test:calculator-validation`: PASS, 6 tests.
- `npm run test:calculator-integrity`: PASS, 6 tests.
- `npm run build`: PASS.

Build retains pre-existing Vite warnings about ineffective dynamic imports and a large bundle chunk; neither comes from this Calculator work.

## Staging acceptance

| Check | Status | Reason |
| --- | --- | --- |
| Admin create/edit/preview/test/publish | NOT RUN | Requires deployment of this working tree. |
| Authenticated published calculator use | NOT RUN | Requires deployment. |
| Anonymous preview has no protected formula content | NOT RUN | Requires browser Network evidence after deployment. |
| Draft/in-review/archived hidden | NOT RUN | Requires staging data and browser verification. |
| Calculator ↔ Core Guideline relation create/read | BLOCKED | Requires `supabase/calculator_guideline_core_reference_migration.sql`; it intentionally aborts when legacy relation IDs have no explicit mapping. |

## Required next actions

1. Review and run the Core reference migration on staging only after backing up `calculator_guideline_references`.
2. Deploy the Calculator build to staging.
3. Run the manual matrix in `CALCULATOR_TEST_MATRIX.md` and collect Network responses for guest/authenticated/admin sessions.
4. Do not merge or publish a Calculator until staging cases pass.
