import { getGuidelineCoreDocument, listGuidelineCoreDocuments } from "./guidelineRepository";
import { getGuidelineSection, listGuidelineSections } from "./guidelineSectionRepository";
import { getGuidelineRecommendation, listGuidelineRecommendations } from "./guidelineRecommendationRepository";

export async function listPublicGuidelines() {
  return listGuidelineCoreDocuments({ publicOnly: true });
}

export async function getPublicGuideline(id: string) {
  return getGuidelineCoreDocument(id, { publicOnly: true });
}

export async function listPublicGuidelineSections(guidelineId: string) {
  const guideline = await getPublicGuideline(guidelineId);
  if (!guideline) return [];
  return listGuidelineSections(guidelineId, { publicOnly: true });
}

export async function getPublicGuidelineSection(id: string) {
  return getGuidelineSection(id, { publicOnly: true });
}

export async function listPublicGuidelineRecommendations(guidelineId: string) {
  const guideline = await getPublicGuideline(guidelineId);
  if (!guideline) return [];
  return listGuidelineRecommendations(guidelineId, { publicOnly: true });
}

export async function getPublicGuidelineRecommendation(id: string) {
  return getGuidelineRecommendation(id, { publicOnly: true });
}
