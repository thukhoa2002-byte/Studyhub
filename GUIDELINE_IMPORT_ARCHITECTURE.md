# Guideline Import Architecture

## Scope

Sprint D adds a private, resumable import workspace. It does not replace Guideline Core and it does not publish content.

```text
PDF / DOCX / Markdown / HTML / TXT
        |
        v
private import job + source document
        |
        +--> local text extraction / OCR
        +--> document item detection
        +--> AI structure extraction
        +--> Vietnamese translation + terminology
        +--> duplicate and quality checks
        v
human review and bulk approval
        |
        v
Guideline Core draft (guideline_documents, guideline_sections,
guideline_recommendations, optional guideline_source_documents)
        |
        v
existing review and publication policy
```

## Boundaries

- `guideline_import_*` tables are staging-only and are private to the Guideline admin.
- The import pipeline never reads or writes `guideline_entries` as a structured editor model.
- Accepted sections and recommendations are inserted into Core with `draft` status and `unverified` verification status.
- Existing Guideline, Calculator, Drug and public-reader schemas are not replaced by Sprint D.
- Storage uses the private `guideline-imports` bucket. A source document is not public merely because it was uploaded.

## Authorization

The existing `requireGuidelineAdmin` middleware and `public.is_guideline_admin()` RLS function are reused. The browser sends the Supabase access token to the server. The server uses that token for REST calls, so staging RLS remains in the request path.

## Recovery

Jobs persist status, progress, selected item IDs, extracted text, errors and events. The UI polls processing jobs and exposes Resume from the stored checkpoint. A production deployment should move the long-running `processJob` call to a durable worker/queue before very large documents are processed concurrently.

## Future extensions

- EPUB parser.
- Page image previews and OCR coordinates for scanned pages.
- Dedicated queue/worker and streaming event channel.
- Terminology dictionary shared across jobs.
- A user-confirmed update/merge workflow for possible duplicates.
