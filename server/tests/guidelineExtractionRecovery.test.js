import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeGuidelineText,
  sourceSectionIdentity,
  structuralImportDiagnostics,
  canImportStructuredBatch,
  compareSourceRows,
  compareSourceTables,
  missingRecommendationTableNumbers,
} from "../services/guidelineExtractionRecovery.js";
import { reconstructGuidelinePageReadingOrder, singlePageSourceFallback } from "../services/guidelineImport.js";

test("normalizes Unicode, soft hyphens, ligatures and non-breaking spaces without changing clinical symbols", () => {
  const normalized = normalizeGuidelineText("NSTE-\u00AD\nACS\u00a0  \ufb01ndings ≥ 10 mg");
  assert.equal(normalized, "NSTE-ACS findings ≥ 10 mg");
});

test("inherits a recommendation page only when the extracted item is single-page", () => {
  assert.equal(singlePageSourceFallback({ pageStart: 9, pageEnd: 9 }), 9);
  assert.equal(singlePageSourceFallback({ pageStart: 9, pageEnd: null }), 9);
  assert.equal(singlePageSourceFallback({ pageStart: 9, pageEnd: 10 }), null);
});

test("reconstructs a two-column PDF in source reading order and keeps full-width rows separate", () => {
  const items = [
    { str: "Table 3", transform: [1, 0, 0, 1, 80, 700], width: 480 },
    { str: "1. Left section", transform: [1, 0, 0, 1, 40, 600], width: 120 },
    { str: "Left recommendation", transform: [1, 0, 0, 1, 40, 570], width: 160 },
    { str: "2. Right section", transform: [1, 0, 0, 1, 340, 600], width: 140 },
    { str: "Right recommendation", transform: [1, 0, 0, 1, 340, 570], width: 170 },
  ];
  assert.deepEqual(reconstructGuidelinePageReadingOrder(items, 600, 800), [
    "Table 3",
    "1. Left section",
    "Left recommendation",
    "2. Right section",
    "Right recommendation",
  ]);
});

test("keeps a mid-page full-width boundary in its source position", () => {
  const items = [
    { str: "Page heading", transform: [1, 0, 0, 1, 80, 740], width: 480 },
    { str: "Upper left", transform: [1, 0, 0, 1, 40, 680], width: 120 },
    { str: "Upper right", transform: [1, 0, 0, 1, 340, 680], width: 120 },
    { str: "Recommendation Table 4", transform: [1, 0, 0, 1, 80, 500], width: 480 },
    { str: "Lower left", transform: [1, 0, 0, 1, 40, 440], width: 120 },
    { str: "Lower right", transform: [1, 0, 0, 1, 340, 440], width: 120 },
  ];
  assert.deepEqual(reconstructGuidelinePageReadingOrder(items, 600, 800), [
    "Page heading",
    "Upper left",
    "Upper right",
    "Recommendation Table 4",
    "Lower left",
    "Lower right",
  ]);
});

test("keeps real source numbering and rejects temporary section identities", () => {
  assert.deepEqual(sourceSectionIdentity({ source_key: "section:3.2", title_original: "3.2 Diagnosis" }), {
    number: "3.2", title: "Diagnosis", temporary: false, canonicalKey: "section:3.2",
  });
  assert.equal(sourceSectionIdentity({ source_key: "1001", title_original: "Temporary" }).temporary, true);
});

test("structural diagnostics keep source Sections as non-blocking provenance metadata", () => {
  const diagnostics = structuralImportDiagnostics({
    items: [{ id: "table-1", resourceType: "recommendation_table", contentType: "recommendation_table", label: "Table 1", pageStart: 2 }],
    sections: [{ id: "s1", source_key: "section:4", title_original: "4. Imaging", source_page: 2 }],
    recommendations: [
      { source_key: "r1", import_section_id: "s1", recommendation_text_original: "Use imaging", recommendation_text_vi: "Dùng hình ảnh", source_page: 2 },
      { source_key: "r2", import_section_id: "missing", recommendation_text_original: "Use imaging", recommendation_text_vi: "Dùng hình ảnh", source_page: null },
    ],
    tables: [],
  });
  assert.ok(diagnostics.some((item) => item.code === "missing_source_page"));
  assert.equal(diagnostics.some((item) => item.code === "missing_section"), false);
  assert.ok(diagnostics.some((item) => item.code === "duplicate_recommendation"));
  assert.ok(diagnostics.some((item) => item.code === "incomplete_table"));
  assert.ok(diagnostics.some((item) => item.code === "inventory_mismatch"));
});

test("structural diagnostics deduplicate the same blocking issue from persisted and derived checks", () => {
  const diagnostics = structuralImportDiagnostics({
    recommendations: [{ source_key: "rec-1", recommendation_text_original: "Use imaging", recommendation_text_vi: "Dùng hình ảnh", source_page: null }],
    issues: [{ severity: "blocking", code: "missing_source_page", message: "Khuyến cáo rec-1 thiếu trang nguồn." }],
  });
  assert.equal(diagnostics.filter((item) => item.code === "missing_source_page").length, 1);
});

test("table ownership does not require a matching source Section to remain valid", () => {
  const diagnostics = structuralImportDiagnostics({
    sections: [
      { id: "imaging", source_key: "3.1", title_original: "Imaging" },
      { id: "invasive", source_key: "4.2", title_original: "Invasive strategy" },
    ],
    tables: [{ sourceKey: "table-5", sectionSourceKey: "3.1", sourcePage: 12, rows: [{ cellsOriginal: ["Use imaging"], cellsVi: ["Dùng hình ảnh"] }] }],
    recommendations: [{ source_key: "rec-1", import_section_id: "invasive", tableSourceKey: "table-5", recommendation_text_original: "Use imaging", recommendation_text_vi: "Dùng hình ảnh", source_page: 12 }],
  });
  assert.equal(diagnostics.some((item) => item.code === "wrong_section_suspected"), false);
});

test("optional Source Section provenance diagnostics do not block import", () => {
  const result = canImportStructuredBatch({
    items: [{ id: "table-5", resourceType: "recommendation_table", contentType: "recommendation_table", label: "Table 5", pageStart: 12 }],
    sections: [{ source_key: "1001", title_original: "Temporary", source_page: 12 }],
    tables: [{
      itemId: "table-5",
      sourceKey: "table-5",
      sourcePage: 12,
      rows: [{ cellsOriginal: ["Use imaging"], cellsVi: ["Dùng hình ảnh"] }],
    }],
    recommendations: [{
      source_key: "rec-1",
      tableSourceKey: "table-5",
      recommendation_text_original: "Use imaging",
      recommendation_text_vi: "Dùng hình ảnh",
      source_page: 12,
    }],
  });
  assert.equal(result.valid, true);
  assert.equal(result.blockers.length, 0);
  assert.ok(result.diagnostics.some((item) => item.code === "source_section_metadata_unresolved"));
});

test("keeps recommendation tables and rows in source order, not database or translation order", () => {
  const tables = [
    { tableNumber: "Table 9", sourceOrder: 8, sourcePage: 30 },
    { tableNumber: "Table 2", sourceOrder: 1, sourcePage: 9 },
    { tableNumber: "Table 5", sourceOrder: 4, sourcePage: 20 },
  ].sort(compareSourceTables);
  assert.deepEqual(tables.map((table) => table.tableNumber), ["Table 2", "Table 5", "Table 9"]);

  const rows = [
    { sourceOrder: 1, groupOrder: 1, rowOrder: 0 },
    { sourceOrder: 1, groupOrder: 0, rowOrder: 2 },
    { sourceOrder: 1, groupOrder: 0, rowOrder: 0 },
  ].sort(compareSourceRows);
  assert.deepEqual(rows.map((row) => `${row.groupOrder}:${row.rowOrder}`), ["0:0", "0:2", "1:0"]);
});

test("reports a missing recommendation table number without changing source positions", () => {
  const missing = missingRecommendationTableNumbers([
    { resourceType: "recommendation_table", label: "Recommendation Table 1" },
    { resourceType: "recommendation_table", label: "Recommendation Table 2" },
    { resourceType: "recommendation_table", label: "Recommendation Table 4" },
  ]);
  assert.deepEqual(missing, [3]);
  const diagnostics = structuralImportDiagnostics({
    items: [
      { resourceType: "recommendation_table", label: "Recommendation Table 1" },
      { resourceType: "recommendation_table", label: "Recommendation Table 3" },
    ],
  });
  assert.ok(diagnostics.some((item) => item.code === "missing_recommendation_table"));
});
