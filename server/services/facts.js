import client from "../config/openai.js";

export async function extractFacts(text) {
  const prompt = `
Bạn là giảng viên Nội khoa.

Đọc tài liệu sau và trích xuất FACT.

${text}

Trả về JSON có dạng:

{
  "facts":[
    {
      "fact":"...",
      "category":"Definition",
      "importance":10
    }
  ]
}
`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input: prompt,
  });

  console.log(response.output_text);

  const parsed = JSON.parse(response.output_text);

  return parsed.facts;
}