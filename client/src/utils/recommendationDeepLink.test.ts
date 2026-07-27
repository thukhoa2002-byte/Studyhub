import assert from "node:assert/strict";
import test from "node:test";
import { guidelinePath, parseDataRoute } from "./dataRoutes.ts";
import { deepLinkScrollBehavior, recommendationAdminPath, recommendationDeepLinkPath, resolveGuidelineDeepLink } from "./recommendationDeepLink.ts";

const tables = [
  { id: "table-a", legacySectionIds: ["section-a", "tong-quan"], recommendations: [{ id: "recommendation-a" }] },
  { id: "table-b", legacySectionIds: ["section-b", "dieu-tri"], recommendations: [{ id: "recommendation-b" }] },
];

test("creates a stable Table-based deep link using the recommendation UUID", () => {
  const path = recommendationDeepLinkPath("esc-hf-2021", "table-a", "recommendation-a");
  assert.equal(path, "/guidelines/esc-hf-2021/table-a/recommendation-a");
  assert.deepEqual(parseDataRoute(path), { tab: "guidelines", kind: "guideline-detail", slug: "esc-hf-2021", sectionSlug: "table-a", recommendationId: "recommendation-a" });
});

test("supports legacy section slugs while resolving the canonical recommendation section", () => {
  assert.deepEqual(resolveGuidelineDeepLink(tables, "tong-quan", "recommendation-a"), { ok: true, tableId: "table-a", recommendationId: "recommendation-a", usedLegacySection: true });
});

test("rejects stale and mismatched deep links without guessing", () => {
  assert.deepEqual(resolveGuidelineDeepLink(tables, "table-b", "recommendation-a"), { ok: false, reason: "recommendation-table-mismatch" });
  assert.deepEqual(resolveGuidelineDeepLink(tables, "table-a", "missing"), { ok: false, reason: "recommendation-unavailable" });
  assert.deepEqual(resolveGuidelineDeepLink(tables, "missing-table", "recommendation-a"), { ok: false, reason: "table-unavailable" });
});

test("preserves query strings on admin deep links and honors reduced motion", () => {
  assert.equal(recommendationAdminPath("guideline-id", "recommendation-a"), "/admin/guidelines/guideline-id/recommendations?recommendation=recommendation-a");
  assert.equal(parseDataRoute("/admin/guidelines/guideline-id/recommendations?recommendation=recommendation-a").kind, "admin-guideline-recommendations");
  assert.equal(guidelinePath("title with spaces"), "/guidelines/title%20with%20spaces");
  assert.equal(deepLinkScrollBehavior(true), "auto");
  assert.equal(deepLinkScrollBehavior(false), "smooth");
});
