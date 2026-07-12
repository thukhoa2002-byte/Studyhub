import client from "../config/openai.js";

export async function generateQuestions(text) {
  const prompt = `
Bạn là giảng viên Nội khoa đang biên soạn ngân hàng câu hỏi cho kỳ thi Bác sĩ Nội trú.

=========================
TÀI LIỆU
=========================

${text}

=========================
NHIỆM VỤ
=========================

Đọc tài liệu và tạo đúng 10 câu hỏi điền khuyết.

Quy tắc:

- Chỉ hỏi ý quan trọng.
- Không hỏi ý lặp.
- Không hỏi ví dụ.
- Mỗi câu chỉ hỏi một ý.
- Đáp án ngắn gọn.
- Ưu tiên định nghĩa, tiêu chuẩn, điều trị, số liệu, guideline.
- Chỉ tạo câu có độ quan trọng từ 8 trở lên.

Trả lời DUY NHẤT bằng JSON theo đúng định dạng sau:

{
  "questions": [
    {
      "question": "",
      "answer": "",
      "category": "",
      "importance": 10
    }
  ]
}
`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input: prompt,
  });

  console.log("========== OPENAI RESPONSE ==========");
  console.dir(response, { depth: null });

  console.log("========== OUTPUT TEXT ==========");
  console.log(response.output_text);

  let parsed;

  try {
    parsed = JSON.parse(response.output_text);
  } catch (err) {
    console.error("Không parse được JSON:");
    console.error(response.output_text);
    throw err;
  }

  console.log("========== PARSED ==========");
  console.dir(parsed, { depth: null });

  return parsed.questions ?? [];
}