import type { LocalizedText } from "../../types/language";

export type DatabaseCalculatorStatus = "draft" | "in_review" | "reviewed" | "published" | "archived";
export type DatabaseCalculatorType = "score" | "equation" | "criteria" | "algorithm";
export type CalculationMode = "automatic" | "submit";

export interface DatabaseCalculator {
  id: string;
  owner_id: string | null;
  slug: string;
  short_name: string;
  name: LocalizedText;
  description: LocalizedText;
  purpose: LocalizedText;
  calculator_type: DatabaseCalculatorType;
  specialty_id: string | null;
  category_id: string | null;
  handler_key: string | null;
  calculation_mode: CalculationMode;
  input_fields: unknown[];
  scoring_rules: unknown[];
  formula_display: LocalizedText;
  formula_variables: unknown[];
  result_definitions: unknown[];
  when_to_use: { vi: string[]; en: string[] };
  when_not_to_use: { vi: string[]; en: string[] };
  limitations: { vi: string[]; en: string[] };
  warnings: { vi: string[]; en: string[] };
  evidence_references: unknown[];
  version: string;
  calculation_version: string;
  content_revision: number;
  status: DatabaseCalculatorStatus;
  source_verified: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_by: string | null;
  published_at: string | null;
  archived_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export const calculatorGuidelineRelationTypes = [
  "recommended-use",
  "risk-assessment",
  "diagnostic-support",
  "dose-support",
  "monitoring",
  "related",
] as const;

export type CalculatorGuidelineRelationType = typeof calculatorGuidelineRelationTypes[number];

export interface CalculatorGuidelineReferenceRow {
  id: string;
  calculator_id: string;
  guideline_id: string;
  section_id: string | null;
  recommendation_id: string | null;
  relation_type: CalculatorGuidelineRelationType;
  context: LocalizedText;
  required: boolean;
  display_order: number;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuidelineSectionTarget {
  id: string;
  guideline_id: string;
}

export interface GuidelineDocumentTarget {
  id: string;
  visibility: "private" | "shared";
}

export interface GuidelineRecommendationTarget {
  id: string;
  document_id: string;
  section_id: string | null;
  status: "draft" | "reviewed";
}
