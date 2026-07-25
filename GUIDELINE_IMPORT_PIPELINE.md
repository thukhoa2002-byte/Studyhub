# Guideline Import Pipeline

## API

All routes require the existing Guideline admin token:

- `GET /api/admin/guideline-import/jobs`
- `POST /api/admin/guideline-import/jobs` with multipart field `file`
- `GET /api/admin/guideline-import/jobs/:jobId`
- `POST /api/admin/guideline-import/jobs/:jobId/process`
- `POST /api/admin/guideline-import/jobs/:jobId/resume`
- `PATCH /api/admin/guideline-import/sections/:sectionId`
- `PATCH /api/admin/guideline-import/recommendations/:recommendationId`
- `POST /api/admin/guideline-import/jobs/:jobId/import`
- `DELETE /api/admin/guideline-import/jobs/:jobId`

## Stages

1. Upload: validate extension, calculate SHA-256, upload to private Storage and persist the job/document.
2. Extraction: extract PDF/DOCX text using the existing extraction utility; Markdown/HTML/TXT are read locally on the server. Scanned PDFs use the existing OCR fallback.
3. Document analysis: detect every Table, Supplementary Table, Figure, Algorithm, Flowchart, Appendix, Chapter or Section heading. If no heading is detected, the whole document is one selectable item.
4. Selection: the admin chooses which detected items should be sent to AI. Each item is independent.
5. AI extraction: produce section hierarchy, original text, Vietnamese text, recommendation class, evidence, page, anchor, coordinates, confidence, terminology and issues.
6. Quality checks: missing section, empty recommendation, missing Class/Level, low confidence and number mismatch are recorded. Blocking issues prevent import.
7. Human review: edit original/translation, accept/reject/needs review, search and inspect duplicate state.
8. Bulk import: accepted sections and recommendations are inserted into Core draft. No automatic publish occurs.
9. Resume: job state and selected item IDs are stored; failed jobs can be resumed without re-uploading the source.

## Supported formats

PDF, DOCX, Markdown, HTML and TXT are accepted. EPUB is deliberately reserved for a future parser. OCR currently uses the existing Tesseract fallback and is best-effort; scanned documents should be checked manually before import.

## Duplicate policy

Exact, possible and update candidates are marked against recommendations already attached to the target Guideline. An accepted duplicate is blocked from bulk import. No existing Core recommendation is overwritten.

## Publication policy

Every imported Core document, section and recommendation remains draft. Review, source verification and publication continue through `guidelinePublicationService` and the existing database validation triggers.
