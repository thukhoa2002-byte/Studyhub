import { getOpenAIClient } from "../config/openai.js";

export async function gradeExam(questions) {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    max_output_tokens: 3000,
    input: `
Bạn là giảng viên chấm thi Bác sĩ Nội trú.

${JSON.stringify(questions)}

Chấm từng câu.

Trả JSON:

[
  {
    "correct":true,
    "reason":"..."
  }
]

Không markdown.
`,
  });

  return JSON.parse(response.output_text);
}
