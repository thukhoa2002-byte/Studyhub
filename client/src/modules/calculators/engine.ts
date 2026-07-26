import { canonicalizeInputs, unitForField } from "./unitConversion.ts";
import type { CalculatorCalculationResult, CalculatorClinicalTestCase, CalculatorDefinition, CalculatorScoringRule } from "./types.ts";
import { calculatorMethodRegistry } from "./methodRegistry.ts";
import { isSupportedCalculatorImplementationKey } from "./platformRegistry.ts";

export type CalculatorInputs = Record<string, unknown>;
export type CalculatorHandler = (inputs: CalculatorInputs) => CalculatorCalculationResult;

function numberInput(inputs: CalculatorInputs, key: string): number | null {
  const value = typeof inputs[key] === "number" ? inputs[key] : Number(inputs[key]);
  return Number.isFinite(value) ? value : null;
}

function missing(...keys: Array<[string, number | null]>): string[] {
  return keys.filter(([, value]) => value === null).map(([key]) => `Thiếu dữ liệu: ${key}.`);
}

function invalid(warnings: string[], unit?: string): CalculatorCalculationResult {
  return { rawValue: null, score: null, displayValue: "—", unit, warnings, validationErrors: warnings };
}

const calculateBmi: CalculatorHandler = (inputs) => {
  const weight = numberInput(inputs, "weightKg");
  const height = numberInput(inputs, "heightCm");
  const warnings = missing(["weightKg", weight], ["heightCm", height]);
  if (warnings.length || !weight || !height) return invalid(warnings, "kg/m²");
  const rawValue = weight / Math.pow(height / 100, 2);
  const category = rawValue < 18.5 ? "underweight" : rawValue < 25 ? "normal" : rawValue < 30 ? "overweight" : "obesity";
  return { rawValue, score: null, displayValue: rawValue.toFixed(1), unit: "kg/m²", category, interpretationKey: category, warnings: [] };
};

const calculateCockcroftGault: CalculatorHandler = (inputs) => {
  const age = numberInput(inputs, "age");
  const weight = numberInput(inputs, "weightKg");
  const creatinine = numberInput(inputs, "creatinineMgDl");
  const warnings = missing(["age", age], ["weightKg", weight], ["creatinineMgDl", creatinine]);
  if (warnings.length || !age || !weight || !creatinine || creatinine <= 0) return invalid(warnings.length ? warnings : ["Creatinine phải lớn hơn 0."], "mL/min");
  const rawValue = ((140 - age) * weight) / (72 * creatinine) * (inputs.sex === "female" ? 0.85 : 1);
  return { rawValue, score: null, displayValue: rawValue.toFixed(1), unit: "mL/min", interpretationKey: "calculated", warnings: [] };
};

const calculateCurb65: CalculatorHandler = (inputs) => {
  const keys = ["confusion", "ureaMmolL", "respiratoryRate", "lowBloodPressure", "age65"];
  const warnings = keys.filter((key) => typeof inputs[key] !== "boolean" && inputs[key] !== "true" && inputs[key] !== "false").map((key) => `Thiếu dữ liệu: ${key}.`);
  if (warnings.length) return invalid(warnings, "điểm");
  const score = keys.reduce((total, key) => total + (inputs[key] === true || inputs[key] === "true" ? 1 : 0), 0);
  const category = score <= 1 ? "low" : score <= 3 ? "moderate" : "high";
  return { rawValue: score, score, displayValue: String(score), unit: "điểm", category, interpretationKey: category, warnings: [] };
};

export const calculatorRegistry: Record<string, CalculatorHandler> = {
  bmi: calculateBmi,
  "cockcroft-gault": calculateCockcroftGault,
  "curb-65": calculateCurb65,
};

function matchesRule(value: unknown, rule: CalculatorScoringRule): boolean {
  const operator = rule.operator || "equals";
  const target = rule.value;
  const numericValue = typeof value === "number" ? value : Number(value);
  const numericTarget = typeof target === "number" ? target : Number(target);
  if (operator === "in") return Array.isArray(target) && target.map(String).includes(String(value));
  if (operator === "equals") return String(value) === String(target);
  if (operator === "not_equals") return String(value) !== String(target);
  if (!Number.isFinite(numericValue) || !Number.isFinite(numericTarget)) return false;
  if (operator === "greater_than") return numericValue > numericTarget;
  if (operator === "greater_or_equal") return numericValue >= numericTarget;
  if (operator === "less_than") return numericValue < numericTarget;
  return numericValue <= numericTarget;
}

function calculateFromScoringRules(definition: CalculatorDefinition, inputs: CalculatorInputs): CalculatorCalculationResult {
  const rules = definition.scoringRules || [];
  if (rules.length === 0) return invalid(["Chưa có công thức hoặc quy tắc chấm điểm hợp lệ."]);
  const triggered = rules.filter((rule) => matchesRule(inputs[rule.inputId], rule));
  const score = triggered.reduce((total, rule) => total + (Number.isFinite(rule.points) ? Number(rule.points) : 0), 0);
  const directResult = triggered.find((rule) => rule.resultKey)?.resultKey;
  const threshold = definition.resultDefinitions.find((item) => (
    (item.min === undefined || item.min === null || score >= item.min)
    && (item.max === undefined || item.max === null || score <= item.max)
  ));
  const category = directResult || threshold?.key;
  return {
    rawValue: score,
    score,
    displayValue: String(score),
    unit: "điểm",
    category,
    interpretationKey: category,
    warnings: triggered.flatMap((rule) => rule.warning ? [rule.warning] : []),
  };
}

const platformMethodTopics: Record<string, string> = {
  egfr_ckd_epi_2021_creatinine: "renal_function",
  egfr_ckd_epi_2021_creatinine_cystatin_c: "renal_function",
  egfr_ckd_epi_2012_cystatin_c: "renal_function",
  egfr_mdrd_4_variable_idms: "renal_function",
  crcl_cockcroft_gault: "renal_function",
  bmi_adult: "body_size",
};

function calculateFromPlatform(definition: CalculatorDefinition, inputs: CalculatorInputs): CalculatorCalculationResult | null {
  const methodKey = definition.calculation.methodKey || definition.calculation.handlerId;
  const topicKey = definition.calculation.topicKey || platformMethodTopics[methodKey];
  if (!topicKey || !methodKey || !isSupportedCalculatorImplementationKey(methodKey)) return null;
  try {
    const result = calculatorMethodRegistry.calculate(topicKey, methodKey, inputs, definition.calculation.variantKey, definition.calculation.implementationVersion);
    return {
      rawValue: result.primary.rawValue,
      score: result.calculationModelType.includes("point") ? result.primary.rawValue : null,
      displayValue: result.primary.displayValue,
      unit: result.primary.unit,
      category: result.category,
      interpretationKey: result.classification,
      interpretation: result.interpretation,
      warnings: [...result.warnings, ...result.applicabilityWarnings],
    };
  } catch (error) {
    return invalid([error instanceof Error ? error.message : "Không thể tính bằng phương thức đã chọn."]);
  }
}

export function validateCalculatorInputs(definition: CalculatorDefinition, inputs: CalculatorInputs): string[] {
  return definition.inputFields.flatMap((field) => {
    const value = inputs[field.id];
    const empty = value === undefined || value === null || value === "";
    if (field.required && empty) return [field.validationMessage || `Vui lòng nhập ${field.label}.`];
    if (empty) return [];
    if (field.type === "number") {
      const numeric = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numeric)) return [`${field.label} phải là số.`];
      const selectedUnit = unitForField(field, inputs);
      if ((field.allowedUnits?.length || field.canonicalUnit) && !selectedUnit) return [`Đơn vị của ${field.label} không hợp lệ.`];
      try {
        const canonical = canonicalizeInputs([field], inputs)[field.id];
        if (typeof canonical !== "number" || !Number.isFinite(canonical)) return [`${field.label} không thể quy đổi về đơn vị chuẩn.`];
        if (field.min !== undefined && canonical < field.min) return [field.validationMessage || `${field.label} không được nhỏ hơn ${field.min}.`];
        if (field.max !== undefined && canonical > field.max) return [field.validationMessage || `${field.label} không được lớn hơn ${field.max}.`];
      } catch (error) { return [error instanceof Error ? error.message : `Đơn vị của ${field.label} không hợp lệ.`]; }
    }
    if (field.options && !field.options.some((option) => option.value === String(value))) return [`Giá trị của ${field.label} không hợp lệ.`];
    return [];
  });
}

export function calculateCalculator(definition: CalculatorDefinition, inputs: CalculatorInputs): CalculatorCalculationResult {
  const validationErrors = validateCalculatorInputs(definition, inputs);
  if (validationErrors.length) return invalid(validationErrors);
  let canonical: CalculatorInputs;
  try { canonical = canonicalizeInputs(definition.inputFields, inputs); }
  catch (error) { return invalid([error instanceof Error ? error.message : "Không thể quy đổi đơn vị."]); }
  const handler = Object.hasOwn(calculatorRegistry, definition.calculation.handlerId) ? calculatorRegistry[definition.calculation.handlerId] : undefined;
  const platformResult = handler ? null : calculateFromPlatform(definition, canonical);
  const result = handler ? handler(canonical) : platformResult || calculateFromScoringRules(definition, canonical);
  if (!Number.isFinite(result.rawValue ?? 0) && result.rawValue !== null) return invalid(["Kết quả tính không hợp lệ."]);
  return result;
}

const handlerTestCases: Record<string, CalculatorClinicalTestCase[]> = {
  bmi: [
    { id: "bmi-normal", label: "BMI bình thường", inputs: { weightKg: 70, heightCm: 175 }, expected: { rawValue: 22.8571428571, category: "normal", valid: true }, reference: "WHO BMI classification" },
    { id: "bmi-obesity", label: "BMI béo phì", inputs: { weightKg: 95, heightCm: 170 }, expected: { category: "obesity", valid: true }, reference: "WHO BMI classification" },
    { id: "bmi-invalid", label: "BMI thiếu chiều cao", inputs: { weightKg: 70 }, expected: { rawValue: null, valid: false }, reference: "Validation" },
  ],
  "cockcroft-gault": [
    { id: "cg-female", label: "Cockcroft-Gault nữ", inputs: { age: 60, sex: "female", weightKg: 60, creatinineMgDl: 1 }, expected: { rawValue: 56.6666666667, unit: "mL/min", valid: true }, reference: "Cockcroft DW, Gault MH. 1976" },
    { id: "cg-unit", label: "Creatinine mmol/L quy đổi", inputs: { age: 60, sex: "female", weightKg: 60, creatinineMgDl: 88.4, creatinineMgDl__unit: "umol/L" }, expected: { rawValue: 56.6666666667, valid: true }, reference: "Unit conversion" },
    { id: "cg-invalid", label: "Creatinine không hợp lệ", inputs: { age: 60, sex: "female", weightKg: 60, creatinineMgDl: 0 }, expected: { rawValue: null, valid: false }, reference: "Validation" },
  ],
  "curb-65": [
    { id: "curb-min", label: "CURB-65 thấp", inputs: { confusion: false, ureaMmolL: false, respiratoryRate: false, lowBloodPressure: false, age65: false }, expected: { rawValue: 0, category: "low", valid: true }, reference: "Lim WS et al. Thorax 2003" },
    { id: "curb-boundary", label: "CURB-65 ngưỡng 2", inputs: { confusion: true, ureaMmolL: true, respiratoryRate: false, lowBloodPressure: false, age65: false }, expected: { rawValue: 2, category: "moderate", valid: true }, reference: "Lim WS et al. Thorax 2003" },
    { id: "curb-max", label: "CURB-65 tối đa", inputs: { confusion: true, ureaMmolL: true, respiratoryRate: true, lowBloodPressure: true, age65: true }, expected: { rawValue: 5, category: "high", valid: true }, reference: "Lim WS et al. Thorax 2003" },
  ],
};

export function getCalculatorTestCases(definition: CalculatorDefinition): CalculatorClinicalTestCase[] {
  return definition.testCases.length ? definition.testCases : handlerTestCases[definition.calculation.handlerId] || [];
}

export function runCalculatorTestCases(definition: CalculatorDefinition) {
  return getCalculatorTestCases(definition).map((testCase) => {
    const result = calculateCalculator(definition, testCase.inputs);
    const expected = testCase.expected;
    const valid = result.rawValue !== null && (result.validationErrors?.length ?? 0) === 0;
    const rawMatches = expected.rawValue === undefined || (expected.rawValue === null ? result.rawValue === null : result.rawValue !== null && Math.abs(result.rawValue - expected.rawValue) < 0.0001);
    const pass = rawMatches
      && (expected.displayValue === undefined || result.displayValue === expected.displayValue)
      && (expected.unit === undefined || result.unit === expected.unit)
      && (expected.category === undefined || result.category === expected.category)
      && (expected.valid === undefined || expected.valid === valid);
    return { testCase, result, pass };
  });
}

export function hasCalculatorHandler(definition: CalculatorDefinition): boolean {
  return typeof calculatorRegistry[definition.calculation.handlerId] === "function" || isSupportedCalculatorImplementationKey(definition.calculation.methodKey || definition.calculation.handlerId);
}
