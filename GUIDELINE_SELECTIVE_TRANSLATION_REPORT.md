# Guideline Selective Translation Report

## Default scope

`clinical_essentials` is the default. It queues only formal recommendations and clinically actionable tables. Full-document translation remains an explicit advanced choice and requires a quota confirmation in the UI.

## Classification and selection

| Content | Default handling |
| --- | --- |
| Recommendation prose and recommendation tables | Required, automatically selected, processed first |
| Dosing, dose-adjustment and contraindication tables | Required, automatically selected |
| Diagnostic, risk, treatment, monitoring and interaction tables | Important, automatically selected |
| Figure captions and general tables | Manual selection only |
| References, glossary, metadata and non-recommendation title-only tables | Excluded locally; never sent to AI |
| Title-only or partial recommendation tables | Mandatory blocking item; never sent as a fragment |

Recommendation tables are detected from both title and body signals, including recommendation language and Class/Level/LoE. A mandatory table can only leave the checklist through an explicit false-positive classification correction with an audit reason. Optional tables can be marked clinically important with an audit reason.

## Canonical resources: tables and figures

The import inventory now keeps three distinct resource types. They are never
flattened into one another:

| Resource | Import behavior | Recommendation behavior | Completion effect |
| --- | --- | --- | --- |
| `recommendation_table` | Mandatory full-table extraction and translation | Formal rows may produce draft Recommendations | Blocks until complete and reviewed |
| `clinical_table` | Preserves headers, row order, cells and footnotes; translates actionable tables | Never creates Recommendations from rows | Does not block Recommendation completion |
| `figure` | Keeps original asset metadata separate from translated title/caption | Never creates Recommendations from captions or image content | Does not block Recommendation completion |

`Classes of Recommendations` and `Levels of Evidence` are classified as
clinical framework tables, not as Recommendation Tables. Conversely, formal
recommendation language in a table body is sufficient to make it a mandatory
Recommendation Table even when its title is generic.

Figure metadata includes number, source/translated title and caption, pages,
original-asset fields, checksum, dimensions, alt text, related source keys,
extraction state, publication state and permission state. The pipeline never
redraws an image or translates text inside it. Without a high-resolution crop
of the original, a Figure is marked `needs_crop_review`, remains
`ready_private`, and defaults to `private_educational_use`.

### Figure display and permission policy

- A Figure remains an original, owner/admin-only learning asset by default. Its
  cropped PNG is rendered from the source PDF and is never redrawn, recoloured
  or translated.
- The admin import view accepts a normalized crop box and stores the PNG in the
  private `guideline-imports` object path for that import job. The asset endpoint
  requires guideline-admin authorization and sends `Cache-Control: private`.
- Figure metadata is linked to the imported Guideline, resolved Section and
  resolved Recommendation IDs in the import-job metadata. It is intentionally
  not copied into public Guideline Core JSON, so an asset path cannot leak via a
  public document response.
- Public rendering must call `figureDisplayModel`. Original pixels are returned
  only for `permission_granted`. For all other permission states, the public
  model contains only title/caption, attribution, source page, source link and
  related Recommendation IDs.
- A Figure without a reviewed crop remains attached to its original source PDF
  with `needs_crop_review`; it is never discarded or represented as a complete
  image asset.

For the recognised **2023 ESC ACS** document name, the import inventory checks
for 17 Recommendation Tables, 9 Clinical Tables and 20 Figures. Missing items
are warnings requiring edition confirmation or recovery. Missing Figures do
not block Recommendation translation; an incomplete Recommendation Table does.

## Table integrity

The provider schema and prompt require a `tables` result with complete title, headers, ordered rows, cell values, footnotes and source page. Numeric values, doses, units, abbreviations, recommendation class and evidence level are preserved. The import review screen renders extracted table structure for comparison before Core draft import.

Continuation tables are merged before classification when their heading indicates a continuation or repeats the same table label on a following page. An incomplete recommendation table remains `blocked_pending_extraction`; it blocks completion until recovery or an explicit false-positive correction. No missing cells or rows are invented. A complete recommendation table is held at `needs_review` after translation and must be explicitly marked `reviewed` by an administrator before the mandatory checklist can complete.

## Quota, resume and providers

- Each item stores source hash, selected state, status, provider, model, attempt count, completion time and error metadata in the import job metadata.
- Recommendations are processed before dosing and other tables.
- Completed or reviewed items are not sent again. Resume selects only pending or retryable items and uses the saved result as the per-job response cache. Mandatory recommendation tables are never skipped as duplicates.
- Quota exhaustion pauses the job without discarding completed items. It does not mark the whole import as failed.
- Provider selection is explicit: Gemini only, OpenAI only, or Gemini then OpenAI after a Gemini quota error. There is no silent paid-provider fallback.
- Repeated local diagnostics are grouped rather than emitted as an AI request per item.

## Files changed

- `server/services/guidelineTranslationPolicy.js`
- `server/services/guidelineFigureAssets.js`
- `server/services/guidelineFigurePolicy.js`
- `server/services/guidelineImportStore.js`
- `server/services/guidelineTranslationProvider.js`
- `server/services/guidelineImport.js`
- `server/routes/guidelineImport.js`
- `server/tests/guidelineImport.test.js`
- `client/src/services/guidelineImportService.ts`
- `client/src/components/AdminGuidelineImportPage.tsx`

## Verification

| Check | Result |
| --- | --- |
| `node --test server/tests/guidelineImport.test.js` | PASS, 22 tests |
| `npm test` in `client` | PASS |
| `npx tsc -b` in `client` | PASS |
| `npm run lint` in `client` | PASS with existing out-of-scope warnings |
| `npm run build` in `client` | PASS |
| `git diff --check` | PASS |

## Deliberate limits

- No database migration was created or executed.
- No deployment or merge was performed.
- Figure records are persisted in the import job's `analysis_metadata` in this
  iteration. A permanent Figure asset/catalog table needs a separately approved
  schema and migration; the pipeline does not pretend that a source PDF page is
  an already-cropped Figure asset.
- The persisted translation cache is job-local. Cross-job cache reuse needs a dedicated storage model and is intentionally not introduced here.
- The UI provides table inspection; structured table editing and automatic extraction recovery beyond continuation-page merging remain manual review work.
