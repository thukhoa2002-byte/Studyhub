import { guidelinePath } from "./dataRoutes.ts";

export type DeepLinkTable = {
  id: string;
  legacySectionIds?: string[];
  recommendations: Array<{ id: string }>;
};

export type GuidelineDeepLinkTarget =
  | { ok: true; tableId: string; recommendationId: string; usedLegacySection: boolean }
  | { ok: false; reason: "table-unavailable" | "recommendation-unavailable" | "recommendation-table-mismatch" };

export function recommendationDeepLinkPath(guidelineSlug: string, tableId: string, recommendationId: string): string {
  return guidelinePath(guidelineSlug, tableId, recommendationId);
}

export function recommendationAdminPath(guidelineId: string, recommendationId: string): string {
  return `/admin/guidelines/${encodeURIComponent(guidelineId)}/recommendations?recommendation=${encodeURIComponent(recommendationId)}`;
}

export function resolveGuidelineDeepLink(
  tables: DeepLinkTable[],
  tableOrLegacySectionIdentifier: string | undefined,
  recommendationId: string | undefined,
): GuidelineDeepLinkTarget | null {
  if (!recommendationId) return null;
  const owner = tables.find((table) => table.recommendations.some((recommendation) => recommendation.id === recommendationId));
  if (!owner) return { ok: false, reason: "recommendation-unavailable" };
  if (tableOrLegacySectionIdentifier) {
    if (tableOrLegacySectionIdentifier === owner.id) return { ok: true, tableId: owner.id, recommendationId, usedLegacySection: false };
    if (owner.legacySectionIds?.includes(tableOrLegacySectionIdentifier)) return { ok: true, tableId: owner.id, recommendationId, usedLegacySection: true };
    const requestedTable = tables.find((table) => table.id === tableOrLegacySectionIdentifier);
    return requestedTable ? { ok: false, reason: "recommendation-table-mismatch" } : { ok: false, reason: "table-unavailable" };
  }
  return { ok: true, tableId: owner.id, recommendationId, usedLegacySection: false };
}

export function deepLinkScrollBehavior(reducedMotion: boolean): ScrollBehavior {
  return reducedMotion ? "auto" : "smooth";
}
