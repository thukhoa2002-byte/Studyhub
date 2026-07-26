export type GuidelineCoreStatus = "draft" | "in_review" | "published" | "archived";
export type GuidelineCoreCondition = "ACS" | "HF" | "AF" | "Khác";
export const guidelineCoreConditions: readonly GuidelineCoreCondition[] = ["ACS", "HF", "AF", "Khác"];

export function normalizeGuidelineCoreCondition(value: unknown): GuidelineCoreCondition {
  return typeof value === "string" && guidelineCoreConditions.includes(value as GuidelineCoreCondition)
    ? value as GuidelineCoreCondition
    : "Khác";
}
export type GuidelineSectionStatus = GuidelineCoreStatus;
export type GuidelineRecommendationStatus = "draft" | "in_review" | "reviewed" | "published" | "archived";
export type GuidelineVerificationStatus = "unverified" | "needs_review" | "verified" | "rejected";
export type GuidelineSourceKind = "primary" | "supplement" | "supporting" | "html" | "xml" | "manual";

export interface GuidelineCoreDocument {
  id: string;
  owner_id: string;
  title: string;
  society: string;
  condition: string;
  publication_year: number | null;
  version_label: string;
  summary: string;
  topics: unknown[];
  source_url: string | null;
  doi: string | null;
  citation: string | null;
  file_path: string | null;
  supplement_file_path: string | null;
  provenance: unknown[];
  visibility: "private" | "shared";
  status: GuidelineCoreStatus;
  review_note: string;
  published_at: string | null;
  archived_at: string | null;
  published_by: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuidelineCorePreview {
  id: string;
  title: string;
  society: string;
  condition: string;
  publication_year: number | null;
  version_label: string;
  summary: string;
  topics: unknown[];
  status: "published";
  published_at: string | null;
}

export interface GuidelineSectionRecord {
  id: string;
  guideline_id: string;
  owner_id: string | null;
  parent_section_id: string | null;
  slug: string;
  section_number: string | null;
  title: string;
  title_vi: string;
  summary: string;
  display_order: number;
  status: GuidelineSectionStatus;
  created_at: string;
  updated_at: string;
}

export interface GuidelineSourceDocumentRecord {
  id: string;
  guideline_id: string;
  owner_id: string | null;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  source_kind: GuidelineSourceKind;
  checksum: string;
  page_count: number | null;
  extraction_status: "not_started" | "queued" | "processing" | "completed" | "failed";
  created_at: string;
  updated_at: string;
}

export type GuidelineRecommendationTableStatus = "draft" | "published" | "archived";
export type GuidelineClinicalTableStatus = "draft" | "in_review" | "published" | "archived";

export interface GuidelineRecommendationTableRecord {
  id: string;
  guideline_id: string;
  // Source Section is provenance only. A table remains a valid primary
  // resource when the original document has no recoverable section mapping.
  section_id: string | null;
  owner_id: string | null;
  table_number: string;
  source_table_number?: string;
  title: string;
  title_vi: string;
  short_description?: string;
  source_page: number | null;
  source_page_start?: number | null;
  source_page_end?: number | null;
  source_quote: string;
  source_anchor: string;
  source_order?: number;
  display_order: number;
  is_complete: boolean;
  translation_status?: "pending" | "blocked_pending_extraction" | "translated" | "reviewed";
  status: GuidelineRecommendationTableStatus;
  created_at: string;
  updated_at: string;
}

export interface GuidelineRecommendationGroupRecord {
  id: string;
  guideline_id: string;
  section_id: string | null;
  recommendation_table_id: string;
  owner_id: string | null;
  source_heading: string;
  title_vi: string;
  context: string;
  source_page: number | null;
  group_order: number;
  status: GuidelineRecommendationTableStatus;
  created_at: string;
  updated_at: string;
}

/** A non-recommendation clinical table. Its rows must never be promoted to recommendations automatically. */
export interface GuidelineClinicalTableRecord {
  id: string;
  guideline_id: string;
  section_id: string | null;
  owner_id: string | null;
  table_number: string;
  title: string;
  title_vi: string;
  short_description: string;
  source_page_start: number | null;
  source_page_end: number | null;
  source_order: number;
  headers_original: string[];
  headers_vi: string[];
  rows_original: string[][];
  rows_vi: string[][];
  footnotes_original: string[];
  footnotes_vi: string[];
  is_complete: boolean;
  status: GuidelineClinicalTableStatus;
  created_at: string;
  updated_at: string;
}

export interface GuidelineRecommendationRecord {
  id: string;
  guideline_id: string;
  section_id: string | null;
  recommendation_table_id?: string | null;
  recommendation_group_id?: string | null;
  owner_id: string | null;
  title: string;
  recommendation_text_original: string;
  recommendation_text_vi: string;
  rationale_vi: string;
  recommendation_class: string;
  evidence_level: string;
  evidence_system: string;
  population: string;
  intervention: string;
  comparator: string;
  outcome: string;
  conditions: string;
  contraindications: string;
  source_page: number | null;
  source_quote: string;
  source_anchor: string;
  verification_status: GuidelineVerificationStatus;
  review_note: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  status: GuidelineRecommendationStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type NewGuidelineRecommendationTable = Pick<GuidelineRecommendationTableRecord,
  "guideline_id" | "section_id" | "table_number" | "title" | "title_vi" | "source_quote" | "source_anchor" | "is_complete" | "display_order"
> & Partial<Pick<GuidelineRecommendationTableRecord,
  "source_table_number" | "short_description" | "source_page" | "source_page_start" | "source_page_end" | "source_order" | "translation_status" | "status"
>>;

export type NewGuidelineRecommendationGroup = Pick<GuidelineRecommendationGroupRecord,
  "guideline_id" | "section_id" | "recommendation_table_id" | "source_heading" | "title_vi" | "context" | "group_order"
> & Partial<Pick<GuidelineRecommendationGroupRecord, "source_page" | "status">>;

export type NewGuidelineClinicalTable = Pick<GuidelineClinicalTableRecord,
  "guideline_id" | "section_id" | "table_number" | "title" | "title_vi" | "source_order" | "headers_original" | "headers_vi" | "rows_original" | "rows_vi" | "footnotes_original" | "footnotes_vi" | "is_complete"
> & Partial<Pick<GuidelineClinicalTableRecord, "short_description" | "source_page_start" | "source_page_end" | "status">>;

export type NewGuidelineCoreDocument = Omit<Pick<GuidelineCoreDocument, "title" | "society" | "condition" | "version_label" | "visibility">, "condition"> & {
  condition: GuidelineCoreCondition;
  summary?: string;
  topics?: unknown[];
  publication_year?: number | null;
  source_url?: string | null;
  doi?: string | null;
  citation?: string | null;
  provenance?: unknown[];
  review_note?: string;
};

export type NewGuidelineSection = Pick<GuidelineSectionRecord, "guideline_id" | "slug" | "title" | "title_vi" | "summary" | "display_order"> & {
  parent_section_id?: string | null;
  section_number?: string | null;
  status?: GuidelineSectionStatus;
};

export type NewGuidelineRecommendation = Omit<GuidelineRecommendationRecord, "id" | "owner_id" | "created_at" | "updated_at" | "reviewed_by" | "reviewed_at" | "status"> & {
  status?: GuidelineRecommendationStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
};
