import type { GuidelineDocument, GuidelineEntry } from "./guidelines";

export interface GuidelineExposureReference {
  sectionId?: string | null;
  recommendationId?: string | null;
}

/**
 * The current database has visibility on documents and review status on entries,
 * not a document-level published status. A linked recommendation is public only
 * when that exact entry is reviewed; a whole-document query requires every entry
 * to be reviewed.
 */
export function canExposeGuideline(
  document: Pick<GuidelineDocument, "visibility">,
  entries: Array<Pick<GuidelineEntry, "id" | "status" | "section_id">>,
  reference?: GuidelineExposureReference,
): boolean {
  if (document.visibility !== "shared") return false;
  const recommendationId = reference?.recommendationId || null;
  const sectionId = reference?.sectionId || null;
  if (recommendationId) {
    const entry = entries.find((item) => item.id === recommendationId);
    return Boolean(entry && entry.status === "reviewed" && (!sectionId || entry.section_id === sectionId));
  }
  if (sectionId) return entries.some((entry) => entry.section_id === sectionId && entry.status === "reviewed");
  return entries.length > 0 && entries.every((entry) => entry.status === "reviewed");
}
