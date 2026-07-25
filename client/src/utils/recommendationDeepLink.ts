import { guidelinePath } from "./dataRoutes.ts";

export type DeepLinkSection = {
  id: string;
  slug: string;
  recommendations: Array<{ id: string }>;
};

export type GuidelineDeepLinkTarget =
  | { ok: true; sectionId: string; recommendationId: string }
  | { ok: false; reason: "section-unavailable" | "recommendation-unavailable" | "recommendation-section-mismatch" };

export function recommendationDeepLinkPath(guidelineSlug: string, sectionId: string | null | undefined, recommendationId: string): string {
  return guidelinePath(guidelineSlug, sectionId || undefined, recommendationId);
}

export function recommendationAdminPath(guidelineId: string, recommendationId: string): string {
  return `/admin/guidelines/${encodeURIComponent(guidelineId)}/recommendations?recommendation=${encodeURIComponent(recommendationId)}`;
}

export function resolveGuidelineDeepLink(
  sections: DeepLinkSection[],
  sectionIdentifier: string | undefined,
  recommendationId: string | undefined,
): GuidelineDeepLinkTarget | null {
  if (!recommendationId) return null;
  const recommendationSection = sections.find((section) => section.recommendations.some((recommendation) => recommendation.id === recommendationId));
  if (!recommendationSection) return { ok: false, reason: "recommendation-unavailable" };
  if (sectionIdentifier && sectionIdentifier !== recommendationSection.id && sectionIdentifier !== recommendationSection.slug) {
    const requestedSection = sections.find((section) => section.id === sectionIdentifier || section.slug === sectionIdentifier);
    return requestedSection ? { ok: false, reason: "recommendation-section-mismatch" } : { ok: false, reason: "section-unavailable" };
  }
  return { ok: true, sectionId: recommendationSection.id, recommendationId };
}

export function deepLinkScrollBehavior(reducedMotion: boolean): ScrollBehavior {
  return reducedMotion ? "auto" : "smooth";
}
