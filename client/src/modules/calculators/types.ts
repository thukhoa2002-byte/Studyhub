export type CalculatorStatus = "draft" | "in_review" | "reviewed" | "published" | "archived";
export type CalculatorInputType = "number" | "select" | "radio" | "checkbox" | "boolean";

export interface CalculatorOption {
  value: string;
  label: string;
}

export interface CalculatorInputField {
  id: string;
  label: string;
  type: CalculatorInputType;
  unit?: string;
  required: boolean;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: string | number | boolean | null;
  options?: CalculatorOption[];
  helpText?: string;
  validationMessage?: string;
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
  drugReferences?: CalculatorReference[];
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
  category?: string;
  interpretationKey?: string;
  interpretation?: string;
  warnings: string[];
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
  calculation: { handlerId: string };
  resultDefinitions: CalculatorResultDefinition[];
  interpretations: string[];
  guidelineReferences: CalculatorGuidelineReference[];
  drugReferences: CalculatorReference[];
  flashcardReferences: CalculatorReference[];
  quizReferences: CalculatorReference[];
  relatedCalculatorReferences: CalculatorReference[];
  references: string[];
  status: CalculatorStatus;
  version: string;
  sourceVerified: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  changeNotes?: string;
  history?: CalculatorVersionHistory[];
}
