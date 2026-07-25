# Render Staging Deployment

## Phân tích `render.yaml`

File hiện tại định nghĩa một Node Web Service:

- Service: `studyhub`
- Runtime: Node
- Plan: `free`
- Auto deploy: `true`
- Build:

```bash
npm install --prefix client && npm install --prefix server && npm run build --prefix client
```

- Start:

```bash
npm start --prefix server
```

`render.yaml` không khai báo `branch`, `staging`, environment group hoặc cờ
production. Branch thực tế được cấu hình trong Render Dashboard. Vì chỉ có
service `studyhub`, cần xem service hiện tại là có khả năng production và
không được đổi branch của service đó.

## Cấu hình staging an toàn

Tạo Render Web Service riêng, không chuyển service `studyhub` hiện tại sang
branch feature.

| Setting | Giá trị |
|---|---|
| Service type | Web Service |
| Service name | `studyhub-calculator-staging` |
| Repository | `thukhoa2002-byte/noitru-ai` |
| Branch | `feature/calculator-guideline-staging` |
| Runtime | Node |
| Root directory | repository root |
| Build command | `npm install --prefix client && npm install --prefix server && npm run build --prefix client` |
| Start command | `npm start --prefix server` |
| Auto deploy | Chỉ bật cho branch feature nếu cần |
| Production service | Không chọn, không sửa |

Render sẽ cấp domain cụ thể cho service. Ghi domain thực tế vào
`CALCULATOR_STAGING_EXECUTION_REPORT.md`, không tự đoán hostname.

## Environment variables

Chỉ đặt các biến sau trên service staging.

### Bắt buộc

| Biến | Phạm vi | Giá trị staging |
|---|---|---|
| `VITE_SUPABASE_URL` | client build | URL Supabase staging |
| `VITE_SUPABASE_ANON_KEY` | client build | anon/public key của Supabase staging |
| `SUPABASE_URL` | server | Cùng URL Supabase staging |
| `SUPABASE_ANON_KEY` | server | Cùng anon/public key Supabase staging |
| `CANONICAL_HOST` | server | Domain staging, không gồm `https://` |

### Tùy chọn

| Biến | Cách dùng |
|---|---|
| `VITE_API_URL` | Để trống nếu API cùng service; nếu tách API thì dùng URL staging |
| `OPENAI_MODEL` | Dùng default server nếu bỏ trống |
| `OPENAI_VISION_MODEL` | Fallback về `OPENAI_MODEL` |
| `OPENAI_API_KEY` | Chỉ cần nếu staging kiểm tra API OpenAI |
| `GEMINI_MODEL` | Default hiện tại là `gemini-3.1-flash-lite` |
| `GEMINI_DAILY_REQUEST_LIMIT` | Default hiện tại là `500` |
| `GEMINI_API_KEY` | Chỉ cần nếu staging kiểm tra API Gemini |
| `REFERENCE_FONT_DIR` | Chỉ cần nếu staging dùng thư mục font riêng |
| `PORT` | Không tự đặt; Render cung cấp |

### Không dùng giá trị production

- Không copy `VITE_SUPABASE_URL` hoặc `SUPABASE_URL` production.
- Không copy anon key production.
- Không dùng Supabase service-role key trong client hoặc browser.
- Không đặt `VITE_OPENAI_API_KEY` bằng production key.
- Không đặt `VITE_OPENAI_API_KEY` nếu không cần; code hiện tại dùng
  `dangerouslyAllowBrowser: true`, làm lộ key cho người dùng.
- Không copy OpenAI/Gemini key production khi có thể tạo key staging riêng.
- Không copy `CANONICAL_HOST` production.

## Kiểm tra code hiện tại

Client đọc:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`
- `VITE_OPENAI_API_KEY`

Server đọc:

- `SUPABASE_URL` hoặc fallback `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY` hoặc fallback `VITE_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_VISION_MODEL`
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_DAILY_REQUEST_LIMIT`
- `CANONICAL_HOST`, `PORT`, `REFERENCE_FONT_DIR`

`client/.env.example` có một Supabase URL và `client/.env.local` hiện khớp URL
đó. Đây không phải bằng chứng đó là staging; Render phải override cả URL và
anon key bằng giá trị Supabase staging.

`server/index.js` có fallback canonical host `studyhub-ib8g.onrender.com`.
Staging phải đặt `CANONICAL_HOST` bằng domain staging để không quảng bá hoặc
redirect về production.

Không có hard-code Supabase URL trong Calculator database service. Migration và
Calculator-Guideline code không tạo hoặc truy vấn Drug relation.

## Checklist trước deploy

- [ ] Branch là `feature/calculator-guideline-staging`.
- [ ] Commit là `93318f7e72c24d823ca3a236c832a426a21b40b3`.
- [ ] Working tree sạch.
- [ ] Đã chọn Render service staging riêng.
- [ ] Branch Render là `feature/calculator-guideline-staging`.
- [ ] Không sửa service `studyhub` hiện tại.
- [ ] Supabase project URL là staging.
- [ ] Anon key là staging.
- [ ] Không có service-role key trong client variables.
- [ ] `CANONICAL_HOST` là domain staging.
- [ ] `VITE_API_URL` để trống hoặc trỏ staging.
- [ ] Không copy production OpenAI/Gemini key.
- [ ] Hai database migration đã PASS trên Supabase staging.

## Checklist deploy

- [ ] Manual deploy từ service staging.
- [ ] Build log xác nhận đúng branch.
- [ ] Build log xác nhận commit `93318f7`.
- [ ] Build command thành công.
- [ ] Server start thành công.
- [ ] Ghi URL staging và thời điểm deploy.
- [ ] `/api/health` trả HTTP `200`.
- [ ] Network request dùng Supabase staging host.
- [ ] Không có request dùng production Supabase project.

## Checklist sau deploy

Anonymous:

- [ ] Draft không hiển thị.
- [ ] `in_review` không hiển thị.
- [ ] Reviewed nhưng chưa published không hiển thị.
- [ ] Archived không hiển thị.
- [ ] Published hiển thị.
- [ ] Slug draft/archived trả 404 hoặc access denied.
- [ ] Relation chỉ hiển thị khi Calculator published, Guideline shared và Recommendation reviewed.

Admin `thukhoa2002@gmail.com`:

- [ ] Đọc được mọi trạng thái Calculator.
- [ ] Đọc được mọi Calculator-Guideline relation.
- [ ] Tạo, sửa và xóa relation được.
- [ ] Duplicate và FK sai vẫn bị chặn.

User thường:

- [ ] Không tạo, sửa hoặc xóa Calculator-Guideline relation.
- [ ] Không đọc được dữ liệu không public.

Network/API:

- [ ] Response Supabase chỉ trả rows được RLS cho phép.
- [ ] Frontend không tải toàn bộ status rồi tự lọc.
- [ ] Ghi HTTP status/response cho draft slug, published slug và archived slug.

E2E:

- [ ] Admin tạo draft.
- [ ] Thêm Guideline relation.
- [ ] Review và source verify.
- [ ] Publish.
- [ ] Logout và xác nhận Calculator/Guideline relation xuất hiện public.
- [ ] Login admin và archive.
- [ ] Logout và xác nhận Calculator biến mất khỏi public.
- [ ] Không có thay đổi Drug.

Ghi từng mục thành `PASS`, `FAIL`, `BLOCKED` hoặc `NOT RUN` trong
`CALCULATOR_STAGING_EXECUTION_REPORT.md`.

## Xác nhận Supabase staging

Đối chiếu cùng một project ở hai nơi:

1. Supabase Dashboard: project URL và project reference ID staging.
2. Render Environment: `VITE_SUPABASE_URL`, `SUPABASE_URL` và hai anon key.

Các biến `VITE_*` được đóng gói vào client khi build. Đổi biến trên Render sau
khi build không đổi bundle cũ; cần redeploy staging.

## Rollback

### Application

1. Dừng deploy staging hoặc chọn previous successful deploy trên Render.
2. Redeploy commit staging trước đó.
3. Không thay đổi production service.

### Database

- Không rollback destructive tự động.
- Migration Calculator đã PASS và không có Drug relation.
- Khi chỉ rollback application, giữ schema staging nguyên trạng.
- Không dùng `supabase/calculator_data_reset.sql` để rollback deploy.

## Trạng thái hiện tại

- Repository: PASS.
- Branch: `feature/calculator-guideline-staging`.
- Commit: `93318f7e72c24d823ca3a236c832a426a21b40b3`.
- Render staging: NOT RUN/BLOCKED cho tới khi tạo service riêng.
- Anonymous/Admin RLS: BLOCKED cho tới khi deploy build staging.
- E2E: BLOCKED cho tới khi deploy build staging.
- Production: không thay đổi.
- Drug: không thay đổi, ngoài phạm vi.
