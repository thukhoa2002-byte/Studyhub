import client from "../config/openai.js";
import { factSchema } from "../schema/factSchema.js";

export async function extractFacts(text) {
  const prompt = `
Bạn là giảng viên Nội khoa.

Đọc tài liệu sau và trích xuất các FACT.

${text}
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

  console.log("========== FACT RESPONSE ==========");
  console.dir(response, { depth: null });
  console.log("===================================");

  let parsed = response.output_parsed;

  if (!parsed && response.output_text) {
    try {
      parsed = JSON.parse(response.output_text);
    } catch (e) {
      console.error(e);
    }
  }

  if (!parsed) {
    throw new Error("Không thể trích xuất FACT.");
  }

  return parsed.facts;
}