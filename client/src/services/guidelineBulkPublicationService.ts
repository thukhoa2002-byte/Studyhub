import { getGuidelineCoreDocument } from "./guidelineRepository.ts";
import { listGuidelineRecommendations } from "./guidelineRecommendationRepository.ts";
import { listGuidelineSourceDocuments } from "./guidelineSourceDocumentRepository.ts";
import { getGuidelineRecommendationGroup, getGuidelineRecommendationTable, updateGuidelineRecommendationGroup, updateGuidelineRecommendationTable } from "./guidelineRecommendationTableRepository.ts";
import { publishGuideline, publishGuidelineRecommendation } from "./guidelinePublicationService.ts";
import { validateRecommendationForPublication } from "./guidelineValidation.ts";

export type BulkPublicationResult = {
  publishedSectionIds: string[];
  publishedRecommendationIds: string[];
  alreadyPublishedRecommendationIds: string[];
  blocked: Array<{ id: string; title: string; reasons: string[] }>;
};


export async function publishSectionEligibleContent(sectionId: string, _actorId: string): Promise<BulkPublicationResult> {
  // Legacy compatibility only. Section is no longer a primary publication
  // scope; callers should use table or group publication.
  throw new Error(`Mục nguồn ${sectionId} chỉ là metadata. Hãy xuất bản theo Bảng khuyến cáo.`);
}

export async function publishGuidelineEligibleContent(guidelineId: string, actorId: string): Promise<BulkPublicationResult> {
  return publishScopedEligibleContent(guidelineId, actorId, null);
}

export async function publishRecommendationTableEligibleContent(tableId: string, actorId: string): Promise<BulkPublicationResult> {
  const table = await getGuidelineRecommendationTable(tableId);
  if (!table) throw new Error("Không tìm thấy Bảng khuyến cáo.");
  if (table.status === "archived") throw new Error("Bảng khuyến cáo đã lưu trữ.");
  if (!table.is_complete) {
    return { publishedSectionIds: [], publishedRecommendationIds: [], alreadyPublishedRecommendationIds: [], blocked: [{ id: table.id, title: table.title_vi || table.title || "Bảng khuyến cáo", reasons: ["Bảng khuyến cáo chưa được đánh dấu hoàn chỉnh."] }] };
  }
  const result = await publishScopedEligibleContent(table.guideline_id, actorId, table.id);
  await updateGuidelineRecommendationTable(table.id, { status: "published" });
  return result;
}

export async function publishRecommendationGroupEligibleContent(groupId: string, actorId: string): Promise<BulkPublicationResult> {
  const group = await getGuidelineRecommendationGroup(groupId);
  if (!group) throw new Error("Không tìm thấy Mục khuyến cáo.");
  if (group.status === "archived") throw new Error("Mục khuyến cáo đã lưu trữ.");
  const result = await publishScopedEligibleContent(group.guideline_id, actorId, group.recommendation_table_id, group.id);
  await updateGuidelineRecommendationGroup(group.id, { status: "published" });
  return result;
}

async function publishScopedEligibleContent(guidelineId: string, actorId: string, recommendationTableId: string | null = null, recommendationGroupId: string | null = null): Promise<BulkPublicationResult> {
  const [document, recommendations, sourceDocuments] = await Promise.all([
    getGuidelineCoreDocument(guidelineId), listGuidelineRecommendations(guidelineId), listGuidelineSourceDocuments(guidelineId),
  ]);
  if (!document) throw new Error("Guideline không tồn tại.");
  const result: BulkPublicationResult = { publishedSectionIds: [], publishedRecommendationIds: [], alreadyPublishedRecommendationIds: [], blocked: [] };
  // Table-first workflow promotes the parent Guideline, then only the rows
  // within the requested table/group. Source Sections are never published.
  if (document.status !== "published") await publishGuideline(guidelineId, actorId);
  const currentDocument = document.status === "published" ? document : await getGuidelineCoreDocument(guidelineId);
  if (!currentDocument) throw new Error("Không thể đọc Guideline sau khi xuất bản.");
  for (const recommendation of recommendations.filter((item) => (!recommendationTableId || item.recommendation_table_id === recommendationTableId) && (!recommendationGroupId || item.recommendation_group_id === recommendationGroupId))) {
    if (recommendation.status === "published") { result.alreadyPublishedRecommendationIds.push(recommendation.id); continue; }
    if (recommendation.status !== "draft") { result.blocked.push({ id: recommendation.id, title: recommendation.title, reasons: ["Khuyến cáo không còn ở trạng thái bản nháp."] }); continue; }
    const errors = validateRecommendationForPublication(recommendation, currentDocument, null, sourceDocuments);
    if (errors.length) { result.blocked.push({ id: recommendation.id, title: recommendation.title, reasons: errors }); continue; }
    try { await publishGuidelineRecommendation(recommendation.id, actorId); result.publishedRecommendationIds.push(recommendation.id); }
    catch (error) { result.blocked.push({ id: recommendation.id, title: recommendation.title, reasons: [error instanceof Error ? error.message : "Không thể xuất bản khuyến cáo."] }); }
  }
  return result;
}
