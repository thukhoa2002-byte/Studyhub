# Calculator-Guideline Staging Runbook

Status: ready for manual staging execution. This runbook does not authorize
production changes, and no migration has been executed from this workspace.

## Scope

The only dependency graph in this run is:

```text
calculators
  -> calculator_guideline_references
      -> guideline_documents
      -> guideline_sections
      -> guideline_entries
```

Do not create or query `drugs`, `calculator_drug_references`,
`guideline_drug_references`, or `guideline_entries.drug_id` for this run.

## Files and Order

Run only these files, in this order:

1. [guidelines_migration.sql](/Users/macbook/StudyHub/supabase/guidelines_migration.sql)
2. [calculator_foundation_migration.sql](/Users/macbook/StudyHub/supabase/calculator_foundation_migration.sql)

Do not run `guideline_drug_links_migration.sql` for this sprint. If it already
exists in staging, do not reverse it in this run; the Calculator migration does
not depend on or read its `drug_id` field.

## 1. Backup Staging

Use a staging project only. Do not use a production project ref or production
database URL.

Preferred: create a Supabase project backup/snapshot from the Dashboard before
opening SQL Editor.

If the Supabase CLI is installed and linked to staging, export the public
schema/data before applying SQL:

```bash
supabase login
supabase link --project-ref <STAGING_PROJECT_REF>
supabase db dump --linked --schema public > staging_public_backup.sql
```

Keep `staging_public_backup.sql` outside the repository. Do not commit it.

## 2. Run with Supabase SQL Editor

1. Open the staging project in Supabase Dashboard.
2. Open SQL Editor and create a new query.
3. Paste and run `guidelines_migration.sql`.
4. Confirm it completes without an error.
5. Open a second query, paste and run `calculator_foundation_migration.sql`.
6. Confirm it completes without an error.
7. Run the structural verification SQL in section 9 of
   [CALCULATOR_MIGRATION_VERIFICATION_REPORT.md](/Users/macbook/StudyHub/CALCULATOR_MIGRATION_VERIFICATION_REPORT.md).

Do not combine this with unrelated migrations. Do not run
`calculator_data_reset.sql`.

## 3. Run with Supabase CLI

Only after `supabase link` confirms the staging project:

```bash
supabase db execute --linked --file supabase/guidelines_migration.sql
supabase db execute --linked --file supabase/calculator_foundation_migration.sql
```

If the installed CLI does not support `db execute --file`, use the SQL Editor
procedure above. Do not substitute `db push` unless these standalone SQL files
have first been converted into the repository's migration convention and
reviewed as a separate change.

## 4. Structural Verification Checklist

Run the SQL in section 9 of the verification report and check in this order:

- [ ] `calculators`, `guideline_sections`, and `calculator_guideline_references` exist.
- [ ] `guideline_entries.section_id` exists, is nullable, and is UUID.
- [ ] Calculator/reference IDs and Guideline IDs are UUID-compatible.
- [ ] Calculator owner/auth foreign keys exist.
- [ ] Reference `calculator_id` FK exists with `ON DELETE CASCADE`.
- [ ] Guideline/document/section/recommendation FKs exist with `ON DELETE RESTRICT`.
- [ ] Composite section-to-guideline FK exists.
- [ ] Composite recommendation-to-guideline FK exists.
- [ ] Composite recommendation-to-section FK exists.
- [ ] `NULLS NOT DISTINCT` exists on the reference identity index.
- [ ] Unique Calculator slug index exists.
- [ ] Reference indexes exist for calculator, guideline, section, recommendation, and relation type.
- [ ] No Calculator foundation trigger exists.
- [ ] RLS is enabled for Calculator, section, and reference tables.
- [ ] Expected RLS policies exist for public and admin access.

Expected: no existing rows are deleted or rewritten; new Calculator/reference
tables are empty unless staging already contains them.

## 5. Database Workflow Verification

Run the disposable transaction in section 10 of the verification report. It
must finish with `ROLLBACK`.

- [ ] Create Calculator draft.
- [ ] Create Guideline document.
- [ ] Create Guideline section.
- [ ] Create reviewed Recommendation.
- [ ] Create a valid Calculator-Guideline relation.
- [ ] Duplicate relation fails with `unique_violation`.
- [ ] Section belonging to another Guideline fails with `foreign_key_violation`.
- [ ] Recommendation belonging to another Guideline fails with `foreign_key_violation`.
- [ ] Recommendation belonging to another Section fails with `foreign_key_violation`.
- [ ] Never-published draft Calculator can be deleted.
- [ ] Published Calculator cannot be treated as a draft delete; archive it instead.
- [ ] Archived Calculator is excluded from a public `status = 'published'` query.
- [ ] Reverse Guideline-to-Calculator query returns only eligible published targets.
- [ ] Transaction ends with `ROLLBACK` and leaves no verification rows.

The SQL transaction uses synthetic values only. It must not use real medical
content or production records.

## 6. RLS Access Verification

Run the API queries in section 11 with two sessions.

Anonymous session:

- [ ] Draft Calculator is not returned.
- [ ] `in_review` Calculator is not returned.
- [ ] Reviewed-but-not-published Calculator is not returned.
- [ ] Archived Calculator is not returned.
- [ ] Published Calculator is returned.
- [ ] Reference is returned only when Calculator is published and the linked
  Guideline target is shared/reviewed according to its scope.

Admin session for `thukhoa2002@gmail.com`:

- [ ] Admin can read all Calculator statuses.
- [ ] Admin can read all Calculator-Guideline references.
- [ ] Admin can create, update, and delete references subject to FK/unique rules.
- [ ] Non-admin cannot create or modify Calculator/reference records.

## 7. End-to-End Application Test

- [ ] Admin creates a Calculator draft.
- [ ] Admin selects a Guideline, Section, and Recommendation.
- [ ] Admin saves the relation.
- [ ] Admin submits the Calculator for review.
- [ ] Admin verifies the source.
- [ ] Admin publishes the Calculator.
- [ ] Public Calculator page displays the eligible Guideline relation.
- [ ] Public Guideline page displays the published Calculator relation.
- [ ] Draft Calculator is absent from public list/detail/query.
- [ ] Archived Calculator is absent from public list/detail/query.
- [ ] Guideline that is private or has an unreviewed target is absent from public relation results.
- [ ] Editing a critical Calculator field resets `source_verified` according to the service workflow.
- [ ] Stale-reference checker reports missing, cross-parent, private, or unreviewed targets.
- [ ] Clicking a relation opens the correct Guideline section and Recommendation.

## 8. Migration Completion Gate

Migration is considered staging-verified only when all structural, workflow,
RLS, and E2E boxes above are checked and the transaction rollback is confirmed.

Before commit, record:

- migration execution timestamp and staging project ref;
- backup/snapshot identifier;
- structural verification result;
- anonymous/admin access result;
- E2E result;
- any existing warnings or policy differences.

Do not commit or push until staging verification is complete. This workspace
cannot verify the live database because Supabase CLI and `psql` are not
installed, and no database credentials were provided.
