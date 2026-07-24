import { calculatorRegistry } from "../modules/calculators/engine.ts";
import type { DatabaseCalculator, CalculatorGuidelineReferenceRow, CalculatorGuidelineRelationType } from "../modules/calculators/databaseTypes.ts";
import { calculatorGuidelineRelationTypes } from "../modules/calculators/databaseTypes.ts";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeCalculatorSlug(value: string): string {
  return slugify(value);
}

export function validateCalculatorSlug(slug: string): string[] {
  if (!slug) return ["Slug không được để trống."];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return ["Slug chỉ được chứa chữ thường, số và dấu gạch ngang."];
  return [];
}

export interface CalculatorPublishCheck {
  errors: string[];
  warnings: string[];
  canPublish: boolean;
}

export function validateCalculatorPublish(
  record: Pick<DatabaseCalculator, "slug" | "name" | "calculator_type" | "handler_key" | "input_fields" | "scoring_rules" | "source_verified" | "version">,
): CalculatorPublishCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  errors.push(...validateCalculatorSlug(record.slug));
  if (!text(record.name?.vi) && !text(record.name?.en)) errors.push("Calculator phải có tên tiếng Việt hoặc tiếng Anh.");
  if (!record.version?.trim()) errors.push("Calculator phải có version.");
  if (!Array.isArray(record.input_fields) || record.input_fields.length === 0) errors.push("Calculator phải có ít nhất một input field.");
  if (record.calculator_type === "equation" && (!record.handler_key || !Object.hasOwn(calculatorRegistry, record.handler_key))) errors.push("Equation phải có handlerKey hợp lệ trong calculatorRegistry.");
  if (record.calculator_type === "score" && (!Array.isArray(record.scoring_rules) || record.scoring_rules.length === 0)) errors.push("Score calculator phải có scoring rules.");
  if (!record.source_verified) errors.push("Calculator chưa được xác minh nguồn.");
  if (record.handler_key && !Object.hasOwn(calculatorRegistry, record.handler_key)) warnings.push("handlerKey chưa có trong registry hiện tại.");
  return { errors, warnings, canPublish: errors.length === 0 };
}

export function validateGuidelineReferenceInput(
  input: Pick<CalculatorGuidelineReferenceRow, "guideline_id" | "section_id" | "recommendation_id" | "relation_type">,
): string[] {
  const errors: string[] = [];
  if (!input.guideline_id) errors.push("guideline_id là bắt buộc.");
  if (!calculatorGuidelineRelationTypes.includes(input.relation_type as CalculatorGuidelineRelationType)) errors.push("relation_type không hợp lệ.");
  return errors;
}

export interface GuidelineReferenceTargets {
  section?: { id: string; guideline_id: string } | null;
  recommendation?: { id: string; document_id: string; section_id: string | null } | null;
}

export function validateGuidelineReferenceTargets(
  input: Pick<CalculatorGuidelineReferenceRow, "guideline_id" | "section_id" | "recommendation_id">,
  targets: GuidelineReferenceTargets,
): string[] {
  const errors: string[] = [];
  if (input.section_id && (!targets.section || targets.section.guideline_id !== input.guideline_id)) errors.push("section_id không thuộc guideline_id.");
  if (input.recommendation_id && (!targets.recommendation || targets.recommendation.document_id !== input.guideline_id)) errors.push("recommendation_id không thuộc guideline_id.");
  if (input.section_id && input.recommendation_id && targets.recommendation && targets.recommendation.section_id !== input.section_id) errors.push("recommendation_id không thuộc section_id.");
  return errors;
}

export function isDuplicateGuidelineReference(
  input: Pick<CalculatorGuidelineReferenceRow, "calculator_id" | "guideline_id" | "section_id" | "recommendation_id" | "relation_type">,
  existing: Array<Pick<CalculatorGuidelineReferenceRow, "calculator_id" | "guideline_id" | "section_id" | "recommendation_id" | "relation_type">>,
): boolean {
  return existing.some((reference) => (
    reference.calculator_id === input.calculator_id
    && reference.guideline_id === input.guideline_id
    && reference.section_id === input.section_id
    && reference.recommendation_id === input.recommendation_id
    && reference.relation_type === input.relation_type
  ));
}
