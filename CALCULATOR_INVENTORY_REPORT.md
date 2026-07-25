# Calculator Inventory Report

Ngày kiểm kê: 2026-07-24

## Phạm vi

Module Máy tính y khoa hiện có hai nhánh: module calculator mới ở `client/src/modules/calculators` và công cụ calculator cũ nằm trong `ReferenceToolsPage`. Không có bảng database riêng cho `CalculatorDefinition`; dữ liệu module mới đang ở localStorage với key `studyhub:calculators:v1`. Database có bảng `reference_formulas`, thuộc nhánh công cụ công thức cũ.

## Thành phần

| File | Chức năng | Đang dùng | Phân loại | Reset |
| --- | --- | --- | --- | --- |
| `client/src/modules/calculators/engine.ts` | Handler, registry, validation, dispatcher | Có | Business logic + validation | Giữ |
| `client/src/modules/calculators/engine.test.ts` | Unit test BMI, Cockcroft-Gault, CURB-65 | Có | Test logic | Giữ |
| `client/src/modules/calculators/types.ts` | Type/schema runtime cho calculator | Có | Utility/contract | Giữ |
| `client/src/modules/calculators/data.ts` | 3 seed calculator và toàn bộ metadata | Có | Metadata/seed | Xóa |
| `client/src/modules/calculators/CalculatorPublicPage.tsx` | Public list/detail/result UI | Có | UI | Giữ, danh sách rỗng |
| `client/src/services/calculatorService.ts` | Catalog localStorage, CRUD, publish/archive, tìm kiếm | Có | Service | Giữ API, reset catalog về rỗng |
| `client/src/components/AdminCalculatorPage.tsx` | Admin list/editor | Có | UI | Giữ, danh sách rỗng |
| `client/src/components/AdminCalculatorImportPage.tsx` | Admin import JSON | Có | UI/import | Giữ, không sinh dữ liệu |
| `client/src/components/ReferenceToolsPage.tsx` | UI legacy và các handler inline của calculator cũ | Có trong source, không còn route hoạt động | UI + business logic legacy | Giữ nguyên để refactor sau; không dùng làm nguồn dữ liệu public |
| `client/src/services/referenceTools.ts` | CRUD `reference_formulas` | Có | Metadata service | Không dùng sau reset |
| `supabase/reference_tools_migration.sql` | Schema/RLS bảng `reference_formulas` | Có | Database schema | Giữ, không drop |
| `client/src/utils/dataRoutes.ts` | Route public/admin calculator | Có | Route utility | Giữ |
| `client/src/config/access.ts` | Quyền admin calculator | Có | Access utility | Giữ |
| `client/src/components/ReferenceLibraryPage.tsx` | Điểm gắn nhánh công cụ cũ | Có | UI integration | Giữ, không hiển thị calculator cũ |
| `client/src/components/DrugDataPage.tsx` | Hiển thị calculator liên quan đến thuốc | Có | Cross-module UI | Giữ, liên kết rỗng khi catalog rỗng |
| `client/src/components/GuidelineDataPage.tsx` | Hiển thị calculator liên quan guideline | Có | Cross-module UI | Giữ, liên kết rỗng khi catalog rỗng |
| `client/src/App.tsx` | Mount public/admin calculator routes | Có | Route integration | Giữ |
| `client/package.json` | Test/build scripts | Có | Tooling | Giữ |

## Phân loại logic

### Business logic giữ lại

- `calculatorRegistry.bmi`
- `calculatorRegistry["cockcroft-gault"]`
- `calculatorRegistry["curb-65"]`
- `calculateCalculator`
- `hasCalculatorHandler`
- `validateCalculatorInputs`
- `numberInput`, `missing`

Inventory hiện tại không có handler độc lập tên `calculateBSA`, `calculateMDRD`, `calculateCKD-EPI` hoặc các handler score khác trong `engine.ts`. Các công thức đó đang nằm inline trong legacy `ReferenceToolsPage`; file này đã được backup để refactor logic riêng ở bước sau, không sửa công thức trong bước reset.

### Utility giữ lại

- `calculatorService` catalog/CRUD API, sau reset trả catalog rỗng.
- Slug/ID helper và status helper trong `calculatorService`.
- Route parser/canonicalizer.
- Admin access check.
- Type/schema và validation của engine.

### Metadata reset

- `calculatorDefinitions` trong `data.ts`.
- Seed fields: name, description, purpose, limitations, references, result ranges, status và links.
- Catalog localStorage `studyhub:calculators:v1`.
- Legacy formula overrides localStorage `studyhub-reference-formula-overrides`.
- Các record `reference_formulas` trong Supabase cần xóa bằng quyền owner/admin database.

### UI giữ để refactor sau

- Public calculator page.
- Admin calculator list/editor/import.
- Result panel, input controls và route wiring.
- Legacy `ReferenceToolsPage.tsx` vẫn được giữ trong source để bảo toàn logic cho bước refactor sau, nhưng đã tháo khỏi `ReferenceLibraryPage`; public calculator hiện không đọc file này.
- Các metadata/seed của catalog mới đã bị xóa. Các handler inline legacy chưa bị sửa hoặc xóa trong bước reset vì yêu cầu giữ nguyên logic và chưa refactor UI.

## Routes hiện có

- Public: `/may-tinh-y-khoa`, `/may-tinh-y-khoa/:slug`.
- Alias public: `/calculators`, `/calculators/:slug`.
- Admin: `/admin/may-tinh-y-khoa`, `/admin/may-tinh-y-khoa/new`, `/admin/may-tinh-y-khoa/import`, `/admin/may-tinh-y-khoa/:id/edit`.

## Backup

Backup mã nguồn được tạo tại:

`/private/tmp/studyhub-calculator-backup-20260724`

Backup không nằm trong git repository và không được commit. Workspace không có service-role key nên chưa thể export record private từ Supabase bằng shell.

## Bước xây lại ở Prompt 2

- Thiết kế metadata/schema mới.
- Tách business handler khỏi legacy UI.
- Xây lại registry và public/admin theo kiến trúc mới.
- Bổ sung handler còn thiếu và test độc lập sau khi có yêu cầu cụ thể.

## Trạng thái reset

- Chưa commit.
- Chưa push.
- Không drop table, migration hoặc index.
