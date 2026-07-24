# Calculator Staging Execution Report

## Status

**IN PROGRESS**: hai migration đã chạy thành công trên Supabase staging theo
xác nhận thủ công của người dùng. Các bước verification sau migration chưa
được chạy.

Thời điểm kiểm tra: `2026-07-24 10:53:14 +07`.
Thời điểm chạy migration trên staging: chưa được cung cấp; kết quả dưới đây
được ghi nhận theo xác nhận của người dùng.

Không có thay đổi nào được thực hiện trên production. Không dùng
`guideline_drug_links_migration.sql`. Không tạo bảng hoặc quan hệ Drug. Không
commit và không push.

## Môi trường đã kiểm tra

| Hạng mục | Kết quả |
|---|---|
| `supabase` CLI | BLOCKED: chưa cài |
| `psql` | BLOCKED: chưa cài |
| `SUPABASE_ACCESS_TOKEN` | BLOCKED: không có trong environment |
| `SUPABASE_DB_PASSWORD` | BLOCKED: không có trong environment |
| Browser session có quyền Supabase staging | NOT REQUIRED: người dùng đã chạy bằng SQL Editor |
| `client/.env.local` | Có URL Supabase, nhưng không đủ quyền chạy DDL |
| Production access | NOT RUN |

## Migration đã áp dụng

| Migration | Kết quả |
|---|---|
| `supabase/guidelines_migration.sql` | PASS theo xác nhận SQL Editor |
| `supabase/calculator_foundation_migration.sql` | PASS theo xác nhận SQL Editor |

Thứ tự bắt buộc:

1. `supabase/guidelines_migration.sql`
2. `supabase/calculator_foundation_migration.sql`

Không chạy:

- `supabase/guideline_drug_links_migration.sql`
- `supabase/calculator_data_reset.sql`
- bất kỳ migration Drug nào

## Kết quả kiểm tra source trước khi chạy

| Kiểm tra | Kết quả |
|---|---|
| Dependency order | PASS: Guidelines trước Calculator foundation |
| Phạm vi chỉ Calculator ↔ Guideline | PASS |
| Không có `calculator_drug_references` | PASS |
| Không dùng `guideline_entries.drug_id` | PASS trong Calculator migration |
| Không seed dữ liệu y khoa | PASS |
| Không có câu lệnh xóa dữ liệu hiện có | PASS trong Calculator migration |
| Calculator FK | PASS theo source SQL |
| Composite Guideline FKs | PASS theo source SQL |
| `NULLS NOT DISTINCT` | PASS theo source SQL |
| `ON DELETE RESTRICT` cho Guideline/Section/Recommendation | PASS theo source SQL |
| RLS policies | PASS theo source SQL, chưa xác minh database thật |

## Kết quả verification live

Migration đã PASS. Các mục dưới đây được cập nhật theo kết quả SQL Editor;
những mục chưa chạy vẫn giữ `NOT RUN` và không được suy diễn từ việc migration
hoàn tất:

| Verification | Kết quả |
|---|---|
| Bảng và cột | NOT RUN |
| Index | PASS theo ảnh SQL Editor: Calculator/reference indexes và Calculator slug unique đã có; cần xác nhận thêm section/entry ở output đầy đủ |
| Unique `NULLS NOT DISTINCT` | PASS theo ảnh SQL Editor: `has_nulls_not_distinct = true` |
| Foreign key composite | PASS theo ảnh SQL Editor: 15 FK, đủ composite FK Calculator ↔ Guideline |
| `ON DELETE RESTRICT` | NOT RUN |
| Validation Guideline/Section/Recommendation | NOT RUN |
| Trigger | PASS theo xác nhận SQL Editor: không có trigger Calculator migration |
| RLS anonymous UI/API | BLOCKED: build Calculator ↔ Guideline chưa deploy lên staging |
| RLS authenticated/admin UI/API | BLOCKED: build Calculator ↔ Guideline chưa deploy lên staging |
| RLS structural query ban đầu | FAIL: `pg_tables.forcerowsecurity` không tồn tại; đã thay bằng `pg_class` |
| RLS policy query | PASS theo ảnh SQL Editor: trả về 20 policy |
| RLS flags (`relrowsecurity`, `relforcerowsecurity`) | PASS theo ảnh SQL Editor: cả 3 bảng `true / false` |
| Tạo Calculator draft | PASS theo xác nhận workflow |
| Tạo Guideline | PASS theo xác nhận workflow |
| Tạo Section | PASS theo xác nhận workflow |
| Tạo Recommendation | PASS theo xác nhận workflow |
| Tạo relation hợp lệ | PASS theo xác nhận workflow |
| Duplicate relation | PASS theo xác nhận workflow |
| Sai Guideline/Section | PASS theo xác nhận workflow |
| Sai Recommendation/Guideline | PASS theo xác nhận workflow |
| Sai Recommendation/Section | PASS theo xác nhận workflow |
| Archive Calculator | PASS theo xác nhận workflow |
| Delete draft Calculator | PASS theo xác nhận workflow |
| Public query | PASS theo xác nhận workflow |
| Reverse Guideline → Calculator | PASS theo xác nhận workflow |
| Stale-reference checker | NOT RUN trên DB thật; local unit test đã PASS |
| Transaction rollback | PASS theo xác nhận workflow |
| E2E Admin → Publish → Public | BLOCKED: build Calculator ↔ Guideline chưa deploy lên staging |

## Không có lỗi SQL để phân tích

Migration không phát sinh lỗi. Đã có một lỗi trong câu SQL verification RLS
được chạy trên staging:

| Mục | Kết quả |
|---|---|
| Migration | PASS |
| RLS verification query ban đầu | FAIL do câu kiểm tra không tương thích view `pg_tables` |
| Migration/schema bị ảnh hưởng | Không |
| Dữ liệu bị ảnh hưởng | Không |

### Phân tích lỗi RLS verification

1. **Câu SQL gây lỗi:**

   ```sql
   select schemaname, tablename, rowsecurity, forcerowsecurity
   from pg_tables
   where schemaname = 'public';
   ```

2. **Nguyên nhân:** `pg_tables` có `rowsecurity` nhưng không có
   `forcerowsecurity` trên PostgreSQL staging.
3. **Ảnh hưởng:** chỉ câu kiểm tra RLS bị dừng; không ảnh hưởng migration,
   bảng, dữ liệu hoặc policy.
4. **Bản sửa tối thiểu:** chạy câu thay thế trong mục RLS của report, dùng
   `pg_class.relrowsecurity` và `pg_class.relforcerowsecurity`.
5. **Rollback:** không cần rollback database vì chỉ là câu `SELECT`.
6. **Chạy lại an toàn:** chạy lại câu `pg_class` thay thế, sau đó tiếp tục
   query `pg_policies` và các bước verification còn lại.

Khi có lỗi thực tế, cần ghi theo mẫu:

1. Câu SQL gây lỗi.
2. Nguyên nhân.
3. Ảnh hưởng.
4. Bản sửa tối thiểu.
5. Cách rollback.
6. Cách chạy lại an toàn.

Không tự sửa migration trước khi có lỗi thực tế từ staging.

## Cách tiếp tục trên staging

### SQL Editor

1. Mở đúng Supabase **staging project**.
2. Xác nhận project ref, không phải production.
3. Tạo backup/snapshot staging.
4. Chạy toàn bộ `guidelines_migration.sql`.
5. Chờ kết quả thành công.
6. Chạy toàn bộ `calculator_foundation_migration.sql`.
7. Chạy structural SQL ở section 9 trong
   `CALCULATOR_MIGRATION_VERIFICATION_REPORT.md`.
8. Chạy workflow transaction ở section 10 và xác nhận `ROLLBACK`.
9. Chạy API/RLS verification ở section 11.

### Supabase CLI

Sau khi CLI được cài và link đúng staging:

```bash
supabase login
supabase link --project-ref <STAGING_PROJECT_REF>
supabase db dump --linked --schema public > staging_public_backup.sql
supabase db execute --linked --file supabase/guidelines_migration.sql
supabase db execute --linked --file supabase/calculator_foundation_migration.sql
```

Không đưa `staging_public_backup.sql` vào repository.

Nếu CLI hiện tại không hỗ trợ `db execute --file`, dùng SQL Editor; không dùng
`db push` cho các file standalone này nếu chưa chuyển chúng sang migration
convention và review riêng.

## Điều kiện cho phép commit

Chỉ xem migration đủ điều kiện commit khi:

- [ ] Hai migration chạy thành công trên staging.
- [ ] Structural verification PASS.
- [ ] Composite FK và NULL-safe uniqueness PASS.
- [ ] Anonymous RLS PASS.
- [ ] Admin/authenticated RLS PASS.
- [ ] Draft/Published/Archived visibility PASS.
- [ ] Duplicate và mọi trường hợp sai Guideline/Section/Recommendation bị chặn.
- [ ] Archive và delete draft PASS.
- [ ] Public query và reverse query PASS.
- [ ] Stale-reference checker PASS.
- [ ] Transaction rollback PASS.
- [ ] E2E Admin → Publish → Public PASS.
- [ ] Không có thay đổi Drug.
- [ ] Người dùng xác nhận staging verification đã PASS.

## Deployment Gate

Các kiểm tra sau chưa thể kết luận từ SQL Editor vì SQL Editor dùng role
`postgres` và bypass RLS:

- Anonymous UI/API: **BLOCKED** cho tới khi build Calculator ↔ Guideline được
  deploy lên staging.
- Authenticated/Admin UI/API: **BLOCKED** cho tới khi build Calculator ↔
  Guideline được deploy lên staging.
- E2E Admin → Publish → Public: **BLOCKED** cho tới khi deploy.

Sau khi deploy staging, chạy lại toàn bộ checklist Anonymous/Admin trong
`CALCULATOR_STAGING_RUNBOOK.md`, rồi cập nhật các mục trên thành `PASS` hoặc
`FAIL` theo kết quả thực tế.

Hiện tại chưa đạt điều kiện commit.
