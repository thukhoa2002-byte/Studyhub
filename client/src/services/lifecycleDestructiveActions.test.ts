import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateCalculatorStatusTransition } from "./calculatorValidation.ts";
import { validateDrugStatusTransition } from "./drugValidation.ts";
import { validateGuidelineStatusTransition, validateRecommendationStatusTransition } from "./guidelineValidation.ts";

test("archived lifecycle supports restore and validated republish for all core entities", () => {
  assert.deepEqual(validateDrugStatusTransition("archived", "draft"), []);
  assert.deepEqual(validateDrugStatusTransition("archived", "published"), []);
  assert.deepEqual(validateCalculatorStatusTransition("archived", "draft"), []);
  assert.deepEqual(validateCalculatorStatusTransition("archived", "published"), []);
  assert.deepEqual(validateGuidelineStatusTransition("archived", "draft"), []);
  assert.deepEqual(validateRecommendationStatusTransition("archived", "published"), []);
  assert.notDeepEqual(validateDrugStatusTransition("published", "draft"), []);
  assert.notDeepEqual(validateCalculatorStatusTransition("published", "draft"), []);
  assert.notDeepEqual(validateDrugStatusTransition("draft", "archived"), []);
  assert.notDeepEqual(validateGuidelineStatusTransition("draft", "archived"), []);
});

test("lifecycle migration enforces transitions, restrictive foreign keys, and safe delete policies", () => {
  const migration = readFileSync(new URL("../../../supabase/lifecycle_destructive_actions_migration.sql", import.meta.url), "utf8");
  assert.match(migration, /enforce_studyhub_lifecycle_transition/);
  assert.match(migration, /old\.status = 'archived' and new\.status in \('draft', 'published'\)/);
  assert.match(migration, /recommendation_drug_references_drug_id_fkey[\s\S]*on delete restrict/);
  assert.match(migration, /recommendation_calculator_references_calculator_id_fkey[\s\S]*on delete restrict/);
  assert.match(migration, /delete draft or archived core/);
  assert.doesNotMatch(migration, /on delete cascade/);
});

test("admin lifecycle UI uses services and requires an explicit permanent-delete confirmation", () => {
  const calculatorAdmin = readFileSync(new URL("../components/AdminCalculatorPage.tsx", import.meta.url), "utf8");
  const guidelineAdmin = readFileSync(new URL("../components/AdminGuidelineStructuredEditor.tsx", import.meta.url), "utf8");
  assert.match(calculatorAdmin, /restoreCalculatorToDraft/);
  assert.match(calculatorAdmin, /deleteCalculatorPermanently/);
  assert.match(guidelineAdmin, /deleteGuidelinePermanently/);
  assert.match(guidelineAdmin, /deleteGuidelineSectionPermanently/);
  assert.match(guidelineAdmin, /deleteGuidelineRecommendationPermanently/);
  assert.match(calculatorAdmin, /Nhập DELETE để xóa vĩnh viễn/);
  assert.match(guidelineAdmin, /Nhập DELETE để xóa vĩnh viễn/);
  assert.doesNotMatch(calculatorAdmin, /from\("calculators"\)/);
  assert.doesNotMatch(guidelineAdmin, /from\("guideline_/);
});
