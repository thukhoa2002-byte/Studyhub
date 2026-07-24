import assert from "node:assert/strict";
import test from "node:test";
import { calculateCalculator, calculatorRegistry, runCalculatorTestCases } from "./engine.ts";
import type { CalculatorDefinition } from "./types.ts";

function scoreDefinition(): CalculatorDefinition {
  return {
    id: "test-score", slug: "test-score", name: "Test score", nameVi: "Điểm kiểm thử", shortName: "TEST", specialty: "Nội", category: "Điểm", description: "", purpose: "", whenToUse: [], whenNotToUse: [], limitations: [],
    inputFields: [{ id: "age", label: "Tuổi", type: "number", required: true, min: 0, max: 120 }],
    calculation: { handlerId: "" },
    scoringRules: [{ id: "age-65", inputId: "age", operator: "greater_or_equal", value: 65, points: 1 }],
    resultDefinitions: [{ key: "low", label: "Thấp", description: "", min: 0, max: 0 }, { key: "high", label: "Cao", description: "", min: 1 }],
    interpretations: [], guidelineReferences: [], flashcardReferences: [], quizReferences: [], relatedCalculatorReferences: [], references: ["Test reference"], testCases: [{ id: "age-65", label: "Điểm tuổi", inputs: { age: 65 }, expected: { rawValue: 1, category: "high", valid: true } }], status: "draft", version: "1.0.0", sourceVerified: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("BMI handler calculates the expected value and category", () => {
  const result = calculatorRegistry.bmi({ weightKg: 70, heightCm: 175 });
  assert.equal(result.displayValue, "22.9");
  assert.equal(result.category, "normal");
  assert.deepEqual(result.warnings, []);
});

test("Cockcroft-Gault applies the female correction factor", () => {
  const result = calculatorRegistry["cockcroft-gault"]({ age: 60, sex: "female", weightKg: 60, creatinineMgDl: 1 });
  assert.equal(result.displayValue, "56.7");
  assert.equal(result.unit, "mL/min");
});

test("CURB-65 scores boolean criteria", () => {
  const result = calculatorRegistry["curb-65"]({ confusion: true, ureaMmolL: false, respiratoryRate: true, lowBloodPressure: false, age65: true });
  assert.equal(result.rawValue, 3);
  assert.equal(result.category, "moderate");
});

test("generic scoring definitions run without a registered handler", () => {
  const result = calculateCalculator(scoreDefinition(), { age: 65 });
  assert.equal(result.rawValue, 1);
  assert.equal(result.score, 1);
  assert.equal(result.category, "high");
});

test("validation prevents invalid values from reaching the runtime", () => {
  const result = calculateCalculator(scoreDefinition(), { age: 130 });
  assert.equal(result.rawValue, null);
  assert.match(result.warnings.join(" "), /không được lớn hơn/);
});

test("configured clinical cases run against the same engine", () => {
  const results = runCalculatorTestCases(scoreDefinition());
  assert.equal(results.length, 1);
  assert.equal(results[0].pass, true);
});
