import { getGuidelineCoreDocument, updateGuidelineCoreDocument } from "./guidelineRepository";
import { listGuidelineSections, getGuidelineSection, setGuidelineSectionStatus } from "./guidelineSectionRepository";
import { listGuidelineRecommendations, getGuidelineRecommendation, updateGuidelineRecommendation } from "./guidelineRecommendationRepository";
import { listGuidelineSourceDocuments } from "./guidelineSourceDocumentRepository";
import { assertValidGuidelinePublication, assertValidRecommendationPublication, GuidelineValidationError, validateGuidelineStatusTransition, validateRecommendationStatusTransition } from "./guidelineValidation";
import type { GuidelineCoreStatus, GuidelineRecommendationStatus } from "./guidelineCoreTypes";

function assertTransition(errors: string[]): void {
  if (errors.length > 0) throw new GuidelineValidationError(errors);
}

export async function publishGuideline(guidelineId: string, actorId: string) {
  const [document, sections, recommendations, sourceDocuments] = await Promise.all([
    getGuidelineCoreDocument(guidelineId),
    listGuidelineSections(guidelineId),
    listGuidelineRecommendations(guidelineId),
    listGuidelineSourceDocuments(guidelineId),
  ]);
  if (!document) throw new Error("Guideline không tồn tại.");
  assertTransition(validateGuidelineStatusTransition(document.status, "published"));
  assertValidGuidelinePublication(document, sections, recommendations, sourceDocuments);
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

export async function publishGuidelineRecommendation(recommendationId: string, actorId: string) {
  const recommendation = await getGuidelineRecommendation(recommendationId);
  if (!recommendation) throw new Error("Recommendation không tồn tại.");
  const [document, section, sourceDocuments] = await Promise.all([
    getGuidelineCoreDocument(recommendation.guideline_id),
    recommendation.section_id ? getGuidelineSection(recommendation.section_id) : Promise.resolve(null),
    listGuidelineSourceDocuments(recommendation.guideline_id),
  ]);
  if (!document) throw new Error("Guideline không tồn tại.");
  assertTransition(validateRecommendationStatusTransition(recommendation.status, "published"));
  assertValidRecommendationPublication(recommendation, document, section, sourceDocuments);
  return updateGuidelineRecommendation(recommendationId, {
    status: "published",
    verification_status: "verified",
    reviewed_by: actorId,
    reviewed_at: new Date().toISOString(),
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
