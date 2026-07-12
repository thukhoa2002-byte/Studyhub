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

Đọc tài liệu trên và tạo các câu hỏi điền khuyết.

Yêu cầu:

- Chỉ hỏi các ý quan trọng.
- Không hỏi ý trùng lặp.
- Không hỏi ví dụ.
- Mỗi câu chỉ hỏi một ý.
- Đáp án ngắn gọn.
- Ưu tiên định nghĩa, tiêu chuẩn chẩn đoán, điều trị, số liệu, guideline.
- Chỉ lấy các ý có độ quan trọng từ 8 trở lên.

CHỈ trả về JSON đúng định dạng sau, không thêm bất kỳ giải thích nào:

{
  "questions": [
    {
      "question": "...",
      "answer": "...",
      "category": "...",
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

  if (!response.output_text) {
    throw new Error("OpenAI không trả về output_text.");
  }

  let parsed;

  try {
    parsed = JSON.parse(response.output_text);
  } catch (err) {
    console.error("Không parse được JSON:");
    console.error(response.output_text);
    throw new Error("OpenAI không trả về JSON hợp lệ.");
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error("JSON không có trường questions.");
  }

  return parsed.questions;
}