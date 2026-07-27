import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildImportPrompt, createDocumentItems, normalizeImportResult, validateImportForBulkImport } from "../services/guidelineImport.js";
import { classifyGuidelineItems, defaultSelection, groupedLocalDiagnostics, initializeItemStates, inventoryDiagnostics, mandatoryRecommendationCompletion, selectTranslationItems, translationSummary } from "../services/guidelineTranslationPolicy.js";
import { figureDisplayModel } from "../services/guidelineFigurePolicy.js";

test("table-first import does not require Section output or emit missing_section blockers", () => {
  const service = readFileSync(new URL("../services/guidelineImport.js", import.meta.url), "utf8");
  const route = readFileSync(new URL("../routes/guidelineImport.js", import.meta.url), "utf8");
  assert.doesNotMatch(service.match(/required: \[[^\n]+/)?.[0] || "", /"sections"/);
  assert.match(route, /GUIDELINE_LEGACY_SECTION_IMPORT === "enabled"/);
  assert.doesNotMatch(route, /code: "missing_section"/);
  assert.match(route, /const sourceSections = \[\]/);
});

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
  assert.equal(result.issues.some((issue) => issue.code === "missing_section"), false);
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

test("bulk import does not require an accepted source Section", () => {
  const errors = validateImportForBulkImport(
    { id: "job-1", analysis_metadata: { items: [] } },
    [],
    [{ review_status: "accepted", recommendation_text_vi: "Nội dung", duplicate_status: "new" }],
    [],
  );
  assert.equal(errors.some((error) => /section/i.test(error)), false);
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

test("mandatory recommendation table cannot be manually excluded and requires explicit table review", () => {
  const [item] = classifyGuidelineItems([{ id: "rec-table", type: "table", label: "Table 2", title: "Recommendations", text: "Table 2 Recommendations\nRecommendation | Class\nUse therapy | I\nAvoid therapy | III" }]);
  assert.deepEqual(selectTranslationItems([item], [], "selected_content", { "rec-table": { status: "pending" } }).map((value) => value.id), ["rec-table"]);
  assert.deepEqual(selectTranslationItems([item], ["rec-table"], "clinical_essentials", { "rec-table": { status: "translated" } }), []);
  assert.equal(mandatoryRecommendationCompletion([item], { "rec-table": { status: "translated" } }).complete, false);
  assert.equal(mandatoryRecommendationCompletion([item], { "rec-table": { status: "needs_review" } }).complete, false);
  assert.equal(mandatoryRecommendationCompletion([item], { "rec-table": { status: "reviewed" } }).complete, true);
});

test("mandatory recommendation tables are never skipped as duplicate content", () => {
  const items = classifyGuidelineItems([
    { id: "rec-1", type: "table", label: "Table 7", title: "Recommendations", text: "Table 7 Recommendations\nRecommendation | Class\nUse therapy | I" },
    { id: "rec-2", type: "table", label: "Table 7", title: "Recommendations", text: "Table 7 Recommendations\nRecommendation | Class\nUse therapy | I" },
  ]);
  const states = initializeItemStates(items, items.map((item) => item.id));
  assert.equal(states["rec-1"].status, "pending");
  assert.equal(states["rec-2"].status, "pending");
  assert.deepEqual(selectTranslationItems(items, items.map((item) => item.id), "clinical_essentials", states).map((item) => item.id), ["rec-1", "rec-2"]);
});

test("recognizes recommendation tables from body signals even with a generic or reference-like title", () => {
  const [item] = classifyGuidelineItems([{ id: "body-rec", type: "table", label: "Table 8", title: "References", text: "Table 8 References\nRecommendation statement | Class | LoE\nAspirin is recommended | I | A" }]);
  assert.equal(item.contentType, "recommendation_table");
  assert.equal(item.mandatory, true);
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

test("quota pause preserves a mandatory recommendation table as incomplete work", () => {
  const [item] = classifyGuidelineItems([{ id: "quota-rec", type: "table", label: "Table 10", title: "Recommendations", text: "Table 10 Recommendations\nRecommendation | Class\nUse therapy | I" }]);
  const states = { "quota-rec": { status: "failed_retryable", errorCode: "provider_quota_exhausted" } };
  assert.deepEqual(selectTranslationItems([item], [item.id], "clinical_essentials", states).map((candidate) => candidate.id), [item.id]);
  assert.equal(mandatoryRecommendationCompletion([item], states).complete, false);
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
  assert.equal(items[0].sourceOrder, 0);
  assert.equal(items[0].sourceTableNumber, "Table 3");
});

test("merges repeated table labels across continuation pages without relying on continuation wording", () => {
  const items = createDocumentItems("Table 9: Recommendations\n[Trang 10]\nRecommendation | Class\nUse aspirin | I\n\nTable 9: Recommendations\n[Trang 11]\nRecommendation | Class\nContinue therapy | I");
  assert.equal(items.length, 1);
  assert.match(items[0].text, /Continue therapy/);
});

test("does not cut a table when a cell starts with lowercase algorithm", () => {
  const items = createDocumentItems([
    "Table 5 Revised recommendations",
    "Recommendations in 2017 and 2020 versions | Class LoE",
    "An early invasive strategy is recommended in patients with any of the following high-risk criteria:",
    "• Diagnosis of NSTEMI suggested by the diagnostic algorithm recommended in Section 3",
    "I A",
    "Recommendations in 2023 version | Class LoE",
    "The new recommendation should remain part of Table 5.",
    "Table 6 Dose regimen",
  ].join("\n"));
  assert.equal(items[0].label, "Table 5");
  assert.match(items[0].text, /diagnostic algorithm recommended in Section 3/);
  assert.match(items[0].text, /The new recommendation should remain part of Table 5/);
  assert.equal(items[1].label, "Table 6");
});

test("table normalization preserves table cells and rejects invalid source page zero", () => {
  const normalized = normalizeImportResult({ document: {}, sections: [], recommendations: [], terminology: [], issues: [], tables: [{ sourceKey: "table-1", titleOriginal: "Dose", titleVi: "Liều", headersOriginal: ["Drug", "Dose"], headersVi: ["Thuốc", "Liều"], rows: [{ cellsOriginal: ["Aspirin", "75 mg"], cellsVi: ["Aspirin", "75 mg"] }], footnotesOriginal: ["a"], footnotesVi: ["a"], sourcePage: 0 }] });
  assert.deepEqual(normalized.tables[0].rows[0].cellsOriginal, ["Aspirin", "75 mg"]);
  assert.equal(normalized.tables[0].sourcePage, null);
  assert.equal(normalized.tables[0].rows[0].rowOrder, 0);
});

test("keeps recommendation tables, clinical tables, and figures as distinct canonical resources", () => {
  const items = classifyGuidelineItems([
    { id: "rec", type: "table", label: "Recommendation Table 1", title: "Treatment recommendations", text: "Recommendation Table 1\nRecommendation | Class | LoE\nAspirin is recommended | I | A" },
    { id: "framework", type: "table", label: "Table 1", title: "Classes of Recommendations", text: "Table 1\nClass I | Evidence that treatment is beneficial\nClass II | Conflicting evidence" },
    { id: "figure", type: "figure", label: "Figure 1", title: "ACS management algorithm", text: "Figure 1: ACS management algorithm" },
  ]);
  assert.equal(items[0].resourceType, "recommendation_table");
  assert.equal(items[1].resourceType, "clinical_table");
  assert.equal(items[1].clinicalTableSubtype, "framework");
  assert.equal(items[2].resourceType, "figure");
  assert.equal(items[2].figure.permissionStatus, "private_educational_use");
});

test("does not turn a clinical table row into a formal recommendation", () => {
  const [item] = classifyGuidelineItems([{ id: "dose", type: "table", label: "Table 6", title: "Dosing", text: "Table 6 Dosing\nDrug | Dose\nAspirin | 75 mg daily" }]);
  assert.equal(item.resourceType, "clinical_table");
  assert.equal(item.mandatory, undefined);
  assert.equal(item.clinicalTableSubtype, "dosing");
});

test("title-only recommendation tables remain blocking while title-only clinical tables can be skipped", () => {
  const items = classifyGuidelineItems([
    { id: "rec", type: "table", label: "Recommendation Table 7", title: "Recommendations for ACS", text: "Recommendation Table 7: Recommendations for ACS" },
    { id: "clinical", type: "table", label: "Table 8", title: "Definitions", text: "Table 8: Definitions" },
  ]);
  assert.equal(items[0].contentType, "recommendation_table_incomplete");
  assert.equal(items[0].translationEligibility, "blocked_pending_extraction");
  assert.equal(items[1].contentType, "missing_content");
  assert.equal(items[1].translationEligibility, "not_required");
});

test("figure has independent original asset and translated caption fields without creating a recommendation", () => {
  const [figure] = classifyGuidelineItems([{ id: "figure-2", type: "figure", label: "Figure 2", title: "Risk pathway", pageStart: 12, text: "Figure 2: Risk pathway" }]);
  assert.equal(figure.figure.originalAssetPath, "");
  assert.equal(figure.figure.translatedCaption, "");
  assert.equal(figure.figure.extractionStatus, "caption_extracted");
  assert.equal(figure.mandatory, undefined);
});

test("keeps original Figure asset private unless public reproduction is explicitly granted", () => {
  const figure = {
    figureNumber: "1",
    sourceTitle: "Algorithm",
    translatedCaption: "Tóm tắt thuật toán.",
    originalAssetPath: "owner/job/figures/figure-1.png",
    permissionStatus: "permission_pending",
    sourcePages: [12],
    relatedRecommendationIds: ["rec-1"],
  };
  const publicView = figureDisplayModel(figure);
  assert.equal(publicView.mode, "metadata_only");
  assert.equal("originalAssetPath" in publicView, false);
  assert.equal(publicView.relatedRecommendationIds[0], "rec-1");
  const adminView = figureDisplayModel(figure, { isOwnerOrAdmin: true });
  assert.equal(adminView.mode, "original");
  assert.equal(adminView.originalAssetPath, figure.originalAssetPath);
  const grantedView = figureDisplayModel({ ...figure, permissionStatus: "permission_granted" });
  assert.equal(grantedView.canDisplayPublicImage, true);
  assert.equal(grantedView.originalAssetPath, figure.originalAssetPath);
});

test("expected ESC ACS inventory is tracked separately and missing figures do not block recommendation completion", () => {
  const items = classifyGuidelineItems([{ id: "rec", type: "table", label: "Recommendation Table 1", title: "Recommendations", text: "Recommendation Table 1\nRecommendation | Class\nTherapy is recommended | I" }]);
  const diagnostics = inventoryDiagnostics(items, { fileName: "2023 ESC Guidelines for the management of ACS.pdf" });
  assert.equal(diagnostics.length, 3);
  assert.ok(diagnostics.some((item) => item.code === "inventory_missing_figures"));
  assert.equal(mandatoryRecommendationCompletion(items, { rec: { status: "reviewed" } }).complete, true);
  const summary = translationSummary(items, ["rec"], "clinical_essentials", { rec: { status: "reviewed" } });
  assert.equal(summary.resources.recommendationTables.extracted, 1);
  assert.equal(summary.resources.figures.extracted, 0);
});
