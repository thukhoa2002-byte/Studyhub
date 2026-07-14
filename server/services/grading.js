import OpenAI from "openai";

function getClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function gradeAnswer(question, correctAnswer, userAnswer) {
  const client = getClient();

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    max_output_tokens: 500,
    input: `
Bạn là giảng viên chấm thi Bác sĩ Nội trú.

Câu hỏi:

${question}

Đáp án chuẩn:

${correctAnswer}

Thí sinh trả lời:

${userAnswer}

Quy tắc:

- Chấp nhận từ đồng nghĩa.
- Chấp nhận cách viết khác.
- Chấp nhận viết tắt.
- Chấp nhận khác dấu câu.
- Chấp nhận khác chữ hoa/thường.
- Nếu thiếu ý quan trọng thì sai.
- Nếu đúng nhưng diễn đạt khác thì vẫn đúng.

Trả đúng JSON:

{
  "correct": true,
  "reason": "..."
}

Không giải thích ngoài JSON.
`,
  });

  return JSON.parse(response.output_text);
}
