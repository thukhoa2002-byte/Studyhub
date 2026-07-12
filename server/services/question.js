import client from "../config/openai.js";
import { questionSchema } from "../schema/questionSchema.js";

export async function generateQuestions(text) {
  const response = await client.responses.create({
    model: "gpt-5",

    input: `
Bạn là giảng viên Nội khoa đang biên soạn ngân hàng câu hỏi cho kỳ thi Bác sĩ Nội trú.

=========================
TÀI LIỆU
=========================

${text}

=========================
NHIỆM VỤ
=========================

Đọc tài liệu và tạo các câu hỏi điền khuyết.

Quy tắc:

- Chỉ hỏi ý quan trọng.
- Không hỏi ý lặp.
- Không hỏi ví dụ.
- Mỗi câu chỉ hỏi một ý.
- Đáp án ngắn gọn.
- Ưu tiên định nghĩa, tiêu chuẩn, điều trị, số liệu, guideline.
- Chỉ tạo câu có độ quan trọng từ 8 trở lên.
`,

    text: {
      format: {
        type: "json_schema",
        ...questionSchema,
      },
    },
  });

  return response.output_parsed.questions;
}