# Calculator Content Pack V1

## Scope completed

- BMI is registered under the canonical `bmi` topic. The legacy `body_size` topic remains as a deprecated compatibility path.
- BMI accepts kilograms/pounds and meters/centimeters, normalizes before calculation, uses raw BMI for WHO boundary classification, and exposes the normalized calculation details.
- Renal Function remains a multi-method topic. The verified implementation list contains CKD-EPI creatinine 2021, CKD-EPI cystatin C 2012, CKD-EPI creatinine-cystatin C 2012, MDRD 4-variable IDMS, and Cockcroft-Gault actual body weight.
- eGFR and CrCl keep independent metric, unit and indexing metadata. Cockcroft-Gault is labelled CrCl, never eGFR.
- The previous key `egfr_ckd_epi_2021_creatinine_cystatin_c` was not silently repointed to the 2012 equation. It is now a disabled `source_required` scaffold until the 2021 combined specification is approved.
- Child-Pugh INR and PT-prolongation are registered as separate disabled `source_required` scaffolds. No bilirubin, albumin, INR/PT, ascites or encephalopathy thresholds were invented.
- Admin Calculator Editor now obtains topic and method choices from the typed registry. It persists only identity/configuration metadata; formula code and coefficients remain in source.

## Source status

The implementation reuses the approved source links already present in the project: WHO BMI classification, NIDDK estimating GFR equations, and Cockcroft/Gault 1976. The two blocked scaffolds require a project-approved complete source table before implementation and publication.

## Publication behavior

For topic-backed calculators, publication now requires a registered topic, an enabled default method, and an available/verified implementation. Unverified or draft implementations cannot satisfy this gate.

## Migration

`supabase/calculator_formula_versioning_migration.sql` remains the only additive persistence migration. It is not run by this change. It stores method identity/configuration only and never formula code.

## Manual onboarding

1. In Admin -> Máy tính y khoa, create a draft.
2. Choose `BMI` or `Chức năng thận` from **Calculator topic**.
3. Choose one or more registered **Method được bật**, then select a verified **Method mặc định**. The disabled Child-Pugh INR/PT and CKD-EPI 2021 combined entries must not be published.
4. Supply the normal display metadata, input schema, result definitions, source display references and clinical fixtures required by the existing publication gate.
5. Save, run the existing clinical tests, then publish only after all blockers clear.

## Known limitations

- No complete approved Child-Pugh threshold source is stored in the repository; Child-Pugh production calculation is intentionally blocked.
- No complete approved CKD-EPI 2021 creatinine-cystatin C equation specification is stored in the repository; that method is intentionally blocked.
- Cockcroft-Gault IBW, AdjBW and BSA-normalized variants remain unavailable to publication until an approved project policy is added. They are not silently selected.
