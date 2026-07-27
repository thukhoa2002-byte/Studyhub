import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hasActiveDuplicateRelation, validateRelationMetadata } from "./knowledgeRelationValidation.ts";
import { normalizeDrugSlug, validateDrugDraft, validateDrugPublish } from "./drugValidation.ts";

test("Drug validation requires a generic name and verified sourced publication", () => {
  assert.deepEqual(validateDrugDraft({ genericName: "" }), ["Tên hoạt chất là bắt buộc."]);
  assert.equal(normalizeDrugSlug("Acetylsalicylic acid"), "acetylsalicylic-acid");
  assert.ok(validateDrugPublish({ genericName: "Aspirin", status: "draft", sourceVerified: false, references: [], sourceReferences: [] }).length >= 2);
});

test("knowledge relation duplicate and metadata validation reject unsafe input", () => {
  const rows = [{ drug_id: "drug-1", relation_type: "recommended", status: "active" }, { drug_id: "drug-1", relation_type: "alternative", status: "archived" }];
  assert.equal(hasActiveDuplicateRelation(rows, "drug_id", "drug-1", "recommended"), true);
  assert.equal(hasActiveDuplicateRelation(rows, "drug_id", "drug-1", "alternative"), false);
  assert.deepEqual(validateRelationMetadata({ display_order: -1 }), ["Thứ tự hiển thị phải là số không âm."]);
});

test("active Drug UI no longer imports the legacy service or writes localStorage", () => {
  const admin = readFileSync(new URL("../components/AdminDrugPage.tsx", import.meta.url), "utf8");
  const publicPage = readFileSync(new URL("../components/DrugDataPage.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(admin, /thuocService|localStorage/);
  assert.doesNotMatch(publicPage, /thuocService|drugData\.ts|localStorage/);
  assert.match(admin, /drugDatabaseService/);
  assert.match(publicPage, /drugDatabaseService/);
});

test("relationship migration keeps legacy guideline entries outside active relation tables", () => {
  const migration = readFileSync(new URL("../../../supabase/knowledge_relationship_foundation_migration.sql", import.meta.url), "utf8");
  assert.match(migration, /recommendation_drug_references/);
  assert.match(migration, /recommendation_calculator_references/);
  assert.doesNotMatch(migration, /guideline_entries\.drug_id/);
  assert.match(migration, /unique nulls not distinct/);
  assert.match(migration, /on delete restrict/);
});

test("Drug and Calculator reverse lookup resolves public ownership through Recommendation Table", () => {
  const service = readFileSync(new URL("./knowledgeRelationService.ts", import.meta.url), "utf8");
  const link = readFileSync(new URL("../components/RecommendationLink.tsx", import.meta.url), "utf8");
  assert.match(service, /getGuidelineRecommendationTablesByIds/);
  assert.match(service, /table\?\.status === "published"/);
  assert.doesNotMatch(service, /section\?\.status === "published"/);
  assert.match(link, /location\.tableId/);
});
