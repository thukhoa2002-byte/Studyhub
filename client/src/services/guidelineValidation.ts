import type {
  GuidelineCoreDocument,
  GuidelineCoreStatus,
  GuidelineRecommendationRecord,
  GuidelineRecommendationStatus,
  GuidelineSectionRecord,
  GuidelineSourceDocumentRecord,
} from "./guidelineCoreTypes";

export class GuidelineValidationError extends Error {
  readonly code = "GUIDELINE_VALIDATION_ERROR";
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join(" "));
    this.name = "GuidelineValidationError";
    this.errors = errors;
  }
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function hasGuidelineSourceTraceability(
  document: Pick<GuidelineCoreDocument, "source_url" | "doi" | "citation" | "file_path" | "provenance">,
  sourceDocuments: Array<Pick<GuidelineSourceDocumentRecord, "id">> = [],
): boolean {
  return Boolean(
    hasText(document.source_url)
      || hasText(document.doi)
      || hasText(document.citation)
      || hasText(document.file_path)
      || sourceDocuments.length > 0
      || (Array.isArray(document.provenance) && document.provenance.length > 0),
  );
}

export function validateGuidelineForPublication(
  document: Pick<GuidelineCoreDocument, "title" | "publication_year" | "version_label" | "source_url" | "doi" | "citation" | "file_path" | "provenance">,
  sections: Array<Pick<GuidelineSectionRecord, "status">>,
  recommendations: Array<Pick<GuidelineRecommendationRecord, "status" | "verification_status">>,
  sourceDocuments: Array<Pick<GuidelineSourceDocumentRecord, "id">> = [],
): string[] {
  const errors: string[] = [];
  if (!hasText(document.title)) errors.push("Guideline title is required.");
  if (document.publication_year == null && !hasText(document.version_label)) errors.push("Publication year or version is required.");
  if (!hasGuidelineSourceTraceability(document, sourceDocuments)) errors.push("Source traceability is required.");
  const hasEligibleChild = sections.some((section) => section.status === "published")
    || recommendations.some((recommendation) => recommendation.status === "published" && recommendation.verification_status === "verified");
  if (!hasEligibleChild) errors.push("At least one eligible published section or recommendation is required.");
  return errors;
}

export function validateRecommendationForPublication(
  recommendation: Pick<GuidelineRecommendationRecord, "title" | "recommendation_text_original" | "recommendation_text_vi" | "section_id" | "source_page" | "source_quote" | "source_anchor" | "verification_status">,
  document: Pick<GuidelineCoreDocument, "id" | "status">,
  section: Pick<GuidelineSectionRecord, "id" | "guideline_id" | "status"> | null,
  sourceDocuments: Array<Pick<GuidelineSourceDocumentRecord, "id">> = [],
): string[] {
  const errors: string[] = [];
  if (!hasText(recommendation.title) && !hasText(recommendation.recommendation_text_original) && !hasText(recommendation.recommendation_text_vi)) errors.push("Recommendation display text is required.");
  if (!recommendation.section_id) errors.push("Published recommendation must belong to a section.");
  if (!section || section.id !== recommendation.section_id || section.guideline_id !== document.id) errors.push("Recommendation section must belong to the same Guideline.");
  if (document.status !== "published") errors.push("Parent Guideline must be published first.");
  if (section?.status !== "published") errors.push("Parent Section must be published first.");
  if (recommendation.verification_status !== "verified") errors.push("Recommendation must be verified before publication.");
  if (sourceDocuments.length === 0 && recommendation.source_page == null && !hasText(recommendation.source_quote) && !hasText(recommendation.source_anchor)) errors.push("Recommendation source traceability is required.");
  return errors;
}

const guidelineTransitions: Record<GuidelineCoreStatus, GuidelineCoreStatus[]> = {
  draft: ["draft", "in_review", "published"],
  in_review: ["in_review", "published", "draft"],
  published: ["published", "archived"],
  archived: ["archived", "draft", "published"],
};

const recommendationTransitions: Record<GuidelineRecommendationStatus, GuidelineRecommendationStatus[]> = {
  draft: ["draft", "in_review", "reviewed", "published"],
  in_review: ["in_review", "reviewed", "draft", "published"],
  reviewed: ["reviewed", "published", "in_review", "draft"],
  published: ["published", "archived"],
  archived: ["archived", "draft", "published"],
};

export function validateGuidelineStatusTransition(from: GuidelineCoreStatus, to: GuidelineCoreStatus): string[] {
  return guidelineTransitions[from].includes(to) ? [] : [`Invalid Guideline status transition: ${from} -> ${to}.`];
}

export function validateRecommendationStatusTransition(from: GuidelineRecommendationStatus, to: GuidelineRecommendationStatus): string[] {
  return recommendationTransitions[from].includes(to) ? [] : [`Invalid Recommendation status transition: ${from} -> ${to}.`];
}

export function assertValidGuidelinePublication(...args: Parameters<typeof validateGuidelineForPublication>): void {
  const errors = validateGuidelineForPublication(...args);
  if (errors.length > 0) throw new GuidelineValidationError(errors);
}

export function assertValidRecommendationPublication(...args: Parameters<typeof validateRecommendationForPublication>): void {
  const errors = validateRecommendationForPublication(...args);
  if (errors.length > 0) throw new GuidelineValidationError(errors);
}
