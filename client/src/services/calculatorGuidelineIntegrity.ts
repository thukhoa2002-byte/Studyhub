import type { CalculatorGuidelineReferenceRow, DatabaseCalculator, GuidelineDocumentTarget, GuidelineRecommendationTarget, GuidelineSectionTarget } from "../modules/calculators/databaseTypes.ts";

export type StaleReferenceReason =
  | "missing-calculator"
  | "missing-guideline"
  | "missing-section"
  | "section-wrong-guideline"
  | "missing-recommendation"
  | "recommendation-wrong-guideline"
  | "recommendation-wrong-section"
  | "guideline-not-shared"
  | "guideline-not-reviewed"
  | "section-not-reviewed"
  | "recommendation-not-reviewed";

export interface StaleCalculatorGuidelineReference {
  reference: CalculatorGuidelineReferenceRow;
  reasons: StaleReferenceReason[];
}

export interface GuidelineIntegrityTargets {
  calculators: Pick<DatabaseCalculator, "id">[];
  documents: GuidelineDocumentTarget[];
  sections: GuidelineSectionTarget[];
  recommendations: GuidelineRecommendationTarget[];
}

export function findStaleCalculatorGuidelineReferences(
  references: CalculatorGuidelineReferenceRow[],
  targets: GuidelineIntegrityTargets,
): StaleCalculatorGuidelineReference[] {
  const calculators = new Set(targets.calculators.map((item) => item.id));
  const documents = new Map(targets.documents.map((item) => [item.id, item]));
  const sections = new Map(targets.sections.map((item) => [item.id, item]));
  const recommendations = new Map(targets.recommendations.map((item) => [item.id, item]));

  return references.flatMap((reference) => {
    const reasons: StaleReferenceReason[] = [];
    if (!calculators.has(reference.calculator_id)) reasons.push("missing-calculator");
    const document = documents.get(reference.guideline_id);
    if (!document) reasons.push("missing-guideline");
    else if (document.visibility !== "shared") reasons.push("guideline-not-shared");

    const documentRecommendations = targets.recommendations.filter((item) => item.document_id === reference.guideline_id);
    if (!reference.section_id && !reference.recommendation_id && document) {
      if (documentRecommendations.length === 0 || documentRecommendations.some((item) => item.status !== "reviewed")) reasons.push("guideline-not-reviewed");
    }

    if (reference.section_id) {
      const section = sections.get(reference.section_id);
      if (!section) reasons.push("missing-section");
      else if (section.guideline_id !== reference.guideline_id) reasons.push("section-wrong-guideline");
      else if (!targets.recommendations.some((item) => item.document_id === reference.guideline_id && item.section_id === reference.section_id && item.status === "reviewed")) reasons.push("section-not-reviewed");
    }

    if (reference.recommendation_id) {
      const recommendation = recommendations.get(reference.recommendation_id);
      if (!recommendation) reasons.push("missing-recommendation");
      else {
        if (recommendation.document_id !== reference.guideline_id) reasons.push("recommendation-wrong-guideline");
        if (reference.section_id && recommendation.section_id !== reference.section_id) reasons.push("recommendation-wrong-section");
        if (recommendation.status !== "reviewed") reasons.push("recommendation-not-reviewed");
      }
    }

    return reasons.length > 0 ? [{ reference, reasons }] : [];
  });
}

export async function scanStaleCalculatorGuidelineReferences(): Promise<StaleCalculatorGuidelineReference[]> {
  const { calculatorRepository } = await import("./calculatorRepository.ts");
  const [references, calculators, documents, sections, recommendations] = await Promise.all([
    calculatorRepository.listAllGuidelineReferences(),
    calculatorRepository.list({}),
    calculatorRepository.listGuidelineDocuments(),
    calculatorRepository.listGuidelineSections(),
    calculatorRepository.listGuidelineRecommendations(),
  ]);
  return findStaleCalculatorGuidelineReferences(references, { calculators, documents, sections, recommendations });
}
