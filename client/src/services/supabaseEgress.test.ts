import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("public Guideline reader batches document children instead of issuing N+1 queries", () => {
  const implementation = source("./guidelineCorePublicService.ts");
  assert.match(implementation, /listPublishedGuidelineSectionsForPublic\(guidelineIds\)/);
  assert.match(implementation, /listPublishedGuidelineRecommendationsForPublic\(guidelineIds\)/);
  assert.doesNotMatch(implementation, /documents\.map\(async/);
});

test("public catalogs fetch compact previews once and filter locally", () => {
  const drugs = source("../components/DrugDataPage.tsx");
  const calculators = source("../modules/calculators/CalculatorPublicPage.tsx");
  assert.doesNotMatch(drugs, /listPublishedDrugs\(/);
  assert.match(drugs, /listPublishedDrugPreviews\(\)/);
  assert.match(calculators, /listPublicCalculatorPreviews\(\)/);
  assert.match(calculators, /filteredItems/);
});

test("background refreshes are throttled and signed URLs are cached", () => {
  const app = source("../App.tsx");
  const analytics = source("../components/SiteAnalytics.tsx");
  const books = source("./referenceBooks.ts");
  const legacyGuidelines = source("./guidelines.ts");
  assert.doesNotMatch(app, /setInterval\([^\n]*15000/);
  assert.match(app, /setInterval\(refreshWhenVisible, 60000\)/);
  assert.doesNotMatch(analytics, /setInterval\(updateOnlineVisitors, 10_000\)/);
  assert.match(analytics, /60_000/);
  assert.match(books, /signedUrlCache/);
  assert.match(legacyGuidelines, /guidelineSignedUrlCache/);
});

test("active repositories use explicit list payloads instead of wildcard list reads", () => {
  const drugs = source("./drugRepository.ts");
  const calculators = source("./calculatorRepository.ts");
  const relations = source("./knowledgeRelationRepository.ts");
  assert.match(drugs, /select\(drugListColumns\)/);
  assert.match(calculators, /select\(calculatorListColumns\)/);
  assert.match(relations, /select\(drugRelationColumns\)/);
  assert.match(relations, /select\(calculatorRelationColumns\)/);
});
