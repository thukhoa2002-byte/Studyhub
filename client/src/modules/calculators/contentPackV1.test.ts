import assert from "node:assert/strict";
import test from "node:test";
import { calculatorMethodRegistry } from "./methodRegistry.ts";
import "./platformRegistry.ts";

test("BMI Content Pack normalizes kg/cm and pounds/meters while preserving the raw result", () => {
  const metric = calculatorMethodRegistry.calculate("bmi", "bmi_adult", { weight: 70, height: 175, height__unit: "cm" });
  const imperialWeight = calculatorMethodRegistry.calculate("bmi", "bmi_adult", { weight: 154.3235835, weight__unit: "lb", height: 1.75, height__unit: "m" });
  assert.equal(metric.primary.unit, "kg/m²");
  assert.ok(metric.primary.rawValue !== null && Math.abs(metric.primary.rawValue - 22.8571428571) < 0.0001);
  assert.equal(metric.category, "normal");
  assert.equal(metric.sourceReference, "WHO BMI classification");
  assert.ok(imperialWeight.primary.rawValue !== null && Math.abs(imperialWeight.primary.rawValue - 22.8571428571) < 0.0001);
});

test("BMI Content Pack rejects zero and negative height instead of calculating", () => {
  const zero = calculatorMethodRegistry.calculate("bmi", "bmi_adult", { weight: 70, height: 0, height__unit: "m" });
  const negative = calculatorMethodRegistry.calculate("bmi", "bmi_adult", { weight: 70, height: -175, height__unit: "cm" });
  assert.equal(zero.primary.rawValue, null);
  assert.equal(negative.primary.rawValue, null);
});

test("renal Content Pack converts creatinine units and keeps eGFR distinct from CrCl", () => {
  const egfr = calculatorMethodRegistry.calculate("renal_function", "egfr_ckd_epi_2021_creatinine", { age: 50, sex: "female", creatinine: 88.4, creatinine__unit: "umol/L" });
  const crcl = calculatorMethodRegistry.calculate("renal_function", "crcl_cockcroft_gault", { age: 50, sex: "female", creatinine: 88.4, creatinine__unit: "umol/L", weight: 60, weight__unit: "kg" }, "actual-body-weight");
  assert.equal(egfr.primary.metric, "eGFR");
  assert.equal(egfr.primary.unit, "mL/min/1,73 m²");
  assert.equal(egfr.primary.indexingStatus, "indexed_to_1_73m2");
  assert.equal(crcl.primary.metric, "CrCl");
  assert.equal(crcl.primary.unit, "mL/min");
  assert.equal(crcl.primary.indexingStatus, "absolute_ml_min");
});

test("renal method requirements block a cystatin-only result until cystatin C is supplied", () => {
  const missing = calculatorMethodRegistry.calculate("renal_function", "egfr_ckd_epi_2012_cystatin_c", { age: 50, sex: "female" });
  const complete = calculatorMethodRegistry.calculate("renal_function", "egfr_ckd_epi_2012_cystatin_c", { age: 50, sex: "female", cystatinC: 1, cystatinC__unit: "mg/L" });
  assert.equal(missing.primary.rawValue, null);
  assert.ok(complete.primary.rawValue !== null);
});

test("unverified Child-Pugh variants and 2021 combined CKD-EPI scaffolds cannot calculate", () => {
  assert.equal(calculatorMethodRegistry.get("child_pugh", "child_pugh_inr")?.source.verified, false);
  assert.equal(calculatorMethodRegistry.get("child_pugh", "child_pugh_pt_prolongation")?.source.verified, false);
  assert.equal(calculatorMethodRegistry.get("renal_function", "egfr_ckd_epi_2021_creatinine_cystatin_c")?.source.verified, false);
  assert.throws(() => calculatorMethodRegistry.calculate("child_pugh", "child_pugh_inr", {}), /chưa được xác minh nguồn/);
  assert.throws(() => calculatorMethodRegistry.calculate("child_pugh", "child_pugh_pt_prolongation", {}), /chưa được xác minh nguồn/);
  assert.throws(() => calculatorMethodRegistry.calculate("renal_function", "egfr_ckd_epi_2021_creatinine_cystatin_c", {}), /chưa được xác minh nguồn/);
});

test("renal snapshots retain normalized inputs rather than only display units", () => {
  const execution = calculatorMethodRegistry.calculateWithSnapshot("renal_function", "egfr_ckd_epi_2021_creatinine", { age: 50, sex: "female", creatinine: 88.4, creatinine__unit: "umol/L" });
  assert.equal(execution.snapshot.normalizedInputSnapshot.creatinineMgDl, 1);
  assert.equal(execution.snapshot.normalizedInputSnapshot.creatinine, undefined);
});
