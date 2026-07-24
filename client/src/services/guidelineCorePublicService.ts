import { listGuidelineCoreDocuments } from "./guidelineRepository";
import { listGuidelineRecommendations } from "./guidelineRecommendationRepository";
import { listGuidelineSections } from "./guidelineSectionRepository";
import { mapPublishedCoreGuideline } from "./guidelineCorePublicMapper";
import type { Guideline } from "../types/guideline";

export { mapPublishedCoreGuideline } from "./guidelineCorePublicMapper";

export async function loadPublishedCoreGuidelines(): Promise<Guideline[]> {
  const documents = await listGuidelineCoreDocuments({ publicOnly: true });
  const mapped = await Promise.all(documents.map(async (document) => {
    const [sections, recommendations] = await Promise.all([
      listGuidelineSections(document.id, { publicOnly: true }),
      listGuidelineRecommendations(document.id, { publicOnly: true }),
    ]);
    return mapPublishedCoreGuideline(document, sections, recommendations);
  }));
  return mapped.filter((guideline): guideline is Guideline => guideline !== null);
}

export function findPublishedCoreGuidelineBySlug(guidelines: Guideline[], slug: string): Guideline | undefined {
  return guidelines.find((guideline) => guideline.slug === slug);
}

export function findPublishedCoreGuidelineById(guidelines: Guideline[], id: string): Guideline | undefined {
  return guidelines.find((guideline) => guideline.id === id);
}
