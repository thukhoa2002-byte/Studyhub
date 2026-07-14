import express from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import { getOpenAIClient } from "../config/openai.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const cache = new Map();

router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Không có ảnh." });
    const key = createHash("sha256").update(req.file.buffer).digest("hex");
    if (cache.has(key)) return res.json(cache.get(key));
    const client = getOpenAIClient();
    const response = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini",
      max_output_tokens: 4500,
      input: [{ role: "user", content: [
        { type: "input_text", text: "Đọc toàn bộ nội dung y khoa trong ảnh và chọn tối đa 10 kiến thức QUAN TRỌNG NHẤT để tạo câu hỏi trắc nghiệm. Ưu tiên định nghĩa, tiêu chuẩn chẩn đoán, phân loại, chỉ định/chống chỉ định, thuốc-liều, giá trị xét nghiệm, dấu hiệu cảnh báo và điểm hay gặp trong thi Nội trú. Bỏ qua ví dụ vụn, câu lặp, chi tiết trang trí và kiến thức không giúp quyết định lâm sàng. Mỗi câu có đúng 4 lựa chọn, chỉ một đáp án đúng; phương án nhiễu phải hợp lý nhưng sai rõ ràng theo tài liệu. Trả JSON theo schema, không markdown. Câu hỏi ngắn; explanation tối đa 1 câu." },
        { type: "input_image", image_url: `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}` },
      ] }],
      text: { format: { type: "json_schema", name: "mcq_list", strict: true, schema: {
        type: "object", properties: { title: { type: "string" }, questions: { type: "array", maxItems: 10, items: { type: "object", properties: {
          question: { type: "string" }, answer: { type: "string" }, category: { type: "string" }, importance: { type: "integer" }, options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } }, correctOption: { type: "string" }, explanation: { type: "string" }
        }, required: ["question","answer","category","importance","options","correctOption","explanation"], additionalProperties: false } } }, required: ["title","questions"], additionalProperties: false
      } } },
    });
    const payload = { success: true, text: "", title: response.output_parsed?.title ?? "Trắc nghiệm", data: response.output_parsed?.questions ?? JSON.parse(response.output_text).questions };
    cache.set(key, payload); if (cache.size > 50) cache.delete(cache.keys().next().value);
    return res.json(payload);
  } catch (error) { console.error(error); return res.status(500).json({ success: false, message: error.message }); }
});

export default router;
