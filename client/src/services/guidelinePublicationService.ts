import { getGuidelineCoreDocument, updateGuidelineCoreDocument } from "./guidelineRepository";
import { getGuidelineSection, setGuidelineSectionStatus } from "./guidelineSectionRepository";
import { listGuidelineRecommendations, getGuidelineRecommendation, updateGuidelineRecommendation } from "./guidelineRecommendationRepository";
import { getGuidelineRecommendationTable } from "./guidelineRecommendationTableRepository";
import { listGuidelineSourceDocuments } from "./guidelineSourceDocumentRepository";
import { assertValidGuidelinePublication, assertValidRecommendationPublication, GuidelineValidationError, validateGuidelineStatusTransition, validateRecommendationStatusTransition } from "./guidelineValidation";
import type { GuidelineCoreStatus, GuidelineRecommendationStatus } from "./guidelineCoreTypes";

function assertTransition(errors: string[]): void {
  if (errors.length > 0) throw new GuidelineValidationError(errors);
}

export async function publishGuideline(guidelineId: string, actorId: string) {
  const [document, recommendations, sourceDocuments] = await Promise.all([
    getGuidelineCoreDocument(guidelineId),
    listGuidelineRecommendations(guidelineId),
    listGuidelineSourceDocuments(guidelineId),
  ]);
  if (!document) throw new Error("Guideline không tồn tại.");
  assertTransition(validateGuidelineStatusTransition(document.status, "published"));
  assertValidGuidelinePublication(document, recommendations, sourceDocuments);
  return updateGuidelineCoreDocument(guidelineId, {
    status: "published",
    // Keep the legacy visibility flag aligned while older RLS policies are still present.
    // Public Core reads remain governed by status = published.
    visibility: "shared",
    published_at: new Date().toISOString(),
    published_by: actorId,
    archived_at: null,
    archived_by: null,
  });
}

export async function publishGuidelineRecommendation(recommendationId: string, _actorId: string) {
  const recommendation = await getGuidelineRecommendation(recommendationId);
  if (!recommendation) throw new Error("Recommendation không tồn tại.");
  const [document, table, sourceDocuments] = await Promise.all([
    getGuidelineCoreDocument(recommendation.guideline_id),
    recommendation.recommendation_table_id ? getGuidelineRecommendationTable(recommendation.recommendation_table_id) : Promise.resolve(null),
    listGuidelineSourceDocuments(recommendation.guideline_id),
  ]);
  if (!document) throw new Error("Guideline không tồn tại.");
  assertTransition(validateRecommendationStatusTransition(recommendation.status, "published"));
  assertValidRecommendationPublication(recommendation, document, table, sourceDocuments);
  return updateGuidelineRecommendation(recommendationId, {
    status: "published",
  });
}

export async function setGuidelineStatus(guidelineId: string, status: GuidelineCoreStatus, actorId: string) {
  const document = await getGuidelineCoreDocument(guidelineId);
  if (!document) throw new Error("Guideline không tồn tại.");
  assertTransition(validateGuidelineStatusTransition(document.status, status));
  if (status === "published") return publishGuideline(guidelineId, actorId);
  return updateGuidelineCoreDocument(guidelineId, {
    status,
    visibility: "private",
    archived_at: status === "archived" ? new Date().toISOString() : null,
    archived_by: status === "archived" ? actorId : null,
  });
}

export async function setGuidelineRecommendationStatus(recommendationId: string, status: GuidelineRecommendationStatus, actorId: string) {
  const recommendation = await getGuidelineRecommendation(recommendationId);
  if (!recommendation) throw new Error("Recommendation không tồn tại.");
  assertTransition(validateRecommendationStatusTransition(recommendation.status, status));
  if (status === "published") return publishGuidelineRecommendation(recommendationId, actorId);
  return updateGuidelineRecommendation(recommendationId, {
    status,
    reviewed_by: status === "reviewed" ? actorId : null,
    reviewed_at: status === "reviewed" ? new Date().toISOString() : null,
  });
}

export async function archiveGuideline(guidelineId: string, actorId: string) {
  return setGuidelineStatus(guidelineId, "archived", actorId);
}

export async function archiveGuidelineRecommendation(recommendationId: string, actorId: string) {
  return setGuidelineRecommendationStatus(recommendationId, "archived", actorId);
}

export async function publishGuidelineSection(sectionId: string) {
  const section = await getGuidelineSection(sectionId);
  if (!section) throw new Error("Section không tồn tại.");
  return setGuidelineSectionStatus(sectionId, "published");
}
