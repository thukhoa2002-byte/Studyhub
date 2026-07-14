import { getOpenAIClient } from "../config/openai.js";
import { questionSchema } from "../schema/questionSchema.js";

export async function generateQuestions(text) {
  const client = getOpenAIClient();
  const prompt = `
Bạn là giảng viên Nội khoa chuyên biên soạn câu hỏi cho kỳ thi Bác sĩ Nội trú.

========================
TÀI LIỆU
========================

${text}

========================
NHIỆM VỤ
========================

Đọc toàn bộ tài liệu.

Đầu tiên xác định chủ đề chính.

Sinh:

- title
- questions

========================
QUY TẮC TẠO CÂU HỎI
========================

Đây KHÔNG PHẢI câu hỏi tự luận.

Đây là câu hỏi ĐIỀN KHUYẾT (CLOZE).

Mỗi câu phải được tạo bằng cách:

- giữ nguyên câu gốc
- chỉ che đúng một ý quan trọng nhất
- thay bằng _____

Ví dụ:

Đúng:
"SAAG ≥ _____ g/dL gợi ý tăng áp lực tĩnh mạch cửa."

Đáp án:
1,1

Đúng:
"TIPS chống chỉ định tuyệt đối khi có _____."

Đáp án:
Suy tim mất bù

Đúng:
"Kháng sinh lựa chọn đầu tay là _____."

Đáp án:
Ceftriaxone

Sai:
"TIPS là gì?"

Sai:
"Điều trị của..."

Sai:
"Hãy kể..."

Sai:
"Các biểu hiện..."

Sai:
"Trên X-quang thấy gì?"

========================
NGUYÊN TẮC
========================

✓ Chỉ che đúng một ý.

✓ Đáp án càng ngắn càng tốt.

✓ Không che nhiều chỗ.

✓ Không đổi cấu trúc câu.

✓ Không viết lại câu.

✓ Không hỏi mở.

✓ Không hỏi suy luận.

✓ Không tạo câu có thể có nhiều đáp án.

✓ Chỉ lấy ý quan trọng.

Ưu tiên:

- Định nghĩa
- Tiêu chuẩn
- Phân loại
- Chỉ định
- Chống chỉ định
- Thuốc
- Liều
- Giá trị xét nghiệm
- Guideline
`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        ...questionSchema,
      },
    },
  });

  if (response.output_parsed) {
    return response.output_parsed;
  }

  if (response.output_text) {
    return JSON.parse(response.output_text);
  }

  throw new Error("Không thể tạo câu hỏi.");
}
