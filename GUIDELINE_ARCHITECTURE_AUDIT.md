# Guideline Architecture Audit

Ngày audit: 2026-07-24
Phạm vi: client, server và Supabase migrations hiện có. Chưa sửa source, chưa sửa migration, chưa chạy migration.

## Kết luận điều hành

Module Guideline hiện là mô hình document-centric:

    guideline_documents
      -> guideline_entries
      -> client tự nhóm entry thành section

Calculator foundation đã bổ sung guideline_sections và calculator_guideline_references, nhưng chưa hoàn tất việc chuyển Guideline thành structured clinical knowledge. Public Guideline vẫn có fallback sang dữ liệu tĩnh client/src/data/guidelineData.ts; đây là rủi ro lớn nhất vì UI có thể hiển thị nội dung không đến từ database/RLS.

| Khu vực | Phân loại | Nhận định |
| --- | --- | --- |
| UUID và owner_id của document/entry | KEEP | Phù hợp convention hiện tại. |
| guideline_documents | REFACTOR | Có thể giữ làm nền metadata, nhưng thiếu status/slug/source entity rõ ràng. |
| guideline_entries | MIGRATE | Đang trộn recommendation, table row và dữ liệu import. |
| guideline_sections | KEEP + REFACTOR | Đã có bảng thật và FK; chưa có service/editor đầy đủ. |
| calculator_guideline_references | KEEP | Migration, FK, uniqueness, RLS đã triển khai và staging database verification đã PASS. |
| GuidelinesPage | REFACTOR | Đang gộp admin ingestion, review, publish và public presentation. |
| guidelineService.ts | DEPRECATE | Vẫn là adapter legacy/static và fallback; cần thay dần bằng repository/public service. |
| guidelines.ts | REFACTOR | Database service hiện tại, nhưng contract chưa tách core và ingestion. |
| guidelineImportService.ts | KEEP + REFACTOR | Giữ làm ingestion adapter; không để là nguồn đọc public. |
| guideline_drug_links_migration.sql và drug_id | DEPRECATE | Không dùng cho Calculator ↔ Guideline; không mở rộng trong sprint này. |
| guidelineData.ts | REMOVE LATER | Chỉ xóa sau khi public/admin chạy hoàn toàn trên database. |

## Inventory routes

Nguồn: client/src/utils/dataRoutes.ts và client/src/App.tsx.

| Route | Chức năng hiện tại | Phân loại |
| --- | --- | --- |
| /guidelines | Public list | REFACTOR: data service còn fallback static. |
| /guidelines/:slug | Public detail | REFACTOR: detail dùng legacy-mapped data. |
| /guidelines/:slug/:section/:recommendation | Public deep link | REFACTOR: route parse đủ nhưng query chưa theo core ID/status thật. |
| /guidelines/manage | Alias canonicalized sang /admin/guidelines | DEPRECATE alias, giữ redirect. |
| /admin/guidelines | Admin list/ingestion | REFACTOR: render GuidelinesPage document-centric. |
| /admin/guidelines/new | Admin create document | REFACTOR: form bắt buộc PDF chính, source URL và mặc định bật AI. |
| /admin/guidelines/:id | Admin detail | REFACTOR: chưa có structured workspace. |
| /admin/guidelines/:id/edit | Admin edit | REFACTOR: route parse có nhưng chưa có editor edit riêng. |
| /admin/guidelines/:id/sections | Dự kiến section editor | DEPRECATE/REFACTOR: route khai báo nhưng chưa có handler độc lập. |
| /admin/guidelines/:id/recommendations | Dự kiến recommendation editor | DEPRECATE/REFACTOR: route khai báo nhưng chưa có handler độc lập. |

## Inventory components

| File | Chức năng | Phân loại |
| --- | --- | --- |
| client/src/components/GuidelinesPage.tsx | Public rendering, admin upload, AI extraction, entry CRUD, review, visibility, PDF | REFACTOR mạnh; tách public, core admin và ingestion. |
| client/src/components/AdminGuidelinePage.tsx | Wrapper admin cho GuidelinesPage | REFACTOR. |
| client/src/components/AdminPage.tsx | Dashboard link tới quản lý Guideline | KEEP; đổi destination khi editor mới sẵn sàng. |
| client/src/components/GuidelineDataPage.tsx | Public legacy model và calculator links | REFACTOR; không để static fallback là nguồn public. |
| client/src/components/AdminDrugImportPage.tsx | Guideline table import UI cho common guidance và nhiều thuốc | KEEP trong ingestion boundary; không đưa Drug vào sprint này. |

## Inventory services, utilities và types

| File | Chức năng | Phân loại |
| --- | --- | --- |
| client/src/services/guidelines.ts | CRUD document/entry, storage URL, status/visibility | REFACTOR thành repositories/services tách lớp. |
| client/src/services/guidelineService.ts | Static lookup, DB-to-legacy mapping, fallback | DEPRECATE sau migration. |
| client/src/services/guidelinePublication.ts | canExposeGuideline theo shared/reviewed | KEEP, chuẩn hóa thành publication service. |
| client/src/services/guidelineImportService.ts | Lưu GuidelineImportCandidate và tạo entry/Drug links | KEEP ingestion-only; cần provenance/verification rõ hơn. |
| client/src/utils/guidelineImport.ts | Candidate, provenance, common guidance, drug rows | KEEP + REFACTOR; không publish trực tiếp. |
| client/src/types/guideline.ts | Legacy UI model có sections/recommendations | REFACTOR thành domain read models hoặc adapter tạm. |
| client/src/data/guidelineData.ts | Static/mock guideline data | REMOVE LATER sau khi không còn runtime consumer. |
| client/src/services/calculatorRepository.ts | Query Guideline targets và Calculator references | KEEP; tách phần Guideline target sang repository riêng. |
| client/src/services/calculatorDatabaseService.ts | Calculator ↔ Guideline domain operations | KEEP; dependency graph cập nhật khi Guideline repository mới có. |
| client/src/services/calculatorGuidelineIntegrity.ts | Stale/integrity check in-memory | KEEP + REFACTOR. |

## Inventory server và ingestion

| File/khu vực | Chức năng | Phân loại |
| --- | --- | --- |
| server/routes/guidelineExtraction.js | Endpoint extraction guideline | KEEP trong ingestion; cần audit quota/provenance. |
| server/routes/drugImport.js | AI extraction bảng guideline nhiều thuốc | KEEP ngoài core; không mở rộng Drug trong sprint này. |
| server/services/drugImport.js và prompts | Parse/AI guideline table | REFACTOR boundary; output candidate, không tự ghi public core. |
| server/middleware/guidelineAdmin.js | Quyền server cho guideline/extraction | KEEP, đối chiếu Supabase RLS. |

## Inventory Supabase

| File/bảng | Chức năng | Phân loại |
| --- | --- | --- |
| supabase/guidelines_migration.sql | guideline_documents, guideline_entries, storage bucket, RLS | KEEP legacy foundation; migrate có kiểm soát sau. |
| supabase/calculator_foundation_migration.sql | guideline_sections, calculator_guideline_references, public policy | KEEP; không sửa trong audit-only sprint. |
| supabase/guideline_drug_links_migration.sql | drug_id text và provenance | DEPRECATE; không dùng làm quan hệ mới. |
| public.guideline_documents | Metadata, visibility, file paths | REFACTOR/MIGRATE về core. |
| public.guideline_entries | Recommendation/table row/review | MIGRATE/ADAPTER. |
| public.guideline_sections | Section UUID parent cho Calculator relation | KEEP + mở rộng. |
| public.calculator_guideline_references | Calculator ↔ Guideline relation | KEEP. |
| storage.guideline-files | Private PDF storage | KEEP; bổ sung source metadata ở core/source layer. |

## Schema hiện tại

### guideline_documents

- id uuid primary key, gen_random_uuid().
- owner_id uuid FK auth.users, hiện ON DELETE CASCADE.
- title, society, condition, publication_year, version_label, source_url.
- file_path, supplement_file_path.
- visibility chỉ private/shared, không có status draft/in_review/published/archived.
- summary, topics, provenance được thêm bởi migration sau.
- Thiếu slug, short_title, specialty/topic tách biệt, citation, doi, language_original, published_at, archived_at, created_by/updated_by.

### guideline_entries

- id uuid, document_id uuid, owner_id uuid.
- Trộn topic, drug_name, clinical_context, recommendation_summary, dose, renal/hepatic adjustment, contraindications, monitoring.
- Có recommendation_class, evidence_level, page_reference, table_kind, table_row_role, table_cells.
- status chỉ draft/reviewed.
- section_id nullable FK guideline_sections được thêm trong Calculator migration.
- Không có entity guideline_recommendations riêng; entry đang là recommendation/table row.
- Thiếu original text, rationale, PICO fields, source quote/anchor và verification actor/time.

### guideline_sections

- id uuid, guideline_id uuid FK guideline_documents ON DELETE RESTRICT.
- owner_id, slug, title, title_vi, summary, display_order, timestamps.
- Unique guideline_id + slug và id + guideline_id.
- Chưa có parent_section_id, section_number, status.

### calculator_guideline_references

- calculator_id uuid FK Calculator ON DELETE CASCADE.
- guideline_id uuid FK document ON DELETE RESTRICT.
- section_id và recommendation_id nullable, composite FK bảo đảm parent đúng.
- relation_type constrained values, context JSONB, required, display_order, owner, timestamps.
- Unique index dùng NULLS NOT DISTINCT trên identity composite.
- RLS và public exposure function đã được Calculator foundation migration triển khai.

## ID, slug và quan hệ

- Core database dùng UUID cho document, entry, section, calculator và reference.
- Guideline public slug chưa nằm trong database. guidelineService.ts sinh slug runtime từ society/title/year, không phải identity ổn định.
- Legacy GuidelineRecommendation dùng entry UUID; section được sinh runtime từ topic.
- Calculator relation dùng UUID thật cho document/section/entry, là hướng đúng.
- guideline_entries.drug_id là text nullable từ migration riêng, không phải relation chuẩn. Sprint này không dùng.

## RLS và publication audit

### Admin

guidelines_migration.sql dùng is_guideline_admin() theo email thukhoa2002@gmail.com và owner_id để cấp CRUD documents/entries. UI admin đang gộp upload, AI, entry CRUD, review và visibility trong GuidelinesPage.

### Public

Calculator foundation dùng visibility=shared cho document và status=reviewed cho entries vì document chưa có status. Đây là policy đã được chốt và staging database verification đã PASS, nhưng tên domain chưa phản ánh target model.

guidelineService.loadGuidelines() gọi DB nhưng khi không có document hoặc có lỗi thì fallback về guidelineData.ts. Vì vậy public UI chưa bảo đảm chỉ hiển thị database/RLS data.

### Gaps

- Public Guideline service chưa database-only.
- Không có public repository riêng với query published/eligible.
- Không có document status chuẩn; shared đang mang nghĩa publish.
- Entry public policy chưa có verification_status độc lập.
- Admin/public/ingestion chưa tách boundary.

## Calculator integration

Dependency hiện tại:

    calculators
      -> calculator_guideline_references
      -> guideline_documents / guideline_sections / guideline_entries

Không dùng guideline_entries.drug_id, không tạo Drug relation và không thay đổi trong audit. Calculator không nhúng recommendation text, phù hợp mục tiêu. Target lookup hiện nằm trong calculatorRepository, cần tách sang Guideline repositories ở Sprint B.

## Future Drug integration

Định hướng dependency cho giai đoạn sau:

    Guideline
      -> Guideline Section
      -> Guideline Recommendation
      -> Guideline-Drug Reference
      -> Drug

Recommendation giữ bối cảnh và nội dung khuyến cáo. Drug là entity chuẩn hóa riêng; không sao chép toàn bộ Drug vào Recommendation.

Không dùng legacy guideline_entries.drug_id. Không tạo foreign key tới drugs, guideline_drug_references hoặc calculator_drug_references trước khi Drug entity chính thức tồn tại.

Các field cần chừa cho relation tương lai:

    drug_id
    relation_type
    indication_context
    dose_context
    population_context
    renal_adjustment_context
    hepatic_adjustment_context
    recommendation_id
    sort_order
    created_at
    updated_at

Legacy drug references chỉ được inventory trong sprint này:

- guideline_entries.drug_id từ supabase/guideline_drug_links_migration.sql;
- drug_name trên guideline_entries;
- drugReferences và guidelineLinks trong legacy types/import candidates;
- resolveDrugId và lookup theo tên/slug trong guidelineService.ts.

Chưa sửa, migrate hoặc expose các reference này thành quan hệ database.

## Rủi ro

1. Static fallback có thể hiển thị dữ liệu không public.
2. visibility shared và entry reviewed tạo publication policy kép.
3. Xóa document cascade entries, không phù hợp audit trail structured knowledge.
4. Upload form bắt buộc PDF và mặc định bật AI, nên nhập metadata chưa độc lập với ingestion.
5. AI output/provenance đang nằm trong JSON, chưa có ingestion job/source entity.
6. Runtime topic grouping làm section/deep link và relation không ổn định khi topic đổi.
7. Legacy drug resolution dựa trên tên/slug tĩnh; không mở rộng sprint này.
8. Supabase egress đang vượt quota; ingestion PDF/AI cần giới hạn và theo dõi riêng.

## Quyết định cần xác nhận

1. Giữ guideline_documents làm bảng core hay tạo alias/view guidelines rồi migrate dần.
2. Thêm status chuẩn hay duy trì visibility + reviewed entries trong transition.
3. Dùng guideline_entries làm recommendation adapter hay tạo guideline_recommendations sau mapping.
4. Source document bắt buộc khi publish hay citation/source URL là đủ.
5. Delete policy archive/restrict thay cho cascade document → entry.
6. Public database service có phải nguồn duy nhất, static fixture chỉ còn cho unit test hay không.
