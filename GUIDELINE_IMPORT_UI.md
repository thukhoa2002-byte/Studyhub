# Guideline Import UI

Route: `/admin/guidelines/import`

## Upload panel

- Select PDF, DOCX, Markdown, HTML or TXT.
- Choose a new Guideline or an existing Guideline target.
- Choose source and target language.
- Preserve English terminology and standard abbreviations.
- Start upload and document analysis.

## Item selection

The UI lists every detected document item with type, label, title and page range. The admin can select all or individual tables, figures, algorithms, flowcharts, appendices or the full document. The pipeline is not limited to the first table.

## Review panel

- Job status/progress and current stage.
- Two-column original and Vietnamese recommendation text.
- Nested section list with translated heading.
- Class, evidence level, confidence, source page and duplicate badge.
- Search across original text, translation and evidence.
- Edit fields with save-on-blur.
- Accept, reject or mark for review.
- Quality-check list with blocking issues.
- Terminology count and job event history.

## Import action

`Nhập thành Core draft` is disabled when no section/recommendation is accepted, a blocking issue remains, content is empty, or an accepted record is marked duplicate. The action confirms that import will create draft content only.

## UX states

The page supports empty, loading through button states, processing, error, success, failed/resume, progress and background polling states. A job can be selected from import history after navigating away.
