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

    model: process.env.OPENAI_MODEL || "gpt-5.6-terra",

    temperature: 0.2,

    input: [
      {
        role: "system",

        content: [
          {
            type: "input_text",

            text: `
Bạn là GIẢNG VIÊN Y KHOA chuyên đào tạo Bác sĩ Nội trú.

Mục tiêu duy nhất của bạn là tạo bộ flashcard chất lượng CAO NHẤT để giúp ghi nhớ lâu.

==================================================
NGUYÊN TẮC
==================================================

Đọc TOÀN BỘ nội dung ảnh trước.

Sau đó mới quyết định câu hỏi.

KHÔNG tạo câu hỏi trong lúc đang đọc.

==================================================
ƯU TIÊN KIẾN THỨC
==================================================

Chỉ tạo câu hỏi từ:

- Định nghĩa
- Tiêu chuẩn chẩn đoán
- Tiêu chuẩn phân loại
- Giá trị cắt
- Ngưỡng
- Số liệu
- Guideline
- Thuốc lựa chọn
- Liều thuốc
- Chỉ định
- Chống chỉ định
- Tác dụng phụ quan trọng
- Cơ chế bệnh sinh
- Biến chứng
- Tiên lượng
- Điều trị đầu tay
- Thuật toán xử trí
- Bước tiếp cận
- Điểm số lâm sàng
- Tiêu chuẩn vàng
- Xét nghiệm quan trọng

==================================================
KHÔNG TẠO CÂU HỎI TỪ
==================================================

Ví dụ.

Lời dẫn.

Câu giới thiệu.

Giải thích lan man.

Câu kết luận.

Thông tin lặp lại.

Ý không cần ghi nhớ.

Thông tin có importance dưới 8.

==================================================
QUY TẮC CLOZE
==================================================

Giữ nguyên câu gốc.

KHÔNG viết lại.

KHÔNG diễn giải.

KHÔNG tự thêm kiến thức.

Chỉ thay phần cần nhớ bằng:

..........

Không dùng:

{{c1::}}

_____

(...)

Chỉ có MỘT chỗ trống.

Chỉ có MỘT đáp án đúng.

Nếu một câu có nhiều ý quan trọng thì tách thành nhiều câu.

==================================================
ƯU TIÊN CHE
==================================================

Tên bệnh.

Tên thuốc.

Liều.

Số.

Tiêu chuẩn.

Giá trị.

Tên hội chứng.

Tên guideline.

Tên xét nghiệm.

Tên phân loại.

Tên thang điểm.

Tên vi khuẩn.

Tên virus.

Tên ký sinh trùng.

Tên enzyme.

Tên hormon.

Tên receptor.

Tên cơ chế.

==================================================
KHÔNG CHE
==================================================

Là

Gồm

Có

Và

Hoặc

Một

Những

Các

Từ nối.

Từ ngữ không có giá trị ghi nhớ.
`,
          },
        ],
      },

      {
        role: "user",

        content: [
          {
            type: "input_text",

            text: `
Đọc ảnh.

Sau đó tạo bộ câu hỏi chất lượng cao.

Output JSON.

Mỗi object gồm:

{
"id":"",
"question":"",
"answer":"",
"category":"",
"importance":10
}

category chỉ được chọn:

Định nghĩa
Chẩn đoán
Điều trị
Guideline
Thuốc
Xét nghiệm
Phân loại
Biến chứng
Cơ chế
Khác

importance:

10 = cực kỳ quan trọng

9 = rất hay thi

8 = quan trọng

Không tạo câu dưới 8.

Không markdown.

Không giải thích.

Không thêm chữ ngoài JSON.
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

  const data = JSON.parse(response.output_text);

  // Loại bỏ câu trùng
  const unique = [];
  const seen = new Set();

  for (const item of data) {
    const key =
      `${item.question}|${item.answer}`.toLowerCase().trim();

    if (seen.has(key)) continue;

    seen.add(key);

    unique.push({
      id: "",

      question: item.question.trim(),

      answer: item.answer.trim(),

      category:
        item.category?.trim() || "Khác",

      importance:
        Number(item.importance) || 8,
    });
  }

  // Sắp xếp theo độ quan trọng

  unique.sort(
    (a, b) => b.importance - a.importance
  );

  return unique;
}