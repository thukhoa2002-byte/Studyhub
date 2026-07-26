import { getGuidelineCoreDocument } from "./guidelineRepository.ts";
import { getGuidelineSection, listGuidelineSections, setGuidelineSectionStatus } from "./guidelineSectionRepository.ts";
import { listGuidelineRecommendations } from "./guidelineRecommendationRepository.ts";
import { listGuidelineSourceDocuments } from "./guidelineSourceDocumentRepository.ts";
import { publishGuideline, publishGuidelineRecommendation } from "./guidelinePublicationService.ts";
import { validateRecommendationForPublication } from "./guidelineValidation.ts";
import { bulkPublicationOrder } from "./guidelineBulkPublicationPolicy.ts";

export { summarizeSectionBulkPublication } from "./guidelineBulkPublicationPolicy.ts";

export type BulkPublicationResult = {
  publishedSectionIds: string[];
  publishedRecommendationIds: string[];
  alreadyPublishedRecommendationIds: string[];
  blocked: Array<{ id: string; title: string; reasons: string[] }>;
};


export async function publishSectionEligibleContent(sectionId: string, actorId: string): Promise<BulkPublicationResult> {
  const section = await getGuidelineSection(sectionId);
  if (!section) throw new Error("Không tìm thấy section để xuất bản hàng loạt.");
  return publishScopedEligibleContent(section.guideline_id, actorId, sectionId);
}

export async function publishGuidelineEligibleContent(guidelineId: string, actorId: string): Promise<BulkPublicationResult> {
  return publishScopedEligibleContent(guidelineId, actorId, null);
}

async function publishScopedEligibleContent(guidelineId: string, actorId: string, sectionId: string | null): Promise<BulkPublicationResult> {
  const [document, sections, recommendations, sourceDocuments] = await Promise.all([
    getGuidelineCoreDocument(guidelineId), listGuidelineSections(guidelineId), listGuidelineRecommendations(guidelineId), listGuidelineSourceDocuments(guidelineId),
  ]);
  if (!document) throw new Error("Guideline không tồn tại.");
  const targetSections = bulkPublicationOrder(sections).map((id) => sections.find((item) => item.id === id)!).filter((item) => !sectionId || item.id === sectionId);
  const result: BulkPublicationResult = { publishedSectionIds: [], publishedRecommendationIds: [], alreadyPublishedRecommendationIds: [], blocked: [] };

  // Sections must exist before their recommendations. Draft sections can be published while the Guideline is private; the document is published immediately after an eligible section exists.
  for (const section of targetSections) {
    if (section.status === "published") continue;
    if (section.status === "archived") { result.blocked.push({ id: section.id, title: section.title, reasons: ["Section đã lưu trữ."] }); continue; }
    try { await setGuidelineSectionStatus(section.id, "published"); result.publishedSectionIds.push(section.id); }
    catch (error) { result.blocked.push({ id: section.id, title: section.title, reasons: [error instanceof Error ? error.message : "Không thể xuất bản section."] }); }
  }

  // A Recommendation cannot become public before its parent Guideline. Publishing
  // a scoped Section therefore promotes the parent only after the section passed.
  if (document.status !== "published") await publishGuideline(guidelineId, actorId);
  const currentDocument = document.status === "published" ? document : await getGuidelineCoreDocument(guidelineId);
  if (!currentDocument) throw new Error("Không thể đọc Guideline sau khi xuất bản.");
  const currentSections = await listGuidelineSections(guidelineId);
  for (const recommendation of recommendations.filter((item) => !sectionId || item.section_id === sectionId)) {
    if (recommendation.status === "published") { result.alreadyPublishedRecommendationIds.push(recommendation.id); continue; }
    if (recommendation.status !== "draft") { result.blocked.push({ id: recommendation.id, title: recommendation.title, reasons: ["Khuyến cáo không còn ở trạng thái bản nháp."] }); continue; }
    const owner = currentSections.find((item) => item.id === recommendation.section_id) || null;
    const errors = validateRecommendationForPublication(recommendation, currentDocument, owner, sourceDocuments);
    if (errors.length) { result.blocked.push({ id: recommendation.id, title: recommendation.title, reasons: errors }); continue; }
    try { await publishGuidelineRecommendation(recommendation.id, actorId); result.publishedRecommendationIds.push(recommendation.id); }
    catch (error) { result.blocked.push({ id: recommendation.id, title: recommendation.title, reasons: [error instanceof Error ? error.message : "Không thể xuất bản khuyến cáo."] }); }
  }
  return result;
}
