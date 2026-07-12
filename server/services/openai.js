import OpenAI from "openai";

function getClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function generateClozeFromImage(file) {
  const client = getClient();

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
Bạn là giảng viên Y khoa.

Đọc toàn bộ nội dung trong ảnh.

Nhiệm vụ:
- Tạo các câu hỏi đục lỗ để ôn thi.
- KHÔNG dùng {{c1::}}.
- Chỉ thay phần cần nhớ bằng dấu "..........".
- Mỗi câu chỉ hỏi 1 ý.
- Không tạo câu hỏi trùng nhau.
- Trả về JSON hợp lệ.

Ví dụ:

[
  {
    "question":"Viêm phổi là tình trạng tổn thương viêm ..........",
    "answer":"nhu mô phổi"
  },
  {
    "question":"Viêm phổi cộng đồng khởi phát trong .......... đầu nhập viện.",
    "answer":"48 giờ"
  }
]

Không viết markdown.
Không giải thích.
Chỉ trả JSON.
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

  return JSON.parse(response.output_text);
}