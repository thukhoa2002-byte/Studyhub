import { guidelines } from "../data/guidelineData";
import { listGuidelineDocuments, listGuidelineEntries, type GuidelineDocument, type GuidelineEntry } from "./guidelines";
import { getAllThuoc, getThuocById, getThuocBySlug } from "./thuocService";
import type { Drug } from "../types/drug";
import type { DrugReference, Guideline, GuidelineRecommendation, GuidelineReference, GuidelineSection } from "../types/guideline";

export function getAllGuidelines(source: Guideline[] = guidelines): Guideline[] {
  return source;
}

export function getGuidelineById(guidelineId: string, source: Guideline[] = guidelines): Guideline | undefined {
  return source.find((guideline) => guideline.id === guidelineId);
}

export function getGuidelineBySlug(slug: string, source: Guideline[] = guidelines): Guideline | undefined {
  return source.find((guideline) => guideline.slug === slug);
}

export function getGuidelineSection(guidelineId: string, sectionId: string, source: Guideline[] = guidelines): GuidelineSection | undefined {
  return getGuidelineById(guidelineId, source)?.sections.find((section) => section.id === sectionId || section.slug === sectionId);
}

export function getRecommendationById(recommendationId: string, source: Guideline[] = guidelines): GuidelineRecommendation | undefined {
  for (const guideline of source) {
    for (const section of guideline.sections) {
      const recommendation = section.recommendations.find((item) => item.id === recommendationId);
      if (recommendation) return recommendation;
    }
  }
  return undefined;
}

export function getDrugReferencesFromRecommendation(recommendationId: string, source: Guideline[] = guidelines): DrugReference[] {
  return getRecommendationById(recommendationId, source)?.drugReferences ?? [];
}

export function getGuidelineReferencesForDrug(drugId: string, source: Guideline[] = guidelines): GuidelineReference[] {
  const references: GuidelineReference[] = [];
  for (const guideline of source) {
    for (const section of guideline.sections) {
      for (const recommendation of section.recommendations) {
        const drugReference = recommendation.drugReferences.find((reference) => reference.drugId === drugId);
        if (drugReference) references.push({ guideline, section, recommendation, relationType: drugReference.relationType, context: drugReference.context });
      }
    }
  }
  return references;
}

export function getRecommendationsByDrugId(drugId: string, source: Guideline[] = guidelines): GuidelineRecommendation[] {
  return getGuidelineReferencesForDrug(drugId, source).map((reference) => reference.recommendation);
}

export function getRecommendationsByTag(tag: string, source: Guideline[] = guidelines): GuidelineRecommendation[] {
  return source.flatMap((guideline) => guideline.sections.flatMap((section) => section.recommendations.filter((recommendation) => recommendation.tags.includes(tag))));
}

export function getAllDrugs(): Drug[] {
  return getAllThuoc();
}

export function getDrugById(drugId: string): Drug | undefined {
  return getThuocById(drugId);
}

export function getDrugBySlug(slug: string): Drug | undefined {
  return getThuocBySlug(slug);
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parsePageReference(value: string): number | null {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function resolveDrugId(drugName: string): string | null {
  const normalized = slugify(drugName);
  if (!normalized) return null;
  return getAllThuoc().find((drug) => [drug.id, drug.slug, drug.genericName, drug.titleVi, ...drug.aliases, ...drug.brandNames].some((name) => slugify(name) === normalized || normalized.includes(slugify(name)) || slugify(name).includes(normalized)))?.id ?? null;
}

function mapEntry(document: GuidelineDocument, entry: GuidelineEntry, sectionId: string): GuidelineRecommendation {
  const drugId = entry.drug_id || resolveDrugId(entry.drug_name);
  return {
    id: entry.id,
    title: entry.topic.trim() || "Khuyến cáo",
    content: entry.recommendation_summary || entry.clinical_context || "Nội dung khuyến cáo chưa được nhập.",
    classOfRecommendation: entry.recommendation_class || "Chưa nhập",
    levelOfEvidence: entry.evidence_level || "Chưa nhập",
    population: "",
    clinicalContext: entry.clinical_context,
    tags: [document.condition, entry.topic].filter(Boolean),
    drugReferences: drugId ? [{ drugId, relationType: "recommended", context: entry.clinical_context || "Liên kết từ dữ liệu guideline." }] : [],
    source: { guidelineId: document.id, sectionId, page: parsePageReference(entry.page_reference), table: entry.table_kind, figure: "" },
    status: entry.status === "reviewed" ? "reviewed" : "draft",
    lastUpdatedAt: entry.created_at,
    sourceVerified: entry.status === "reviewed",
    isPlaceholder: false,
  };
}

function mapStoredGuideline(document: GuidelineDocument, entries: GuidelineEntry[]): Guideline {
  const grouped = new Map<string, GuidelineEntry[]>();
  for (const entry of entries) {
    const key = entry.topic.trim() || "general-recommendations";
    grouped.set(key, [...(grouped.get(key) || []), entry]);
  }
  const sections = Array.from(grouped.entries()).map(([title, sectionEntries], index) => {
    const sectionId = `${document.id}-${slugify(title) || "general-recommendations"}`;
    return { id: sectionId, slug: slugify(title) || "general-recommendations", title, titleVi: title, order: index + 1, summary: "Nội dung được chuyển từ guideline đã lưu.", recommendations: sectionEntries.map((entry) => mapEntry(document, entry, sectionId)), drugReferences: [], calculatorReferences: [], flowchartReferences: [] };
  });
  if (sections.length === 0) sections.push({ id: `${document.id}-overview`, slug: "overview", title: "Overview", titleVi: "Tổng quan", order: 1, summary: "Guideline chưa có recommendation đã lưu.", recommendations: [], drugReferences: [], calculatorReferences: [], flowchartReferences: [] });
  const allEntriesReviewed = entries.length > 0 && entries.every((entry) => entry.status === "reviewed");
  return { id: document.id, slug: slugify(`${document.society}-${document.title}-${document.publication_year}`) || document.id, title: document.title, titleVi: document.title, organization: document.society, publicationYear: document.publication_year, version: document.version_label, specialty: document.condition, topics: document.topics?.length ? document.topics : [document.condition], summary: document.summary || "Dữ liệu được chuyển từ kho guideline hiện có.", sourceUrl: document.source_url, lastReviewedAt: allEntriesReviewed ? new Date().toISOString() : "", status: allEntriesReviewed && document.visibility === "shared" ? "published" : "draft", isPlaceholder: false, sections };
}

export async function loadGuidelines(): Promise<Guideline[]> {
  try {
    const documents = await listGuidelineDocuments();
    if (documents.length === 0) return guidelines;
    const stored = await Promise.all(documents.map(async (document) => mapStoredGuideline(document, await listGuidelineEntries(document.id))));
    return stored;
  } catch {
    return guidelines;
  }
}
