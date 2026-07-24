import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../../supabase/calculator_foundation_migration.sql", import.meta.url), "utf8");

test("calculator migration has real Guideline foreign keys and NULL-safe uniqueness", () => {
  assert.match(migration, /create table if not exists public\.calculators/);
  assert.match(migration, /create table if not exists public\.calculator_guideline_references/);
  assert.match(migration, /foreign key \(section_id, guideline_id\)\s+references public\.guideline_sections\(id, guideline_id\)\s+on delete restrict/s);
  assert.match(migration, /foreign key \(recommendation_id, guideline_id\)\s+references public\.guideline_entries\(id, document_id\)\s+on delete restrict/s);
  assert.match(migration, /foreign key \(recommendation_id, section_id\)\s+references public\.guideline_entries\(id, section_id\)\s+on delete restrict/s);
  assert.match(migration, /\) nulls not distinct;/);
  assert.doesNotMatch(migration, /calculator_drug_references/);
  assert.doesNotMatch(migration, /guideline_entries\.drug_id/);
});

test("public calculator and reference policies require published/eligible content", () => {
  assert.match(migration, /status = 'published'/);
  assert.match(migration, /public\.can_expose_guideline_reference\(guideline_id, section_id, recommendation_id\)/);
  assert.match(migration, /visibility = 'shared'/);
  assert.match(migration, /status = 'reviewed'/);
  assert.match(migration, /alter table public\.calculators enable row level security/);
  assert.match(migration, /alter table public\.calculator_guideline_references enable row level security/);
});
