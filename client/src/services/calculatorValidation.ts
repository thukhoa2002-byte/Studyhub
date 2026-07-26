import { calculatorRegistry, getCalculatorTestCases, runCalculatorTestCases } from "../modules/calculators/engine.ts";
import { isSupportedCalculatorImplementationKey } from "../modules/calculators/platformRegistry.ts";
import { calculatorMethodRegistry } from "../modules/calculators/methodRegistry.ts";
import { isEvidencePublishable } from "../modules/calculators/evidenceRegistry.ts";
import type { DatabaseCalculator, DatabaseCalculatorStatus, CalculatorGuidelineReferenceRow, CalculatorGuidelineRelationType } from "../modules/calculators/databaseTypes.ts";
import { calculatorGuidelineRelationTypes } from "../modules/calculators/databaseTypes.ts";
import { databaseCalculatorToDefinition } from "./calculatorDatabaseAdapter.ts";
import { isLegacyCalculatorMode, registryImplementationFor } from "./calculatorConfigurationMode.ts";

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

const calculatorStatusTransitions: Record<DatabaseCalculatorStatus, DatabaseCalculatorStatus[]> = {
  draft: ["draft", "in_review", "published"],
  in_review: ["in_review", "reviewed", "draft", "published"],
  reviewed: ["reviewed", "published", "in_review", "draft"],
  published: ["published", "archived"],
  archived: ["archived", "draft", "published"],
};

export function validateCalculatorStatusTransition(from: DatabaseCalculatorStatus, to: DatabaseCalculatorStatus): string[] {
  return calculatorStatusTransitions[from].includes(to) ? [] : [`Không thể chuyển trạng thái Calculator từ ${from} sang ${to}.`];
}

export interface CalculatorPublishCheck {
  errors: string[];
  warnings: string[];
  canPublish: boolean;
}

const requiredHandlerInputs: Record<string, string[]> = {
  bmi: ["weightKg", "heightCm"],
  "cockcroft-gault": ["age", "sex", "weightKg", "creatinineMgDl"],
  "curb-65": ["confusion", "ureaMmolL", "respiratoryRate", "lowBloodPressure", "age65"],
};

type CalculatorConfigurationRecord = Pick<DatabaseCalculator, "calculator_type" | "handler_key" | "input_fields" | "scoring_rules">
  & Partial<Pick<DatabaseCalculator, "formula_variables" | "calculator_topic_key" | "default_method_key" | "enabled_method_keys" | "calculation_version">>;

export function validateCalculatorConfiguration(record: CalculatorConfigurationRecord): string[] {
  const errors: string[] = [];
  const topicKey = record.calculator_topic_key?.trim() || "";
  const legacyMode = isLegacyCalculatorMode(record.formula_variables || []);

  if (topicKey && legacyMode) errors.push("Calculator Registry và chế độ legacy không thể cùng tồn tại.");
  if (topicKey && record.handler_key) errors.push("Calculator Registry không được lưu handler legacy.");
  if (!topicKey && !legacyMode) errors.push("Hãy chọn Calculator Topic hoặc xác nhận đây là calculator legacy.");

  if (!topicKey) {
    if (legacyMode && !record.handler_key && (!Array.isArray(record.scoring_rules) || record.scoring_rules.length === 0)) errors.push("Calculator legacy cần handler hoặc scoring rules JSON.");
    return errors;
  }

  const topic = calculatorMethodRegistry.getTopic(topicKey);
  if (!topic) return [...errors, "Calculator topic key chưa được đăng ký trong Calculator Registry."];
  const defaultMethodKey = record.default_method_key?.trim() || "";
  const enabledMethodKeys = Array.isArray(record.enabled_method_keys) ? record.enabled_method_keys : [];
  if (!defaultMethodKey) errors.push("Calculator theo topic phải chọn method mặc định.");
  if (defaultMethodKey && !enabledMethodKeys.includes(defaultMethodKey)) errors.push("Method mặc định phải nằm trong danh sách method được bật.");

  for (const methodKey of enabledMethodKeys) {
    const implementation = registryImplementationFor(topicKey, methodKey, record.calculation_version);
    if (!implementation) { errors.push(`Method ${methodKey} chưa được đăng ký.`); continue; }
    if (implementation.status === "retired") errors.push(`Method ${methodKey} đã retired và không thể dùng cho calculator mới.`);
  }

  return errors;
}

export function validateCalculatorPublish(
  record: Pick<DatabaseCalculator, "slug" | "name" | "calculator_type" | "handler_key" | "input_fields" | "scoring_rules" | "source_verified" | "version">
  & Partial<Pick<DatabaseCalculator, "result_definitions" | "evidence_references" | "formula_variables" | "calculator_topic_key" | "default_method_key" | "enabled_method_keys" | "comparison_enabled" | "calculation_version">>,
): CalculatorPublishCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  errors.push(...validateCalculatorSlug(record.slug));
  if (!text(record.name?.vi) && !text(record.name?.en)) errors.push("Calculator phải có tên tiếng Việt hoặc tiếng Anh.");
  if (!record.version?.trim()) errors.push("Calculator phải có version.");
  errors.push(...validateCalculatorConfiguration(record));

  const topicKey = record.calculator_topic_key?.trim() || "";
  if (topicKey) {
    const implementation = registryImplementationFor(topicKey, record.default_method_key, record.calculation_version);
    if (!implementation) return { errors, warnings, canPublish: false };
    if (implementation.status === "draft") errors.push("Method mặc định đang là bản nháp.");
    if (implementation.status === "retired") errors.push("Method mặc định đã retired.");
    if (implementation.status === "deprecated") errors.push("Method deprecated không được chọn làm method mặc định.");
    if (!implementation.source.verified || implementation.formulaVersion === "source_required") errors.push("Method mặc định chưa được xác minh nguồn công thức.");
    errors.push(...isEvidencePublishable(calculatorMethodRegistry.evidenceFor(implementation)));
    const fixtures = calculatorMethodRegistry.evidenceFor(implementation).fixtures.filter((item) => item.fixtureKind === "clinical_reference");
    if (fixtures.length === 0) errors.push("Method mặc định chưa có clinical reference fixture.");
    for (const fixture of fixtures) {
      try {
        const result = calculatorMethodRegistry.calculate(topicKey, implementation.methodKey, fixture.rawInputs, implementation.variantKey, implementation.implementationVersion);
        if (result.primary.rawValue === null || fixture.expectedRawOutput === null || Math.abs(result.primary.rawValue - fixture.expectedRawOutput) > fixture.acceptedTolerance) errors.push(`Clinical reference fixture ${fixture.fixtureId} không đạt.`);
      } catch { errors.push(`Clinical reference fixture ${fixture.fixtureId} không chạy được.`); }
    }
    return { errors: [...new Set(errors)], warnings, canPublish: errors.length === 0 };
  }

  if (!Array.isArray(record.input_fields) || record.input_fields.length === 0) errors.push("Calculator phải có ít nhất một input field.");
  else {
    for (const field of record.input_fields as Array<Record<string, unknown>>) {
      if (!text(field.id) || !text(field.label) || typeof field.required !== "boolean") errors.push("Mỗi input field phải có id, nhãn và trạng thái bắt buộc.");
      if (field.type === "number" && field.min !== undefined && field.max !== undefined && Number(field.min) > Number(field.max)) errors.push(`Giới hạn min/max của ${text(field.label) || "input"} không hợp lệ.`);
    }
  }
  const configuredInputIds = new Set(Array.isArray(record.input_fields) ? record.input_fields.map((field) => typeof field === "object" && field ? (field as { id?: unknown }).id : "").filter((id): id is string => typeof id === "string" && id.length > 0) : []);
  for (const requiredInput of requiredHandlerInputs[record.handler_key || ""] || []) {
    if (!configuredInputIds.has(requiredInput)) errors.push(`Calculator thiếu input bắt buộc cho handler: ${requiredInput}.`);
  }
  if (record.calculator_type === "equation" && (!record.handler_key || (!Object.hasOwn(calculatorRegistry, record.handler_key) && !isSupportedCalculatorImplementationKey(record.handler_key)))) errors.push("Equation phải có handlerKey hoặc methodKey hợp lệ trong Calculator registry.");
  if (["score", "criteria", "algorithm"].includes(record.calculator_type) && (!Array.isArray(record.scoring_rules) || record.scoring_rules.length === 0) && (!record.handler_key || (!Object.hasOwn(calculatorRegistry, record.handler_key) && !isSupportedCalculatorImplementationKey(record.handler_key)))) errors.push("Calculator dạng điểm, tiêu chí hoặc thuật toán phải có scoring rules hoặc method hợp lệ.");
  if (!Array.isArray(record.result_definitions) || record.result_definitions.length === 0) errors.push("Calculator phải có định nghĩa kết quả và diễn giải.");
  if (!Array.isArray(record.evidence_references) || !record.evidence_references.some((reference) => typeof reference === "string" && reference.trim())) errors.push("Calculator phải có ít nhất một nguồn tham khảo uy tín.");
  const definition = databaseCalculatorToDefinition({ ...record, result_definitions: record.result_definitions || [], evidence_references: record.evidence_references || [], formula_variables: record.formula_variables || [], id: "validation", owner_id: null, short_name: "", description: { vi: "", en: "" }, purpose: { vi: "", en: "" }, specialty_id: null, category_id: null, calculation_mode: "automatic", formula_display: { vi: "", en: "" }, when_to_use: { vi: [], en: [] }, when_not_to_use: { vi: [], en: [] }, limitations: { vi: [], en: [] }, warnings: { vi: [], en: [] }, calculation_version: record.version || "1.0.0", content_revision: 1, status: "draft", reviewed_by: null, reviewed_at: null, published_by: null, published_at: null, archived_by: null, archived_at: null, created_at: "", updated_at: "" });
  if (getCalculatorTestCases(definition).length === 0) errors.push("Calculator phải có bộ ca kiểm thử lâm sàng.");
  else if (runCalculatorTestCases(definition).some((testCase) => !testCase.pass)) errors.push("Calculator còn ca kiểm thử lâm sàng không đạt.");
  if (!record.source_verified) errors.push("Calculator legacy chưa được xác minh nguồn.");
  if (record.handler_key) {
    const legacyImplementations = calculatorMethodRegistry.listTopics()
      .flatMap((topic) => calculatorMethodRegistry.listMethods(topic.topicKey, true))
      .filter((item) => item.methodKey === record.handler_key);
    if (legacyImplementations.length > 0 && legacyImplementations.every((item) => item.status === "draft" || !item.source.verified || isEvidencePublishable(calculatorMethodRegistry.evidenceFor(item)).length > 0)) errors.push(`Method ${record.handler_key} chưa có nguồn evidence hoặc chưa sẵn sàng xuất bản.`);
    if (legacyImplementations.length > 0 && legacyImplementations.every((item) => item.status === "retired")) errors.push(`Method ${record.handler_key} đã retired.`);
  }
  if (record.handler_key && !Object.hasOwn(calculatorRegistry, record.handler_key) && !isSupportedCalculatorImplementationKey(record.handler_key)) warnings.push("handlerKey chưa có trong registry hiện tại.");
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
  recommendation?: { id: string; guideline_id: string; section_id: string | null } | null;
}

export function validateGuidelineReferenceTargets(
  input: Pick<CalculatorGuidelineReferenceRow, "guideline_id" | "section_id" | "recommendation_id">,
  targets: GuidelineReferenceTargets,
): string[] {
  const errors: string[] = [];
  if (input.section_id && (!targets.section || targets.section.guideline_id !== input.guideline_id)) errors.push("section_id không thuộc guideline_id.");
  if (input.recommendation_id && (!targets.recommendation || targets.recommendation.guideline_id !== input.guideline_id)) errors.push("recommendation_id không thuộc guideline_id.");
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
