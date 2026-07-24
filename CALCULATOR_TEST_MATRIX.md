# Calculator Test Matrix

| Area | Coverage | Command | Status |
| --- | --- | --- | --- |
| BMI | normal category; invalid missing height | `npm run test:calculators` | PASS local |
| Cockcroft-Gault | female correction; invalid creatinine | `npm run test:calculators` | PASS local |
| CURB-65 | low, threshold and high categories | `npm run test:calculators` | PASS local |
| Declarative score | rule trigger and threshold | `npm run test:calculators` | PASS local |
| Unit conversion | creatinine conversion; mass conversion; invalid unit rejection | `npm run test:calculator-units` | PASS local |
| Publication blockers | source verification, handler, input/result/reference requirements | `npm run test:calculator-validation` | PASS local |
| Calculator-Guideline integrity | duplicate identity, owner matching, stale targets, Core hardening SQL | `npm run test:calculator-integrity` | PASS local |
| Public visibility | preview/detail protection and published filtering | `npm run test:visibility` | NOT RUN in this sprint |
| Browser E2E | admin save -> preview -> tests -> publish -> authenticated detail | staging manual test | BLOCKED pending deploy + Core FK migration |

## Required manual staging cases

1. Create a draft calculator with `STAGING_TEST_` prefix and save it without sources. Confirm publish is blocked.
2. Add inputs, result definitions, authoritative reference, source verification, and clinical JSON cases. Run the test runner; confirm all pass.
3. Preview the calculator and compare output with the public page after publication.
4. Change a creatinine value from `mg/dL` to `umol/L`; confirm equivalent output.
5. Create a Guideline/Section/Recommendation relation after Core FK hardening. Confirm duplicate and wrong-parent records are rejected.
6. As guest, inspect the calculator list response: preview only. Direct detail must not return formula JSON.
7. As authenticated user, verify published content; draft, in-review and archived records remain unavailable.
