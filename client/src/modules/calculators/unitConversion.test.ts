import assert from "node:assert/strict";
import test from "node:test";
import { calculateCalculator } from "./engine.ts";
import { convertUnit } from "./unitConversion.ts";
import type { CalculatorDefinition } from "./types.ts";

const cockcroftWithUnits: CalculatorDefinition = {
  id: "cg", slug: "cg", name: "Cockcroft-Gault", nameVi: "Cockcroft-Gault", shortName: "CrCl", specialty: "Thận", category: "Tính độ thanh thải", description: "", purpose: "", whenToUse: [], whenNotToUse: [], limitations: [],
  inputFields: [
    { id: "age", label: "Tuổi", type: "number", required: true, min: 18 },
    { id: "sex", label: "Giới", type: "select", required: true, options: [{ value: "female", label: "Nữ" }, { value: "male", label: "Nam" }] },
    { id: "weightKg", label: "Cân nặng", type: "number", required: true, min: 1, canonicalUnit: "kg", displayUnit: "kg", allowedUnits: ["kg", "g"] },
    { id: "creatinineMgDl", label: "Creatinine", type: "number", required: true, min: 0.01, canonicalUnit: "mg/dL", displayUnit: "mg/dL", allowedUnits: ["mg/dL", "mg/L", "umol/L"] },
  ],
  calculation: { handlerId: "cockcroft-gault" }, scoringRules: [], resultDefinitions: [], interpretations: [], guidelineReferences: [], flashcardReferences: [], quizReferences: [], relatedCalculatorReferences: [], references: ["Cockcroft DW, Gault MH. 1976"], testCases: [], status: "draft", version: "1.0.0", sourceVerified: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

test("creatinine unit conversion is reversible", () => {
  assert.equal(convertUnit(88.4, "umol/L", "mg/dL"), 1);
  assert.equal(convertUnit(1, "mg/dL", "mg/L"), 10);
});

test("runtime converts input values into the canonical unit before calculation", () => {
  const result = calculateCalculator(cockcroftWithUnits, {
    age: 60,
    sex: "female",
    weightKg: 60000,
    weightKg__unit: "g",
    creatinineMgDl: 88.4,
    creatinineMgDl__unit: "umol/L",
  });
  assert.equal(result.rawValue?.toFixed(1), "56.7");
});

test("runtime rejects a unit outside the configured unit set", () => {
  const result = calculateCalculator(cockcroftWithUnits, { age: 60, sex: "female", weightKg: 60, creatinineMgDl: 1, creatinineMgDl__unit: "mmol/L" });
  assert.equal(result.rawValue, null);
  assert.match(result.warnings.join(" "), /đơn vị/i);
});
