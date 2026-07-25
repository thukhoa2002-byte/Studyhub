import { getGuidelineCoreDocument } from "./guidelineRepository.ts";
import { getGuidelineSection, setGuidelineSectionStatus } from "./guidelineSectionRepository.ts";
import { getGuidelineRecommendation } from "./guidelineRecommendationRepository.ts";
import { archiveGuideline, archiveGuidelineRecommendation, publishGuideline, publishGuidelineRecommendation, publishGuidelineSection, setGuidelineRecommendationStatus, setGuidelineStatus } from "./guidelinePublicationService.ts";
import { requireGuidelineClient } from "./guidelineRepository.ts";

async function count(table: string, column: string, id: string): Promise<number> {
  const { count: result, error } = await requireGuidelineClient().from(table).select("id", { count: "exact", head: true }).eq(column, id);
  if (error) throw error;
  return result || 0;
}

async function remove(table: string, id: string): Promise<void> {
  const { error } = await requireGuidelineClient().from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function restoreGuidelineToDraft(id: string, actorId: string) { return setGuidelineStatus(id, "draft", actorId); }
export async function republishGuideline(id: string, actorId: string) { return publishGuideline(id, actorId); }
export async function restoreGuidelineRecommendationToDraft(id: string, actorId: string) { return setGuidelineRecommendationStatus(id, "draft", actorId); }
export async function republishGuidelineRecommendation(id: string, actorId: string) { return publishGuidelineRecommendation(id, actorId); }

export async function getGuidelineDeleteBlockers(id: string): Promise<string[]> {
  const [sections, recommendations, sources, entries, calculatorReferences] = await Promise.all([
    count("guideline_sections", "guideline_id", id), count("guideline_recommendations", "guideline_id", id), count("guideline_source_documents", "guideline_id", id), count("guideline_entries", "document_id", id), count("calculator_guideline_references", "guideline_id", id),
  ]);
  return [
    sections && `${sections} section đang phụ thuộc.`, recommendations && `${recommendations} khuyến cáo đang phụ thuộc.`, sources && `${sources} source document đang phụ thuộc.`, entries && `${entries} dữ liệu legacy guideline_entries đang phụ thuộc.`, calculatorReferences && `${calculatorReferences} liên kết Calculator ↔ Guideline đang phụ thuộc.`,
  ].filter(Boolean) as string[];
}

export async function deleteGuidelinePermanently(id: string): Promise<void> {
  const document = await getGuidelineCoreDocument(id); if (!document) return;
  if (document.status === "published") throw new Error("Guideline đã xuất bản phải được lưu trữ trước khi xóa.");
  if (document.status !== "draft" && document.status !== "archived") throw new Error("Chỉ Guideline bản nháp hoặc đã lưu trữ mới được xóa vĩnh viễn.");
  const blockers = await getGuidelineDeleteBlockers(id); if (blockers.length) throw new Error(`${blockers.join(" ")} Hãy gỡ dependency trước khi xóa.`);
  await remove("guideline_documents", id);
}

export async function restoreGuidelineSectionToDraft(id: string) {
  const section = await getGuidelineSection(id); if (!section) throw new Error("Section không tồn tại.");
  if (section.status !== "archived") throw new Error("Chỉ section đã lưu trữ mới có thể khôi phục.");
  return setGuidelineSectionStatus(id, "draft");
}
export async function republishGuidelineSection(id: string) { return publishGuidelineSection(id); }
export async function getGuidelineSectionDeleteBlockers(id: string): Promise<string[]> {
  const [children, recommendations, entries, calculatorReferences] = await Promise.all([
    count("guideline_sections", "parent_section_id", id), count("guideline_recommendations", "section_id", id), count("guideline_entries", "section_id", id), count("calculator_guideline_references", "section_id", id),
  ]);
  return [children && `${children} section con đang phụ thuộc.`, recommendations && `${recommendations} khuyến cáo đang phụ thuộc.`, entries && `${entries} dữ liệu legacy đang phụ thuộc.`, calculatorReferences && `${calculatorReferences} liên kết Calculator ↔ Guideline đang phụ thuộc.`].filter(Boolean) as string[];
}
export async function deleteGuidelineSectionPermanently(id: string): Promise<void> {
  const section = await getGuidelineSection(id); if (!section) return;
  if (section.status === "published") throw new Error("Section đã xuất bản phải được lưu trữ trước khi xóa.");
  if (section.status !== "draft" && section.status !== "archived") throw new Error("Chỉ section bản nháp hoặc đã lưu trữ mới được xóa vĩnh viễn.");
  const blockers = await getGuidelineSectionDeleteBlockers(id); if (blockers.length) throw new Error(`${blockers.join(" ")} Hãy gỡ dependency trước khi xóa.`);
  await remove("guideline_sections", id);
}

export async function getGuidelineRecommendationDeleteBlockers(id: string): Promise<string[]> {
  const [drugRelations, calculatorRelations, guidelineReferences] = await Promise.all([
    count("recommendation_drug_references", "recommendation_id", id), count("recommendation_calculator_references", "recommendation_id", id), count("calculator_guideline_references", "recommendation_id", id),
  ]);
  return [drugRelations && `${drugRelations} liên kết Recommendation ↔ Thuốc đang phụ thuộc.`, calculatorRelations && `${calculatorRelations} liên kết Recommendation ↔ Calculator đang phụ thuộc.`, guidelineReferences && `${guidelineReferences} liên kết Calculator ↔ Guideline đang phụ thuộc.`].filter(Boolean) as string[];
}
export async function deleteGuidelineRecommendationPermanently(id: string): Promise<void> {
  const recommendation = await getGuidelineRecommendation(id); if (!recommendation) return;
  if (recommendation.status === "published") throw new Error("Khuyến cáo đã xuất bản phải được lưu trữ trước khi xóa.");
  if (recommendation.status !== "draft" && recommendation.status !== "archived") throw new Error("Chỉ khuyến cáo bản nháp hoặc đã lưu trữ mới được xóa vĩnh viễn.");
  const blockers = await getGuidelineRecommendationDeleteBlockers(id); if (blockers.length) throw new Error(`${blockers.join(" ")} Hãy gỡ dependency trước khi xóa.`);
  await remove("guideline_recommendations", id);
}

export { archiveGuideline, archiveGuidelineRecommendation };
