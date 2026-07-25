import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canUseColorTheme } from "../config/access.ts";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const guidelinePage = readFileSync(new URL("../components/GuidelineDataPage.tsx", import.meta.url), "utf8");
const calculatorPage = readFileSync(new URL("../modules/calculators/CalculatorPublicPage.tsx", import.meta.url), "utf8");
const drugPage = readFileSync(new URL("../components/DrugDataPage.tsx", import.meta.url), "utf8");
const mcqPage = readFileSync(new URL("../components/McqPage.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../supabase/authenticated_content_access_migration.sql", import.meta.url), "utf8");

test("Color theme is limited to the designated account", () => {
  assert.equal(canUseColorTheme("totentu162@gmail.com"), true);
  assert.equal(canUseColorTheme("thukhoa2002@gmail.com"), false);
  assert.equal(canUseColorTheme(null), false);
});

test("protected routes preserve the destination and require authentication", () => {
  assert.match(appSource, /AUTH_RETURN_PATH_KEY/);
  assert.match(appSource, /requiresAuthenticatedContent/);
  assert.match(appSource, /history\.back\(\)/);
  assert.match(appSource, /pendingPath/);
});

test("public modules render the shared sign-in gate before protected content", () => {
  for (const source of [guidelinePage, calculatorPage, drugPage, mcqPage]) {
    assert.match(source, /ProtectedContentGate/);
  }
  assert.match(guidelinePage, /listPublishedGuidelinePreviews/);
  assert.doesNotMatch(guidelinePage, /from ["']\.\.\/services\/thuocService/);
  assert.match(calculatorPage, /listPublicCalculatorPreviews/);
  assert.match(calculatorPage, /if \(!user\) return <ProtectedContentGate/);
  assert.doesNotMatch(drugPage, /from ["']\.\.\/services\/thuocService/);
  assert.match(drugPage, /if \(!user\) return/);
  assert.match(mcqPage, /if \(!userId\) return <ProtectedContentGate/);
});

test("protected content migration exposes only narrow anonymous preview RPCs", () => {
  assert.match(migration, /create or replace function public\.list_public_guideline_previews/);
  assert.match(migration, /create or replace function public\.list_public_calculator_previews/);
  assert.match(migration, /grant execute on function public\.list_public_guideline_previews\(\) to anon, authenticated/);
  assert.match(migration, /grant execute on function public\.list_public_calculator_previews\(\) to anon, authenticated/);
  assert.match(migration, /create policy "authenticated reads published guideline core"/);
  assert.match(migration, /create policy "authenticated reads published calculators"/);
  assert.match(migration, /drop policy if exists "public reads shared guideline documents"/);
  assert.match(migration, /drop policy if exists "public reads shared guideline sections"/);
  assert.match(migration, /drop policy if exists "public reads reviewed shared guideline entries"/);
  assert.doesNotMatch(migration, /create policy "public reads published guideline core"/);
  assert.doesNotMatch(migration, /create policy "public reads published calculators"/);
  assert.match(migration, /status = 'published'/);
  assert.match(migration, /verification_status = 'verified'/);
});

test("public calculator previews use an explicit safe-field query", () => {
  const repository = readFileSync(new URL("./calculatorRepository.ts", import.meta.url), "utf8");
  assert.match(repository, /listPublicPreviews/);
  assert.match(repository, /select\("id,slug,short_name,name,description,specialty_id,category_id,status,version,updated_at"\)/);
  assert.doesNotMatch(repository, /formula_display.*listPublicPreviews/s);
});
