# Guideline Publication Policy

## Guideline lifecycle

```text
draft -> in_review -> published -> archived
```

Cho phép quay lại `draft` hoặc `in_review` khi cần sửa. Không publish tự động
từ AI/import. `archived` không được public và không quay lại public nếu chưa
được review lại theo service policy.

## Guideline publish requirements

Guideline chỉ được chuyển sang `published` khi:

- có title hợp lệ;
- có publication year hoặc version khi nguồn cung cấp;
- có source traceability: source URL, DOI, citation, source document hoặc
  provenance tương đương;
- có ít nhất một section đã publish hoặc một Recommendation đủ điều kiện;
- không còn validation error;
- thao tác được thực hiện bởi admin/editor được ủy quyền.

Tạo draft thủ công không yêu cầu PDF, Word, source URL hoặc file upload.

## Recommendation lifecycle

```text
draft -> in_review -> reviewed -> published -> archived
```

Recommendation public eligibility:

- `status = published`;
- `verification_status = verified`;
- có `title` hoặc `recommendation_text_vi`/`recommendation_text_original`;
- `guideline_id` hợp lệ;
- `section_id` hợp lệ và thuộc đúng Guideline;
- có source traceability tối thiểu (`source_page`, `source_quote`,
  `source_anchor` hoặc source document/provenance);
- Guideline cha `status = published`;
- Section cha không `archived` và đã đủ điều kiện public.

`reviewed` chỉ là trạng thái workflow, không tự làm Recommendation public.

## Query rule

Public service phải query theo điều kiện ở database/RLS:

```text
guideline_documents.status = published
guideline_sections.status = published
guideline_recommendations.status = published
guideline_recommendations.verification_status = verified
```

Trang chi tiết theo slug/id trả not-found khi Guideline hoặc Recommendation
không thỏa điều kiện. Không tải toàn bộ dữ liệu rồi lọc ở frontend.

## Edit and verification reset

Sửa các field nội dung hoặc provenance quan trọng phải reset:

```text
verification_status = needs_review
status = in_review
reviewed_at = null
reviewed_by = null
```

Service không cho publish lại cho tới khi review/verify mới hoàn tất.
