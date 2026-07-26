import assert from "node:assert/strict";
import test from "node:test";
import { calculatorMethodRegistry } from "./methodRegistry.ts";
import "./platformRegistry.ts";

test("CURB-65 preserves every threshold and criterion breakdown", () => {
  const boundary = calculatorMethodRegistry.calculate("pneumonia_severity_curb65", "curb_65", { confusion: false, urea: 7, respiratoryRate: 29, systolicBp: 90, diastolicBp: 61, age: 64 });
  const threshold = calculatorMethodRegistry.calculate("pneumonia_severity_curb65", "curb_65", { confusion: true, urea: 7.1, respiratoryRate: 30, systolicBp: 89, diastolicBp: 70, age: 65 });
  assert.equal(boundary.primary.rawValue, 0);
  assert.equal(threshold.primary.rawValue, 5);
  assert.equal(threshold.criterionResults?.length, 5);
  assert.equal(threshold.classification, "high");
});

test("qSOFA scores exact respiratory and blood pressure boundaries without diagnosing sepsis", () => {
  const below = calculatorMethodRegistry.calculate("qsofa", "qsofa", { alteredMentation: false, respiratoryRate: 21, systolicBp: 101 });
  const at = calculatorMethodRegistry.calculate("qsofa", "qsofa", { alteredMentation: false, respiratoryRate: 22, systolicBp: 100 });
  assert.equal(below.primary.rawValue, 0);
  assert.equal(at.primary.rawValue, 2);
  assert.match(at.applicabilityWarnings.join(" "), /không thay thế chẩn đoán/i);
});

test("CHA2DS2-VASc keeps age bands mutually exclusive and retains sex category", () => {
  const score = calculatorMethodRegistry.calculate("atrial_fibrillation_thromboembolic_risk", "cha2ds2_vasc", { heartFailure: false, hypertension: false, age: 75, diabetes: false, priorStrokeTiaEmbolism: false, vascularDisease: false, sex: "female" });
  assert.equal(score.primary.rawValue, 3);
  assert.equal(score.criterionResults?.find((item) => item.criterionKey === "age")?.pointsAwarded, 2);
});

test("HAS-BLED keeps renal/liver and drugs/alcohol as distinct components", () => {
  const score = calculatorMethodRegistry.calculate("bleeding_risk_has_bled", "has_bled", { hypertension: false, renalAbnormality: true, liverAbnormality: true, priorStroke: false, bleedingHistory: false, labileInr: false, ageOver65: false, drugsPredisposingBleeding: true, alcoholExcess: true });
  assert.equal(score.primary.rawValue, 4);
  assert.equal(score.criterionResults?.length, 9);
  assert.match(score.applicabilityWarnings.join(" "), /không dùng riêng lẻ/i);
});

test("HEART stays source-gated until an original authoritative evidence record is approved", () => {
  assert.throws(() => calculatorMethodRegistry.calculate("heart_score", "heart_score", { history: "2", ecg: "1", age: 65, riskFactorCount: 3, knownAtheroscleroticDisease: false, troponinRatioToUpperReferenceLimit: 3.1 }), /chưa được xác minh nguồn/);
});

test("QTc and MELD remain blocked until a source-approved variant and fixture exist", () => {
  assert.equal(calculatorMethodRegistry.get("corrected_qt", "qtc_bazett")?.status, "draft");
  assert.equal(calculatorMethodRegistry.get("meld", "meld_original")?.status, "draft");
  assert.throws(() => calculatorMethodRegistry.calculate("corrected_qt", "qtc_bazett", { qt: 400, heartRate: 60 }), /chưa được xác minh nguồn/);
  assert.throws(() => calculatorMethodRegistry.calculate("meld", "meld_original", {}), /chưa được xác minh nguồn/);
});

test("Glasgow-Blatchford remains source-gated rather than exposing an unverified threshold table", () => {
  assert.equal(calculatorMethodRegistry.get("glasgow_blatchford_score", "glasgow_blatchford")?.status, "draft");
  assert.throws(() => calculatorMethodRegistry.calculate("glasgow_blatchford_score", "glasgow_blatchford", {}), /chưa được xác minh nguồn/);
});
