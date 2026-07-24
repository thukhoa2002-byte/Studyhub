import assert from "node:assert/strict";
import test from "node:test";
import { canExposeGuideline } from "./guidelinePublication.ts";

const document = { visibility: "shared" as const };
const entries = [
  { id: "reviewed", section_id: "section-a", status: "reviewed" as const },
  { id: "draft", section_id: "section-b", status: "draft" as const },
];

test("linked recommendation uses its own review status", () => {
  assert.equal(canExposeGuideline(document, entries, { recommendationId: "reviewed", sectionId: "section-a" }), true);
  assert.equal(canExposeGuideline(document, entries, { recommendationId: "draft", sectionId: "section-b" }), false);
});

test("document-level exposure requires every entry to be reviewed", () => {
  assert.equal(canExposeGuideline(document, entries), false);
  assert.equal(canExposeGuideline(document, [entries[0]]), true);
});
