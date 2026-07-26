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

export interface GuidelineRecommendationRecord {
  id: string;
  guideline_id: string;
  section_id: string | null;
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
