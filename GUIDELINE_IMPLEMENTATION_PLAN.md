# Guideline Implementation Plan

Ngày lập: 2026-07-24
Trạng thái: kế hoạch đề xuất, chưa triển khai.

## Quy tắc thực thi

- Chia sprint nhỏ; mỗi sprint có test, report và rollback.
- Không thay đổi logic tính Calculator.
- Không làm Drug, không tạo relation Drug.
- Không sửa/chạy migration trong vòng audit này.
- Không merge main, deploy production hoặc xóa legacy code khi chưa dual-read verification.

## Sprint A - Audit và domain model

Phạm vi:

- Hoàn thành audit, target architecture và mapping plan.
- Chốt tên entity/table: mở rộng guideline_documents hay tạo guidelines.
- Chốt document status/publication policy.
- Chốt mapping guideline_entries → recommendation.
- Chốt source document metadata.

Điều kiện qua sprint: owner xác nhận các quyết định domain trong audit.

## Sprint B - Schema, repository và service

Phạm vi:

- Thiết kế migration additive, idempotent, không destructive.
- Chuẩn hóa guidelineRepository.
- Thêm guidelineSectionRepository.
- Thêm guidelineRecommendationRepository.
- Thêm guidelineSourceDocumentRepository nếu cần.
- Tạo guidelineValidation, guidelinePublicationService, guidelinePublicService.
- Giữ Calculator reference FK/unique/RLS đã PASS.

Kiểm tra:

- UUID/FK/unique/index;
- archive/restrict delete;
- stale reference;
- anonymous/authenticated/admin RLS;
- không có drug_id dependency.

Không cutover public cùng commit nếu chưa có dual-read test.

## Sprint C - Admin structured editor

Tách các khu vực:

    Overview
    Source
    Sections
    Recommendations
    Calculator References
    Review & Publication

Yêu cầu:

- tạo guideline thủ công không bắt buộc AI/PDF nếu source policy cho phép;
- tạo/sửa/sắp xếp section;
- tạo/sửa recommendation với original/Việt, class/LoE, source page/quote;
- review/verification từng recommendation;
- publish/archive qua service và RLS;
- cảnh báo stale khi đổi field critical.

## Sprint D - Public Guideline pages

Phạm vi:

- database-backed public list/detail;
- query chỉ published/eligible ở repository/service và RLS;
- table of contents từ section thật;
- recommendation card có class/evidence/source traceability;
- deep link section/recommendation bằng identity ổn định;
- Calculator links chỉ hiện khi hai phía đủ public.

Điều kiện bắt buộc: loại bỏ runtime fallback guidelineData.ts trước khi PASS.

## Sprint E - Ingestion/AI translation adapter

Phạm vi:

- giữ upload PDF/DOCX và extraction hiện có;
- tạo ingestion candidate/job metadata;
- preserve original text, translation status, source page, table/figure identity;
- AI output status unverified/needs_review;
- mở structured review editor sau extraction;
- không auto publish;
- quota/egress limit và retry rõ ràng.

Extraction failure không được làm hỏng core document đã lưu.

## Sprint F - Calculator integration và stale verification

Phạm vi:

- giữ calculator_guideline_references;
- chuyển target lookup ra Guideline repositories;
- hiển thị recommendation theo result context;
- reverse query Guideline → Calculator;
- stale checker khi đổi section/recommendation/status/source critical fields;
- không sao chép recommendation vào Calculator.

Drug remains out of scope:

- không tạo guideline_drug_references;
- không tạo calculator_drug_references;
- không tạo FK tới drugs;
- không dùng guideline_entries.drug_id;
- chỉ cập nhật inventory/migration note nếu phát hiện legacy reference.

Test:

- valid relation public;
- wrong guideline/section/recommendation blocked;
- duplicate blocked;
- archived/unverified target hidden;
- không có dangling relation.

## Sprint G - RLS, tests và migration verification

Phạm vi:

- SQL structural verification;
- anonymous/admin/regular-user API tests;
- public response evidence;
- staging rollback rehearsal;
- E2E admin create → review → publish → public → archive.

Build gates:

- build;
- typecheck;
- lint;
- Guideline domain/publication tests;
- ingestion tests;
- Calculator integrity tests;
- RLS/API tests;
- migration verification report.

## File dự kiến sửa

### Sprint B

- supabase additive guideline migration được duyệt;
- client/src/services/guidelines.ts tách repository/service;
- database/domain types;
- guidelinePublication.ts;
- domain/RLS tests.

### Sprint C/D

- AdminGuidelinePage.tsx;
- components cho Overview/Source/Sections/Recommendations/Review;
- GuidelineDataPage.tsx;
- dataRoutes.ts nếu cần;
- bỏ runtime static fallback sau dual-read.

### Sprint E

- server/routes/guidelineExtraction.js;
- ingestion service/prompt contract;
- guidelineImport.ts và guidelineImportService.ts.

### Sprint F/G

- calculatorRepository.ts chỉ giữ orchestration Calculator hoặc gọi Guideline repositories;
- calculatorGuidelineIntegrity.ts;
- tests và staging reports.

## Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
| --- | --- |
| Static fallback làm sai public visibility | Dual-read, response test, remove fallback trước cutover. |
| Status không tương thích visibility hiện tại | Helper transition, migration additive. |
| Topic grouping tạo section không ổn định | Materialize section UUID và review mapping. |
| AI dịch sai/thiếu provenance | Candidate draft, original preservation, review gate. |
| File/AI tăng egress | Không tải lại file, signed URL ngắn hạn, quota monitoring. |
| FK relation stale | Composite FK, service validation, stale checker. |
| Xóa document làm mất entry | Archive/RESTRICT, backup trước migration. |

## Điều kiện bắt đầu implementation

Chỉ bắt đầu Sprint B sau khi owner xác nhận:

1. Tên và identity Guideline core.
2. Document publish policy transition.
3. Entry-to-recommendation mapping.
4. Source document bắt buộc hay tùy chọn.
5. Delete/archive semantics.
6. Static data chỉ còn fixture hay còn compatibility period.

## Điều kiện hoàn tất redesign

- structured core là nguồn dữ liệu duy nhất;
- public không fallback static/local/mock;
- ingestion chỉ tạo draft/unverified;
- admin CRUD/review/publish/archive qua service + RLS;
- Calculator reference FK/unique/RLS vẫn PASS;
- staging E2E và Network/API PASS;
- không thay đổi Drug;
- owner duyệt merge/deploy production.

## Future Drug integration gate

Sau khi Guideline redesign hoàn tất, một sprint riêng mới được mở:

    Guideline Recommendation
      -> Guideline-Drug Reference
      -> Drug

Reference tương lai cần hỗ trợ:

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

Điều kiện trước khi triển khai:

- Drug database entity, UUID và status/public policy đã PASS;
- không còn phụ thuộc vào tên hiển thị hoặc guideline_entries.drug_id;
- FK, duplicate, delete/archive và RLS đã được thiết kế;
- có mapping review cho legacy references;
- có migration verification và rollback;
- không làm thay đổi Calculator formula hoặc Guideline recommendation content.
