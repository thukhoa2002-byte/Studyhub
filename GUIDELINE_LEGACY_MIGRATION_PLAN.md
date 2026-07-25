# Guideline Legacy Migration Plan

Ngày lập: 2026-07-24
Trạng thái: kế hoạch, chưa chạy migration.

## Nguồn legacy

1. public.guideline_documents
2. public.guideline_entries
3. public.guideline_sections được tạo trong Calculator foundation
4. guideline_documents.file_path và supplement_file_path
5. guideline_entries.provenance, table_cells, table_kind, table_row_role
6. client/src/data/guidelineData.ts
7. client/src/utils/guidelineImport.ts
8. AI extraction/translation output

## Legacy Drug reference inventory

Chỉ ghi nhận, chưa migrate:

| Legacy reference | Vị trí | Kế hoạch |
| --- | --- | --- |
| drug_id | guideline_entries, từ guideline_drug_links_migration.sql | Giữ nguyên trong audit; không dùng làm FK mới. |
| drug_name | guideline_entries | Giữ như text nguồn; không coi là identity Drug. |
| drugReferences | client/src/types/guideline.ts | Adapter legacy; không mở rộng. |
| resolveDrugId | client/src/services/guidelineService.ts | Legacy name/slug resolution; không dùng cho quan hệ mới. |
| guidelineLinks/guidelineReferences | import candidates | Giữ provenance/candidate; chỉ map sau khi Drug entity tồn tại. |

Không tạo guideline_drug_references, calculator_drug_references hoặc FK tới drugs trong kế hoạch hiện tại.

## Mapping đề xuất

| Legacy | Target | Cách xử lý |
| --- | --- | --- |
| guideline_documents.id | guideline.id | Giữ UUID nếu mở rộng/đổi tên logic. |
| title | title, short_title | Giữ title; short title cần admin xác nhận. |
| society | organization | Map trực tiếp. |
| condition | specialty/topic | Map tạm, không suy diễn specialty chính xác. |
| publication_year | publication_year | Map trực tiếp. |
| version_label | version | Map trực tiếp. |
| source_url | source_url/citation | Map trực tiếp, bổ sung citation thủ công nếu thiếu. |
| visibility | status | shared chỉ là public candidate; không tự đánh dấu published. |
| file paths | source document | Giữ path; bổ sung checksum/page count sau. |
| summary/topics | summary/topic | Normalize JSONB, không mất dữ liệu. |
| guideline_entries.id | recommendation.id | Giữ UUID, phân loại row role trước. |
| document_id | recommendation.guideline_id | Map FK. |
| section_id | recommendation.section_id | Giữ nếu FK hợp lệ; null tạo section candidate draft. |
| topic | recommendation.title hoặc section candidate | Không tự quyết định khi topic là nhóm bảng. |
| recommendation_summary | recommendation_text_vi candidate | Giữ nguyên, không dịch lại. |
| provenance original text | recommendation_text_original/source quote | Chỉ map khi xác định được nguồn. |
| recommendation_class | recommendation_class | Map trực tiếp. |
| evidence_level | evidence_level | Map trực tiếp, giữ evidence system nếu có. |
| page_reference | source_page | Map trực tiếp. |
| status reviewed | verification candidate | Chỉ map verified sau reviewer xác nhận. |
| table_row_role header/section | source/table structure | Không tạo recommendation độc lập. |
| table_cells | structured source/table data | Giữ JSONB hoặc extraction record. |
| provenance | provenance/source metadata | Không flatten làm mất field. |
| guidelineData.ts | fixture/import candidate | Không tự động đưa vào database. |

## Migration phases

### Phase 0: snapshot và inventory dữ liệu

- Export row counts, schema, FK, RLS và storage object metadata.
- Backup documents, entries, sections, references và provenance.
- Tạo mapping report từng document/entry.
- Không destructive SQL.

### Phase 1: compatibility metadata

- Chọn giữ guideline_documents hoặc tạo guidelines.
- Nếu mở rộng bảng hiện có: thêm field nullable/default an toàn, không đổi primary key.
- Nếu tạo bảng mới: giữ legacy_document_id unique và mapping transaction.
- Chỉ tạo status/publish policy sau khi owner chốt.

### Phase 2: normalize sections

- Dùng guideline_sections hiện có.
- Entry có section_id: kiểm tra FK/document match.
- Entry null section: tạo candidate section draft từ topic, không publish.
- Không dùng runtime topic grouping làm identity lâu dài.

### Phase 3: normalize recommendations

- Phân loại table_row_role.
- Body recommendation có recommendation_summary đưa vào recommendation adapter/entity.
- Header/section/data rows giữ trong source/table representation hoặc review queue.
- Giữ entry UUID và provenance.

### Phase 4: source documents

- Tính checksum khi đọc file, không tải lại hàng loạt.
- Ghi MIME, filename, page count, extraction/translation status.
- Không đổi storage path nếu không cần.

### Phase 5: dual-read verification

- Repository mới đọc target model.
- So sánh số lượng và identity với legacy read model.
- Calculator references vẫn resolve cùng UUID.
- Chặn public nếu target record thiếu source/review.

### Phase 6: cutover và deprecate

- Tắt static fallback trên public sau verification PASS.
- Giữ guidelineService.ts facade tạm thời.
- Đánh dấu guidelineData.ts fixture-only.
- Chỉ xóa legacy consumers sau runtime audit và test.

## An toàn migration

- Idempotent theo convention project.
- Mỗi phase có transaction hoặc down strategy.
- Không cascade xóa Guideline/Section/Recommendation đã publish.
- Ưu tiên RESTRICT/archive.
- Không dùng guideline_entries.drug_id.
- Không seed nội dung y khoa giả.
- Không chạy production từ sprint audit.

## Verification SQL dự kiến

    select count(*) from public.guideline_documents;
    select count(*) from public.guideline_entries;
    select count(*) from public.guideline_sections;
    select count(*) from public.calculator_guideline_references;

    select e.id, e.document_id, e.section_id
    from public.guideline_entries e
    left join public.guideline_sections s on s.id = e.section_id
    where e.section_id is not null
      and (s.id is null or s.guideline_id <> e.document_id);

    select r.id
    from public.calculator_guideline_references r
    left join public.guideline_documents d on d.id = r.guideline_id
    where d.id is null;

Expected: không có row sai FK/stale.

## Rollback

- Phase 1/2: down migration chỉ cho cột/bảng mới chưa có consumer; không drop legacy.
- Phase 3+: rollback bằng feature flag/dual-read switch, không xóa legacy record.
- Mapping sai: đánh dấu batch failed và sửa mapping, không overwrite nguồn.
- Delete/archive cần audit log hoặc export trước.

## Không đủ dữ liệu để tự động migrate

- guideline_sections hiện được nhóm từ topic runtime; cần admin xác nhận mapping.
- source_quote, source_anchor, evidence system và verification actor có thể thiếu.
- Static fixture thiếu provenance để tự động đưa vào core.
- Không suy diễn published từ bản dịch/AI output.
- Không thể migrate Drug reference an toàn trước khi có drugs schema, UUID strategy, status/public rule và duplicate policy.

## Future Drug migration gate

Chỉ mở migration Guideline-Drug sau khi:

1. Drug entity chính thức tồn tại trong database.
2. ID type và owner/status/public policy của Drug đã được chốt.
3. drug_id có FK thật tới drugs.
4. Recommendation ID có FK thật tới Guideline Recommendation.
5. Relation duplicate policy và delete semantics đã được duyệt.
6. Legacy guideline_entries.drug_id đã được inventory theo từng row.
7. Có mapping review thủ công cho reference không khớp.
8. Có transaction, rollback và verification.

Relation tương lai dự kiến lưu:

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

Không sao chép hồ sơ Drug vào Recommendation và không tự động publish reference được migrate.
