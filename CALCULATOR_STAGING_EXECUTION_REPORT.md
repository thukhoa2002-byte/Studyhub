# Calculator Staging Execution Report

## Latest Deployment Verification

| Hạng mục | Kết quả |
|---|---|
| Staging URL | `https://studyhub-staging.onrender.com` |
| Branch deployed | `feature/calculator-guideline-staging` |
| Commit expected | `93318f7e72c24d823ca3a236c832a426a21b40b3` |
| Repository commit | PASS: local HEAD và remote branch khớp commit trên |
| Render deployment | PASS theo xác nhận external verification |
| Backend startup | PASS theo xác nhận external verification |
| `/api/health` | PASS: `{"success":true,"message":"Backend OK","version":"1.2.0-gemini"}` |
| Serving expected commit | PASS theo xác nhận Render deployment branch/commit |
| Anonymous RLS | BLOCKED: chưa truy cập được staging build |
| Admin RLS | BLOCKED: chưa truy cập được staging build |
| Regular user permissions | BLOCKED: chưa truy cập được staging build |
| Network/API evidence | BLOCKED: chưa lấy được HTTP response/network trace |
| Calculator → Guideline E2E | BLOCKED: chưa truy cập được staging build |
| Admin login/UI | PASS theo xác nhận người dùng: thấy khu vực Management/Admin |
| Regular user login/UI | PASS theo xác nhận người dùng: không thấy khu vực Management/Admin |
| Login Not Found | PASS theo xác nhận người dùng: chưa tái hiện lỗi |

External verification đã gọi thành công `GET https://studyhub-staging.onrender.com/api/health` và nhận response thành công với backend version `1.2.0-gemini`. Lỗi DNS trước đó chỉ xảy ra trong Codex workspace, không được coi là lỗi của Render hoặc ứng dụng.

UI visibility is not treated as RLS evidence. Direct Supabase API/database
checks remain separate below.

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
| RLS anonymous UI/API | BLOCKED: chờ manual verification trên staging |
| RLS authenticated/admin UI/API | BLOCKED: chờ manual verification trên staging |
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
| E2E Admin → Publish → Public | BLOCKED: chờ manual verification trên staging |

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

Deployment đã PASS. Các kiểm tra sau vẫn chưa thể kết luận từ SQL Editor vì
SQL Editor dùng role `postgres` và bypass RLS:

- Anonymous UI/API: **BLOCKED** chờ manual verification.
- Authenticated/Admin UI/API: **BLOCKED** chờ manual verification.
- Regular-user RLS: **BLOCKED** chờ manual verification.
- Network/API evidence: **BLOCKED** chờ manual verification.
- E2E Admin → Publish → Public: **BLOCKED** chờ manual verification.

Chạy checklist trong `CALCULATOR_STAGING_RUNBOOK.md` và cập nhật các mục trên
thành `PASS` hoặc `FAIL` theo kết quả thực tế.

Hiện tại chưa đạt điều kiện commit.

## Current Staging Verification Update

## Application Integration Fix

Previous E2E blocker: Admin/Public Calculator pages vẫn dùng
`client/src/services/calculatorService.ts` (catalog local/legacy), nên không
đi qua bảng `calculators` và `calculator_guideline_references`.

Integration fix đã hoàn tất trên feature branch:

- `AdminCalculatorPage` đọc và ghi qua `calculatorDatabaseService`;
- Admin hỗ trợ list mọi status, tạo/sửa calculator, publish, archive và xóa
  draft chưa từng publish;
- Admin có panel tạo, sửa, xóa Calculator ↔ Guideline relation, dùng service
  validation cho FK, duplicate và điều kiện publish;
- `AdminCalculatorImportPage` lưu JSON thành draft database, không dùng
  localStorage;
- `CalculatorPublicPage` query `status = 'published'` ở repository, detail
  draft/archived trả not-found, relation lấy qua public RLS query;
- `GuidelineDataPage` dùng reverse query database để hiển thị Calculator liên
  quan đủ điều kiện public;
- adapter giữ nguyên calculator engine hiện tại mà không đưa catalog legacy
  vào runtime.

Legacy consumer còn lại sau audit:

| Consumer | Trạng thái |
|---|---|
| `client/src/services/calculatorReset.test.ts` | Chỉ dùng để kiểm tra reset legacy, không phải runtime UI |
| `client/src/services/calculatorService.ts` | Giữ tạm để phục vụ test reset; không còn được import bởi Admin/Public/Import/Guideline calculator flows |

Migration không thay đổi. Drug không thay đổi.

Commit source fix sẽ được push trên branch
`feature/calculator-guideline-staging`; Render staging cần deploy lại commit
mới trước khi chạy E2E.

### Source integration note

Database Calculator service/repository có trong source. Việc xác nhận đường đi
UI tới entity `calculators` và `calculator_guideline_references` được gộp vào
mục E2E bên dưới; không tạo thêm một hạng mục pending ngoài năm kiểm tra thủ
công đã chốt.

### Live verification evidence currently available

| Kiểm tra | Kết quả | Evidence |
|---|---|---|
| Admin login và thấy Admin/Management | PASS | Người dùng xác nhận |
| Regular user login và không thấy Admin/Management | PASS | Người dùng xác nhận; chỉ là UI evidence |
| Anonymous calculator status filtering | BLOCKED | Chưa có HTTP response/API trace từ staging |
| Anonymous direct non-public slug | BLOCKED | Chưa có HTTP response/API trace từ staging |
| Admin đọc mọi Calculator status | BLOCKED | Chưa có authenticated Supabase response |
| Admin tạo/sửa/xóa relation | BLOCKED | Chưa có authenticated REST response; UI chưa nối database service |
| Regular user CRUD relation bị chặn | BLOCKED | Chưa có authenticated REST response |
| Network/API chứng minh DB RLS | BLOCKED | Chưa truy cập được staging/browser network trong workspace |
| E2E Draft → relation → Review → Publish → Public → Archive → Hidden | BLOCKED | UI chưa nối database service và chưa có live trace |

### Manual API verification to run from staging-connected browser

Thực hiện trong Supabase staging project, dùng đúng project URL và anon key
của staging. Không dùng production key. Thay các giá trị trong dấu `<...>`
và ghi lại status code cùng response body trong report.

```http
GET /rest/v1/calculators?select=id,slug,status&order=slug
apikey: <STAGING_ANON_KEY>
```

Anonymous expected result: chỉ có `published`; draft, `in_review`, reviewed
chưa publish và archived không xuất hiện. Truy vấn slug không public phải trả
`200` với `[]` hoặc response bị từ chối, không trả nội dung.

```http
GET /rest/v1/calculator_guideline_references?select=*&order=display_order
apikey: <STAGING_ANON_KEY>
```

Anonymous expected result: chỉ relation đáp ứng policy public; không có
relation của Calculator chưa published.

Với admin, thêm:

```http
Authorization: Bearer <ADMIN_ACCESS_TOKEN>
```

Expected: đọc được mọi status và relation; POST/PATCH/DELETE relation hợp lệ
thành công. Với regular user, dùng access token của user thường; các POST,
PATCH, DELETE phải bị RLS từ chối và các GET non-public phải trả rỗng hoặc bị
từ chối.

### Xác nhận deployment live

External verification xác nhận Render staging đang hoạt động tại
`https://studyhub-staging.onrender.com` với branch
`feature/calculator-guideline-staging` và commit
`93318f7e72c24d823ca3a236c832a426a21b40b3`. Health endpoint trả backend
version `1.2.0-gemini`. DNS không phân giải được trong Codex workspace chỉ là
giới hạn của workspace, không phải application failure.

### Điều kiện hoàn tất staging verification

- [ ] Có response API anonymous chứng minh RLS lọc status.
- [ ] Có response API admin chứng minh đọc đủ status và CRUD relation.
- [ ] Có response API regular user chứng minh bị chặn CRUD/non-public read.
- [ ] Network trace chứng minh frontend không tải toàn bộ dữ liệu rồi lọc local.
- [ ] E2E trên staging PASS sau khi build tích hợp được deploy.
- [ ] Không có thay đổi Drug.

Chưa đủ điều kiện commit/merge vào `main` hoặc deploy production.
