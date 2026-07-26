import test from "node:test";
import assert from "node:assert/strict";
import { buildImportPrompt, createDocumentItems, normalizeImportResult, validateImportForBulkImport } from "../services/guidelineImport.js";
import { classifyGuidelineItems, defaultSelection, groupedLocalDiagnostics, mandatoryRecommendationCompletion, selectTranslationItems } from "../services/guidelineTranslationPolicy.js";

test("detects every document section instead of stopping at the first table", () => {
  const items = createDocumentItems("Table 1: Dosing\nalpha\n\nFigure 2: Algorithm\nbeta\n\nAppendix A: Terms\ngamma");
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((item) => item.type), ["table", "figure", "appendix"]);
  assert.match(items[1].text, /Figure 2/);
});

test("normalizes AI output and creates review issues without inventing content", () => {
  const result = normalizeImportResult({
    document: { title: "ESC", organization: "ESC", year: 2021, version: "1", sourceLanguage: "en" },
    sections: [{ sourceKey: "s1", titleOriginal: "Section", titleVi: "Mục", parentSourceKey: "", summaryOriginal: "", summaryVi: "", level: 0, sourcePage: 2, sourceAnchor: "p2", displayOrder: 0 }],
    recommendations: [{ sourceKey: "r1", sectionSourceKey: "missing", titleOriginal: "", recommendationTextOriginal: "", recommendationTextVi: "", rationaleVi: "", recommendationClass: "", evidenceLevel: "", evidenceSystem: "", confidence: .5, sourcePage: 3, sourceQuote: "", sourceAnchor: "", coordinates: {}, displayOrder: 0 }],
    terminology: [{ sourceTerm: "HFrEF", preferredTranslation: "suy tim phân suất tống máu giảm" }],
    issues: [],
  });
  assert.equal(result.terminology[0].sourceTerm, "HFrEF");
  assert.ok(result.issues.some((issue) => issue.code === "missing_section"));
  assert.ok(result.issues.some((issue) => issue.code === "empty_recommendation"));
});

test("bulk import blocks unresolved quality issues and duplicate accepted records", () => {
  const errors = validateImportForBulkImport(
    { id: "job-1" },
    [{ review_status: "accepted" }],
    [{ review_status: "accepted", recommendation_text_vi: "x", duplicate_status: "exact" }],
    [],
  );
  assert.match(errors.join(" "), /trùng/);
});

test("prompt preserves source facts and forbids automatic publication", () => {
  const prompt = buildImportPrompt({ text: "Recommendation 10 mg", item: { label: "Table 1", pageStart: 4 }, sourceMetadata: { fileName: "esc.pdf" }, sourceLanguage: "en", targetLanguage: "vi", preserveAbbreviations: true, preserveEnglishTerminology: true });
  assert.match(prompt, /10 mg/);
  assert.match(prompt, /mảng tables/);
  assert.match(prompt, /không tự publish/i);
});

test("translates recommendation and clinically important tables by default", () => {
  const items = classifyGuidelineItems([
    { id: "recommendation", type: "document", label: "Recommendation", title: "", text: "Patients should be considered for treatment." },
    { id: "dose", type: "table", label: "Table 1", title: "Dosing regimen", text: "Table 1 Dosing regimen\nDrug | Dose\nAspirin | 75 mg daily\nClopidogrel | 75 mg daily" },
    { id: "contra", type: "table", label: "Table 2", title: "Contraindications", text: "Table 2 Contraindications\nCondition | Action\nBleeding | Do not use\nAllergy | Avoid" },
  ]);
  assert.deepEqual(defaultSelection(items), ["recommendation", "dose", "contra"]);
  assert.ok(items.every((item) => item.translationEligibility === "automatic"));
});

test("does not send figures, glossary, reference, or non-recommendation title-only tables to AI", () => {
  const items = classifyGuidelineItems([
    { id: "figure", type: "figure", label: "Figure 1", title: "Algorithm", text: "Figure 1: algorithm" },
    { id: "glossary", type: "document", label: "Glossary", title: "Abbreviations", text: "ACEI ARNI" },
    { id: "reference", type: "document", label: "References", title: "References", text: "1. Smith et al." },
    { id: "title-only", type: "table", label: "Table 9", title: "Baseline characteristics", text: "Table 9: Baseline characteristics" },
  ]);
  assert.equal(defaultSelection(items).length, 0);
  assert.equal(items[3].contentType, "missing_content");
  assert.equal(groupedLocalDiagnostics(items).find((item) => item.code === "missing_content")?.count, 1);
});

test("recommendation title-only table is mandatory and blocks completion until recovered", () => {
  const [item] = classifyGuidelineItems([{ id: "rec-title", type: "table", label: "Table 4", title: "Recommendations for ACS", text: "Table 4: Recommendations for ACS" }]);
  assert.equal(item.contentType, "recommendation_table_incomplete");
  assert.equal(item.translationEligibility, "blocked_pending_extraction");
  assert.equal(item.mandatory, true);
  assert.deepEqual(selectTranslationItems([item], [], "clinical_essentials", { "rec-title": { status: "blocked_pending_extraction" } }), []);
  assert.equal(mandatoryRecommendationCompletion([item], { "rec-title": { status: "blocked_pending_extraction" } }).complete, false);
});

test("mandatory recommendation table cannot be manually excluded and completed work is not retried", () => {
  const [item] = classifyGuidelineItems([{ id: "rec-table", type: "table", label: "Table 2", title: "Recommendations", text: "Table 2 Recommendations\nRecommendation | Class\nUse therapy | I\nAvoid therapy | III" }]);
  assert.deepEqual(selectTranslationItems([item], [], "selected_content", { "rec-table": { status: "pending" } }).map((value) => value.id), ["rec-table"]);
  assert.deepEqual(selectTranslationItems([item], ["rec-table"], "clinical_essentials", { "rec-table": { status: "translated" } }), []);
  assert.equal(mandatoryRecommendationCompletion([item], { "rec-table": { status: "translated" } }).complete, true);
});

test("resume processes only retryable work and keeps completed items out of the queue", () => {
  const items = classifyGuidelineItems([
    { id: "completed", type: "table", label: "Table 2", title: "Recommendations", text: "Table 2 Recommendations\nRecommendation | Class\nUse therapy | I\nAvoid therapy | III" },
    { id: "retry", type: "table", label: "Table 3", title: "Dosing", text: "Table 3 Dosing\nDrug | Dose\nAspirin | 75 mg\nClopidogrel | 75 mg" },
  ]);
  const queued = selectTranslationItems(items, items.map((item) => item.id), "clinical_essentials", {
    completed: { status: "translated" },
    retry: { status: "failed_retryable" },
  });
  assert.deepEqual(queued.map((item) => item.id), ["retry"]);
});

test("prioritizes recommendation content before dosing and other clinical tables", () => {
  const items = classifyGuidelineItems([
    { id: "monitoring", type: "table", label: "Table 4", title: "Monitoring", text: "Table 4 Monitoring\nTest | Frequency\nK+ | Monthly\nCreatinine | Monthly" },
    { id: "dose", type: "table", label: "Table 3", title: "Dosing", text: "Table 3 Dosing\nDrug | Dose\nAspirin | 75 mg\nClopidogrel | 75 mg" },
    { id: "recommendation", type: "table", label: "Table 2", title: "Recommendations", text: "Table 2 Recommendations\nRecommendation | Class\nUse therapy | I\nAvoid therapy | III" },
  ]);
  assert.deepEqual(selectTranslationItems(items, items.map((item) => item.id), "clinical_essentials", {}).map((item) => item.id), ["recommendation", "dose", "monitoring"]);
});

test("merges table continuation pages before classification", () => {
  const items = createDocumentItems("Table 3: Recommendations\n[Trang 10]\nRecommendation | Class\nUse aspirin | I\n\nTable 3: continued\n[Trang 11]\nRecommendation | Class\nContinue therapy | I");
  assert.equal(items.length, 1);
  assert.equal(items[0].contentType, "recommendation_table");
  assert.match(items[0].text, /Continue therapy/);
  assert.equal(items[0].pageEnd, 11);
});

test("table normalization preserves table cells and rejects invalid source page zero", () => {
  const normalized = normalizeImportResult({ document: {}, sections: [], recommendations: [], terminology: [], issues: [], tables: [{ sourceKey: "table-1", titleOriginal: "Dose", titleVi: "Liều", headersOriginal: ["Drug", "Dose"], headersVi: ["Thuốc", "Liều"], rows: [{ cellsOriginal: ["Aspirin", "75 mg"], cellsVi: ["Aspirin", "75 mg"] }], footnotesOriginal: ["a"], footnotesVi: ["a"], sourcePage: 0 }] });
  assert.deepEqual(normalized.tables[0].rows[0].cellsOriginal, ["Aspirin", "75 mg"]);
  assert.equal(normalized.tables[0].sourcePage, null);
});
