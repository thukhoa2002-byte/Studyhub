# Calculator Migration Verification Report

Status: prepared for staging verification. The migration has not been executed in this environment.

The current environment has neither the Supabase CLI nor `psql`, so this report contains the SQL and expected results for staging. No commit or push was performed.

## Dependency Graph

The current sprint has one supported database relationship path:

```text
calculators
  -> calculator_guideline_references
      -> guideline_documents
      -> guideline_sections
      -> guideline_entries
```

`Drug` is an unfinished database dependency. This sprint deliberately does not
create `calculator_drug_references`, a drug mapping, a related-drug public query,
or a Calculator-side Drug mock/localStorage fallback. The legacy
`guideline_entries.drug_id` field is not used as a substitute relation.

## 1. Migration Order

Run these migrations in this order:

1. `supabase/guidelines_migration.sql`
2. `supabase/calculator_foundation_migration.sql`

Do not run `supabase/guideline_drug_links_migration.sql` as part of this
Calculator sprint. It adds the legacy `guideline_entries.drug_id` field and is
outside the Calculator-Guideline dependency graph. If it was already applied
for an existing Guideline workflow, leave it unchanged; the Calculator
migration still does not read or use that field.

The foundation migration requires `guideline_documents`, `guideline_entries`, and `public.is_guideline_admin()` to exist first. It does not delete or seed data.

## 2. Tables and Columns

New tables:

- `public.calculators`
- `public.guideline_sections`
- `public.calculator_guideline_references`

Existing table changed:

- `public.guideline_entries.section_id uuid`, nullable, foreign key to `guideline_sections(id)`.

`calculators.id`, `guideline_sections.id`, `calculator_guideline_references.id`, `guideline_documents.id`, and `guideline_entries.id` are UUIDs. `owner_id` uses the existing UUID `auth.users.id` convention.

The current database still has no `public.drugs` table. Drug data remains outside this migration. `guideline_entries.drug_id` is not used as a Calculator-Drug relationship and must not be used as a substitute for a foreign key.

## 3. Foreign Keys and Delete Policies

`calculators`:

- `owner_id -> auth.users(id) ON DELETE SET NULL`
- `reviewed_by -> auth.users(id) ON DELETE SET NULL`
- `published_by -> auth.users(id) ON DELETE SET NULL`
- `archived_by -> auth.users(id) ON DELETE SET NULL`

`guideline_sections`:

- `guideline_id -> guideline_documents(id) ON DELETE RESTRICT`
- `owner_id -> auth.users(id) ON DELETE SET NULL`

`guideline_entries.section_id`:

- `section_id -> guideline_sections(id) ON DELETE RESTRICT`

`calculator_guideline_references`:

- `calculator_id -> calculators(id) ON DELETE CASCADE`
- `guideline_id -> guideline_documents(id) ON DELETE RESTRICT`
- `(section_id, guideline_id) -> guideline_sections(id, guideline_id) ON DELETE RESTRICT`
- `(recommendation_id, guideline_id) -> guideline_entries(id, document_id) ON DELETE RESTRICT`
- `(recommendation_id, section_id) -> guideline_entries(id, section_id) ON DELETE RESTRICT`
- `owner_id -> auth.users(id) ON DELETE SET NULL`

The CASCADE on `calculator_id` is safe only because the service allows hard delete for draft calculators that have never been published. Published calculators must be archived by service rule.

## 4. Indexes and Uniqueness

`calculators`:

- unique `calculators_slug_unique_idx(slug)`
- `calculators_status_updated_idx(status, updated_at desc)`
- `calculators_owner_idx(owner_id)`
- `calculators_handler_idx(handler_key)`

`guideline_sections`:

- unique `(guideline_id, slug)`
- unique `(id, guideline_id)` for composite foreign keys
- `guideline_sections_guideline_idx(guideline_id, display_order)`

`guideline_entries`:

- unique `(id, document_id)` for composite foreign keys
- unique `(id, section_id)` for composite foreign keys
- `guideline_entries_section_idx(section_id)`

`calculator_guideline_references`:

- unique identity `(calculator_id, guideline_id, section_id, recommendation_id, relation_type) NULLS NOT DISTINCT`
- individual indexes for `calculator_id`, `guideline_id`, `section_id`, `recommendation_id`, and `relation_type`

`relation_type` is constrained to:

`recommended-use`, `risk-assessment`, `diagnostic-support`, `dose-support`, `monitoring`, `related`.

## 5. RLS Policies

`calculators`:

- public/authenticated users can read `status = 'published'`
- the calculator admin can read all records
- the owner can read their own records
- only the calculator admin can insert/update
- delete is restricted to draft records with `published_at IS NULL`

`guideline_sections`:

- anonymous users can read sections under shared guidelines with at least one reviewed entry
- authenticated admin/owner can read all relevant sections

`guideline_documents` and `guideline_entries` public additions:

- anonymous users can read shared documents
- anonymous users can read reviewed entries belonging to shared documents

`calculator_guideline_references`:

- public reads only when the calculator is published and `can_expose_guideline_reference(...)` returns true
- calculator admin can read/write/delete all references

Guideline publication is not represented by a fabricated document status. The actual rule is `visibility = 'shared'` plus the relevant reviewed entry condition.

## 6. Triggers

The foundation migration creates no trigger.

`updated_at` is currently set by the repository/service layer. It is not maintained by a database trigger. This is intentional for the current migration and should be revisited only if the project standardizes timestamp triggers globally.

## 7. Rollback / Down Strategy

The repository currently uses forward SQL migration files and has no down-migration convention.

Recommended staging rollback before production:

1. Take a schema/data backup.
2. Record the migration version and object definitions.
3. If the migration has created no production data, remove only the three new tables and the added `guideline_entries.section_id` column in a reviewed, manual rollback script.
4. Do not drop or recreate existing Guideline tables automatically.
5. If calculators contain data, archive or export them before rollback instead of deleting them.

No rollback SQL is included in the forward migration because an automatic rollback could delete calculator/reference data.

## 8. Data Impact

Expected impact:

- Existing rows are not deleted.
- Existing Guideline rows are not rewritten.
- Existing `guideline_entries.drug_id` values are not changed.
- New tables start empty.
- Existing public behavior is expanded only for shared Guideline documents and reviewed entries.
- No medical seed data is inserted.

One staging prerequisite must be checked: if an existing `guideline_entries` row contains data that conflicts with the new nullable `section_id` foreign key, the migration must stop rather than modify that row.

## 9. Structural Verification SQL

Run after applying the migrations.

```sql
-- Tables and section_id
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('calculators', 'guideline_sections', 'calculator_guideline_references', 'guideline_entries')
order by table_name, ordinal_position;

-- Foreign keys and delete behavior
select
  conrelid::regclass as table_name,
  conname as constraint_name,
  confrelid::regclass as referenced_table,
  case confdeltype
    when 'a' then 'NO ACTION'
    when 'r' then 'RESTRICT'
    when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'
    when 'd' then 'SET DEFAULT'
  end as delete_rule,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f'
  and conrelid in (
    'public.calculators'::regclass,
    'public.guideline_sections'::regclass,
    'public.calculator_guideline_references'::regclass,
    'public.guideline_entries'::regclass
  )
order by table_name, constraint_name;

-- Indexes
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('calculators', 'guideline_sections', 'calculator_guideline_references', 'guideline_entries')
order by tablename, indexname;

-- Constraints
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.calculators'::regclass,
  'public.guideline_sections'::regclass,
  'public.calculator_guideline_references'::regclass,
  'public.guideline_entries'::regclass
)
order by table_name, conname;

-- Triggers
select event_object_table, trigger_name, action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('calculators', 'guideline_sections', 'calculator_guideline_references', 'guideline_entries');

-- RLS enabled and force-RLS flags. `pg_tables` exposes rowsecurity but not
-- forcerowsecurity on the staging PostgreSQL version.
select
  n.nspname as schemaname,
  c.relname as tablename,
  c.relrowsecurity as rowsecurity,
  c.relforcerowsecurity as forcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('calculators', 'guideline_sections', 'calculator_guideline_references');

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('calculators', 'guideline_sections', 'calculator_guideline_references', 'guideline_documents', 'guideline_entries')
order by tablename, policyname;
```

Expected results:

- All three new tables exist.
- Calculator and reference IDs are UUID.
- Reference deletes are RESTRICT for Guideline/Section/Recommendation and CASCADE only for Calculator.
- The five reference indexes plus the NULLS-NOT-DISTINCT unique index exist.
- No calculator foundation trigger exists.
- RLS is enabled on all three new tables.

## 10. Workflow Verification SQL

Run as a staging database owner or service role inside a disposable transaction. Replace the admin email only if staging uses a different configured admin. The block uses synthetic records and ends with `ROLLBACK`.

```sql
begin;

do $verify$
declare
  v_admin uuid;
  v_calculator uuid := gen_random_uuid();
  v_guideline uuid := gen_random_uuid();
  v_other_guideline uuid := gen_random_uuid();
  v_section uuid := gen_random_uuid();
  v_entry uuid := gen_random_uuid();
begin
  select id into strict v_admin
  from auth.users
  where lower(email) = 'thukhoa2002@gmail.com'
  limit 1;

  -- 1. Create calculator draft
  insert into public.calculators (id, owner_id, slug, short_name, name, calculator_type, handler_key, input_fields, source_verified)
  values (
    v_calculator, v_admin, 'verification-calculator', 'Verification',
    '{"vi":"Verification calculator","en":"Verification calculator"}'::jsonb,
    'equation', 'bmi', '[{"id":"weightKg"}]'::jsonb, false
  );
  assert (select status from public.calculators where id = v_calculator) = 'draft', 'calculator must start as draft';

  -- 2. Create guideline document and a second document for FK tests
  insert into public.guideline_documents
    (id, owner_id, title, society, condition, publication_year, version_label, source_url, visibility)
  values
    (v_guideline, v_admin, 'Verification guideline', 'ESC', 'HF', 2026, 'test', 'https://example.invalid/test', 'shared'),
    (v_other_guideline, v_admin, 'Other verification guideline', 'ESC', 'HF', 2026, 'test', 'https://example.invalid/other', 'shared');

  insert into public.guideline_sections (id, guideline_id, owner_id, slug, title)
  values (v_section, v_guideline, v_admin, 'verification-section', 'Verification section');

  insert into public.guideline_entries
    (id, document_id, owner_id, topic, drug_name, recommendation_summary, page_reference, status, section_id)
  values
    (v_entry, v_guideline, v_admin, 'Verification', 'Test drug', 'Reviewed recommendation', '1', 'reviewed', v_section);

  -- 3. Create valid relation
  insert into public.calculator_guideline_references
    (calculator_id, guideline_id, section_id, recommendation_id, relation_type, owner_id)
  values
    (v_calculator, v_guideline, v_section, v_entry, 'recommended-use', v_admin);
  assert (select count(*) from public.calculator_guideline_references where calculator_id = v_calculator) = 1, 'valid relation must be created';

  -- 4. Duplicate relation must fail
  begin
    insert into public.calculator_guideline_references
      (calculator_id, guideline_id, section_id, recommendation_id, relation_type, owner_id)
    values
      (v_calculator, v_guideline, v_section, v_entry, 'recommended-use', v_admin);
    raise exception 'duplicate relation was accepted';
  exception when unique_violation then
    null;
  end;

  -- 5. Section from one guideline with another guideline must fail
  begin
    insert into public.calculator_guideline_references
      (calculator_id, guideline_id, section_id, relation_type, owner_id)
    values
      (v_calculator, v_other_guideline, v_section, 'related', v_admin);
    raise exception 'cross-guideline section was accepted';
  exception when foreign_key_violation then
    null;
  end;

  -- 6. Delete a never-published calculator draft
  delete from public.calculators where id = v_calculator and status = 'draft' and published_at is null;
  assert not exists (select 1 from public.calculators where id = v_calculator), 'draft calculator must be deletable';

  -- Recreate for archive/public checks
  insert into public.calculators (id, owner_id, slug, short_name, name, calculator_type, handler_key, input_fields, source_verified, status, published_at)
  values (
    v_calculator, v_admin, 'verification-calculator', 'Verification',
    '{"vi":"Verification calculator","en":"Verification calculator"}'::jsonb,
    'equation', 'bmi', '[{"id":"weightKg"}]'::jsonb, true, 'published', now()
  );
  insert into public.calculator_guideline_references
    (calculator_id, guideline_id, section_id, recommendation_id, relation_type, owner_id)
  values
    (v_calculator, v_guideline, v_section, v_entry, 'recommended-use', v_admin);
  assert (select count(*) from public.calculators where slug = 'verification-calculator' and status = 'published') = 1, 'published calculator must be queryable';

  -- 7. Archive instead of delete after publish
  update public.calculators set status = 'archived', archived_by = v_admin, archived_at = now() where id = v_calculator;
  assert (select status from public.calculators where id = v_calculator) = 'archived', 'published calculator must be archived';

  -- 8. Public-style queries must exclude archived records
  assert not exists (
    select 1 from public.calculators where id = v_calculator and status = 'published'
  ), 'archived calculator must not be public';

  -- 9. Related guideline query shape
  assert exists (
    select 1
    from public.calculator_guideline_references r
    join public.guideline_documents d on d.id = r.guideline_id
    join public.guideline_entries e on e.id = r.recommendation_id
    where r.guideline_id = v_guideline and d.visibility = 'shared' and e.status = 'reviewed'
  ), 'related guideline query must resolve reviewed recommendation';

end
$verify$;

rollback;
```

Expected workflow results:

- Calculator creation succeeds with `status = draft`.
- Guideline and reviewed recommendation creation succeeds.
- Valid relation succeeds.
- Duplicate relation fails with `unique_violation`.
- Cross-guideline section fails with `foreign_key_violation`.
- Never-published draft can be deleted.
- Published calculator can be archived and remains in the database.
- Public-style calculator query excludes archived data.
- Related guideline query resolves only the shared/reviewed target.
- Calculator-Drug relation is not tested in this migration and remains intentionally deferred.

## 11. RLS Verification Through the Real API

The SQL editor/service role bypasses RLS, so the following must also be run through Supabase REST or the application client:

### Anonymous session

```ts
const { data: publicCalculators } = await supabase
  .from('calculators')
  .select('id, slug, status')
  .order('slug');

const { data: publicRelations } = await supabase
  .from('calculator_guideline_references')
  .select('calculator_id, guideline_id, section_id, recommendation_id, relation_type')
  .order('display_order');
```

Expected:

- `publicCalculators` contains only `published` calculators.
- `publicRelations` contains only references whose calculator is published and whose Guideline target passes `can_expose_guideline_reference`.
- Draft, reviewed-only, and archived calculators are absent.

### Admin session (`thukhoa2002@gmail.com`)

Run the same queries with the authenticated admin session.

Expected:

- Admin can read draft, in_review, reviewed, published, and archived calculators.
- Admin can read all calculator-guideline references.
- Admin can create/update/delete references subject to FK and unique constraints.

## 12. Related Drug: Explicitly Deferred

The requested related-drug query is intentionally not implemented because the audited database has no `public.drugs` table and no `calculator_drug_references` table.

The legacy field `guideline_entries.drug_id` is not a valid source for Calculator-Drug relations and is not used by the calculator migration.

Required order:

1. Normalize Drug into a real database entity with stable UUID IDs.
2. Add the Drug repository/service and publish/archive rules.
3. Create `calculator_drug_references` with a real `drug_id uuid` foreign key.
4. Add service validation, RLS, duplicate constraints, and public queries.

No hard-coded mapping, temporary relation, or long-term compatibility layer is introduced here.

## 13. Sign-off Checklist

- [ ] Apply `guidelines_migration.sql` on staging.
- [ ] Apply `calculator_foundation_migration.sql`.
- [ ] Run structural verification SQL.
- [ ] Run workflow transaction; confirm it ends with rollback.
- [ ] Run anonymous API queries.
- [ ] Run authenticated admin API queries.
- [ ] Do not create Calculator-Drug relations until the Drug entity migration is complete.
- [ ] Confirm no production/staging data was changed by the verification transaction.
- [ ] Only after all checks pass, consider the migration ready for production and commit.

For the executable staging runbook, use
`CALCULATOR_STAGING_RUNBOOK.md`. It contains the backup steps, SQL Editor and
CLI commands, ordered verification checklist, E2E workflow, expected results,
and the manual approval gate before commit.

## 14. Implementation and Local Verification

Implemented in the application layer:

- `client/src/modules/calculators/databaseTypes.ts`: UUID-backed Calculator and Calculator-Guideline reference types.
- `client/src/services/calculatorRepository.ts`: Calculator/reference repository and Guideline target lookups.
- `client/src/services/calculatorDatabaseService.ts`: draft/publish/archive/delete workflow and reference creation validation.
- `client/src/services/calculatorValidation.ts`: slug, publish, constrained relation type, parent-integrity and duplicate validation.
- `client/src/services/calculatorGuidelineIntegrity.ts`: stale-reference scanner and reasons for missing, cross-parent, unpublished, or unreviewed targets.
- `client/src/modules/calculators/CalculatorPublicPage.tsx`: Drug relation is explicitly marked unavailable; no Drug fallback is queried.
- `client/src/components/AdminCalculatorPage.tsx`: no Calculator-side Drug JSON/mapping editor; Drug relationship is marked not implemented.
- `client/src/components/DrugDataPage.tsx`: reverse Calculator-Drug relation is marked not implemented.
- `client/src/modules/calculators/types.ts` and `client/src/services/calculatorService.ts`: legacy Calculator-Drug reference helpers/fields removed.

Tests added:

- `client/src/services/calculatorValidation.test.ts`
- `client/src/services/calculatorGuidelineIntegrity.test.ts`
- `client/src/services/calculatorMigrationPolicy.test.ts`

Local commands completed:

- `npm run build` passed; Vite emitted existing chunk-size/dynamic-import warnings.
- `npm run lint` passed with existing warning-level hook/Fast Refresh findings.
- `npm run test:calculators` passed: 3 tests.
- `npm run test:calculator-validation` passed: 5 tests.
- `npm run test:calculator-integrity` passed: 5 tests.
- `npm run test:guideline-publication` passed: 2 tests.
- `npm run test:calculator-reset` passed: 1 test.
- `npm run test:visibility` passed: 2 tests.

The SQL migration has not been executed against Supabase in this environment.
There is no Supabase CLI or `psql` available here, so RLS, FK enforcement,
`NULLS NOT DISTINCT`, and public/admin access still require the staging SQL/API
verification in sections 9-11. No commit and no push were performed.
