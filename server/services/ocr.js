import { getOpenAIClient } from "../config/openai.js";

export async function extractTextFromImage(file) {
  const client = getOpenAIClient();
  const base64Image = file.buffer.toString("base64");

  const response = await client.responses.create({
    model: "gpt-5",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `
Đọc toàn bộ văn bản trong ảnh.

Yêu cầu:

- Giữ nguyên nội dung.
- Không sửa lỗi chính tả.
- Không giải thích.
- Không markdown.

Chỉ trả về văn bản.
`,
          },
          {
            type: "input_image",
            image_url: `data:${file.mimetype};base64,${base64Image}`,
          },
        ],
      },
    ],
  });

  return response.output_text;
}
