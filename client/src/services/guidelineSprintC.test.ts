import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseDataRoute } from "../utils/dataRoutes.ts";
import { validateGuidelineForPublication, validateRecommendationForPublication } from "./guidelineValidation.ts";

const editorSource = readFileSync(new URL("../components/AdminGuidelineStructuredEditor.tsx", import.meta.url), "utf8");

test("Sprint C admin routes resolve to the structured Guideline editor", () => {
  assert.equal(parseDataRoute("/admin/guidelines").kind, "admin-guideline-list");
  assert.equal(parseDataRoute("/admin/guidelines/new").kind, "admin-guideline-new");
  assert.equal(parseDataRoute("/admin/guidelines/g1/edit").kind, "admin-guideline-edit");
  assert.equal(parseDataRoute("/admin/guidelines/g1/sections").kind, "admin-guideline-sections");
  assert.equal(parseDataRoute("/admin/guidelines/g1/recommendations").kind, "admin-guideline-recommendations");
});

test("structured editor uses services and keeps legacy entries out of its data model", () => {
  assert.match(editorSource, /createGuidelineCoreDocument/);
  assert.match(editorSource, /createGuidelineSection/);
  assert.match(editorSource, /createGuidelineRecommendation/);
  assert.match(editorSource, /createGuidelineSourceDocument/);
  assert.doesNotMatch(editorSource, /from\("\.\/services\/supabase"\)/);
  assert.doesNotMatch(editorSource, /from\("\.\/services\/guidelines"\)/);
  assert.match(editorSource, /guideline_entries/);
  assert.doesNotMatch(editorSource, /guideline_entries\.drug_id/);
});

test("publication blockers remain visible until Guideline Core requirements are met", () => {
  const document = { title: "Test", publication_year: null, version_label: "", source_url: null, doi: null, citation: "", file_path: null, provenance: [] };
  const blockers = validateGuidelineForPublication(document, [], [], []);
  assert.ok(blockers.some((item) => /Publication year or version/.test(item)));
  assert.ok(blockers.some((item) => /Source traceability/.test(item)));
  assert.ok(blockers.some((item) => /eligible published/.test(item)));
});

test("single-admin recommendation publication keeps source-backed parent context without a review gate", () => {
  const recommendation = { title: "Rec", recommendation_text_original: "Do", recommendation_text_vi: "Làm", section_id: "s1", source_page: null, source_quote: "", source_anchor: "", verification_status: "unverified" as const };
  const errors = validateRecommendationForPublication(recommendation, { id: "g1", status: "published" }, { id: "s1", guideline_id: "g1", status: "published" }, []);
  assert.ok(errors.some((item) => /source traceability/.test(item)));
  assert.doesNotMatch(errors.join(" "), /verified/);
});
