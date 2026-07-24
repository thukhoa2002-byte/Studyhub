import assert from "node:assert/strict";
import test from "node:test";
import type { CalculatorGuidelineReferenceRow } from "../modules/calculators/databaseTypes.ts";
import { findStaleCalculatorGuidelineReferences } from "./calculatorGuidelineIntegrity.ts";

const baseReference: CalculatorGuidelineReferenceRow = {
  id: "ref-1",
  calculator_id: "calc-1",
  guideline_id: "guide-1",
  section_id: "section-1",
  recommendation_id: "entry-1",
  relation_type: "recommended-use",
  context: { vi: "", en: "" },
  required: false,
  display_order: 0,
  owner_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const targets = {
  calculators: [{ id: "calc-1" }],
  documents: [{ id: "guide-1", visibility: "shared" as const, status: "published" as const }],
  sections: [{ id: "section-1", guideline_id: "guide-1", status: "published" as const }],
  recommendations: [{ id: "entry-1", guideline_id: "guide-1", section_id: "section-1", status: "published" as const, verification_status: "verified" as const }],
};

test("valid calculator-guideline reference is not stale", () => {
  assert.deepEqual(findStaleCalculatorGuidelineReferences([baseReference], targets), []);
});

test("stale checker reports missing and cross-parent targets", () => {
  const stale = findStaleCalculatorGuidelineReferences([
    { ...baseReference, calculator_id: "missing-calculator" },
    { ...baseReference, section_id: "missing-section" },
    { ...baseReference, guideline_id: "guide-2" },
    { ...baseReference, recommendation_id: "entry-2" },
  ], {
    ...targets,
    documents: [...targets.documents, { id: "guide-2", visibility: "private" as const, status: "draft" as const }],
    recommendations: [...targets.recommendations, { id: "entry-2", guideline_id: "guide-2", section_id: "section-1", status: "draft" as const, verification_status: "unverified" as const }],
  });

  assert.deepEqual(stale[0]?.reasons, ["missing-calculator"]);
  assert.ok(stale[1]?.reasons.includes("missing-section"));
  assert.ok(stale[2]?.reasons.includes("guideline-not-published"));
  assert.ok(stale[3]?.reasons.includes("recommendation-wrong-guideline"));
  assert.ok(stale[3]?.reasons.includes("recommendation-not-publishable"));
});

test("section and document references require reviewed entries", () => {
  const sectionStale = findStaleCalculatorGuidelineReferences([{ ...baseReference, recommendation_id: null }], {
    ...targets,
    sections: [{ id: "section-1", guideline_id: "guide-1", status: "draft" }],
  });
  assert.deepEqual(sectionStale[0]?.reasons, ["section-not-published"]);
});
