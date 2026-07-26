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

## Table integrity

The provider schema and prompt require a `tables` result with complete title, headers, ordered rows, cell values, footnotes and source page. Numeric values, doses, units, abbreviations, recommendation class and evidence level are preserved. The import review screen renders extracted table structure for comparison before Core draft import.

Continuation tables are merged before classification when their heading indicates a continuation. An incomplete recommendation table remains `blocked_pending_extraction`; it blocks completion until recovery or an explicit false-positive correction. No missing cells or rows are invented.

## Quota, resume and providers

- Each item stores source hash, selected state, status, provider, model, attempt count, completion time and error metadata in the import job metadata.
- Recommendations are processed before dosing and other tables.
- Completed items are not sent again. Resume selects only pending or retryable items and uses the saved result as the per-job response cache.
- Quota exhaustion pauses the job without discarding completed items. It does not mark the whole import as failed.
- Provider selection is explicit: Gemini only, OpenAI only, or Gemini then OpenAI after a Gemini quota error. There is no silent paid-provider fallback.
- Repeated local diagnostics are grouped rather than emitted as an AI request per item.

## Files changed

- `server/services/guidelineTranslationPolicy.js`
- `server/services/guidelineTranslationProvider.js`
- `server/services/guidelineImport.js`
- `server/routes/guidelineImport.js`
- `server/tests/guidelineImport.test.js`
- `client/src/services/guidelineImportService.ts`
- `client/src/components/AdminGuidelineImportPage.tsx`

## Verification

| Check | Result |
| --- | --- |
| `node --test server/tests/guidelineImport.test.js` | PASS, 12 tests |
| `npm test` in `client` | PASS |
| `npx tsc -b` in `client` | PASS |
| `npm run lint` in `client` | PASS with existing out-of-scope warnings |
| `npm run build` in `client` | PASS |
| `git diff --check` | PASS |

## Deliberate limits

- No database migration was created or executed.
- No deployment or merge was performed.
- The persisted translation cache is job-local. Cross-job cache reuse needs a dedicated storage model and is intentionally not introduced here.
- The UI provides table inspection; structured table editing and automatic extraction recovery beyond continuation-page merging remain manual review work.
