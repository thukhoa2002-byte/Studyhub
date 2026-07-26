# Calculator Platform Test Matrix

| Area | Automated evidence | Status |
| --- | --- | --- |
| Legacy handler compatibility | `engine.test.ts` | PASS locally |
| CKD-EPI method lookup/version | `platformRegistry.test.ts` | PASS locally |
| CrCl variant isolation/indexing | `platformRegistry.test.ts` | PASS locally |
| Result reproducibility snapshot | `platformRegistry.test.ts` | PASS locally |
| Automatic execution snapshot | `platformRegistry.test.ts` | PASS locally |
| Semantic implementation-version ordering | `platformRegistry.test.ts` | PASS locally |
| Compatibility engine delegation | `platformRegistry.test.ts` | PASS locally |
| Content Pack BMI unit/threshold behavior | `contentPackV1.test.ts` | PASS locally |
| Renal unit conversion and metric separation | `contentPackV1.test.ts` | PASS locally |
| Unverified Child-Pugh / 2021 combined scaffold blocked | `contentPackV1.test.ts` | PASS locally |
| Unit conversion | `unitConversion.test.ts` | PASS locally |
| Publication/lifecycle validation | `calculatorValidation.test.ts` | PASS locally |
| Database metadata migration | staging preflight/migration | NOT RUN |

Manual staging checks after the additive migration:

1. Create a draft Calculator with `calculator_topic_key=renal_function` and `default_method_key=egfr_ckd_epi_2021_creatinine`.
2. Confirm the database stores metadata only, never JavaScript or formula expressions.
3. Confirm the public page invokes the versioned method through the existing service/engine path.
4. Change method and confirm raw input values remain visible and no implicit unit conversion occurs.
5. Verify a saved-result consumer can resolve its exact method/version after a newer version is registered.
