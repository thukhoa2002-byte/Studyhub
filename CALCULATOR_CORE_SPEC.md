# Calculator Core Specification

## Canonical definition

`CalculatorDefinition` is the database/UI compatibility model. Executable clinical methods are owned by the typed source registry, not by React or database JSON. It contains identity and lifecycle metadata, localized title/description/purpose, specialty/category, input definitions, legacy `calculation.handlerId`, optional `topicKey`, `methodKey`, `variantKey`, `implementationVersion`, optional scoring rules, result definitions, references, Guideline references, persistent test cases, and audit timestamps.

The database persists the configured definition in `calculators`. JSON fields are normalized by `databaseCalculatorToDefinition()`; React never interprets database JSON directly.

## Supported calculation modes

- **Equation:** a legacy registered handler such as `bmi` or `cockcroft-gault`, or a source-owned versioned method such as `egfr_ckd_epi_2021_creatinine`.
- **Score / criteria / algorithm:** declarative `scoringRules`, with result thresholds in `resultDefinitions`.
- A missing handler is valid only when scoring rules exist. A missing handler and rules is non-publishable.

## Inputs and units

Every input includes its ID, label, type, required state, optional categorical options, min/max/step and clinical message. Numeric inputs may additionally define:

- `displayUnit`
- `canonicalUnit`
- `allowedUnits`
- `unitKey`

The UI stores the selected display unit under `unitKey` or `<input-id>__unit`. `canonicalizeInputs()` converts values before a handler or scoring rule runs. The current shared conversion families are creatinine (`mg/dL`, `mg/L`, `umol/L`), mass (`kg`, `g`) and length (`cm`, `m`). Unsupported conversions are rejected.

## Runtime result

Every execution returns `rawValue`, formatted `displayValue`, optional `unit`, optional `score`, category/interpretation key, warnings, and validation errors. Invalid input returns `rawValue: null` with explicit errors. It never produces NaN or Infinity.

## Versioned clinical methods

The source-owned runtime follows:

`Calculator topic -> Method -> optional Variant -> Implementation Version -> Calculation model`.

- Registry: `client/src/modules/calculators/methodRegistry.ts`.
- Built-in methods: `client/src/modules/calculators/platformRegistry.ts`.
- Clinical equations, score inputs and reference metadata: `client/src/modules/calculators/referenceToolRuntime.ts`.
- The database never stores executable JavaScript, `eval` expressions, or arbitrary formula code.
- A published implementation is immutable by identity. Scientific changes require a new `methodKey`; implementation-only corrections use a new semantic `implementationVersion`.
- Deprecated methods remain resolvable for historical result snapshots; retired methods cannot be selected for a new calculation.

The initial published registry includes CKD-EPI 2021 creatinine, CKD-EPI 2012 cystatin C, CKD-EPI 2012 creatinine-cystatin C, MDRD 4-variable IDMS, Cockcroft-Gault variants (actual, ideal, adjusted and BSA-normalized body weight), and adult BMI. Each method has source metadata, an explicit lifecycle, validation, normalized inputs, formula year/version and reproducible result metadata.

`supabase/calculator_formula_versioning_migration.sql` is additive only and has not been run. It adds topic/method display metadata to `calculators`; it does not change handlers, formulas, RLS, Guideline relations or historical records.

## Guideline relation contract

Application lookup targets `guideline_documents`, `guideline_sections`, and `guideline_recommendations`. A relation can target a Guideline alone, a Section, or a Recommendation. Public eligibility requires a published Calculator, Guideline, and when present a published Section plus published/verified Recommendation.

The foundation database FK is legacy. Apply `calculator_guideline_core_reference_migration.sql` before creating Core Recommendation relations in staging. It uses RESTRICT for Guideline, Section and Recommendation deletion and retains CASCADE only from Calculator deletion to its references.
