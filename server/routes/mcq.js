import express from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import { generateStructuredFromImage } from "../services/gemini.js";
import { consumeAiCall, getAiCallsRemaining } from "../services/aiUsage.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const cache = new Map();

router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Không có ảnh." });
    const key = createHash("sha256").update(req.file.buffer).digest("hex");
    if (cache.has(key)) return res.json({ ...cache.get(key), aiCallsRemaining: getAiCallsRemaining() });
    const aiCallsRemaining = consumeAiCall();
    if (aiCallsRemaining === null) return res.status(429).json({ success: false, message: "Đã hết lượt AI dùng chung.", aiCallsRemaining: 0 });
    const schema = {
        type: "object", properties: { title: { type: "string" }, questions: { type: "array", items: { type: "object", properties: {
          question: { type: "string" }, answer: { type: "string" }, category: { type: "string" }, importance: { type: "integer" }, options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } }, correctOption: { type: "string" }, explanation: { type: "string" }
        }, required: ["question","answer","category","importance","options","correctOption","explanation"], additionalProperties: false } } }, required: ["title","questions"], additionalProperties: false
    };
    const result = await generateStructuredFromImage({
      file: req.file,
      maxOutputTokens: 12000,
      schema,
      prompt: "Đọc toàn bộ nội dung y khoa trong ảnh và tạo câu hỏi cho TỪNG Ý KIẾN THỨC QUAN TRỌNG, không áp dụng giới hạn số câu cố định. Tự điều chỉnh số lượng theo mật độ kiến thức: tài liệu ít ý thì tạo ít câu, tài liệu nhiều ý thì tạo nhiều câu. Mỗi ý quan trọng chỉ tạo một câu, không lặp. Chỉ sử dụng kiến thức nhìn thấy trong ảnh, không tự bổ sung dữ kiện ngoài tài liệu. Ưu tiên định nghĩa, tiêu chuẩn chẩn đoán, phân loại, chỉ định/chống chỉ định, thuốc-liều, giá trị xét nghiệm, dấu hiệu cảnh báo và điểm hay gặp trong thi Nội trú. Bỏ qua ví dụ vụn, chi tiết trang trí và kiến thức không giúp quyết định lâm sàng. Mỗi câu có đúng 4 lựa chọn, chỉ một đáp án đúng; correctOption phải giống chính xác một phần tử trong options; answer phải là đáp án đúng. Phương án nhiễu phải hợp lý nhưng sai rõ ràng theo tài liệu. Câu hỏi ngắn; explanation tối đa 1 câu. Trả đúng JSON theo schema.",
    });
    const payload = { success: true, text: "", title: result.title || "Trắc nghiệm", data: result.questions || [], aiCallsRemaining };
    cache.set(key, payload); if (cache.size > 50) cache.delete(cache.keys().next().value);
    return res.json(payload);
  } catch (error) {
    console.error(error);
    const status = error?.status === 429 ? 429 : 500;
    return res.status(status).json({ success: false, message: status === 429 ? "Gemini đã hết hạn mức hoặc đang quá tải. Vui lòng thử lại sau." : error.message });
  }
});

export default router;
