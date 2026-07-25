# Knowledge Relationship Test Matrix

| Area | Required evidence |
| --- | --- |
| Drug relation | Create, update, delete, duplicate rejection, stale target rejection, public eligibility. Local contract test PASS; staging database/RLS test pending migration. |
| Calculator relation | Create, update, delete, duplicate rejection, stale target rejection, public eligibility. Local contract test PASS; staging database/RLS test pending migration. |
| Hierarchy | Recommendation parent Guideline/Section is derived and cannot be mismatched. |
| Access | Guest preview only; authenticated published reads; admin CRUD; normal user denied writes. |
| Regression | Guideline publication, Calculator runtime, Drug CRUD, visibility and routes. `npm test` (49 PASS), typecheck PASS, lint PASS with pre-existing warnings, build PASS. |
| Staging | One published Guideline/Section/Recommendation/Drug/Calculator, both links, guest/auth/admin network evidence. |
