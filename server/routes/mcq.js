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
      prompt: `Đọc toàn bộ nội dung y khoa trong ảnh và tạo trắc nghiệm kiến thức bằng tiếng Việt.

- Chỉ sử dụng dữ kiện nhìn thấy trong ảnh, không tự bổ sung kiến thức ngoài tài liệu.
- Tự điều chỉnh số câu theo số ý quan trọng; mỗi ý chỉ tạo một câu và không lặp.
- Ưu tiên định nghĩa, tiêu chuẩn chẩn đoán, phân loại, dấu hiệu, xét nghiệm, chỉ định/chống chỉ định, thuốc-liều, cơ chế và điểm dễ nhầm trong thi Nội trú.
- Hỏi trực tiếp, rõ ràng, ngắn gọn; không bắt buộc dựng tình huống bệnh nhân.
- Mỗi câu có đúng 4 lựa chọn đồng dạng và chỉ một đáp án đúng. Không dùng “tất cả đều đúng” hoặc “không đáp án nào”.
- Phương án nhiễu phải hợp lý nhưng sai rõ theo tài liệu; tránh làm lộ đáp án bằng độ dài hay từ khóa.
- correctOption phải trùng chính xác một phần tử trong options; answer phải bằng đáp án đúng.
- explanation tối đa một câu, nêu căn cứ quan trọng nhất trong ảnh.
- importance từ 1 đến 5; category là chủ đề ngắn gọn.
- Trước khi trả kết quả, kiểm tra không có hai đáp án cùng đúng, không bịa dữ kiện và không trùng câu.

Trả đúng JSON theo schema, không thêm văn bản bên ngoài JSON.`,
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
