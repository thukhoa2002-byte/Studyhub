# Guideline Target Architecture

Ngày lập: 2026-07-24
Trạng thái: đề xuất, chưa triển khai.

## Nguyên tắc

- Guideline Core là structured clinical knowledge; ingestion chỉ là một producer của Core.
- GuidelineRecommendation là đơn vị tri thức lâm sàng có cấu trúc, độc lập và ổn định; không phải chỉ là bản dịch của một đoạn văn.
- Recommendation trả lời câu hỏi "What should be done". Calculator trả lời "What was calculated". Drug mô tả "How the medication is defined".
- Recommendation không chứa logic Calculator, hồ sơ Drug hoặc bản sao dữ liệu của các domain khác.
- Guideline Core không phụ thuộc vào việc có PDF hay file nguồn. Guideline có thể được tạo từ PDF, Word, HTML, DOI, XML hoặc trình soạn thảo thủ công.
- Giữ nội dung gốc, source metadata, page/section/quote và trạng thái kiểm chứng.
- Calculator không chứa recommendation text; chỉ lưu reference tới Guideline.
- Không tạo quan hệ Drug trong sprint này.
- Public chỉ đọc dữ liệu đủ điều kiện ở database/service layer, không dùng frontend filtering hoặc static fallback.
- Không publish nội dung AI chưa review/verify.
- Dùng UUID hiện tại; slug là định danh điều hướng, không thay primary key.

## Dependency graph

    Guideline
      ├── GuidelineSourceDocument
      ├── GuidelineSection (parent_section_id nullable)
      │     └── GuidelineRecommendation
      ├── GuidelinePublicationPolicy
      └── CalculatorGuidelineReference
              ├── Calculator
              ├── Guideline
              ├── Section (nullable)
              └── Recommendation (nullable)

    SourceDocument / ManualEditor / ExternalMetadata
      └── Extraction / Normalization / Translation adapters
              └── Draft Candidate
                      └── Human Review
                              └── Structured GuidelineRecommendation
                                      └── Publication

Guideline Core không phụ thuộc ngược vào bất kỳ adapter ingestion nào. Một
Guideline hoặc Recommendation hợp lệ có thể được tạo và chỉnh sửa mà không
có SourceDocument; source/provenance là metadata kiểm chứng, không phải điều
kiện tồn tại của Core.

Future-only Drug branch:

    GuidelineRecommendation
      -> GuidelineDrugReference
      -> Drug

Branch này chưa thuộc implementation hiện tại. Không tạo FK hoặc compatibility table trước khi Drug entity chính thức được chuẩn hóa.

## Domain entities

### Guideline

Identity/metadata mục tiêu:

    id UUID
    title
    short_title
    slug UNIQUE
    organization
    country_or_region
    specialty
    topic
    publication_year
    version
    language_original
    source_url
    doi
    citation
    summary_vi
    status: draft | in_review | published | archived
    published_at
    archived_at
    created_by / updated_by hoặc owner_id theo convention
    created_at / updated_at

Mapping transition:

    guideline_documents.id -> guidelines.id
    title -> title
    society -> organization
    condition -> specialty/topic tạm thời
    publication_year -> publication_year
    version_label -> version
    source_url -> source_url
    visibility=shared -> public candidate, chưa tự gọi là published

Không tạo bảng mới trước khi chốt giữ tên guideline_documents hay chuyển sang guidelines.

### GuidelineSection

    id UUID
    guideline_id UUID FK
    parent_section_id UUID NULL FK self
    title
    slug
    section_number
    summary_vi
    sort_order
    status
    created_at / updated_at

guideline_sections hiện có là nền tảng phù hợp. Cần bổ sung parent/number/status bằng migration sau khi mapping được duyệt.

### GuidelineRecommendation

    id UUID
    guideline_id UUID FK
    section_id UUID FK
    title
    recommendation_text_original
    recommendation_text_vi
    rationale_vi
    recommendation_class
    evidence_level
    evidence_system
    population
    intervention
    comparator
    outcome
    conditions
    contraindications
    source_page
    source_quote
    source_anchor
    verification_status: unverified | needs_review | verified | rejected
    reviewed_by / reviewed_at
    status
    sort_order
    created_at / updated_at

Recommendation là domain entity độc lập và là đơn vị tham chiếu chính cho
kiến thức lâm sàng có cấu trúc. Nó mô tả hành động/khuyến cáo cần thực hiện,
đối tượng áp dụng, điều kiện và mức bằng chứng; không thực thi phép tính và
không lưu hồ sơ thuốc.

Các domain khác trong tương lai có thể tham chiếu Recommendation bằng ID:

    Calculator -> Recommendation
    Drug -> Recommendation
    Disease -> Recommendation
    Procedure -> Recommendation
    DiagnosticTest -> Recommendation
    EvidenceSummary -> Recommendation

Các tham chiếu này không làm Recommendation phụ thuộc vào entity đích và
không được nhúng dữ liệu domain đích vào recommendation.

Trong transition, guideline_entries là recommendation read/write adapter.
Các row table_row_role=header/section không tự động trở thành
recommendation. Adapter phải có mapping/review rõ ràng trước khi tạo Core
Recommendation ổn định.

### GuidelineSourceDocument

Chỉ tạo nếu file_path hiện tại không đủ:

    id UUID
    guideline_id UUID FK
    original_filename
    storage_path
    storage_url hoặc signed-url metadata
    checksum
    mime_type
    language
    page_count
    upload_status
    extraction_status
    translation_status
    created_at

Có thể giữ file_path/supplement_file_path trong transition và bổ sung checksum/metadata sau.

## Core và ingestion

### Guideline Core

Repository/service chịu trách nhiệm:

- metadata guideline;
- section/recommendation CRUD;
- source traceability;
- validation;
- review/verification;
- publish/archive;
- public query;
- Calculator references;
- stale reference check.

### Guideline Ingestion

Adapter/service chỉ chịu trách nhiệm sản xuất candidate:

- tiếp nhận PDF, DOCX, HTML, DOI, XML hoặc dữ liệu từ editor;
- trích xuất text/layout/table khi nguồn có cấu trúc tương ứng;
- nhận diện section/recommendation;
- dịch Anh sang Việt khi được yêu cầu;
- tạo candidate draft;
- lưu provenance và trạng thái job.

Ingestion không tạo ra định nghĩa riêng của Guideline Core, không gọi publish
service tự động và không được coi PDF là nguồn bắt buộc. Candidate phải đi
qua Core editor và human review trước khi trở thành Structured
Recommendation và được publish.

### Core publication flow

    Source (optional)
      -> Extraction (optional)
      -> Draft
      -> Human Review
      -> Structured Recommendation
      -> Publication

Manual editor có thể bắt đầu trực tiếp tại Draft. Khi đó source metadata có
thể để trống hoặc bổ sung sau; quy trình review/publication vẫn giữ nguyên.

## Publish policy

Target document policy:

    status = published
    published_at IS NOT NULL

Target recommendation policy:

    status cho phép public
    verification_status = verified
    section thuộc guideline
    source traceability tối thiểu có page/quote/anchor hoặc source document

Trong transition, helper phải duy trì policy hiện tại:

    visibility = shared
    AND entry.status = reviewed

Không giả định guideline_documents.status tồn tại trước migration.

## Service boundaries

    guidelineRepository
    guidelineSectionRepository
    guidelineRecommendationRepository
    guidelineSourceDocumentRepository
    guidelineValidation
    guidelinePublicationService
    guidelinePublicService
    guidelineIngestionService
    calculatorGuidelineIntegrityService

Future, chưa triển khai:

    guidelineDrugReferenceRepository
    guidelineDrugReferenceService

Chỉ tạo sau khi drugs có schema, ID strategy, status và public policy chính thức.

React pages chỉ gọi các service này. guidelines.ts có thể làm compatibility facade tạm thời nhưng không là public source lâu dài.

## Public query contract

Public list/detail phải query:

- guideline published/eligible;
- sections thuộc guideline eligible;
- recommendations verified và status public;
- Calculator published;
- Calculator references đủ điều kiện.

Direct slug lookup trả null/404 cho draft, in_review, archived hoặc stale target.

## Admin workspace mục tiêu

    /admin/guidelines
      Overview
      Source
      Sections
      Recommendations
      Calculator References
      Review & Publication
      Ingestion / Translation

Các route sections/recommendations hiện đã được parse nhưng chưa có page độc lập.

## RLS mục tiêu

- Anonymous: chỉ SELECT public guideline/section/recommendation/reference.
- Authenticated thường: quyền đọc public; không CRUD core/relation.
- Admin/editor: CRUD theo role/policy database, review/publish/archive.
- Storage: file gốc private; signed URL theo quyền/visibility.
- Không dùng hidden UI làm authorization.

## Bảo toàn dữ liệu

Không xóa guideline_documents, guideline_entries, file hoặc provenance trong Sprint A. Mapping phải giữ primary key hiện tại và ghi legacy_id/review note nếu cần.

## Future Guideline-Drug Reference contract

Khi Drug entity đã tồn tại, relation có thể lưu:

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

Reference chỉ giữ context riêng của quan hệ và trỏ tới recommendation bằng ID. Không nhúng bản sao Drug profile vào recommendation. Không dùng guideline_entries.drug_id làm compatibility layer lâu dài.
