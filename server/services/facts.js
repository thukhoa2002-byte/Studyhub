import client from "../config/openai.js";
import { factSchema } from "../schema/factSchema.js";

export async function extractFacts(text) {
  const prompt = `
Bạn là giảng viên Nội khoa đang biên soạn ngân hàng kiến thức cho kỳ thi Bác sĩ Nội trú.

=========================
TÀI LIỆU
=========================

${text}

=========================
NHIỆM VỤ
=========================

Đọc toàn bộ tài liệu.

KHÔNG tạo câu hỏi.

KHÔNG giải thích.

KHÔNG tóm tắt.

Chỉ trích xuất các FACT (đơn vị kiến thức độc lập).

Một FACT phải:

- đầy đủ ý nghĩa
- không phụ thuộc câu trước
- có thể dùng để tạo đúng một câu hỏi
- ngắn gọn
- không lặp

Ưu tiên:

- Definition
- Diagnosis
- Guideline
- Treatment
- Drug
- Laboratory
- Classification
- Mechanism
- Complication
- Prognosis

Đánh giá importance từ 1 đến 10.

Quy ước:

10 = Bắt buộc phải nhớ

8–9 = Rất quan trọng

5–7 = Quan trọng

<5 = Không cần tạo câu hỏi

Nếu hai FACT diễn đạt cùng một ý thì chỉ giữ FACT đầy đủ hơn.
`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",

    input: prompt,

    text: {
      format: {
        type: "json_schema",
        ...factSchema,
      },
    },
  });

  if (!response.output_parsed) {
    throw new Error("Không thể trích xuất FACT.");
  }

  return response.output_parsed.facts;
}