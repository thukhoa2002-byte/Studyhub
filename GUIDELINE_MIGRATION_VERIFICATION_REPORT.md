# Guideline Migration Verification Report

Ngày audit: 2026-07-24
Phạm vi: `supabase/guideline_core_migration.sql`
Môi trường database: chưa chạy trên staging.

## Audit result

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Migration order/dependency | PASS | Cần chạy sau `guidelines_migration.sql` và `calculator_foundation_migration.sql` |
| Transaction | PASS | Có `begin; ... commit;` |
| UUID preservation | PASS | Không update/delete UUID hiện có; Recommendation mới dùng UUID |
| Recommendation entity | PASS | Bảng riêng, không dùng `guideline_entries` làm Recommendation mới |
| Source document optionality | PASS | URL/year được nullable; source table không phải FK bắt buộc khi tạo draft |
| Recommendation/section FK | PASS | Composite FK, `ON DELETE RESTRICT` |
| Section hierarchy FK | PASS | `(parent_section_id, guideline_id)` với `ON DELETE RESTRICT` |
| Status constraints | PASS | Document/Section/Recommendation có constrained values |
| Verification constraints | PASS | `verification_status` có constrained values |
| Indexes/timestamps | PASS | Có indexes và updated-at triggers |
| Calculator relation preservation | PASS | File không alter `calculator_guideline_references` |
| Drug isolation | PASS | Không tạo Drug relation, không dùng `guideline_entries.drug_id` |
| RLS enablement | PASS | Các bảng Core được enable RLS |
| RLS force | FAIL | Chưa có `FORCE ROW LEVEL SECURITY`; owner/superuser có thể bypass |
| Legacy entry public isolation | FAIL | Policy cũ trên `guideline_entries` vẫn đọc entry reviewed của document shared, kể cả document archived |
| Calculator relation public isolation | FAIL | `can_expose_guideline_reference` hiện vẫn dựa trên `visibility/shared` và legacy entries, chưa dựa trên Core status/recommendation |
| Editor role | BLOCKED | Policy hiện chỉ nhận diện admin email; chưa có editor role/claim riêng |
| DB lifecycle transition enforcement | FAIL | `archived -> published` chỉ bị chặn ở service, chưa bị trigger DB chặn |
| Staging migration | NOT RUN | Chưa được phép chạy trước khi các defect/limitation trên được xử lý hoặc chấp thuận rõ |

## Compatibility review

- `guideline_entries` không bị drop hoặc update thành Recommendation.
- Không có bước tự động chuyển legacy narrative/table row vào
  `guideline_recommendations`.
- `guideline_entries.table_row_role` và `table_kind` tiếp tục giữ table row
  legacy/unmapped content.
- `guideline_entries.drug_id` không xuất hiện trong migration mới.
- UUID và provenance cũ được giữ; source path được backfill thành supporting
  metadata rows nhưng không xóa path legacy.
- `calculator_guideline_references` không bị thay đổi FK, index hoặc
  `NULLS NOT DISTINCT` uniqueness.
- Không có `ON DELETE CASCADE` mới cho Guideline, Section, Recommendation hoặc
  SourceDocument. Calculator relation cũ vẫn giữ semantics đã được xác minh.

## Backfill behavior requiring confirmation

Existing `guideline_documents.visibility = 'shared'` được backfill thành
`status = 'published'` để giữ hành vi public hiện tại. Đây không phải AI
publish mới, nhưng là một mapping dữ liệu public và phải được ghi nhận trong
backup/staging evidence trước khi chạy.

## Required minimal fixes before execution

1. Thu hồi hoặc thay policy public legacy trên `guideline_entries` để policy
   public kiểm tra `guideline_documents.status = 'published'`, hoặc đánh dấu
   legacy entries là compatibility-only và không dùng trong public query.
2. Quyết định có bật `FORCE ROW LEVEL SECURITY` cho bảng Core hay không; nếu
   bật, xác nhận service role/Supabase admin workflow không bị ảnh hưởng.
3. Thêm DB trigger/state guard cho status transition, hoặc chấp thuận rõ rằng
   state machine chỉ được bảo vệ bởi service và mọi direct SQL verification
   phải đánh dấu limitation.
4. Cập nhật public Calculator-Guideline helper/policy sau khi chốt cách map
   Recommendation mới; không được coi đây là lỗi của FK/uniqueness hiện tại.
5. Chốt editor authorization model trước khi gọi policy là admin/editor
   complete.
6. Migration chưa có marker riêng cho các cột đã backfill; post-commit down
   rollback không thể tự phân biệt cột/provenance đã tồn tại trước migration.

Chưa sửa migration trong audit này.
