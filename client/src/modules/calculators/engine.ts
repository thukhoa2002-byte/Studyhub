import type { CalculatorCalculationResult, CalculatorDefinition } from "./types.ts";

export type CalculatorInputs = Record<string, unknown>;
export type CalculatorHandler = (inputs: CalculatorInputs) => CalculatorCalculationResult;

function numberInput(inputs: CalculatorInputs, key: string): number | null {
  const value = typeof inputs[key] === "number" ? inputs[key] : Number(inputs[key]);
  return Number.isFinite(value) ? value : null;
}

function missing(...keys: Array<[string, number | null]>): string[] {
  return keys.filter(([, value]) => value === null).map(([key]) => `Thiếu dữ liệu: ${key}.`);
}

const calculateBmi: CalculatorHandler = (inputs) => {
  const weight = numberInput(inputs, "weightKg");
  const height = numberInput(inputs, "heightCm");
  const warnings = missing(["weightKg", weight], ["heightCm", height]);
  if (warnings.length || !weight || !height) return { rawValue: null, displayValue: "—", unit: "kg/m²", warnings };
  const rawValue = weight / Math.pow(height / 100, 2);
  const category = rawValue < 18.5 ? "underweight" : rawValue < 25 ? "normal" : rawValue < 30 ? "overweight" : "obesity";
  return { rawValue, displayValue: rawValue.toFixed(1), unit: "kg/m²", category, interpretationKey: category, warnings: [] };
};

const calculateCockcroftGault: CalculatorHandler = (inputs) => {
  const age = numberInput(inputs, "age");
  const weight = numberInput(inputs, "weightKg");
  const creatinine = numberInput(inputs, "creatinineMgDl");
  const warnings = missing(["age", age], ["weightKg", weight], ["creatinineMgDl", creatinine]);
  if (warnings.length || !age || !weight || !creatinine || creatinine <= 0) return { rawValue: null, displayValue: "—", unit: "mL/min", warnings };
  const rawValue = ((140 - age) * weight) / (72 * creatinine) * (inputs.sex === "female" ? 0.85 : 1);
  return { rawValue, displayValue: rawValue.toFixed(1), unit: "mL/min", interpretationKey: "calculated", warnings: [] };
};

const calculateCurb65: CalculatorHandler = (inputs) => {
  const keys = ["confusion", "ureaMmolL", "respiratoryRate", "lowBloodPressure", "age65"];
  const warnings = keys.filter((key) => typeof inputs[key] !== "boolean" && inputs[key] !== "true" && inputs[key] !== "false").map((key) => `Thiếu dữ liệu: ${key}.`);
  if (warnings.length) return { rawValue: null, displayValue: "—", unit: "điểm", warnings };
  const score = keys.reduce((total, key) => total + (inputs[key] === true || inputs[key] === "true" ? 1 : 0), 0);
  const category = score <= 1 ? "low" : score <= 3 ? "moderate" : "high";
  return { rawValue: score, displayValue: String(score), unit: "điểm", category, interpretationKey: category, warnings: [] };
};

export const calculatorRegistry: Record<string, CalculatorHandler> = {
  bmi: calculateBmi,
  "cockcroft-gault": calculateCockcroftGault,
  "curb-65": calculateCurb65,
};

export function validateCalculatorInputs(definition: CalculatorDefinition, inputs: CalculatorInputs): string[] {
  return definition.inputFields.flatMap((field) => {
    const value = inputs[field.id];
    const empty = value === undefined || value === null || value === "";
    if (field.required && empty) return [field.validationMessage || `Vui lòng nhập ${field.label}.`];
    if (empty) return [];
    if (field.type === "number") {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return [`${field.label} phải là số.`];
      if (field.min !== undefined && numeric < field.min) return [`${field.label} không được nhỏ hơn ${field.min}.`];
      if (field.max !== undefined && numeric > field.max) return [`${field.label} không được lớn hơn ${field.max}.`];
    }
    if (field.options && !field.options.some((option) => option.value === String(value))) return [`Giá trị của ${field.label} không hợp lệ.`];
    return [];
  });
}

export function calculateCalculator(definition: CalculatorDefinition, inputs: CalculatorInputs): CalculatorCalculationResult {
  const validationWarnings = validateCalculatorInputs(definition, inputs);
  const handler = calculatorRegistry[definition.calculation.handlerId];
  if (!handler) return { rawValue: null, displayValue: "—", warnings: ["Chưa có công thức tính được đăng ký."] };
  if (validationWarnings.length) return { rawValue: null, displayValue: "—", warnings: validationWarnings };
  return handler(inputs);
}

export function hasCalculatorHandler(definition: CalculatorDefinition): boolean {
  return typeof calculatorRegistry[definition.calculation.handlerId] === "function";
}
