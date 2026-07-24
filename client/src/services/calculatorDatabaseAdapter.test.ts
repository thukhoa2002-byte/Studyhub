import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { DatabaseCalculator } from "../modules/calculators/databaseTypes.ts";
import { databaseCalculatorToDefinition, filterPublicDatabaseCalculators } from "./calculatorDatabaseAdapter.ts";

function calculator(status: DatabaseCalculator["status"]): DatabaseCalculator {
  return {
    id: `staging-${status}`,
    owner_id: null,
    slug: `staging-${status}`,
    short_name: "STAGING_TEST",
    name: { vi: "STAGING_TEST calculator", en: "STAGING_TEST calculator" },
    description: { vi: "", en: "" },
    purpose: { vi: "", en: "" },
    calculator_type: "equation",
    specialty_id: "nephrology",
    category_id: "renal",
    handler_key: "bmi",
    calculation_mode: "automatic",
    input_fields: [],
    scoring_rules: [],
    formula_display: { vi: "", en: "" },
    formula_variables: [],
    result_definitions: [],
    when_to_use: { vi: [], en: [] },
    when_not_to_use: { vi: [], en: [] },
    limitations: { vi: [], en: [] },
    warnings: { vi: [], en: [] },
    evidence_references: [],
    version: "1.0.0",
    calculation_version: "1.0.0",
    content_revision: 1,
    status,
    source_verified: true,
    reviewed_by: null,
    reviewed_at: null,
    published_by: null,
    published_at: status === "published" ? "2026-01-01T00:00:00.000Z" : null,
    archived_by: null,
    archived_at: status === "archived" ? "2026-01-01T00:00:00.000Z" : null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

test("public database adapter keeps only published calculators", () => {
  const visible = filterPublicDatabaseCalculators([calculator("draft"), calculator("in_review"), calculator("reviewed"), calculator("published"), calculator("archived")]);
  assert.deepEqual(visible.map((item) => item.status), ["published"]);
});

test("database calculator maps eligible guideline relation into the public definition", () => {
  const definition = databaseCalculatorToDefinition(calculator("published"), [{
    id: "reference-1",
    calculator_id: "staging-published",
    guideline_id: "guideline-1",
    section_id: null,
    recommendation_id: null,
    relation_type: "recommended-use",
    context: { vi: "HFrEF ổn định", en: "Stable HFrEF" },
    required: false,
    display_order: 0,
    owner_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }]);
  assert.equal(definition.guidelineReferences[0]?.guidelineId, "guideline-1");
  assert.equal(definition.guidelineReferences[0]?.context, "HFrEF ổn định");
});

test("target calculator pages do not import the legacy calculator service", () => {
  const adminPage = readFileSync(new URL("../components/AdminCalculatorPage.tsx", import.meta.url), "utf8");
  const publicPage = readFileSync(new URL("../modules/calculators/CalculatorPublicPage.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(adminPage, /calculatorService/);
  assert.doesNotMatch(publicPage, /calculatorService/);
});
