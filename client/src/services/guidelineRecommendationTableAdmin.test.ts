import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editor = readFileSync(new URL("../components/AdminGuidelineStructuredEditor.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../components/GuidelineRecommendationTablesPanel.tsx", import.meta.url), "utf8");
const clinicalPanel = readFileSync(new URL("../components/GuidelineClinicalTablesPanel.tsx", import.meta.url), "utf8");
const clinicalRepository = readFileSync(new URL("./guidelineClinicalTableRepository.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../supabase/guideline_recommendation_groups_migration.sql", import.meta.url), "utf8");
const orderingMigration = readFileSync(new URL("../../../supabase/guideline_recommendation_table_order_migration.sql", import.meta.url), "utf8");

test("admin primary tab counts Recommendation Tables rather than source sections", () => {
  assert.match(editor, /Bảng khuyến cáo \(\$\{tables\.length\}\)/);
  assert.equal(/Mục nguồn \(\$\{sections\.length\}\)/.test(editor), false);
  assert.match(editor, /GuidelineRecommendationTablesPanel/);
  assert.match(editor, /Bảng lâm sàng \(\$\{clinicalTables\.length\}\)/);
  assert.equal(/\["overview", "sections"/.test(editor), false);
});

test("Clinical Tables are independently stored and never become Recommendation rows", () => {
  assert.match(clinicalRepository, /guideline_clinical_tables/);
  assert.match(clinicalPanel, /Hàng dữ liệu không tự tạo khuyến cáo/);
  const tableOnlyMigration = readFileSync(new URL("../../../supabase/guideline_table_only_model_migration.sql", import.meta.url), "utf8");
  assert.match(tableOnlyMigration, /create table if not exists public\.guideline_clinical_tables/);
  assert.match(tableOnlyMigration, /on delete restrict/);
});

test("Recommendation Tables keep source ownership as metadata and groups nested below a table", () => {
  assert.doesNotMatch(panel, /Mục nguồn \(tùy chọn\)/);
  assert.match(panel, /section_id: null/);
  assert.match(panel, /Mục khuyến cáo/);
  assert.match(panel, /recommendation_table_id/);
  assert.match(panel, /recommendation_group_id/);
  assert.match(panel, /source_order/);
  assert.match(panel, /source_page_start/);
});

test("group migration preserves stable owners and blocks cross-table row assignment", () => {
  assert.match(migration, /create table if not exists public\.guideline_recommendation_groups/);
  assert.match(migration, /unique \(recommendation_table_id, group_order\)/);
  assert.match(migration, /foreign key \(recommendation_group_id, recommendation_table_id\)/);
  assert.match(migration, /on delete restrict/);
  assert.match(orderingMigration, /foreign key \(recommendation_table_id, guideline_id, section_id\)/);
  const tableOnlyMigration = readFileSync(new URL("../../../supabase/guideline_table_only_model_migration.sql", import.meta.url), "utf8");
  assert.match(tableOnlyMigration, /alter column section_id drop not null/);
  assert.match(tableOnlyMigration, /alter table public\.guideline_recommendations\s+alter column section_id drop not null/);
  assert.match(tableOnlyMigration, /recommendation_table_id, guideline_id/);
});

test("table bulk publication is scoped to one table and incomplete tables are blocked", () => {
  const service = readFileSync(new URL("./guidelineBulkPublicationService.ts", import.meta.url), "utf8");
  assert.match(service, /publishRecommendationTableEligibleContent/);
  assert.match(service, /Bảng khuyến cáo chưa được đánh dấu hoàn chỉnh/);
  assert.match(service, /item\.recommendation_table_id === recommendationTableId/);
});
