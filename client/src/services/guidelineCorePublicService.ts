import { listGuidelineCoreDocumentPreviews, listPublishedGuidelineCoreDocumentsForPublic, requireGuidelineClient } from "./guidelineRepository";
import { listPublishedGuidelineRecommendationsForPublic } from "./guidelineRecommendationRepository";
import { listPublishedGuidelineSectionsForPublic } from "./guidelineSectionRepository";
import { listPublishedGuidelineRecommendationGroupsForPublic, listPublishedGuidelineRecommendationTablesForPublic } from "./guidelineRecommendationTableRepository";
import { listPublishedGuidelineClinicalTablesForPublic } from "./guidelineClinicalTableRepository";
import { mapPublishedCoreGuideline } from "./guidelineCorePublicMapper";
import { mapPublishedGuidelineToTableFirst, type PublicGuidelineTableFirst } from "./guidelineTableFirstPublicAdapter";
import type { Guideline } from "../types/guideline";
import type { GuidelineCorePreview } from "./guidelineCoreTypes";

export { mapPublishedCoreGuideline } from "./guidelineCorePublicMapper";

export type PublicGuidelinePreview = GuidelineCorePreview;

export async function listPublishedGuidelinePreviews(): Promise<PublicGuidelinePreview[]> {
  // The RPC is the preferred public boundary. The explicit-column fallback
  // keeps the catalog usable while the additive RLS migration is staged.
  const client = requireGuidelineClient();
  const { data, error } = await client.rpc("list_public_guideline_previews");
  if (!error && data) return data as PublicGuidelinePreview[];
  return listGuidelineCoreDocumentPreviews();
}

export async function loadPublishedCoreGuidelines(): Promise<Guideline[]> {
  const documents = await listPublishedGuidelineCoreDocumentsForPublic();
  if (documents.length === 0) return [];
  const guidelineIds = documents.map((document) => document.id);
  const [sections, recommendations] = await Promise.all([
    listPublishedGuidelineSectionsForPublic(guidelineIds),
    listPublishedGuidelineRecommendationsForPublic(guidelineIds),
  ]);
  const mapped = documents.map((document) => mapPublishedCoreGuideline(document, sections, recommendations));
  return mapped.filter((guideline): guideline is Guideline => guideline !== null);
}

export async function loadPublishedTableFirstGuidelines(): Promise<PublicGuidelineTableFirst[]> {
  const documents = await listPublishedGuidelineCoreDocumentsForPublic();
  if (documents.length === 0) return [];
  const guidelineIds = documents.map((document) => document.id);
  const [sections, recommendations, tables, groups, clinicalTables] = await Promise.all([
    // Kept only to enrich optional source provenance. A failed or unpublished
    // source section must never hide a published table resource.
    listPublishedGuidelineSectionsForPublic(guidelineIds).catch(() => []),
    listPublishedGuidelineRecommendationsForPublic(guidelineIds),
    listPublishedGuidelineRecommendationTablesForPublic(guidelineIds).catch(() => []),
    listPublishedGuidelineRecommendationGroupsForPublic(guidelineIds).catch(() => []),
    listPublishedGuidelineClinicalTablesForPublic(guidelineIds).catch(() => []),
  ]);
  return documents
    .map((document) => mapPublishedGuidelineToTableFirst(document, sections, tables, groups, recommendations, clinicalTables.filter((table) => table.guideline_id === document.id)))
    .filter((guideline): guideline is PublicGuidelineTableFirst => guideline !== null);
}

export function findPublishedTableFirstGuidelineBySlug(guidelines: PublicGuidelineTableFirst[], slug: string): PublicGuidelineTableFirst | undefined {
  return guidelines.find((guideline) => guideline.slug === slug);
}

export function findPublishedCoreGuidelineBySlug(guidelines: Guideline[], slug: string): Guideline | undefined {
  return guidelines.find((guideline) => guideline.slug === slug);
}

export function findPublishedCoreGuidelineById(guidelines: Guideline[], id: string): Guideline | undefined {
  return guidelines.find((guideline) => guideline.id === id);
}
