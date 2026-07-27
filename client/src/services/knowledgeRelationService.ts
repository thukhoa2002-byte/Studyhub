import { getCalculatorRecord } from "./calculatorDatabaseService.ts";
import { getDrugById } from "./drugDatabaseService.ts";
import { getGuidelineRecommendation, getGuidelineRecommendationsByIds } from "./guidelineRecommendationRepository.ts";
import { getGuidelineSectionsByIds } from "./guidelineSectionRepository.ts";
import { getGuidelineRecommendationTable, getGuidelineRecommendationTablesByIds } from "./guidelineRecommendationTableRepository.ts";
import { getGuidelineCoreDocument, getGuidelineCoreDocumentsByIds } from "./guidelineRepository.ts";
import { guidelineCoreSlug } from "./guidelineCorePublicMapper.ts";
import {
  knowledgeRelationRepository,
  type CalculatorRecommendationRelationType,
  type DrugRecommendationRelationType,
  type RecommendationCalculatorRelation,
  type RecommendationDrugRelation,
  type RelationMetadata,
} from "./knowledgeRelationRepository.ts";
import type { GuidelineCoreDocument, GuidelineRecommendationRecord, GuidelineRecommendationTableRecord, GuidelineSectionRecord } from "./guidelineCoreTypes.ts";
import { hasActiveDuplicateRelation, validateRelationMetadata } from "./knowledgeRelationValidation.ts";

export const drugRelationTypes: DrugRecommendationRelationType[] = ["recommended", "alternative", "contraindicated", "caution", "dose_adjustment", "monitoring", "interaction", "mentioned", "supporting_therapy"];
export const calculatorRelationTypes: CalculatorRecommendationRelationType[] = ["risk_stratification", "diagnostic_support", "severity_assessment", "treatment_decision", "dose_calculation", "prognosis", "monitoring", "classification", "mentioned"];

export type RelationContext = Pick<RelationMetadata, "context_text" | "source_location" | "display_order">;
export interface RecommendationLocation {
  recommendation: GuidelineRecommendationRecord;
  guideline: GuidelineCoreDocument;
  table: GuidelineRecommendationTableRecord | null;
  section: GuidelineSectionRecord | null;
  publicEligible: boolean;
}

function normalized(metadata: Partial<RelationContext>): RelationContext {
  return { context_text: metadata.context_text?.trim() || "", source_location: metadata.source_location?.trim() || "", display_order: Math.max(0, Number(metadata.display_order || 0)) };
}

export { hasActiveDuplicateRelation, validateRelationMetadata } from "./knowledgeRelationValidation.ts";

async function validateRecommendationTarget(recommendationId: string): Promise<void> {
  const recommendation = await getGuidelineRecommendation(recommendationId);
  if (!recommendation || recommendation.status === "archived") throw new Error("Khuyến cáo không còn khả dụng.");
  const guideline = await getGuidelineCoreDocument(recommendation.guideline_id);
  if (!guideline || guideline.status === "archived") throw new Error("Guideline của khuyến cáo không còn khả dụng.");
  if (!recommendation.recommendation_table_id) throw new Error("Khuyến cáo chưa thuộc Bảng khuyến cáo.");
  const table = await getGuidelineRecommendationTable(recommendation.recommendation_table_id);
  if (!table || table.guideline_id !== recommendation.guideline_id || table.status === "archived") throw new Error("Bảng khuyến cáo của khuyến cáo không hợp lệ.");
}

export async function listRecommendationRelations(recommendationId: string) {
  const [drugs, calculators] = await Promise.all([
    knowledgeRelationRepository.listDrugRelationsForRecommendation(recommendationId),
    knowledgeRelationRepository.listCalculatorRelationsForRecommendation(recommendationId),
  ]);
  return { drugs, calculators };
}

export async function createRecommendationDrugRelation(actorId: string, input: { recommendationId: string; drugId: string; relationType: DrugRecommendationRelationType } & Partial<RelationContext>): Promise<RecommendationDrugRelation> {
  const metadataErrors = validateRelationMetadata(input); if (metadataErrors.length) throw new Error(metadataErrors.join(" "));
  await validateRecommendationTarget(input.recommendationId);
  const drug = await getDrugById(input.drugId);
  if (!drug || drug.status === "archived") throw new Error("Thuốc không còn khả dụng.");
  const existing = await knowledgeRelationRepository.listDrugRelationsForRecommendation(input.recommendationId);
  if (hasActiveDuplicateRelation(existing, "drug_id", input.drugId, input.relationType)) throw new Error("Liên kết Recommendation ↔ Thuốc đã tồn tại.");
  return knowledgeRelationRepository.createDrugRelation({ recommendation_id: input.recommendationId, drug_id: input.drugId, relation_type: input.relationType, ...normalized(input), status: "active", created_by: actorId });
}

export async function createRecommendationCalculatorRelation(actorId: string, input: { recommendationId: string; calculatorId: string; relationType: CalculatorRecommendationRelationType } & Partial<RelationContext>): Promise<RecommendationCalculatorRelation> {
  const metadataErrors = validateRelationMetadata(input); if (metadataErrors.length) throw new Error(metadataErrors.join(" "));
  await validateRecommendationTarget(input.recommendationId);
  const calculator = await getCalculatorRecord(input.calculatorId);
  if (!calculator || calculator.status === "archived") throw new Error("Calculator không còn khả dụng.");
  const existing = await knowledgeRelationRepository.listCalculatorRelationsForRecommendation(input.recommendationId);
  if (hasActiveDuplicateRelation(existing, "calculator_id", input.calculatorId, input.relationType)) throw new Error("Liên kết Recommendation ↔ Calculator đã tồn tại.");
  return knowledgeRelationRepository.createCalculatorRelation({ recommendation_id: input.recommendationId, calculator_id: input.calculatorId, relation_type: input.relationType, ...normalized(input), status: "active", created_by: actorId });
}

export async function updateRecommendationDrugRelation(id: string, patch: Partial<RelationMetadata & Pick<RecommendationDrugRelation, "relation_type">>) { return knowledgeRelationRepository.updateDrugRelation(id, patch); }
export async function updateRecommendationCalculatorRelation(id: string, patch: Partial<RelationMetadata & Pick<RecommendationCalculatorRelation, "relation_type">>) { return knowledgeRelationRepository.updateCalculatorRelation(id, patch); }
export async function deleteRecommendationDrugRelation(id: string) { return knowledgeRelationRepository.deleteDrugRelation(id); }
export async function deleteRecommendationCalculatorRelation(id: string) { return knowledgeRelationRepository.deleteCalculatorRelation(id); }

export async function listDrugRecommendationRelations(drugId: string) { return knowledgeRelationRepository.listDrugRelationsForDrug(drugId); }
export async function listCalculatorRecommendationRelations(calculatorId: string) { return knowledgeRelationRepository.listCalculatorRelationsForCalculator(calculatorId); }

export async function resolveRecommendationLocations(recommendationIds: string[]) {
  const uniqueIds = [...new Set(recommendationIds)];
  const recommendations = await getGuidelineRecommendationsByIds(uniqueIds);
  const [guidelines, tables, sections] = await Promise.all([
    getGuidelineCoreDocumentsByIds(recommendations.map((item) => item.guideline_id)),
    getGuidelineRecommendationTablesByIds(recommendations.flatMap((item) => item.recommendation_table_id ? [item.recommendation_table_id] : [])),
    getGuidelineSectionsByIds(recommendations.flatMap((item) => item.section_id ? [item.section_id] : [])),
  ]);
  const guidelineById = new Map(guidelines.map((item) => [item.id, item]));
  const tableById = new Map(tables.map((item) => [item.id, item]));
  const sectionById = new Map(sections.map((item) => [item.id, item]));
  const items = recommendations.map((recommendation) => {
    const guideline = guidelineById.get(recommendation.guideline_id);
    if (!guideline) return null;
    const table = recommendation.recommendation_table_id ? tableById.get(recommendation.recommendation_table_id) || null : null;
    const section = recommendation.section_id ? sectionById.get(recommendation.section_id) || null : null;
    const publicEligible = guideline.status === "published"
      && table?.status === "published"
      && table.is_complete
      && recommendation.status === "published"
      && recommendation.verification_status === "verified";
    return { recommendation, guideline, table, section, publicEligible };
  });
  return items.filter((item): item is RecommendationLocation => item !== null);
}

export function recommendationLocationPreview(location: RecommendationLocation) {
  const recommendationTitle = location.recommendation.title || location.recommendation.recommendation_text_vi || location.recommendation.recommendation_text_original || "Khuyến cáo";
  return {
    guidelineId: location.guideline.id,
    guidelineSlug: guidelineCoreSlug(location.guideline),
    guidelineTitle: location.guideline.title || "Guideline",
    tableId: location.table?.id || null,
    tableTitle: location.table?.title_vi || location.table?.title || "Bảng khuyến cáo",
    sectionId: location.section?.id || null,
    sectionTitle: location.section?.title_vi || location.section?.title || "",
    recommendationId: location.recommendation.id,
    recommendationTitle,
    recommendationPreview: location.recommendation.recommendation_text_vi || location.recommendation.recommendation_text_original || "",
    publicEligible: location.publicEligible,
  };
}
