export type CalculatorStatus = "draft" | "in_review" | "reviewed" | "published" | "archived";
export type CalculatorInputType = "number" | "select" | "radio" | "checkbox" | "boolean";
export type CalculatorValueType = "number" | "string" | "boolean";

export interface CalculatorOption {
  value: string;
  label: string;
}

export interface CalculatorInputField {
  id: string;
  label: string;
  type: CalculatorInputType;
  dataType?: CalculatorValueType;
  unit?: string;
  displayUnit?: string;
  canonicalUnit?: string;
  allowedUnits?: string[];
  unitKey?: string;
  required: boolean;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: string | number | boolean | null;
  options?: CalculatorOption[];
  helpText?: string;
  validationMessage?: string;
}

export type CalculatorRuleOperator = "equals" | "not_equals" | "greater_than" | "greater_or_equal" | "less_than" | "less_or_equal" | "in";

export interface CalculatorScoringRule {
  id: string;
  inputId: string;
  operator?: CalculatorRuleOperator;
  value?: string | number | boolean | Array<string | number | boolean>;
  points?: number;
  resultKey?: string;
  warning?: string;
}

export interface CalculatorClinicalTestCase {
  id: string;
  label: string;
  inputs: Record<string, unknown>;
  expected: {
    rawValue?: number | null;
    displayValue?: string;
    unit?: string;
    category?: string;
    valid?: boolean;
  };
  reference?: string;
}

export interface CalculatorReference {
  id: string;
  relationType: string;
  context?: string;
}

export interface CalculatorGuidelineReference extends CalculatorReference {
  guidelineId: string;
  sectionId?: string;
  recommendationId?: string;
}

export interface CalculatorResultDefinition {
  key: string;
  label: string;
  description: string;
  min?: number | null;
  max?: number | null;
  severity?: "low" | "moderate" | "high" | "critical" | "neutral";
  recommendationReferences?: CalculatorGuidelineReference[];
  nextStepText?: string;
}

export interface CalculatorVersionHistory {
  version: string;
  changedAt: string;
  changedBy?: string;
  changeNotes?: string;
}

export interface CalculatorCalculationResult {
  rawValue: number | null;
  displayValue: string;
  unit?: string;
  score?: number | null;
  category?: string;
  interpretationKey?: string;
  interpretation?: string;
  warnings: string[];
  validationErrors?: string[];
}

export interface CalculatorDefinition {
  id: string;
  slug: string;
  name: string;
  nameVi: string;
  shortName: string;
  specialty: string;
  category: string;
  description: string;
  purpose: string;
  whenToUse: string[];
  whenNotToUse: string[];
  limitations: string[];
  inputFields: CalculatorInputField[];
  calculation: {
    handlerId: string;
    topicKey?: string;
    methodKey?: string;
    variantKey?: string;
    implementationVersion?: string;
    comparisonEnabled?: boolean;
  };
  scoringRules?: CalculatorScoringRule[];
  resultDefinitions: CalculatorResultDefinition[];
  interpretations: string[];
  guidelineReferences: CalculatorGuidelineReference[];
  flashcardReferences: CalculatorReference[];
  quizReferences: CalculatorReference[];
  relatedCalculatorReferences: CalculatorReference[];
  references: string[];
  testCases: CalculatorClinicalTestCase[];
  status: CalculatorStatus;
  version: string;
  sourceVerified: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  changeNotes?: string;
  history?: CalculatorVersionHistory[];
}
