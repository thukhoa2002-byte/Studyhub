# Calculator Runtime Audit

Date: 2026-07-24

## Active routes

| Route | UI | Data path | Runtime |
| --- | --- | --- | --- |
| `/may-tinh-y-khoa` | `CalculatorPublicPage` list | `calculatorDatabaseService` -> `CalculatorRepository.listPublicPreviews()` -> preview RPC | no calculation |
| `/may-tinh-y-khoa/:slug` | `CalculatorPublicPage` detail | `calculatorDatabaseService` -> repository -> `calculators` and published relation query | `calculateCalculator()` |
| `/admin/may-tinh-y-khoa` | `AdminCalculatorPage` list | `calculatorDatabaseService` -> `CalculatorRepository.list()` | no calculation |
| `/admin/may-tinh-y-khoa/new` | `AdminCalculatorPage` editor | `calculatorDatabaseService` -> repository | preview and test runner use `calculateCalculator()` |
| `/admin/may-tinh-y-khoa/:id/edit` | `AdminCalculatorPage` editor | `calculatorDatabaseService` -> repository | preview and test runner use `calculateCalculator()` |
| `/admin/may-tinh-y-khoa/import` | `AdminCalculatorImportPage` | `calculatorDatabaseService` -> repository | imported configuration is validated by the same domain service |

## Runtime and dependencies

- Compatibility engine: `client/src/modules/calculators/engine.ts`. It continues to run existing handlers and declarative scoring rules, then delegates versioned `methodKey` entries to the typed platform registry.
- Versioned method registry: `client/src/modules/calculators/methodRegistry.ts` with built-ins registered by `client/src/modules/calculators/platformRegistry.ts`.
- Formula/reference source module: `client/src/modules/calculators/referenceToolRuntime.ts`; `ReferenceToolsPage` renders metadata and results from this module rather than implementing renal equations inline.
- Unit conversion: `client/src/modules/calculators/unitConversion.ts`.
- Database adapter: `client/src/services/calculatorDatabaseAdapter.ts` converts database JSON into a `CalculatorDefinition`.
- UI pages call `calculatorDatabaseService`, not Supabase or `calculatorService` directly.
- `client/src/services/calculatorService.ts` remains only as legacy code for reset-policy tests; no active Calculator page imports it.
- No active Calculator React component contains an executable renal equation. Formula metadata and calculations are source-owned.
- Admin preview, the public detail page, and automated clinical cases all execute `calculateCalculator()`.

## Publication and access behavior

- Draft creation and edits use the database service.
- `validateCalculatorPublish()` blocks publication without inputs, result definitions, references, a handler/scoring rule, source verification, and at least one passing clinical test case.
- Public catalog uses the safe preview DTO/RPC. Calculator details are gated by `ProtectedContentGate` until Google authentication is present.
- Public detail repository queries require `status = published`; database RLS remains the enforcement layer on staging.

## Remaining legacy/database dependency

`calculator_guideline_references` in the already-run foundation migration still has its recommendation foreign keys pointing to `guideline_entries`. The application now reads Core `guideline_recommendations`. The new `supabase/calculator_guideline_core_reference_migration.sql` replaces only those two foreign keys after a preflight check. It aborts if existing legacy relations cannot be explicitly mapped; it does not copy or infer clinical content.

## Test coverage

- Legacy formula handlers: BMI, Cockcroft-Gault, CURB-65.
- Versioned platform registry: CKD-EPI source/method resolution, Cockcroft-Gault variants, BMI, immutable result snapshots, and compatibility-engine delegation.
- Generic score runtime and threshold classification.
- Missing/invalid value validation.
- Unit conversion and unsupported-unit rejection.
- Publication blocker validation.
- Guideline relation target validation, duplicate identity, and stale-reference checks.

Staging acceptance is not yet complete. See `CALCULATOR_ACCEPTANCE_REPORT.md`.
