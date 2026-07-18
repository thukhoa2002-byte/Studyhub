import express from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import { generateStructuredFromImage } from "../services/gemini.js";
import { consumeAiCall, getAiCallsRemaining } from "../services/aiUsage.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const cache = new Map();

router.post("/", requireAuth, upload.single("image"), async (req, res) => {
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
      prompt: `Bạn là bác sĩ và chuyên gia biên soạn câu hỏi ôn thi Nội trú. Hãy đọc chính xác nội dung sách trong ảnh rồi tạo trắc nghiệm kiến thức bằng tiếng Việt.

QUY TRÌNH BẮT BUỘC:
1. Đọc toàn bộ chữ, bảng, sơ đồ và chú thích có thể nhìn thấy trong ảnh.
2. Xác định các ý trọng tâm có thể kiểm tra độc lập và có đáp án được chứng minh trực tiếp từ ảnh.
3. Chỉ tạo câu hỏi cho những ý đọc chắc chắn. Nếu ảnh mờ, mất chữ hoặc không đủ dữ kiện thì bỏ qua ý đó; tạo ít câu hơn thay vì đoán.
4. Tự kiểm tra từng câu và bốn lựa chọn trước khi trả kết quả.

GIỚI HẠN NGUỒN:
- Đáp án đúng và lời giải phải dựa hoàn toàn trên kiến thức nhìn thấy trong ảnh; không dùng trí nhớ bên ngoài, không tự bổ sung số liệu, liều, tiêu chuẩn hoặc khuyến cáo.
- Không suy diễn vượt quá câu chữ của sách. Không biến một mối liên quan thành quan hệ nhân quả nếu ảnh không nói như vậy.
- Không dựng bệnh án hoặc tình huống lâm sàng; chức năng đó thuộc chế độ “Tạo case lâm sàng”.
- Tự điều chỉnh số câu theo số ý quan trọng, không ép đủ số lượng. Mỗi mục tiêu kiến thức chỉ xuất hiện một lần.

CHỌN KIẾN THỨC:
- Ưu tiên định nghĩa, nguyên nhân, cơ chế, phân loại, tiêu chuẩn chẩn đoán, biểu hiện, xét nghiệm, chỉ định/chống chỉ định, thuốc-liều, biến chứng và các cặp khái niệm dễ nhầm.
- Ưu tiên thông tin được nhấn mạnh, liệt kê, so sánh hoặc thể hiện trong bảng/sơ đồ.
- Bỏ qua tiêu đề trang, số trang, chú thích trang trí và chi tiết không có giá trị kiểm tra.

VIẾT CÂU HỎI:
- Hỏi trực tiếp, rõ nghĩa, ngắn gọn và chỉ kiểm tra một ý.
- Mỗi câu có đúng 4 lựa chọn cùng loại khái niệm, cùng cấu trúc ngữ pháp và độ dài gần tương đương; chỉ có một đáp án tốt nhất.
- Không dùng câu phủ định, “ngoại trừ”, “tất cả đều đúng”, “không đáp án nào” hoặc từ ngữ làm lộ đáp án.

TẠO PHƯƠNG ÁN NHIỄU CÓ CHẤT LƯỢNG:
- Ba phương án nhiễu phải gần nghĩa và có vẻ hợp lý với người chưa nắm chắc bài, nhưng sai rõ khi đối chiếu nội dung ảnh.
- Ưu tiên lấy yếu tố gây nhiễu từ các khái niệm cùng nhóm xuất hiện trong ảnh: đổi nhầm nguyên nhân, triệu chứng, giai đoạn, tiêu chuẩn, chỉ định, con số hoặc đối tượng.
- Mỗi phương án nhiễu chỉ nên sai ở một điểm phân biệt quan trọng; không viết đáp án vô lý, hài hước, lạc chủ đề hoặc dễ loại ngay.
- Không tạo phương án nhiễu bằng kiến thức ngoài ảnh. Nếu ảnh không đủ dữ kiện để tạo ba nhiễu hợp lý, bỏ câu đó.
- Xáo trộn vị trí đáp án đúng giữa bốn lựa chọn; không để đáp án đúng luôn dài nhất hoặc luôn ở cùng vị trí.

ĐẦU RA:
- correctOption phải trùng chính xác một phần tử trong options; answer phải bằng đáp án đúng.
- explanation tối đa hai câu: nêu căn cứ quyết định trong ảnh và điểm giúp phân biệt đáp án đúng với phương án nhiễu gần nhất.
- importance từ 1 đến 5; category là chủ đề ngắn gọn.
- Trước khi trả kết quả, loại mọi câu có hai đáp án có thể đúng, thiếu căn cứ trong ảnh, phương án nhiễu tào lao hoặc trùng mục tiêu với câu khác.

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
