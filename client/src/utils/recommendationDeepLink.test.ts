import assert from "node:assert/strict";
import test from "node:test";
import { guidelinePath, parseDataRoute } from "./dataRoutes.ts";
import { deepLinkScrollBehavior, recommendationAdminPath, recommendationDeepLinkPath, resolveGuidelineDeepLink } from "./recommendationDeepLink.ts";

const sections = [
  { id: "section-a", slug: "tong-quan", recommendations: [{ id: "recommendation-a" }] },
  { id: "section-b", slug: "dieu-tri", recommendations: [{ id: "recommendation-b" }] },
];

test("creates a stable deep link using the recommendation UUID", () => {
  const path = recommendationDeepLinkPath("esc-hf-2021", "section-a", "recommendation-a");
  assert.equal(path, "/guidelines/esc-hf-2021/section-a/recommendation-a");
  assert.deepEqual(parseDataRoute(path), { tab: "guidelines", kind: "guideline-detail", slug: "esc-hf-2021", sectionSlug: "section-a", recommendationId: "recommendation-a" });
});

test("supports legacy section slugs while resolving the canonical recommendation section", () => {
  assert.deepEqual(resolveGuidelineDeepLink(sections, "tong-quan", "recommendation-a"), { ok: true, sectionId: "section-a", recommendationId: "recommendation-a" });
});

test("rejects stale and mismatched deep links without guessing", () => {
  assert.deepEqual(resolveGuidelineDeepLink(sections, "section-b", "recommendation-a"), { ok: false, reason: "recommendation-section-mismatch" });
  assert.deepEqual(resolveGuidelineDeepLink(sections, "section-a", "missing"), { ok: false, reason: "recommendation-unavailable" });
  assert.deepEqual(resolveGuidelineDeepLink(sections, "missing-section", "recommendation-a"), { ok: false, reason: "section-unavailable" });
});

test("preserves query strings on admin deep links and honors reduced motion", () => {
  assert.equal(recommendationAdminPath("guideline-id", "recommendation-a"), "/admin/guidelines/guideline-id/recommendations?recommendation=recommendation-a");
  assert.equal(parseDataRoute("/admin/guidelines/guideline-id/recommendations?recommendation=recommendation-a").kind, "admin-guideline-recommendations");
  assert.equal(guidelinePath("title with spaces"), "/guidelines/title%20with%20spaces");
  assert.equal(deepLinkScrollBehavior(true), "auto");
  assert.equal(deepLinkScrollBehavior(false), "smooth");
});
