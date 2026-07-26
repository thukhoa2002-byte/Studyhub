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
export type CalculatorEvidenceRole =
  | "original_derivation"
  | "original_score_publication"
  | "external_validation"
  | "authoritative_specification"
  | "clinical_guideline"
  | "regulatory_source"
  | "dataset_source"
  | "implementation_fixture";

export type CalculatorEvidenceVerificationStatus = "source_required" | "verification_pending" | "verified" | "conflicted_source";
export type CalculatorEvidenceClaim = "formula" | "coefficients" | "scoring_thresholds" | "point_assignments" | "units" | "population" | "applicability" | "classification_boundaries" | "interpretation" | "reference_result" | "dataset_version";

export interface CalculatorEvidenceRecord {
  evidenceId: string;
  role: CalculatorEvidenceRole;
  title: string;
  authors?: string;
  organization?: string;
  journal?: string;
  year?: number;
  doi?: string;
  pmid?: string;
  url?: string;
  citationText: string;
  sourceVersion?: string;
  accessedAt?: string;
  supportedClaims: readonly CalculatorEvidenceClaim[];
  verificationStatus: CalculatorEvidenceVerificationStatus;
  verifiedAt?: string;
  notes?: string;
}

export interface CalculatorSourceVerification {
  formulaTranscriptionVerified: boolean;
  unitsVerified: boolean;
  boundaryRulesVerified: boolean;
  referenceFixturesVerified: boolean;
  sourceConsistencyVerified: boolean;
  lastVerifiedAt?: string;
  verifiedByRole?: "code_review" | "clinical_reviewer";
  conflictNote?: string;
}

export interface CalculatorReferenceFixture {
  fixtureId: string;
  methodKey: string;
  variantKey?: string;
  implementationVersion: string;
  sourceEvidenceId: string;
  fixtureKind: "clinical_reference" | "synthetic";
  rawInputs: Record<string, unknown>;
  enteredUnits?: Record<string, string>;
  normalizedInputs: Record<string, unknown>;
  expectedRawOutput: number | null;
  acceptedTolerance: number;
  expectedClassification?: string;
  notes?: string;
}

export interface CalculatorEvidenceProfile {
  primaryEvidenceId?: string;
  sourceVersion?: string;
  records: readonly CalculatorEvidenceRecord[];
  fixtures: readonly CalculatorReferenceFixture[];
  verification: CalculatorSourceVerification;
}

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
  primaryEvidenceId?: string;
  sourceVersion?: string;
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
  /** Bound by CalculatorMethodRegistry; implementation code cannot receive it from Admin input. */
  evidence?: CalculatorEvidenceProfile;
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
  primaryEvidenceId?: string;
  sourceVersion?: string;
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
