import type { GuidelineEntry } from "./guidelines";
import type { GuidelineRecommendationRecord } from "./guidelineCoreTypes";

export type LegacyEntryClassification =
  | "narrative_recommendation"
  | "table_heading"
  | "table_section"
  | "table_row"
  | "note"
  | "unclassified";

export function classifyLegacyGuidelineEntry(entry: Pick<GuidelineEntry, "table_kind" | "table_row_role" | "recommendation_summary" | "clinical_context" | "table_cells">): LegacyEntryClassification {
  if (entry.table_kind === "data" && entry.table_row_role === "header") return "table_heading";
  if (entry.table_kind === "data" && entry.table_row_role === "section") return "table_section";
  if (entry.table_kind === "data" && entry.table_row_role === "body") return "table_row";
  if (entry.table_kind === "recommendation" && entry.table_row_role === "body" && (entry.recommendation_summary.trim() || entry.clinical_context.trim())) return "narrative_recommendation";
  if (entry.table_cells.length > 0) return "table_row";
  if (entry.recommendation_summary.trim() || entry.clinical_context.trim()) return "note";
  return "unclassified";
}

export function isLegacyRecommendationCandidate(entry: Pick<GuidelineEntry, "table_kind" | "table_row_role" | "recommendation_summary" | "clinical_context" | "table_cells">): boolean {
  return classifyLegacyGuidelineEntry(entry) === "narrative_recommendation";
}

export function legacyEntryToRecommendationCandidate(entry: GuidelineEntry): Pick<GuidelineRecommendationRecord, "id" | "guideline_id" | "section_id" | "title" | "recommendation_text_original" | "recommendation_text_vi" | "recommendation_class" | "evidence_level" | "population" | "conditions" | "contraindications" | "source_page" | "source_quote" | "source_anchor" | "verification_status" | "status" | "sort_order"> | null {
  if (!isLegacyRecommendationCandidate(entry)) return null;
  return {
    id: entry.id,
    guideline_id: entry.document_id,
    section_id: entry.section_id ?? null,
    title: entry.topic.trim(),
    recommendation_text_original: entry.recommendation_summary,
    recommendation_text_vi: entry.recommendation_summary,
    recommendation_class: entry.recommendation_class,
    evidence_level: entry.evidence_level,
    population: entry.clinical_context,
    conditions: entry.clinical_context,
    contraindications: entry.contraindications,
    source_page: Number(entry.page_reference.match(/\d+/)?.[0] ?? 0) || null,
    source_quote: "",
    source_anchor: entry.page_reference,
    verification_status: "needs_review",
    status: "draft",
    sort_order: entry.source_order,
  };
}
