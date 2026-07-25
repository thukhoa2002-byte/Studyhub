import assert from "node:assert/strict";
import test from "node:test";
import { mapPublishedCoreGuideline } from "./guidelineCorePublicMapper.ts";
import type { GuidelineCoreDocument, GuidelineRecommendationRecord, GuidelineSectionRecord } from "./guidelineCoreTypes.ts";

const document: GuidelineCoreDocument = {
  id: "guideline-core-1",
  owner_id: "owner-1",
  title: "Core heart failure guideline",
  society: "ESC",
  condition: "Heart failure",
  publication_year: 2024,
  version_label: "2024",
  summary: "Structured public summary",
  topics: ["HFrEF"],
  source_url: null,
  doi: null,
  citation: "Manual provenance",
  file_path: null,
  supplement_file_path: null,
  provenance: [],
  visibility: "shared",
  status: "published",
  review_note: "",
  published_at: "2026-01-01T00:00:00.000Z",
  archived_at: null,
  published_by: "owner-1",
  archived_by: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const section: GuidelineSectionRecord = {
  id: "section-1",
  guideline_id: document.id,
  owner_id: "owner-1",
  parent_section_id: null,
  slug: "recommendations",
  section_number: "1",
  title: "Recommendations",
  title_vi: "Khuyến cáo",
  summary: "Section summary",
  display_order: 1,
  status: "published",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function recommendation(id: string, overrides: Partial<GuidelineRecommendationRecord> = {}): GuidelineRecommendationRecord {
  return {
    id,
    guideline_id: document.id,
    section_id: section.id,
    owner_id: "owner-1",
    title: "Use guideline-directed therapy",
    recommendation_text_original: "Use guideline-directed therapy.",
    recommendation_text_vi: "Sử dụng điều trị theo khuyến cáo.",
    rationale_vi: "",
    recommendation_class: "I",
    evidence_level: "A",
    evidence_system: "ESC",
    population: "Adults",
    intervention: "Therapy",
    comparator: "Usual care",
    outcome: "Outcomes",
    conditions: "Stable patients",
    contraindications: "",
    source_page: 1,
    source_quote: "Source quote",
    source_anchor: "section-1",
    verification_status: "verified",
    review_note: "",
    reviewed_by: "owner-1",
    reviewed_at: "2026-01-01T00:00:00.000Z",
    status: "published",
    sort_order: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("maps Guideline Core published data without legacy entries", () => {
  const guideline = mapPublishedCoreGuideline(document, [section], [recommendation("recommendation-1")]);

  assert.ok(guideline);
  assert.equal(guideline.status, "published");
  assert.equal(guideline.sections.length, 1);
  assert.equal(guideline.sections[0]?.titleVi, "Khuyến cáo");
  assert.equal(guideline.sections[0]?.recommendations[0]?.content, "Sử dụng điều trị theo khuyến cáo.");
  assert.deepEqual(guideline.sections[0]?.recommendations[0]?.drugReferences, []);
});

test("does not map non-public Guideline Core documents", () => {
  assert.equal(mapPublishedCoreGuideline({ ...document, status: "draft" }, [section], [recommendation("recommendation-1")]), null);
  assert.equal(mapPublishedCoreGuideline({ ...document, status: "archived" }, [section], [recommendation("recommendation-1")]), null);
});

test("filters non-public sections and recommendations defensively", () => {
  const guideline = mapPublishedCoreGuideline(document, [section, { ...section, id: "section-draft", slug: "draft", status: "draft", display_order: 2 }], [
    recommendation("recommendation-1"),
    recommendation("recommendation-draft", { status: "draft" }),
    recommendation("recommendation-unverified", { verification_status: "unverified" }),
  ]);

  assert.ok(guideline);
  assert.equal(guideline.sections.length, 1);
  assert.equal(guideline.sections[0]?.recommendations.length, 1);
  assert.equal(guideline.sections[0]?.recommendations[0]?.id, "recommendation-1");
});
