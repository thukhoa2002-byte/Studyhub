import type { Guideline, GuidelineRecommendation, GuidelineSection } from "../types/guideline";
import type { LocalizedContent } from "../types/language";
import type { GuidelineCoreDocument, GuidelineRecommendationRecord, GuidelineSectionRecord } from "./guidelineCoreTypes";

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function guidelineCoreSlug(document: Pick<GuidelineCoreDocument, "id" | "society" | "title" | "publication_year" | "version_label">): string {
  return slugify(`${document.society}-${document.title}-${document.publication_year ?? document.version_label}`) || document.id;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
}

function localized(title: string, originalTitle = title, summary = ""): LocalizedContent {
  return {
    title: { vi: title, en: originalTitle || title },
    summary: { vi: summary, en: summary },
  };
}

function mapRecommendation(
  document: GuidelineCoreDocument,
  section: GuidelineSectionRecord,
  record: GuidelineRecommendationRecord,
): GuidelineRecommendation {
  const title = text(record.title) || text(record.recommendation_text_vi) || text(record.recommendation_text_original) || "Khuyến cáo";
  const content = text(record.recommendation_text_vi) || text(record.recommendation_text_original) || title;
  const originalTitle = text(record.title) || text(record.recommendation_text_original) || title;

  return {
    id: record.id,
    title,
    content,
    classOfRecommendation: text(record.recommendation_class) || "Chưa nhập",
    levelOfEvidence: text(record.evidence_level) || "Chưa nhập",
    population: text(record.population),
    clinicalContext: text(record.conditions),
    tags: [document.condition, ...stringArray(document.topics)].filter(Boolean),
    drugReferences: [],
    source: { guidelineId: document.id, sectionId: section.id, page: record.source_page, table: record.recommendation_table_id || "", figure: "" },
    status: "published",
    reviewedBy: record.reviewed_by ?? undefined,
    reviewedAt: record.reviewed_at ?? undefined,
    lastUpdatedAt: record.updated_at,
    sourceVerified: true,
    isPlaceholder: false,
    localizedContent: {
      title: { vi: title, en: originalTitle },
      content: { vi: content, en: text(record.recommendation_text_original) || content },
    },
  };
}

function mapSection(
  document: GuidelineCoreDocument,
  record: GuidelineSectionRecord,
  recommendations: GuidelineRecommendationRecord[],
): GuidelineSection {
  const title = text(record.title) || text(record.title_vi) || "Section";
  const titleVi = text(record.title_vi) || title;
  return {
    id: record.id,
    slug: text(record.slug) || slugify(title) || record.id,
    title,
    titleVi,
    order: record.display_order,
    summary: text(record.summary),
    recommendations: recommendations.map((item) => mapRecommendation(document, record, item)),
    drugReferences: [],
    calculatorReferences: [],
    flowchartReferences: [],
    localizedContent: localized(titleVi, title, text(record.summary)),
  };
}

export function mapPublishedCoreGuideline(
  document: GuidelineCoreDocument,
  sectionRecords: GuidelineSectionRecord[],
  recommendationRecords: GuidelineRecommendationRecord[],
): Guideline | null {
  if (document.status !== "published") return null;

  const sections = sectionRecords
    .filter((section) => section.guideline_id === document.id && section.status === "published")
    .sort((left, right) => left.display_order - right.display_order)
    .map((section) => {
      const recommendations = recommendationRecords
        .filter((recommendation) => recommendation.guideline_id === document.id && recommendation.section_id === section.id && recommendation.status === "published" && recommendation.verification_status === "verified")
        .sort((left, right) => left.sort_order - right.sort_order || left.created_at.localeCompare(right.created_at));
      return mapSection(document, section, recommendations);
    });

  const title = text(document.title) || "Guideline";
  const summary = text(document.summary);
  return {
    id: document.id,
    slug: guidelineCoreSlug(document),
    title,
    titleVi: title,
    organization: text(document.society),
    publicationYear: document.publication_year ?? 0,
    version: text(document.version_label),
    specialty: text(document.condition),
    topics: stringArray(document.topics).length > 0 ? stringArray(document.topics) : [text(document.condition)].filter(Boolean),
    summary,
    sourceUrl: text(document.source_url),
    lastReviewedAt: document.published_at || document.updated_at,
    status: "published",
    isPlaceholder: false,
    sections,
    localizedContent: localized(title, title, summary),
  };
}
