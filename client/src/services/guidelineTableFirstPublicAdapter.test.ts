import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mapPublishedGuidelineToTableFirst } from "./guidelineTableFirstPublicAdapter.ts";
import type { GuidelineClinicalTableRecord, GuidelineCoreDocument, GuidelineRecommendationGroupRecord, GuidelineRecommendationRecord, GuidelineRecommendationTableRecord, GuidelineSectionRecord } from "./guidelineCoreTypes.ts";

const document: GuidelineCoreDocument = {
  id: "guideline-1", owner_id: "owner-1", title: "ESC source", society: "ESC", condition: "ACS", publication_year: 2023,
  version_label: "2023", summary: "Summary", topics: [], source_url: null, doi: null, citation: "Citation", file_path: null,
  supplement_file_path: null, provenance: [], visibility: "shared", status: "published", review_note: "", published_at: null,
  archived_at: null, published_by: null, archived_by: null, created_at: "2026-01-01", updated_at: "2026-01-01",
};
const section: GuidelineSectionRecord = {
  id: "section-1", guideline_id: document.id, owner_id: "owner-1", parent_section_id: null, slug: "section-1", section_number: "5",
  title: "Reperfusion", title_vi: "Tái tưới máu", summary: "", display_order: 1, status: "published", created_at: "2026-01-01", updated_at: "2026-01-01",
};
function table(id: string, sourcePageStart: number, sourceOrder: number): GuidelineRecommendationTableRecord {
  return {
    id, guideline_id: document.id, section_id: section.id, owner_id: "owner-1", table_number: id.replace("table-", ""), source_table_number: id,
    title: `Source ${id}`, title_vi: `Bảng ${id}`, short_description: "", source_page: sourcePageStart, source_page_start: sourcePageStart,
    source_page_end: sourcePageStart, source_quote: "", source_anchor: "", source_order: sourceOrder, display_order: sourceOrder,
    is_complete: true, translation_status: "reviewed", status: "published", created_at: "2026-01-01", updated_at: "2026-01-01",
  };
}
function group(id: string, tableId: string, order: number): GuidelineRecommendationGroupRecord {
  return { id, guideline_id: document.id, section_id: section.id, recommendation_table_id: tableId, owner_id: "owner-1", source_heading: `Source ${id}`, title_vi: `Nhóm ${id}`, context: "", source_page: 1, group_order: order, status: "published", created_at: "2026-01-01", updated_at: "2026-01-01" };
}
function recommendation(id: string, tableId: string | null, groupId: string | null, order: number, overrides: Partial<GuidelineRecommendationRecord> = {}): GuidelineRecommendationRecord {
  return {
    id, guideline_id: document.id, section_id: section.id, recommendation_table_id: tableId, recommendation_group_id: groupId, owner_id: "owner-1",
    title: id, recommendation_text_original: `Source ${id}`, recommendation_text_vi: `Dịch ${id}`, rationale_vi: "", recommendation_class: "I",
    evidence_level: "A", evidence_system: "ESC", population: "", intervention: "", comparator: "", outcome: "", conditions: "", contraindications: "",
    source_page: 1, source_quote: "", source_anchor: "", verification_status: "verified", review_note: "", reviewed_by: "owner-1", reviewed_at: "2026-01-01",
    status: "published", sort_order: order, created_at: "2026-01-01", updated_at: "2026-01-01", ...overrides,
  };
}

test("table-first adapter preserves source order rather than creation order", () => {
  const first = table("table-1", 10, 1);
  const later = table("table-2", 12, 2);
  const result = mapPublishedGuidelineToTableFirst(document, [section], [later, first], [group("group-1", first.id, 1), group("group-2", later.id, 1)], [
    recommendation("row-later", later.id, "group-2", 1), recommendation("row-first", first.id, "group-1", 1),
  ]);
  assert.deepEqual(result?.recommendationTables.map((item) => item.id), ["table-1", "table-2"]);
});

test("does not require a published Source Section to expose a complete table", () => {
  const sourceTable = { ...table("table-1", 10, 1), section_id: null };
  const sourceGroup = { ...group("group-1", sourceTable.id, 1), section_id: null };
  const sourceRow = { ...recommendation("row-1", sourceTable.id, sourceGroup.id, 1), section_id: null };
  const result = mapPublishedGuidelineToTableFirst(document, [{ ...section, status: "draft" }], [sourceTable], [sourceGroup], [sourceRow]);
  assert.equal(result?.recommendationTables.length, 1);
  assert.equal(result?.recommendationTables[0]?.sourceSection, null);
});

test("keeps rows inside their explicit table and group without guessing ownership", () => {
  const sourceTable = table("table-1", 10, 1);
  const result = mapPublishedGuidelineToTableFirst(document, [section], [sourceTable], [group("group-1", sourceTable.id, 1)], [
    recommendation("row-2", sourceTable.id, "group-1", 2), recommendation("row-1", sourceTable.id, "group-1", 1),
    recommendation("unmapped", sourceTable.id, null, 3),
  ]);
  assert.deepEqual(result?.recommendationTables[0]?.groups[0]?.rows.map((item) => item.id), ["row-1", "row-2"]);
});

test("does not expose incomplete tables or unverified recommendation rows", () => {
  const sourceTable = table("table-1", 10, 1);
  const result = mapPublishedGuidelineToTableFirst(document, [section], [{ ...sourceTable, is_complete: false }], [group("group-1", sourceTable.id, 1)], [
    recommendation("row-1", sourceTable.id, "group-1", 1, { verification_status: "unverified" }),
  ]);
  assert.equal(result?.recommendationTables.length, 0);
});

test("keeps a Clinical Table distinct from Recommendation Tables", () => {
  const clinical: GuidelineClinicalTableRecord = {
    id: "clinical-1", guideline_id: document.id, section_id: null, owner_id: "owner-1", table_number: "6", title: "Dose table", title_vi: "Bảng liều",
    short_description: "", source_page_start: 20, source_page_end: 20, source_order: 3, headers_original: ["Dose", "Note"], headers_vi: ["Liều", "Ghi chú"],
    rows_original: [["5 mg", "daily"]], rows_vi: [["5 mg", "mỗi ngày"]], footnotes_original: [], footnotes_vi: [], is_complete: true, status: "published", created_at: "2026-01-01", updated_at: "2026-01-01",
  };
  const result = mapPublishedGuidelineToTableFirst(document, [], [], [], [], [clinical]);
  assert.equal(result?.recommendationTables.length, 0);
  assert.deepEqual(result?.structuredTables[0]?.headers, ["Liều", "Ghi chú"]);
  assert.equal(result?.structuredTables[0]?.rows[0]?.[0], "5 mg");
});

test("public renderer uses table-first resources rather than generic section cards", () => {
  const page = readFileSync(new URL("../components/GuidelineDataPage.tsx", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../components/GuidelineTableFirstView.tsx", import.meta.url), "utf8");
  assert.match(page, /GuidelineTableFirstView/);
  assert.match(renderer, /RecommendationTableRenderer/);
  assert.match(renderer, /RecommendationGroupBlock/);
  assert.match(renderer, /StructuredTableRenderer/);
  assert.match(renderer, /recommendation-table-\$\{table\.id\}/);
  assert.match(renderer, /recommendation-\$\{row\.id\}/);
  assert.match(renderer, /Bảng lâm sàng/);
});
