import { drugs } from "../data/drugData";
import { guidelines } from "../data/guidelineData";
import type { Drug } from "../types/drug";
import type { DrugReference, Guideline, GuidelineRecommendation, GuidelineReference, GuidelineSection } from "../types/guideline";

export function getAllGuidelines(): Guideline[] {
  return guidelines;
}

export function getGuidelineById(guidelineId: string): Guideline | undefined {
  return guidelines.find((guideline) => guideline.id === guidelineId);
}

export function getGuidelineBySlug(slug: string): Guideline | undefined {
  return guidelines.find((guideline) => guideline.slug === slug);
}

export function getGuidelineSection(guidelineId: string, sectionId: string): GuidelineSection | undefined {
  return getGuidelineById(guidelineId)?.sections.find((section) => section.id === sectionId || section.slug === sectionId);
}

export function getRecommendationById(recommendationId: string): GuidelineRecommendation | undefined {
  for (const guideline of guidelines) {
    for (const section of guideline.sections) {
      const recommendation = section.recommendations.find((item) => item.id === recommendationId);
      if (recommendation) return recommendation;
    }
  }
  return undefined;
}

export function getDrugReferencesFromRecommendation(recommendationId: string): DrugReference[] {
  return getRecommendationById(recommendationId)?.drugReferences ?? [];
}

export function getGuidelineReferencesForDrug(drugId: string): GuidelineReference[] {
  const references: GuidelineReference[] = [];
  for (const guideline of guidelines) {
    for (const section of guideline.sections) {
      for (const recommendation of section.recommendations) {
        const drugReference = recommendation.drugReferences.find((reference) => reference.drugId === drugId);
        if (drugReference) references.push({ guideline, section, recommendation, relationType: drugReference.relationType, context: drugReference.context });
      }
    }
  }
  return references;
}

export function getRecommendationsByDrugId(drugId: string): GuidelineRecommendation[] {
  return getGuidelineReferencesForDrug(drugId).map((reference) => reference.recommendation);
}

export function getRecommendationsByTag(tag: string): GuidelineRecommendation[] {
  return guidelines.flatMap((guideline) => guideline.sections.flatMap((section) => section.recommendations.filter((recommendation) => recommendation.tags.includes(tag))));
}

export function getAllDrugs(): Drug[] {
  return drugs;
}

export function getDrugById(drugId: string): Drug | undefined {
  return drugs.find((drug) => drug.id === drugId);
}

export function getDrugBySlug(slug: string): Drug | undefined {
  return drugs.find((drug) => drug.slug === slug);
}
