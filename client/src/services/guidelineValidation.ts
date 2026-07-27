import type {
  GuidelineCoreDocument,
  GuidelineCoreStatus,
  GuidelineRecommendationRecord,
  GuidelineRecommendationTableRecord,
  GuidelineRecommendationStatus,
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
  recommendations: Array<Pick<GuidelineRecommendationRecord, "status" | "verification_status" | "title" | "recommendation_text_original" | "recommendation_text_vi">>,
  sourceDocuments: Array<Pick<GuidelineSourceDocumentRecord, "id">> = [],
): string[] {
  const errors: string[] = [];
  if (!hasText(document.title)) errors.push("Guideline title is required.");
  if (document.publication_year == null && !hasText(document.version_label)) errors.push("Publication year or version is required.");
  if (!hasGuidelineSourceTraceability(document, sourceDocuments)) errors.push("Source traceability is required.");
  // A first publish may begin from draft table rows. Individual row
  // publication still requires this Guideline to be published first.
  const hasEligibleTableRow = recommendations.some((recommendation) => recommendation.status !== "archived"
    && (hasText(recommendation.title) || hasText(recommendation.recommendation_text_original) || hasText(recommendation.recommendation_text_vi)));
  if (!hasEligibleTableRow) errors.push("At least one eligible recommendation table row is required.");
  return errors;
}

export function validateRecommendationForPublication(
  recommendation: Pick<GuidelineRecommendationRecord, "title" | "recommendation_text_original" | "recommendation_text_vi" | "recommendation_table_id" | "source_page" | "source_quote" | "source_anchor" | "verification_status">,
  document: Pick<GuidelineCoreDocument, "id" | "status">,
  table: Pick<GuidelineRecommendationTableRecord, "id" | "guideline_id" | "status" | "is_complete"> | null,
  sourceDocuments: Array<Pick<GuidelineSourceDocumentRecord, "id">> = [],
): string[] {
  const errors: string[] = [];
  if (!hasText(recommendation.title) && !hasText(recommendation.recommendation_text_original) && !hasText(recommendation.recommendation_text_vi)) errors.push("Recommendation display text is required.");
  if (!recommendation.recommendation_table_id) errors.push("Recommendation Table is required.");
  else if (!table || table.id !== recommendation.recommendation_table_id || table.guideline_id !== document.id) errors.push("Recommendation Table must belong to the same Guideline.");
  else {
    if (!table.is_complete) errors.push("Recommendation Table must be complete.");
    if (table.status !== "published") errors.push("Recommendation Table must be published first.");
  }
  if (document.status !== "published") errors.push("Parent Guideline must be published first.");
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
