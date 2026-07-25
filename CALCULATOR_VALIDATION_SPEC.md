# Calculator Validation Specification

## Input validation

Before calculation, the engine checks:

1. Required inputs.
2. Numeric type and finite value.
3. Allowed categorical values.
4. Unit selection and conversion compatibility.
5. Canonical min/max range.
6. Handler-specific conditions, such as positive creatinine for Cockcroft-Gault.

Validation returns Vietnamese field messages and calculation stops immediately. No value is silently coerced into a clinical result.

## Publication blockers

`validateCalculatorPublish()` requires:

- valid slug and Vietnamese or English name;
- at least one complete input definition;
- a registered handler or nonempty scoring rules;
- at least one result definition;
- at least one authoritative reference;
- `source_verified = true`;
- at least one clinical test case; and
- all configured clinical test cases passing the canonical runtime.

The editor keeps publish separate from save. Error messages are shown in the existing alert surface.

## Clinical test case shape

```json
{
  "id": "normal-case",
  "label": "Trường hợp bình thường",
  "inputs": { "weightKg": 70, "heightCm": 175 },
  "expected": { "rawValue": 22.8571, "category": "normal", "valid": true },
  "reference": "WHO BMI classification"
}
```

For values with selectable units, include the unit key, for example `"creatinineMgDl__unit": "umol/L"`.

## Guideline relation validation

The service validates relation type, target ownership, duplicate identity including nullable Section/Recommendation values, and stale references. It does not accept a Recommendation belonging to another Guideline or Section.
