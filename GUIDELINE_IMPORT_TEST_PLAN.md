# Guideline Import Test Plan

## Automated coverage

- Detect all document item types and do not stop at the first table.
- Normalize structured AI output without inventing missing content.
- Create blocking issues for missing section, empty recommendation, low confidence and number mismatch.
- Preserve source numbers, terminology and the no-auto-publish instruction in the prompt.
- Block bulk import when accepted candidates are duplicates or blocking issues remain.
- Validate migration text contains staging tables, private RLS and no legacy conversion.

## Manual staging coverage

1. Upload a digital PDF, scanned PDF, DOCX, Markdown, HTML and TXT.
2. Confirm page count/source checksum/private Storage and OCR status.
3. Confirm a multi-table supplement lists every detected item.
4. Select two separate items and process them independently.
5. Interrupt/reload the browser, resume the job and confirm progress is retained.
6. Edit original/translated text, terminology and review state.
7. Verify missing evidence, empty translation, number mismatch and duplicate blockers.
8. Accept valid sections/recommendations and bulk import.
9. Confirm Core Guideline/Section/Recommendation are draft and unverified.
10. Confirm public readers cannot see the imported draft.
11. Review and publish through the existing Guideline editor, then verify public visibility.
12. Remove an abandoned import job and confirm only its private staging data/file is removed.

## Security checks

- Anonymous and regular users receive 401/403 for import endpoints.
- Admin can access only their own job records.
- Import bucket is private.
- No document content is returned by public catalog endpoints.
- No import path uses `guideline_entries.drug_id`, Calculator schema or Drug schema.
