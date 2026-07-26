import type {
  GuidelineCoreDocument,
  GuidelineClinicalTableRecord,
  GuidelineRecommendationGroupRecord,
  GuidelineRecommendationRecord,
  GuidelineRecommendationTableRecord,
  GuidelineSectionRecord,
} from "./guidelineCoreTypes";

export interface PublicRecommendationTableRow {
  id: string;
  sectionId: string;
  groupId: string;
  title: string;
  textOriginal: string;
  textVi: string;
  recommendationClass: string;
  evidenceLevel: string;
  evidenceSystem: string;
  population: string;
  context: string;
  sourcePage: number | null;
  sourceQuote: string;
  sortOrder: number;
}

export interface PublicRecommendationTableGroup {
  id: string;
  sourceHeading: string;
  titleVi: string;
  context: string;
  sourcePage: number | null;
  groupOrder: number;
  rows: PublicRecommendationTableRow[];
}

export interface PublicRecommendationTable {
  id: string;
  tableNumber: string;
  sourceTableNumber: string;
  sourceTitle: string;
  titleVi: string;
  description: string;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  sourceOrder: number;
  sourceSection: { id: string; number: string; title: string; titleVi: string } | null;
  groups: PublicRecommendationTableGroup[];
}

export interface PublicGuidelineTableFirst {
  id: string;
  slug: string;
  title: string;
  society: string;
  condition: string;
  publicationYear: number | null;
  versionLabel: string;
  summary: string;
  sourceUrl: string | null;
  citation: string | null;
  recommendationTables: PublicRecommendationTable[];
  structuredTables: PublicStructuredTable[];
}

export interface PublicStructuredTable {
  id: string;
  tableNumber: string;
  sourceTitle: string;
  titleVi: string;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  headers: string[];
  rows: string[][];
  footnotes: string[];
  sourceOrder: number;
}

function displayTitle(section: GuidelineSectionRecord) {
  return section.title_vi.trim() || section.title.trim();
}

function toRow(row: GuidelineRecommendationRecord): PublicRecommendationTableRow {
  return {
    id: row.id,
    sectionId: row.section_id ?? "",
    groupId: row.recommendation_group_id ?? "",
    title: row.title,
    textOriginal: row.recommendation_text_original,
    textVi: row.recommendation_text_vi,
    recommendationClass: row.recommendation_class,
    evidenceLevel: row.evidence_level,
    evidenceSystem: row.evidence_system,
    population: row.population,
    context: row.conditions,
    sourcePage: row.source_page,
    sourceQuote: row.source_quote,
    sortOrder: row.sort_order,
  };
}

export function mapPublishedGuidelineToTableFirst(
  document: GuidelineCoreDocument,
  sections: GuidelineSectionRecord[],
  tables: GuidelineRecommendationTableRecord[],
  groups: GuidelineRecommendationGroupRecord[],
  recommendations: GuidelineRecommendationRecord[],
  clinicalTables: GuidelineClinicalTableRecord[] = [],
): PublicGuidelineTableFirst | null {
  if (document.status !== "published") return null;
  // Source sections are provenance metadata. They never decide whether a
  // complete published recommendation table is available to readers.
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  const groupsByTable = new Map<string, GuidelineRecommendationGroupRecord[]>();
  for (const group of groups) {
    if (group.status !== "published") continue;
    const current = groupsByTable.get(group.recommendation_table_id) ?? [];
    current.push(group);
    groupsByTable.set(group.recommendation_table_id, current);
  }
  const rowsByGroup = new Map<string, PublicRecommendationTableRow[]>();
  for (const recommendation of recommendations) {
    if (
      recommendation.status !== "published"
      || recommendation.verification_status !== "verified"
      || !recommendation.recommendation_table_id
      || !recommendation.recommendation_group_id
    ) continue;
    const current = rowsByGroup.get(recommendation.recommendation_group_id) ?? [];
    current.push(toRow(recommendation));
    rowsByGroup.set(recommendation.recommendation_group_id, current);
  }
  const recommendationTables = tables
    .filter((table) => table.status === "published" && table.is_complete)
    .map((table) => {
      const sourceSection = table.section_id ? sectionsById.get(table.section_id) ?? null : null;
      const tableGroups = (groupsByTable.get(table.id) ?? [])
        .sort((left, right) => left.group_order - right.group_order)
        .map((group) => ({
          id: group.id,
          sourceHeading: group.source_heading,
          titleVi: group.title_vi,
          context: group.context,
          sourcePage: group.source_page,
          groupOrder: group.group_order,
          rows: (rowsByGroup.get(group.id) ?? [])
            .filter((row) => row.groupId === group.id)
            .slice()
            .sort((left, right) => left.sortOrder - right.sortOrder),
        }))
        .filter((group) => group.rows.length > 0);
      return {
        id: table.id,
        tableNumber: table.table_number,
        sourceTableNumber: table.source_table_number ?? table.table_number,
        sourceTitle: table.title,
        titleVi: table.title_vi,
        description: table.short_description ?? "",
        sourcePageStart: table.source_page_start ?? table.source_page,
        sourcePageEnd: table.source_page_end ?? table.source_page,
        sourceOrder: table.source_order ?? table.display_order,
        sourceSection: sourceSection ? {
          id: sourceSection.id,
          number: sourceSection.section_number ?? "",
          title: sourceSection.title,
          titleVi: displayTitle(sourceSection),
        } : null,
        groups: tableGroups,
      };
    })
    .filter((table) => table.groups.length > 0)
    .sort((left, right) => left.sourceOrder - right.sourceOrder
      || (left.sourcePageStart ?? Number.MAX_SAFE_INTEGER) - (right.sourcePageStart ?? Number.MAX_SAFE_INTEGER)
      || left.tableNumber.localeCompare(right.tableNumber, undefined, { numeric: true }));

  return {
    id: document.id,
    slug: toSlug(document),
    title: document.title,
    society: document.society,
    condition: document.condition,
    publicationYear: document.publication_year,
    versionLabel: document.version_label,
    summary: document.summary,
    sourceUrl: document.source_url,
    citation: document.citation,
    recommendationTables,
    structuredTables: clinicalTables
      .filter((table) => table.status === "published" && table.is_complete && (table.title.trim() || table.title_vi.trim()) && table.rows_original.length > 0)
      .map((table) => ({
        id: table.id,
        tableNumber: table.table_number,
        sourceTitle: table.title,
        titleVi: table.title_vi,
        sourcePageStart: table.source_page_start,
        sourcePageEnd: table.source_page_end,
        headers: table.headers_vi.length ? table.headers_vi : table.headers_original,
        rows: table.rows_vi.length ? table.rows_vi : table.rows_original,
        footnotes: table.footnotes_vi.length ? table.footnotes_vi : table.footnotes_original,
        sourceOrder: table.source_order,
      }))
      .sort((left, right) => left.sourceOrder - right.sourceOrder
        || (left.sourcePageStart ?? Number.MAX_SAFE_INTEGER) - (right.sourcePageStart ?? Number.MAX_SAFE_INTEGER)
        || left.tableNumber.localeCompare(right.tableNumber, undefined, { numeric: true })),
  };
}

function toSlug(document: GuidelineCoreDocument): string {
  return `${document.society}-${document.title}-${document.publication_year ?? document.version_label}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || document.id;
}
