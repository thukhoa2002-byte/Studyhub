# Guideline Target Architecture

Ngày lập: 2026-07-24
Trạng thái: đề xuất, chưa triển khai.

## Nguyên tắc

- Guideline Core là structured clinical knowledge; AI ingestion chỉ là adapter nhập liệu.
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

    GuidelineIngestionJob
      └── IngestionCandidate / TranslationCandidate
              └── creates draft Core records after admin review

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

Mapping tạm thời: guideline_entries là recommendation read/write adapter. Các row table_row_role=header/section không tự động trở thành recommendation.

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

Adapter/service chịu trách nhiệm:

- upload PDF/DOCX;
- trích xuất text/layout/table;
- nhận diện section/recommendation;
- dịch Anh sang Việt;
- tạo candidate draft;
- lưu provenance và trạng thái job.

Ingestion không gọi publish service tự động. Candidate phải qua core editor/review.

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
