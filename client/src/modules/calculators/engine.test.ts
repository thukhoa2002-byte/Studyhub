import assert from "node:assert/strict";
import test from "node:test";
import { calculatorRegistry } from "./engine.ts";

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
