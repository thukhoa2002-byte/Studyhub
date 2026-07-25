import test from "node:test";
import assert from "node:assert/strict";
import { buildImportPrompt, createDocumentItems, normalizeImportResult, validateImportForBulkImport } from "../services/guidelineImport.js";

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
  assert.match(prompt, /không tự publish/i);
});
