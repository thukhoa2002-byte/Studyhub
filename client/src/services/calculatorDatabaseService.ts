import { hasCalculatorHandler } from "../modules/calculators/engine.ts";
import type { DatabaseCalculator, DatabaseCalculatorStatus, CalculatorGuidelineReferenceRow } from "../modules/calculators/databaseTypes.ts";
import { calculatorRepository, type CalculatorInsert, type CalculatorUpdate } from "./calculatorRepository";
import { isDuplicateGuidelineReference, normalizeCalculatorSlug, validateCalculatorPublish, validateCalculatorSlug, validateGuidelineReferenceInput, validateGuidelineReferenceTargets } from "./calculatorValidation";

function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

type CalculatorDraftInput = Omit<CalculatorInsert, "owner_id" | "status" | "source_verified" | "published_at" | "published_by" | "archived_at" | "archived_by" | "slug"> & { slug?: string };

export async function createCalculatorDraft(ownerId: string, input: CalculatorDraftInput): Promise<DatabaseCalculator> {
  const requestedSlug = text(input.slug) || text(input.name?.vi) || text(input.name?.en) || text(input.short_name);
  const baseSlug = normalizeCalculatorSlug(requestedSlug);
  const slugErrors = validateCalculatorSlug(baseSlug);
  if (slugErrors.length) throw new Error(slugErrors.join(" "));
  let slug = baseSlug;
  let suffix = 2;
  while (await calculatorRepository.findBySlug(slug)) slug = `${baseSlug}-${suffix++}`;
  return calculatorRepository.create({ ...input, slug, owner_id: ownerId, status: "draft", source_verified: false, published_at: null, published_by: null, archived_at: null, archived_by: null });
}

export async function updateCalculatorDraft(id: string, input: CalculatorUpdate): Promise<DatabaseCalculator> {
  const current = await calculatorRepository.findById(id);
  if (!current) throw new Error("Không tìm thấy calculator.");
  if (current.status === "published" || current.published_at) {
    if (input.slug && input.slug !== current.slug) throw new Error("Không được đổi slug trực tiếp sau khi publish.");
  }
  if ("slug" in input) {
    const slugErrors = validateCalculatorSlug(input.slug || "");
    if (slugErrors.length) throw new Error(slugErrors.join(" "));
  }
  return calculatorRepository.update(id, input);
}

export async function publishCalculatorRecord(id: string, publisherId: string): Promise<DatabaseCalculator> {
  const current = await calculatorRepository.findById(id);
  if (!current) throw new Error("Không tìm thấy calculator.");
  const check = validateCalculatorPublish(current);
  if (!check.canPublish) throw new Error(check.errors.join(" "));
  return calculatorRepository.update(id, { status: "published", published_by: publisherId, published_at: new Date().toISOString(), archived_by: null, archived_at: null });
}

export async function archiveCalculatorRecord(id: string, archivedBy: string): Promise<DatabaseCalculator> {
  const current = await calculatorRepository.findById(id);
  if (!current) throw new Error("Không tìm thấy calculator.");
  return calculatorRepository.update(id, { status: "archived", archived_by: archivedBy, archived_at: new Date().toISOString() });
}

export async function deleteCalculatorDraft(id: string): Promise<void> {
  const current = await calculatorRepository.findById(id);
  if (!current) return;
  if (current.status !== "draft" || current.published_at) throw new Error("Chỉ được xóa draft chưa từng publish.");
  await calculatorRepository.deleteDraft(id);
}

export async function listPublicCalculators(): Promise<DatabaseCalculator[]> {
  return calculatorRepository.list({ publicOnly: true });
}

export async function getPublicCalculatorBySlug(slug: string): Promise<DatabaseCalculator | null> {
  return calculatorRepository.findBySlug(slug, true);
}

export async function listPublicCalculatorGuidelineReferences(calculatorId: string): Promise<CalculatorGuidelineReferenceRow[]> {
  return calculatorRepository.listGuidelineReferences(calculatorId, true);
}

export async function listPublicCalculatorReferencesForGuideline(guidelineId: string): Promise<CalculatorGuidelineReferenceRow[]> {
  return calculatorRepository.listPublishedGuidelineReferencesForGuideline(guidelineId);
}

export async function createCalculatorGuidelineReference(input: Omit<CalculatorGuidelineReferenceRow, "id" | "created_at" | "updated_at">): Promise<CalculatorGuidelineReferenceRow> {
  const errors = validateGuidelineReferenceInput(input);
  if (errors.length) throw new Error(errors.join(" "));
  const [section, recommendation] = await Promise.all([
    input.section_id ? calculatorRepository.findGuidelineSection(input.section_id) : Promise.resolve(null),
    input.recommendation_id ? calculatorRepository.findGuidelineRecommendation(input.recommendation_id) : Promise.resolve(null),
  ]);
  const targetErrors = validateGuidelineReferenceTargets(input, { section, recommendation });
  if (targetErrors.length) throw new Error(targetErrors.join(" "));
  const existing = await calculatorRepository.listGuidelineReferences(input.calculator_id);
  if (isDuplicateGuidelineReference(input, existing)) throw new Error("Liên kết calculator-guideline đã tồn tại.");
  return calculatorRepository.createGuidelineReference(input);
}

export { isDuplicateGuidelineReference, normalizeCalculatorSlug, validateCalculatorPublish, validateCalculatorSlug, validateGuidelineReferenceInput, validateGuidelineReferenceTargets } from "./calculatorValidation";
export { hasCalculatorHandler };
export type { DatabaseCalculatorStatus };
