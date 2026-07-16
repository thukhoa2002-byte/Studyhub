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
      }, required: ["question", "answer", "category", "importance", "options", "correctOption", "explanation"], additionalProperties: false } } }, required: ["title", "questions"], additionalProperties: false
    };

    const result = await generateStructuredFromImage({
      file: req.file,
      maxOutputTokens: 12000,
      schema,
      prompt: `Bạn là bác sĩ và chuyên gia biên soạn câu hỏi theo PHONG CÁCH USMLE Step 2 CK/Step 3 để ôn thi bác sĩ nội trú. Đọc kỹ toàn bộ ảnh, xác định các mục tiêu học tập có giá trị lâm sàng cao rồi tạo câu hỏi single-best-answer bằng tiếng Việt.

NGUYÊN TẮC NGUỒN:
- Chỉ dùng kiến thức có thể xác nhận từ nội dung nhìn thấy trong ảnh. Không tự thêm bệnh sử, xét nghiệm, liều thuốc, dịch tễ hoặc kết cục không có trong tài liệu.
- Nếu tài liệu không đủ dữ kiện để viết một ca lâm sàng hợp lệ, hãy dùng câu hỏi ứng dụng/diễn giải ngắn; tuyệt đối không bịa dữ kiện để ép thành ca bệnh.
- Số câu phụ thuộc số mục tiêu học tập quan trọng, không giới hạn cố định. Mỗi mục tiêu chỉ tạo một câu; không hỏi lại cùng kiến thức bằng cách đổi câu chữ.

CHỌN KIẾN THỨC:
- Ưu tiên chẩn đoán, chẩn đoán phân biệt, cơ chế bệnh sinh, diễn giải dấu hiệu/xét nghiệm, bước xử trí tiếp theo, điều trị, chỉ định/chống chỉ định, tác dụng phụ, dự phòng, tiên lượng và an toàn người bệnh.
- Ưu tiên kiến thức làm thay đổi quyết định lâm sàng; bỏ qua chi tiết trang trí, mẹo nhớ và trivia ít giá trị.

CẤU TRÚC CÂU HỎI:
- Khi nguồn đủ dữ kiện, viết tình huống bệnh nhân ngắn gọn gồm tuổi/giới nếu có, triệu chứng và thời gian, dấu hiệu then chốt, xét nghiệm liên quan; chỉ giữ dữ kiện cần để suy luận.
- Mỗi câu kiểm tra đúng một quyết định hoặc một mục tiêu học tập và yêu cầu chọn MỘT đáp án tốt nhất.
- Tránh câu hỏi phủ định như “KHÔNG/NGOẠI TRỪ”, tránh “tất cả đều đúng/không đáp án nào”, tránh gợi ý đáp án bằng độ dài hoặc từ ngữ lặp lại.
- Có đúng 4 lựa chọn đồng dạng, cùng nhóm khái niệm, độ dài tương đương, loại trừ lẫn nhau và đều có vẻ hợp lý với người học chưa nắm vững.
- Chỉ một lựa chọn đúng. correctOption phải trùng chính xác một phần tử trong options; answer phải bằng đáp án đúng.
- explanation tối đa một câu: nêu lý do đáp án đúng và dấu hiệu/cơ chế phân biệt quan trọng nhất.
- importance từ 1 đến 5, trong đó 5 là kiến thức quyết định chẩn đoán hoặc xử trí. category là chủ đề lâm sàng ngắn gọn.

TỰ KIỂM TRA TRƯỚC KHI TRẢ KẾT QUẢ:
1. Câu hỏi có thể trả lời hoàn toàn từ ảnh.
2. Chỉ có một đáp án tốt nhất và không có hai lựa chọn cùng đúng.
3. Không có dữ kiện bịa thêm hoặc mâu thuẫn với ảnh.
4. Phương án nhiễu hợp lý nhưng sai rõ khi áp dụng kiến thức nguồn.
5. Không trùng mục tiêu học tập với câu khác.

Trả đúng JSON theo schema, không thêm văn bản bên ngoài JSON.`,
    });

    const payload = { success: true, text: "", title: result.title || "Case lâm sàng", data: result.questions || [], aiCallsRemaining };
    cache.set(key, payload);
    if (cache.size > 50) cache.delete(cache.keys().next().value);
    return res.json(payload);
  } catch (error) {
    console.error(error);
    const status = error?.status === 429 ? 429 : 500;
    return res.status(status).json({ success: false, message: status === 429 ? "Gemini đã hết hạn mức hoặc đang quá tải. Vui lòng thử lại sau." : error.message });
  }
});

export default router;
