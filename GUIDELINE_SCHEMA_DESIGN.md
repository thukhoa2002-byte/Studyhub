# Guideline Schema Design

Ngày: 2026-07-24
Phạm vi: Sprint B, Guideline Core only.

## Quyết định

Guideline Core tiếp tục dùng `guideline_documents` làm identity table trong
giai đoạn này để giữ UUID và dữ liệu hiện có. `guideline_entries` chỉ là
legacy ingestion/table-content table; không dùng nó làm Recommendation mới.

## Schema delta

### `guideline_documents`

Giữ nguyên UUID, owner và các cột file legacy. Bổ sung:

- `status`: `draft | in_review | published | archived`.
- `published_at`, `archived_at`, `published_by`, `archived_by`.
- `review_note`.

Nới `source_url` và `publication_year` thành nullable để tạo draft thủ công.
Điều kiện source traceability chỉ áp dụng khi publish. Không xóa
`file_path`/`supplement_file_path`.

### `guideline_sections`

Giữ `id`, `guideline_id`, slug và các uniqueness hiện có. Bổ sung:

- `parent_section_id` nullable, cùng `guideline_id` để bảo đảm cây không
  trỏ sang Guideline khác.
- `section_number` nullable.
- `status`: `draft | in_review | published | archived`.

### `guideline_recommendations`

Entity Recommendation riêng, UUID và provenance độc lập:

```text
id uuid primary key
guideline_id uuid not null
section_id uuid null
title text
recommendation_text_original text
recommendation_text_vi text
rationale_vi text
recommendation_class text
evidence_level text
evidence_system text
population text
intervention text
comparator text
outcome text
conditions text
contraindications text
source_page integer null
source_quote text
source_anchor text
verification_status unverified | needs_review | verified | rejected
review_note text
reviewed_by uuid null
reviewed_at timestamptz null
status draft | in_review | reviewed | published | archived
sort_order integer
created_at timestamptz
updated_at timestamptz
```

`section_id` nullable ở draft để nội dung chưa phân loại không bị ép vào
section giả. Trigger/service bắt buộc section, text hiển thị, traceability,
verification và parent published trước khi Recommendation được publish.

### `guideline_source_documents`

Supporting record tùy chọn, không phải prerequisite của Guideline:

```text
id uuid
guideline_id uuid
original_filename text
storage_path text
mime_type text
source_kind text
checksum text
page_count integer null
extraction_status text
created_at timestamptz
updated_at timestamptz
```

Các file legacy trên `guideline_documents` được giữ nguyên. Backfill sang
bảng này chỉ tạo supporting rows khi có path, không xóa hay đổi dữ liệu cũ.

## Không thay đổi trong Sprint B

- Không drop hoặc rename `guideline_entries`.
- Không migrate Calculator relation khỏi `guideline_entries` trong migration
  này; Calculator-Guideline FK, uniqueness và logic hiện tại được giữ nguyên.
- Không tạo `drugs`, `guideline_drug_references` hoặc `calculator_drug_references`.
- Không dùng `guideline_entries.drug_id` làm relation mới.

## Migration order

1. Add nullable Guideline lifecycle/source columns.
2. Add Section hierarchy/status columns and constraints.
3. Create optional source-document table and indexes.
4. Create Recommendation table, composite FKs and indexes.
5. Create publication validation trigger/functions.
6. Apply RLS policies and grants.
7. Backfill only lifecycle values/supporting provenance rows in a transaction.

Mọi bước dùng `if not exists`/`if exists` theo convention hiện tại. Không có
destructive delete. Rollback chỉ drop objects mới nếu không còn dependency;
cột dữ liệu cũ không được tự động xóa.

## Rủi ro

- Các UI cũ vẫn đọc `guideline_entries`; chúng là compatibility consumers và
  chưa được chuyển sang Recommendation trong Sprint B.
- Calculator relation hiện trỏ Recommendation legacy. Migration chuyển FK
  sang entity mới là một bước riêng sau khi mapping và Calculator adapter được
  duyệt.
- Dữ liệu `guideline_entries` chứa cả narrative và table rows; phân loại mơ
  hồ phải vào manual review queue, không tự suy diễn thành Recommendation.
