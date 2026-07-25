# Drug Runtime Audit

## Runtime after foundation integration

- Active public/admin UI: `DrugDataPage`, `DrugsPage`, `AdminDrugPage`.
- Data type: `client/src/types/drug.ts`.
- Active path: `Drug UI -> drugDatabaseService -> drugRepository -> public.drugs`.
- Anonymous catalog: `list_public_drug_previews()` returns a discovery-only DTO.
- Authenticated detail: published rows only through `getPublishedDrugBySlug` and RLS.
- Admin create/edit/lifecycle: `saveDrugDraft`, `transitionDrug`, `deleteDrugDraft`.

## Legacy boundary

`thuocService.ts`, `drugData.ts`, `AdminDrugEditor.tsx` and drug import code remain in the tree only for legacy/import compatibility. They are not imported by active public Drug, admin Drug or Guideline public reader paths. The legacy `/admin/thuoc/import` route is explicitly blocked until its pipeline writes canonical `drugs` rows. No active Drug write uses `localStorage`.

## Pending database activation

`knowledge_relationship_foundation_migration.sql` has not been run. Until it is applied, the DB-backed paths correctly report a missing table/RPC rather than falling back to legacy data. No clinical data is migrated automatically.

## Local verification

- `npm test`: PASS (49 tests).
- `npx tsc -b`: PASS.
- `npm run lint`: PASS with 9 existing warnings outside this scope.
- `npm run build`: PASS.
- `git diff --check`: PASS.
