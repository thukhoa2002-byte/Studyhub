import assert from "node:assert/strict";
import test from "node:test";
import {
  isDuplicateGuidelineReference,
  normalizeCalculatorSlug,
  validateCalculatorConfiguration,
  validateCalculatorPublish,
  validateCalculatorSlug,
  validateGuidelineReferenceInput,
  validateGuidelineReferenceTargets,
} from "./calculatorValidation.ts";
import { legacyCalculatorModeKey } from "./calculatorConfigurationMode.ts";
import { readFileSync } from "node:fs";

test("calculator slugs are normalized and validated", () => {
  assert.equal(normalizeCalculatorSlug("Cockcroft–Gault"), "cockcroft-gault");
  assert.deepEqual(validateCalculatorSlug("cockcroft-gault"), []);
  assert.notDeepEqual(validateCalculatorSlug("Cockcroft Gault"), []);
});

test("explicit legacy mode keeps source and handler requirements", () => {
  const check = validateCalculatorPublish({
    slug: "bmi",
    name: { vi: "BMI", en: "BMI" },
    calculator_type: "equation",
    handler_key: "bmi",
    input_fields: [
      { id: "weightKg", label: "Cân nặng", type: "number", required: true },
      { id: "heightCm", label: "Chiều cao", type: "number", required: true },
    ],
    scoring_rules: [],
    result_definitions: [{ key: "normal", label: "Bình thường", description: "" }],
    evidence_references: ["WHO BMI classification"],
    formula_variables: [{ key: legacyCalculatorModeKey, enabled: true }],
    source_verified: true,
    version: "1.0.0",
  });
  assert.equal(check.canPublish, true);

  const unverified = validateCalculatorPublish({
    ...checkRecord(),
    source_verified: false,
  });
  assert.equal(unverified.canPublish, false);
  assert.match(unverified.errors.join(" "), /xác minh nguồn/);
});

test("guideline relation types are constrained", () => {
  assert.deepEqual(validateGuidelineReferenceInput({ guideline_id: "g-1", section_id: null, recommendation_id: null, relation_type: "recommended-use" }), []);
  assert.notDeepEqual(validateGuidelineReferenceInput({ guideline_id: "g-1", section_id: null, recommendation_id: null, relation_type: "free-text" as never }), []);
});

test("guideline targets must belong to the referenced document and section", () => {
  const base = { guideline_id: "guide-1", section_id: "section-1", recommendation_id: "entry-1" };
  assert.deepEqual(validateGuidelineReferenceTargets(base, {
    section: { id: "section-1", guideline_id: "guide-2" },
    recommendation: { id: "entry-1", guideline_id: "guide-2", section_id: "section-2" },
  }), [
    "section_id không thuộc guideline_id.",
    "recommendation_id không thuộc guideline_id.",
    "recommendation_id không thuộc section_id.",
  ]);
});

test("nullable guideline references use the same duplicate identity as the database", () => {
  const input = { calculator_id: "calc-1", guideline_id: "guide-1", section_id: null, recommendation_id: null, relation_type: "related" as const };
  assert.equal(isDuplicateGuidelineReference(input, [input]), true);
  assert.equal(isDuplicateGuidelineReference(input, [{ ...input, relation_type: "monitoring" }]), false);
  assert.equal(isDuplicateGuidelineReference(input, [{ ...input, section_id: "section-1" }]), false);
});

test("publication is blocked when a handler is missing a required input or a test case fails", () => {
  const missingInput = validateCalculatorPublish({ ...checkRecord(), input_fields: [{ id: "weightKg", label: "Cân nặng", type: "number", required: true }], result_definitions: [{ key: "normal", label: "Bình thường", description: "" }], evidence_references: ["WHO"] });
  assert.equal(missingInput.canPublish, false);
  assert.match(missingInput.errors.join(" "), /heightCm/);

  const failedCase = validateCalculatorPublish({
    ...checkRecord(),
    input_fields: [{ id: "weightKg", label: "Cân nặng", type: "number", required: true }, { id: "heightCm", label: "Chiều cao", type: "number", required: true }],
    result_definitions: [{ key: "normal", label: "Bình thường", description: "" }],
    evidence_references: ["WHO"],
    formula_variables: [{ key: "clinical_test_cases", cases: [{ id: "bad", label: "Sai", inputs: { weightKg: 70, heightCm: 175 }, expected: { rawValue: 99, valid: true } }] }],
  });
  assert.equal(failedCase.canPublish, false);
  assert.match(failedCase.errors.join(" "), /kiểm thử/);
});

test("topic-backed publication requires a registered enabled and source-verified method", () => {
  const publishedBmi = validateCalculatorPublish({
    ...checkRecord(),
    handler_key: null,
    calculator_topic_key: "bmi",
    default_method_key: "bmi_adult",
    enabled_method_keys: ["bmi_adult"],
    input_fields: [],
    result_definitions: [],
    evidence_references: [],
    formula_variables: [],
  });
  assert.equal(publishedBmi.canPublish, true);

  const missingDefault = validateCalculatorPublish({ ...checkRecord(), handler_key: null, calculator_topic_key: "bmi", default_method_key: "bmi_adult", enabled_method_keys: [], formula_variables: [] });
  assert.equal(missingDefault.canPublish, false);
  assert.match(missingDefault.errors.join(" "), /Method mặc định/);

  const sourceRequired = validateCalculatorPublish({ ...checkRecord(), handler_key: null, calculator_topic_key: "child_pugh", default_method_key: "child_pugh_inr", enabled_method_keys: ["child_pugh_inr"], formula_variables: [] });
  assert.equal(sourceRequired.canPublish, false);
  assert.match(sourceRequired.errors.join(" "), /chưa có nguồn/);

  const legacyBypass = validateCalculatorPublish({ ...checkRecord(), handler_key: "child_pugh_inr", formula_variables: [{ key: legacyCalculatorModeKey, enabled: true }] });
  assert.equal(legacyBypass.canPublish, false);
  assert.match(legacyBypass.errors.join(" "), /chưa có nguồn/);
});

test("Registry and legacy configuration cannot coexist", () => {
  const errors = validateCalculatorConfiguration({
    ...checkRecord(),
    calculator_topic_key: "bmi",
    default_method_key: "bmi_adult",
    enabled_method_keys: ["bmi_adult"],
    formula_variables: [{ key: legacyCalculatorModeKey, enabled: true }],
  });
  assert.match(errors.join(" "), /không thể cùng tồn tại/);
  assert.match(errors.join(" "), /handler legacy/);
});

test("unknown Registry topic and missing registered implementation block saving", () => {
  const errors = validateCalculatorConfiguration({
    ...checkRecord(), handler_key: null, calculator_topic_key: "unknown_topic", default_method_key: "unknown_method", enabled_method_keys: ["unknown_method"], formula_variables: [],
  });
  assert.match(errors.join(" "), /chưa được đăng ký/);
});

test("legacy calculator requires an explicit legacy marker", () => {
  const withoutMarker = validateCalculatorConfiguration({ ...checkRecord(), formula_variables: [] });
  assert.match(withoutMarker.join(" "), /xác nhận đây là calculator legacy/);
  const withMarker = validateCalculatorConfiguration({ ...checkRecord(), formula_variables: [{ key: legacyCalculatorModeKey, enabled: true }] });
  assert.deepEqual(withMarker, []);
});

test("admin Registry form keeps legacy JSON fields out of Registry mode", () => {
  const page = readFileSync(new URL("../components/AdminCalculatorPage.tsx", import.meta.url), "utf8");
  assert.match(page, /form\.topicKey \? <>/);
  assert.match(page, /form\.legacyMode \? <>/);
  assert.match(page, /Cấu hình Registry được khóa theo code/);
  assert.match(page, /handler_key: form\.topicKey \? null/);
});

function checkRecord() {
  return {
    slug: "bmi",
    name: { vi: "BMI", en: "BMI" },
    calculator_type: "equation" as const,
    handler_key: "bmi",
    input_fields: [{ id: "weightKg", label: "Cân nặng", type: "number", required: true }, { id: "heightCm", label: "Chiều cao", type: "number", required: true }],
    scoring_rules: [],
    formula_variables: [{ key: legacyCalculatorModeKey, enabled: true }],
    source_verified: true,
    version: "1.0.0",
  };
}
