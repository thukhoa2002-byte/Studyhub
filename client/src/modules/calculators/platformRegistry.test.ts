import assert from "node:assert/strict";
import test from "node:test";
import { CalculatorMethodRegistry, calculatorMethodRegistry } from "./methodRegistry.ts";
import "./platformRegistry.ts";
import { calculateCalculator } from "./engine.ts";
import type { CalculatorDefinition } from "./types.ts";

test("registry resolves versioned CKD-EPI implementations by stable method key", () => {
  const method = calculatorMethodRegistry.get("renal_function", "egfr_ckd_epi_2021_creatinine", undefined, "1.0.0");
  assert.ok(method);
  assert.equal(method?.formulaYear, 2021);
  assert.equal(method?.status, "published");
  assert.equal(method?.source.verified, true);
});

test("CKD-EPI 2021 result stores method and implementation version", () => {
  const result = calculatorMethodRegistry.calculate("renal_function", "egfr_ckd_epi_2021_creatinine", { age: 50, sex: "female", creatinineMgDl: 1 });
  assert.equal(result.methodKey, "egfr_ckd_epi_2021_creatinine");
  assert.equal(result.implementationVersion, "1.0.0");
  assert.equal(result.primary.unit, "mL/min/1,73 m²");
  assert.ok((result.primary.rawValue || 0) > 0);
});

test("Cockcroft-Gault exposes verified actual-body-weight without silently enabling other policies", () => {
  const actual = calculatorMethodRegistry.calculate("renal_function", "crcl_cockcroft_gault", { age: 60, sex: "female", weightKg: 60, creatinineMgDl: 1 }, "actual-body-weight");
  assert.equal(actual.primary.indexingStatus, "absolute_ml_min");
  assert.equal(actual.primary.unit, "mL/min");
  assert.equal(calculatorMethodRegistry.get("renal_function", "crcl_cockcroft_gault", "bsa-normalized")?.source.verified, false);
  assert.throws(() => calculatorMethodRegistry.calculate("renal_function", "crcl_cockcroft_gault", { age: 60, sex: "female", weightKg: 60, heightM: 1.6, creatinineMgDl: 1 }, "bsa-normalized"), /chưa được xác minh nguồn/);
});

test("result snapshots preserve reproducibility metadata", () => {
  const result = calculatorMethodRegistry.calculate("body_size", "bmi_adult", { weightKg: 70, heightM: 1.75 });
  const snapshot = calculatorMethodRegistry.snapshot(result, { weightKg: 70, heightM: 1.75 });
  assert.equal(snapshot.calculatorTopicKey, "body_size");
  assert.equal(snapshot.methodKey, "bmi_adult");
  assert.equal(snapshot.implementationVersion, "1.0.0");
  assert.equal(snapshot.outputUnit, "kg/m²");
});

test("registry returns an immutable normalized snapshot with every execution", () => {
  const execution = calculatorMethodRegistry.calculateWithSnapshot("body_size", "bmi_adult", { weightKg: 70, heightM: 1.75 });
  assert.equal(execution.result.methodKey, "bmi_adult");
  assert.deepEqual(execution.snapshot.normalizedInputSnapshot, { weightKg: 70, heightM: 1.75 });
  assert.notEqual(execution.snapshot.inputSnapshot, execution.snapshot.normalizedInputSnapshot);
});

test("registry resolves semantic versions numerically", () => {
  const registry = new CalculatorMethodRegistry();
  registry.registerTopic({ topicKey: "test", title: "Test", enabledMethodKeys: ["method"] });
  const implementation = (implementationVersion: string) => ({
    topicKey: "test", methodKey: "method", implementationVersion, calculationModelType: "equation" as const,
    formulaName: "Test", status: "published" as const, inputSchema: [], source: { primarySource: "Test", sourceReference: "Test", verified: true, population: "Test", applicability: "Test" }, changelog: [],
    validate: () => ({ valid: true, value: {}, errors: [], warnings: [] }), normalize: () => ({}),
    calculate: () => ({ calculatorTopicKey: "test", methodKey: "method", implementationVersion, calculationModelType: "equation" as const, formulaName: "Test", sourceReference: "Test", primary: { metric: "Test", rawValue: 1, roundedValue: 1, displayValue: "1", unit: "", indexingStatus: "not_applicable" as const }, warnings: [], applicabilityWarnings: [], calculationDetails: [] }),
  });
  registry.register(implementation("1.9.0"));
  registry.register(implementation("1.10.0"));
  assert.equal(registry.get("test", "method")?.implementationVersion, "1.10.0");
});

test("legacy engine delegates a database calculator method to the versioned registry", () => {
  const definition: CalculatorDefinition = {
    id: "egfr", slug: "egfr", name: "eGFR", nameVi: "eGFR", shortName: "eGFR", specialty: "", category: "", description: "", purpose: "", whenToUse: [], whenNotToUse: [], limitations: [],
    inputFields: [
      { id: "age", label: "Tuổi", type: "number", required: true },
      { id: "sex", label: "Giới", type: "select", required: true, options: [{ value: "female", label: "Nữ" }, { value: "male", label: "Nam" }] },
      { id: "creatinineMgDl", label: "Creatinine", type: "number", required: true },
    ],
    calculation: { handlerId: "egfr_ckd_epi_2021_creatinine", topicKey: "renal_function", methodKey: "egfr_ckd_epi_2021_creatinine", implementationVersion: "1.0.0" },
    scoringRules: [], resultDefinitions: [], interpretations: [], guidelineReferences: [], flashcardReferences: [], quizReferences: [], relatedCalculatorReferences: [], references: [], testCases: [], status: "draft", version: "1.0.0", sourceVerified: true, createdAt: "", updatedAt: "",
  };
  const result = calculateCalculator(definition, { age: 50, sex: "female", creatinineMgDl: 1 });
  assert.equal(result.unit, "mL/min/1,73 m²");
  assert.ok((result.rawValue || 0) > 0);
});
