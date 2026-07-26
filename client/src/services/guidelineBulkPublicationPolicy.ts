import type { GuidelineRecommendationRecord, GuidelineSectionRecord } from "./guidelineCoreTypes.ts";

export function summarizeSectionBulkPublication(
  sectionId: string,
  _sections: GuidelineSectionRecord[],
  recommendations: GuidelineRecommendationRecord[],
): { total: number; draft: number; published: number; blocked: number } {
  const owned = recommendations.filter((item) => item.section_id === sectionId);
  return {
    total: owned.length,
    draft: owned.filter((item) => item.status === "draft").length,
    published: owned.filter((item) => item.status === "published").length,
    blocked: owned.filter((item) => item.status === "archived" || item.section_id !== sectionId).length,
  };
}

export function bulkPublicationOrder(sections: GuidelineSectionRecord[]): string[] {
  const depth = (section: GuidelineSectionRecord): number => {
    let level = 0; let parent = section.parent_section_id; const seen = new Set<string>();
    while (parent && !seen.has(parent)) { seen.add(parent); level += 1; parent = sections.find((item) => item.id === parent)?.parent_section_id || null; }
    return level;
  };
  return [...sections].sort((a, b) => depth(a) - depth(b) || a.display_order - b.display_order).map((item) => item.id);
}
