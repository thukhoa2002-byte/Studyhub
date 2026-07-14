import { getOpenAIClient } from "../config/openai.js";

export async function gradeExam(questions) {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: "gpt-5",
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
