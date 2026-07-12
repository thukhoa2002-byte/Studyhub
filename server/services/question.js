import client from "../config/openai.js";
import { questionSchema } from "../schema/questionSchema.js";

export async function generateQuestions(text) {
  const prompt = `
Bạn là giảng viên Nội khoa đang biên soạn ngân hàng câu hỏi cho kỳ thi Bác sĩ Nội trú.

========================
TÀI LIỆU
========================

${text}

========================
YÊU CẦU
========================

Đọc toàn bộ tài liệu.

Đầu tiên hãy tự xác định chủ đề chính.

Đặt tên ngắn gọn cho chủ đề (title).

Sau đó tạo câu hỏi điền khuyết.

Quy tắc:

- Chỉ hỏi ý quan trọng.
- Không hỏi ý hiển nhiên.
- Không hỏi từ đơn.
- Không hỏi ngữ pháp.
- Không hỏi câu có thể đoán.
- Một câu chỉ hỏi một ý.
- Đáp án phải có giá trị học tập.
- Ưu tiên:
  - Định nghĩa
  - Chẩn đoán
  - Điều trị
  - Guideline
  - Phân loại
  - Chỉ định
  - Chống chỉ định
  - Tiêu chuẩn
  - Thuốc
  - Liều
  - Giá trị xét nghiệm
- Chỉ tạo câu có importance >= 8.
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