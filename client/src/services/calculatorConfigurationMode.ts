import { calculatorMethodRegistry } from "../modules/calculators/methodRegistry.ts";
import type { CalculatorImplementation } from "../modules/calculators/platformTypes.ts";
import type { CalculatorInputField } from "../modules/calculators/types.ts";

export const legacyCalculatorModeKey = "studyhub_legacy_calculator_mode";

type FormulaVariable = { key?: unknown; enabled?: unknown };

export function isLegacyCalculatorMode(formulaVariables: unknown): boolean {
  return Array.isArray(formulaVariables) && formulaVariables.some((item) => (
    Boolean(item) && typeof item === "object"
    && (item as FormulaVariable).key === legacyCalculatorModeKey
    && (item as FormulaVariable).enabled === true
  ));
}

export function withLegacyCalculatorMode(formulaVariables: unknown[], enabled: boolean): unknown[] {
  const withoutMarker = formulaVariables.filter((item) => !(Boolean(item) && typeof item === "object" && (item as FormulaVariable).key === legacyCalculatorModeKey));
  return enabled ? [{ key: legacyCalculatorModeKey, enabled: true }, ...withoutMarker] : withoutMarker;
}

export function registryImplementationFor(topicKey: string | null | undefined, methodKey: string | null | undefined, implementationVersion?: string | null): CalculatorImplementation | undefined {
  if (!topicKey || !methodKey) return undefined;
  return calculatorMethodRegistry.get(topicKey, methodKey, undefined, implementationVersion || undefined);
}

export function registryInputFields(implementation: CalculatorImplementation): CalculatorInputField[] {
  return implementation.inputSchema.map((field) => ({
    id: field.key,
    label: field.label,
    type: field.inputType === "number" || field.inputType === "integer" ? "number" : field.inputType === "boolean" ? "boolean" : "radio",
    dataType: field.inputType === "boolean" ? "boolean" : field.inputType === "number" || field.inputType === "integer" ? "number" : "string",
    unit: field.unit,
    displayUnit: field.unit,
    canonicalUnit: field.unit,
    allowedUnits: field.unit ? [field.unit, ...(field.alternativeUnits || [])] : undefined,
    unitKey: field.unit ? `${field.key}__unit` : undefined,
    required: field.required,
    min: field.min,
    max: field.max,
    options: field.options,
  }));
}

export function registryCalculatorType(implementation: CalculatorImplementation): "equation" | "score" | "criteria" | "algorithm" {
  if (implementation.calculationModelType === "equation" || implementation.calculationModelType === "conversion_correction") return "equation";
  if (implementation.calculationModelType.includes("score") || implementation.calculationModelType === "staging_system") return "score";
  if (implementation.calculationModelType === "decision_rule" || implementation.calculationModelType === "threshold_classification") return "criteria";
  return "algorithm";
}

export function registryMethodOptions(topicKey: string): CalculatorImplementation[] {
  const preferred = new Map<string, CalculatorImplementation>();
  for (const implementation of calculatorMethodRegistry.listMethods(topicKey, true)) {
    const current = preferred.get(implementation.methodKey);
    if (!current || (current.status !== "published" && implementation.status === "published") || (!current.source.verified && implementation.source.verified)) preferred.set(implementation.methodKey, implementation);
  }
  return [...preferred.values()];
}
