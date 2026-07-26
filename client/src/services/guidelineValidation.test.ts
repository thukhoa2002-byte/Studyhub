import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGuidelineCoreCondition } from "./guidelineCoreTypes.ts";
import { validateGuidelineForPublication, validateRecommendationForPublication, validateGuidelineStatusTransition, validateRecommendationStatusTransition } from "./guidelineValidation.ts";
import { summarizeSectionBulkPublication } from "./guidelineBulkPublicationPolicy.ts";

const source = { source_url: "https://example.test/guideline", doi: null, citation: "Example", file_path: null, provenance: [] };

test("new Guideline writes normalize unsupported or empty condition values to Khác", () => {
  assert.equal(normalizeGuidelineCoreCondition("ACS"), "ACS");
  assert.equal(normalizeGuidelineCoreCondition(""), "Khác");
  assert.equal(normalizeGuidelineCoreCondition("Heart failure"), "Khác");
});

test("manual Guideline can be validated without a source document when citation exists", () => {
  const errors = validateGuidelineForPublication(
    { title: "STAGING_TEST_Guideline", publication_year: 2026, version_label: "1.0", ...source },
    [{ status: "published" }],
    [],
  );
  assert.deepEqual(errors, []);
});

test("Guideline publication requires source traceability and an eligible child", () => {
  const errors = validateGuidelineForPublication(
    { title: "STAGING_TEST_Guideline", publication_year: null, version_label: "", source_url: null, doi: null, citation: null, file_path: null, provenance: [] },
    [{ status: "draft" }],
    [],
  );
  assert.equal(errors.length, 3);
});

test("verified Recommendation requires the matching published Guideline and Section", () => {
  const recommendation = { title: "Recommendation", recommendation_text_original: "Do this", recommendation_text_vi: "Làm điều này", section_id: "section-1", source_page: 2, source_quote: "quote", source_anchor: "p2", verification_status: "verified" as const };
  assert.deepEqual(validateRecommendationForPublication(recommendation, { id: "guideline-1", status: "published" }, { id: "section-1", guideline_id: "guideline-1", status: "published" }), []);
  assert.ok(validateRecommendationForPublication(recommendation, { id: "guideline-2", status: "published" }, { id: "section-1", guideline_id: "guideline-1", status: "published" }).some((error) => /same Guideline/.test(error)));
});

test("single-admin publication does not require a separate verification state", () => {
  const errors = validateRecommendationForPublication(
    { title: "Recommendation", recommendation_text_original: "Do this", recommendation_text_vi: "", section_id: "section-1", source_page: 2, source_quote: "", source_anchor: "", verification_status: "needs_review" },
    { id: "guideline-1", status: "published" },
    { id: "section-1", guideline_id: "guideline-1", status: "published" },
  );
  assert.deepEqual(errors, []);
});

test("section bulk summary is scoped and does not count published rows as drafts", () => {
  const recommendations = [
    { id: "draft", section_id: "section-1", status: "draft" },
    { id: "published", section_id: "section-1", status: "published" },
    { id: "other", section_id: "section-2", status: "draft" },
    { id: "archived", section_id: "section-1", status: "archived" },
  ] as never[];
  assert.deepEqual(summarizeSectionBulkPublication("section-1", [], recommendations), { total: 3, draft: 1, published: 1, blocked: 1 });
});

test("archived Guideline and Recommendation can be restored or republished through validation", () => {
  assert.deepEqual(validateGuidelineStatusTransition("archived", "draft"), []);
  assert.deepEqual(validateGuidelineStatusTransition("archived", "published"), []);
  assert.deepEqual(validateRecommendationStatusTransition("archived", "draft"), []);
  assert.deepEqual(validateRecommendationStatusTransition("archived", "published"), []);
  assert.notDeepEqual(validateGuidelineStatusTransition("published", "draft"), []);
});
