export type CalculationModelType =
  | "equation"
  | "additive_point_score"
  | "threshold_point_score"
  | "weighted_risk_model"
  | "threshold_classification"
  | "decision_rule"
  | "staging_system"
  | "dose_regimen"
  | "conversion_correction"
  | "lookup_table"
  | "time_series"
  | "hybrid";

export type CalculatorImplementationStatus = "draft" | "verified" | "published" | "deprecated" | "retired";
export type IndexingStatus = "indexed_to_1_73m2" | "absolute_ml_min" | "not_indexed" | "not_applicable";

export interface CalculatorSourceMetadata {
  primarySource: string;
  sourceReference: string;
  sourceUrl?: string;
  verified: boolean;
  lastVerifiedAt?: string;
  population: string;
  applicability: string;
}

export interface CalculatorTopicDefinition {
  topicKey: string;
  title: string;
  defaultMethodKey?: string;
  enabledMethodKeys: string[];
  comparisonEnabled?: boolean;
}

export interface CalculatorMethodDefinition {
  topicKey: string;
  methodKey: string;
  label: string;
  description: string;
  defaultVariantKey?: string;
}

export interface CalculatorMethodVariant {
  key: string;
  label: string;
  description?: string;
}

export interface CalculatorInputDefinition {
  key: string;
  label: string;
  inputType: "number" | "integer" | "boolean" | "select" | "radio" | "segmented" | "clinical_grade";
  required: boolean;
  unit?: string;
  alternativeUnits?: string[];
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
}

export interface CalculatorValidationResult<TInput = Record<string, unknown>> {
  valid: boolean;
  value?: TInput;
  errors: string[];
  warnings: string[];
}

export interface CalculatorPrimaryMetric {
  metric: string;
  rawValue: number | null;
  roundedValue: number | null;
  displayValue: string;
  unit: string;
  indexingStatus: IndexingStatus;
}

export interface CalculatorCriterionResult {
  criterionKey: string;
  enteredValue: unknown;
  enteredUnit?: string;
  normalizedValue: unknown;
  matchedRule?: string;
  pointsAwarded?: number;
}

export interface CalculatorResult {
  calculatorTopicKey: string;
  methodKey: string;
  variantKey?: string;
  implementationVersion: string;
  calculationModelType: CalculationModelType;
  formulaName: string;
  formulaYear?: number;
  sourceReference: string;
  primary: CalculatorPrimaryMetric;
  category?: string;
  classification?: string;
  interpretation?: string;
  warnings: string[];
  applicabilityWarnings: string[];
  calculationDetails: Array<{ key: string; label: string; value: string | number }>;
  criterionResults?: CalculatorCriterionResult[];
}

export interface CalculatorInterpretation {
  summary: string;
  category?: string;
  warnings?: string[];
}

export interface CalculatorMethodResult {
  result: CalculatorResult;
  normalizedInput: Record<string, unknown>;
}

export interface CalculatorComparisonResult {
  topicKey: string;
  comparedAt: string;
  results: CalculatorResult[];
}

export interface CalculationModelDefinition {
  type: CalculationModelType;
  sourceBacked: boolean;
  description: string;
}

export interface CalculatorImplementation<TInput = Record<string, unknown>> {
  topicKey: string;
  methodKey: string;
  variantKey?: string;
  implementationVersion: string;
  calculationModelType: CalculationModelType;
  formulaName: string;
  formulaYear?: number;
  formulaVersion?: string;
  status: CalculatorImplementationStatus;
  effectiveFrom?: string;
  effectiveTo?: string;
  inputSchema: CalculatorInputDefinition[];
  source: CalculatorSourceMetadata;
  changelog: string[];
  backwardCompatibilityNotes?: string;
  validate: (input: unknown) => CalculatorValidationResult<TInput>;
  normalize: (input: TInput) => Record<string, unknown>;
  calculate: (input: TInput) => CalculatorResult;
}

export interface CalculatorResultSnapshot {
  calculatorTopicKey: string;
  methodKey: string;
  variantKey?: string;
  implementationVersion: string;
  calculationModelType: CalculationModelType;
  formulaName: string;
  formulaYear?: number;
  inputSnapshot: Record<string, unknown>;
  normalizedInputSnapshot: Record<string, unknown>;
  rawResult: number | null;
  displayResult: string;
  outputMetric: string;
  outputUnit: string;
  indexingStatus: IndexingStatus;
  calculatedAt: string;
}

export interface CalculatorExecution {
  result: CalculatorResult;
  snapshot: CalculatorResultSnapshot;
}
