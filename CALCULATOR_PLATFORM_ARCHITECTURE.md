# Medical Calculator Platform

## Runtime boundary

```text
Calculator topic -> Method -> Variant -> Implementation version -> Calculation model
Database metadata -> CalculatorDefinition adapter -> Compatibility engine -> Typed method registry
```

Formula coefficients, thresholds, validation, normalization, rounding and clinical classifications belong in typed source files. The database stores only display/configuration metadata, lifecycle, source metadata, method identity and linked Recommendations. React renders the schema and calls the service/runtime; it does not contain an executable formula.

## Initial model support

The platform type system recognizes `equation`, `additive_point_score`, `threshold_point_score`, `weighted_risk_model`, `threshold_classification`, `decision_rule`, `staging_system`, `dose_regimen`, `conversion_correction`, `lookup_table`, `time_series`, and `hybrid`.

The first registered source methods use `equation`. The existing declarative score engine continues to serve legacy score, criteria and algorithm records until each has an audited source implementation.

## Identity and lifecycle

- Topic and method keys are stable source-code identities, never derived from a title or array position.
- Variant is required where the scientific or clinical input basis differs, such as Cockcroft-Gault body-weight selection.
- `implementationVersion` follows semantic versioning. A scientific change gets a new `methodKey`; an implementation correction gets a new version.
- Lifecycle: `draft`, `verified`, `published`, `deprecated`, `retired`.
- Draft/unverified methods cannot calculate. Retired methods cannot calculate for new requests. Deprecated methods remain resolvable for historical records.

## Reproducibility

`CalculatorResultSnapshot` retains topic, method, variant, implementation version, formula year, raw and normalized inputs, raw/displayed output, metric, unit, indexing status and timestamp. No historical result is recalculated using a silently replaced implementation.

## Current source-backed methods

| Topic | Method | Variant | Version | Status |
| --- | --- | --- | --- | --- |
| renal_function | egfr_ckd_epi_2021_creatinine | - | 1.0.0 | published |
| renal_function | egfr_ckd_epi_2021_creatinine_cystatin_c | - | 1.0.0 | published |
| renal_function | egfr_ckd_epi_2012_cystatin_c | - | 1.0.0 | published |
| renal_function | egfr_mdrd_4_variable_idms | - | 1.0.0 | published |
| renal_function | crcl_cockcroft_gault | actual/ideal/adjusted/BSA-normalized | 1.0.0 | published |
| body_size | bmi_adult | - | 1.0.0 | published |

Additional score cards shown by the legacy reference interface are not promoted to source-backed Calculator methods until their source, scoring tables, validation and reference cases have been independently verified.

## Database migration order

1. Existing `calculator_foundation_migration.sql` remains prerequisite.
2. Run `calculator_formula_versioning_migration.sql` only after staging backup and preflight; it is additive and not run by this change.
3. Existing Calculator ↔ Guideline and knowledge relation migrations remain separate and unchanged.

No direct Calculator ↔ Drug or Calculator ↔ Guideline relation is introduced by this platform change.
