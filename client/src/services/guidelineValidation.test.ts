import assert from "node:assert/strict";
import test from "node:test";
import { validateGuidelineForPublication, validateRecommendationForPublication, validateGuidelineStatusTransition, validateRecommendationStatusTransition } from "./guidelineValidation.ts";

const source = { source_url: "https://example.test/guideline", doi: null, citation: "Example", file_path: null, provenance: [] };

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

test("unverified Recommendation stays hidden from publication", () => {
  const errors = validateRecommendationForPublication(
    { title: "Recommendation", recommendation_text_original: "Do this", recommendation_text_vi: "", section_id: "section-1", source_page: 2, source_quote: "", source_anchor: "", verification_status: "needs_review" },
    { id: "guideline-1", status: "published" },
    { id: "section-1", guideline_id: "guideline-1", status: "published" },
  );
  assert.ok(errors.some((error) => /verified/.test(error)));
});

test("archived Guideline and Recommendation cannot be reopened by direct status change", () => {
  assert.deepEqual(validateGuidelineStatusTransition("archived", "published"), ["Invalid Guideline status transition: archived -> published."]);
  assert.deepEqual(validateRecommendationStatusTransition("archived", "published"), ["Invalid Recommendation status transition: archived -> published."]);
});
