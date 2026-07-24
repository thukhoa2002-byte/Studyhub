import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../../../supabase/guideline_core_migration.sql", import.meta.url), "utf8");
const calculatorMigration = readFileSync(new URL("../../../supabase/calculator_foundation_migration.sql", import.meta.url), "utf8");

test("Guideline Core migration creates independent Recommendation and optional source entities", () => {
  assert.match(migration, /create table if not exists public\.guideline_recommendations/);
  assert.match(migration, /create table if not exists public\.guideline_source_documents/);
  assert.match(migration, /alter column source_url drop not null/);
  assert.match(migration, /alter column publication_year drop not null/);
  assert.match(migration, /guideline_recommendations_section_belongs_to_guideline_fk/);
  assert.match(migration, /on delete restrict/);
});

test("Guideline Core RLS only exposes published verified Recommendation records", () => {
  assert.match(migration, /status = 'published'\s+and verification_status = 'verified'/);
  assert.match(migration, /guideline admins create recommendations/);
  assert.match(migration, /guideline admins update recommendations/);
  assert.match(migration, /guideline admins delete draft recommendations/);
});

test("Sprint B does not create Drug relations or alter Calculator relation SQL", () => {
  assert.doesNotMatch(migration, /create table[^;]*drug/i);
  assert.doesNotMatch(migration, /guideline_entries\.drug_id/);
  assert.match(calculatorMigration, /calculator_guideline_references_identity_idx/);
  assert.match(calculatorMigration, /nulls not distinct/);
});
