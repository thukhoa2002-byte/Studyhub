# Guideline Staging Acceptance Report

## Scope

Acceptance follow-up for the public Guideline publication integration defect.
This fix changes only the public read adapter and its consumers. No migration was rerun, and Guideline Core, Calculator, and Drug schemas were not changed.

## Deployment

| Item | Result | Evidence |
| --- | --- | --- |
| Staging URL | PASS | `https://studyhub-staging.onrender.com` |
| Branch | PASS | `feature/calculator-guideline-staging` |
| Local Sprint C commit | PASS | `a5374e74972ec3c7c48f2bd01b0b0f4250104be8` (`feat(guideline): add structured admin editor`) |
| Public-reader fix commit | NOT RUN | Created after source verification; live deployment is still pending. |
| Independently verified deployed SHA | BLOCKED | Render deployment metadata was not available from this browser session. |
| `/api/health` | PASS | Previously externally verified as HTTP 200 with `{"success":true,"message":"Backend OK","version":"1.2.0-gemini"}`. |

## Network/API Evidence

The supplied Network captures show:

1. `GET https://...supabase.co/rest/v1/calculators?select=*&order=updated_at.desc`
   - HTTP `200`
   - `Content-Length: 2`
   - `Content-Range: 0-0/*`
   - response: `[]`
   - origin: `https://studyhub-staging.onrender.com`

2. `GET https://...supabase.co/rest/v1/guideline_documents?select=*&order=publication_year.desc.nullslast%2Ccreated_at.desc`
   - HTTP `200`
   - `Content-Length: 2`
   - `Content-Range: 0-0/*`
   - response: `[]`
   - origin: `https://studyhub-staging.onrender.com`

| Check | Result | Assessment |
| --- | --- | --- |
| Supabase endpoint reachable | PASS | Both requests completed successfully. |
| Unexpected 4xx/5xx response | PASS | No HTTP error shown. |
| Restricted records absent from response | PASS | The captured payloads contain no records. |
| Database RLS conclusively proven | BLOCKED | Empty results can mean either RLS filtering or no matching staging data. A role-specific test dataset is required. |
| Frontend-only filtering ruled out | BLOCKED | The captures show the response, but no draft/published comparison was performed. |

## Public Guideline Dependency Map

| Public flow | Previous source | Current source | Status |
| --- | --- | --- | --- |
| `/guidelines` list and `/guidelines/:slug` detail | `guidelineService.loadPublishedGuidelines()` → `guideline_entries` → legacy `canExposeGuideline()` | `loadPublishedCoreGuidelines()` → `guideline_documents` → `guideline_sections` → `guideline_recommendations` | PASS in source/tests |
| Public Calculator → Guideline links | `guidelineService.getPublishedGuidelineById()` and static/legacy model | `loadPublishedCoreGuidelines()` and Core ID lookup | PASS in source/build |
| Public Drug → Guideline links | `guidelineService` legacy recommendation lookup | Core published Guideline IDs; Drug relation details remain unavailable until Drug entity work | PASS in source/build |
| Admin Drug compatibility | `guidelineService.loadGuidelines()` | Unchanged legacy compatibility path; not a public Guideline reader | NOT IN SCOPE |

The public read adapter applies defense-in-depth filtering: only published documents, published sections, and published recommendations with `verification_status = verified` are mapped. No public component imports `guidelineService`, `guidelineData.ts`, or reads `guideline_entries` for Guideline content.

## Defect Resolution

| Item | Result | Details |
| --- | --- | --- |
| Root cause | PASS | Admin wrote Guideline Core records, while the public reader grouped legacy `guideline_entries` and required legacy review state. |
| Public read model | PASS in source/tests | New `guidelineCorePublicService` loads Core documents, sections, and recommendations through repository/service layers. |
| Legacy primary dependency removed | PASS in source audit | Public Guideline, Calculator, and Drug consumers no longer import or call the legacy Guideline reader. |
| Calculator compatibility | PASS in source/build | Calculator schema and relation table are unchanged; public links resolve the Guideline label through Core published records. |
| Live staging acceptance | BLOCKED | The fix must be deployed before the failed admin-publish → public-refresh scenario can be repeated against staging. |

## Acceptance Matrix

All UI and role-based tests below remain pending because this session did not have a usable signed-in staging browser session and no test records were created.

| Area | Result | Notes |
| --- | --- | --- |
| Admin `/admin/guidelines` | BLOCKED | Requires admin browser session. |
| Admin `/admin/guidelines/new` | BLOCKED | Requires admin browser session. |
| Admin edit/sections/recommendations routes | BLOCKED | Requires admin browser session and a Guideline ID. |
| Regular-user direct admin route access | BLOCKED | Must be tested by direct URL, not menu visibility. |
| Create Guideline without PDF/source URL | BLOCKED | No temporary record created. |
| Reload persistence of Guideline fields | BLOCKED | No temporary record created. |
| Section root/child/edit/reorder/archive | BLOCKED | No temporary record created. |
| Self-parenting/circular hierarchy rejection | BLOCKED | No temporary record created. |
| Recommendation CRUD and Section assignment | BLOCKED | No temporary record created. |
| Recommendation review/publication state | BLOCKED | No temporary record created. |
| Optional source document add/edit/remove | BLOCKED | No temporary record created. |
| Draft → in_review → published → archived | BLOCKED | No temporary record created. |
| Publication blockers and confirmation dialogs | BLOCKED | Requires admin browser session. |
| Anonymous public visibility | BLOCKED | Requires published and non-public test records. |
| Regular-user public visibility | BLOCKED | Requires role-specific test records. |
| Calculator ↔ Guideline links | BLOCKED | Requires a published Calculator and eligible Guideline relation. |
| Network persistence/no silent save failure | BLOCKED | Only list requests were captured; save/reload workflow was not run. |

## Verification Results

| Check | Result | Evidence |
| --- | --- | --- |
| Guideline Core public mapper test | PASS | 3 tests: published Core mapping, non-public document rejection, section/recommendation filtering. |
| Guideline Core tests | PASS | 17 tests passed. |
| Guideline publication tests | PASS | 2 tests passed. |
| Calculator tests | PASS | 3 engine tests, 5 validation tests, 5 integrity/migration policy tests passed. |
| Visibility tests | PASS | 2 tests passed. |
| Build/typecheck | PASS | `npm run build` completed; Vite production bundle generated. |
| Lint | PASS WITH WARNINGS | `npm run lint` completed; only pre-existing React hook/Fast Refresh warnings remain. |
| Diff whitespace | PASS | `git diff --check` passed. |

## Acceptance Reproduction To Run After Deploy

1. In Admin, open the existing `STAGING_TEST_Guideline` or create a new `STAGING_TEST_` Guideline Core record.
2. Confirm the document is `published`; publish at least one Section and one reviewed/verified Recommendation when testing nested public content.
3. Sign out and open `/guidelines`.
4. Refresh the page and search for the Guideline title.
5. Open the Guideline detail and verify the Core Section and Recommendation appear.
6. Inspect Network: requests must target `guideline_documents`, `guideline_sections`, and `guideline_recommendations`; no public Guideline request should target `guideline_entries`.

Expected result: the published Guideline appears publicly. Draft, in-review, archived, unpublished Sections, and unverified Recommendations remain absent.

## Temporary Data and Cleanup

- Temporary records created: **none**.
- Cleanup required: **none**.
- No pre-existing user data was deleted or modified.

## Known Hardening Issues

These remain explicitly unverified/known from the migration audit and are not treated as PASS:

- Legacy `guideline_entries` public exposure requires database/RLS verification against parent Guideline lifecycle.
- The Calculator ↔ Guideline public helper must be verified against the new Guideline Core publication policy, not only legacy visibility fields.
- `FORCE ROW LEVEL SECURITY` decisions for Guideline Core and relation tables remain pending staging verification.
- Database lifecycle transition enforcement for invalid transitions such as `archived → published` remains pending hardening verification.
- Admin-email authorization remains a temporary limitation until a stable editor-role/claim system exists.

## Conclusion

The blocking public-reader defect is fixed in source and covered by tests. Live staging acceptance remains **BLOCKED until this fix is deployed**; therefore Sprint C is not yet accepted and must not be merged into `main` from this state.
