import assert from "node:assert/strict";
import test from "node:test";
import { classifyLegacyGuidelineEntry, legacyEntryToRecommendationCandidate } from "./guidelineLegacyMigrationService.ts";
import type { GuidelineEntry } from "./guidelines.ts";

function entry(overrides: Partial<GuidelineEntry> = {}): GuidelineEntry {
  return {
    id: "entry-1",
    document_id: "guideline-1",
    section_id: "section-1",
    owner_id: "owner-1",
    topic: "Beta blocker",
    drug_name: "",
    clinical_context: "HFrEF",
    recommendation_summary: "Use the recommended dose.",
    dose: "",
    renal_adjustment: "",
    hepatic_adjustment: "",
    contraindications: "",
    monitoring: "",
    recommendation_class: "I",
    evidence_level: "A",
    page_reference: "p. 4",
    source_order: 1,
    table_kind: "recommendation",
    table_row_role: "body",
    table_cells: [],
    status: "draft",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

test("narrative legacy entries become review-required Recommendation candidates", () => {
  const candidate = legacyEntryToRecommendationCandidate(entry());
  assert.equal(classifyLegacyGuidelineEntry(entry()), "narrative_recommendation");
  assert.equal(candidate?.id, "entry-1");
  assert.equal(candidate?.guideline_id, "guideline-1");
  assert.equal(candidate?.verification_status, "needs_review");
  assert.equal(candidate?.status, "draft");
});

test("table headings and rows are not forced into Recommendations", () => {
  assert.equal(classifyLegacyGuidelineEntry(entry({ table_kind: "data", table_row_role: "header" })), "table_heading");
  assert.equal(legacyEntryToRecommendationCandidate(entry({ table_kind: "data", table_row_role: "header" })), null);
  assert.equal(classifyLegacyGuidelineEntry(entry({ table_kind: "data", table_row_role: "body" })), "table_row");
});
