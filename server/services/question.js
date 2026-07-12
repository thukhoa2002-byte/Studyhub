import client from "../config/openai.js";
import { questionSchema } from "../schema/questionSchema.js";

export async function generateQuestions(facts) {
  const prompt = `
Bạn là giảng viên Nội khoa.

Từ danh sách FACT dưới đây:

${JSON.stringify(facts, null, 2)}

Hãy:

1. Đặt tên ngắn gọn cho bộ câu hỏi (title).
2. Tạo các câu hỏi điền khuyết.

Quy tắc:

- title tối đa 6 từ.
- title phải là tên chủ đề.
- Không thêm dấu ":".
- Không thêm "Bài", "Chương", "Deck".

Ví dụ:

Viêm phổi cộng đồng

Xơ gan

Viêm tụy cấp

...

Mỗi FACT tối đa tạo một câu hỏi.

Không tạo câu hỏi tầm thường.

Giữ nguyên category và importance.

Đáp án ngắn gọn.
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

  if (!response.output_parsed) {
    throw new Error("Không thể sinh câu hỏi.");
  }

  return response.output_parsed;
}