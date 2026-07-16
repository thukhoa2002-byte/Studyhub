import express from "express";
import multer from "multer";
import { requireGuidelineAdmin } from "../middleware/guidelineAdmin.js";
import { generateStructuredFromFile } from "../services/gemini.js";
import { consumeAiCall, getAiCallsRemaining } from "../services/aiUsage.js";

const router = express.Router();
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TOTAL_BYTES, files: 20 },
});

const optionSchema = {
  type: "object",
  properties: {
    id: { type: "string", enum: ["A", "B", "C", "D"] },
    text: { type: "string" },
  },
  required: ["id", "text"],
  additionalProperties: false,
};

const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source_number: { type: "integer" },
          question: { type: "string" },
          options: { type: "array", minItems: 4, maxItems: 4, items: optionSchema },
          image_source_name: { type: "string" },
          image_alt: { type: "string" },
          review_note: { type: "string" },
        },
        required: ["source_number", "question", "options", "image_source_name", "image_alt", "review_note"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "questions"],
  additionalProperties: false,
};

const prompt = `Bạn là biên tập viên ngân hàng câu hỏi y khoa. Hãy đọc TOÀN BỘ các file được cung cấp và trích câu hỏi trắc nghiệm để quản trị viên duyệt trước khi công khai.

MỤC TIÊU DUY NHẤT
- Chỉ giữ nguyên nội dung câu hỏi và đúng bốn lựa chọn A, B, C, D.
- Loại bỏ hoàn toàn đáp án đúng, ký hiệu đáp án, gạch chân/tô màu gợi ý đáp án, lời giải, bình luận, chú thích đáp án, thang điểm và phần nhận xét.
- Không tự giải câu hỏi, không thêm kiến thức mới, không sửa nội dung chuyên môn.

QUY TẮC TRÍCH XUẤT
1. Giữ thứ tự câu như tài liệu gốc. source_number là số câu gốc nếu đọc được; nếu không thì đánh số liên tục từ 1.
2. Mỗi câu phải có đúng bốn lựa chọn với id lần lượt A, B, C, D. Không gộp lựa chọn, không tự xuống dòng giữa một lựa chọn.
3. Chuẩn hóa khoảng trắng, bỏ đầu trang/chân trang/số trang lặp lại và khoảng trống thừa. Không để dòng trống bất thường.
4. Không chép hình trang trí, logo, biểu đồ không cần thiết hoặc ảnh chứa đáp án.
5. Nếu hình chỉ minh họa và có thể diễn đạt chính xác bằng chữ, chuyển thông tin cần thiết của hình thành một mô tả ngắn đặt ngay trong question.
6. Riêng hình X-quang: nếu hình được gửi dưới dạng file ảnh riêng và thuộc câu hỏi, giữ image_source_name đúng CHÍNH XÁC tên file ảnh đó để hệ thống đặt ảnh dưới đề. Nếu không chắc ảnh thuộc câu nào, để rỗng và ghi lý do ngắn trong review_note; tuyệt đối không gán đoán.
7. image_alt chỉ mô tả trung tính loại hình (ví dụ “X-quang ngực thẳng”), không diễn giải chẩn đoán hay làm lộ đáp án.
8. review_note chỉ ghi cảnh báo cần người duyệt kiểm tra (thiếu chữ, nghi mất lựa chọn, ảnh chưa gán). Nếu không có vấn đề, trả chuỗi rỗng.
9. Loại câu bị thiếu đề, thiếu một trong bốn lựa chọn, không đọc chắc chắn hoặc phụ thuộc hình không thể trích/diễn đạt.
10. Không trả correct_answer, answer, explanation hay bất kỳ đáp án nào.

TỰ KIỂM TRA TRƯỚC KHI TRẢ
- Từng câu có đúng A/B/C/D, không trùng id, không rỗng.
- Không còn đáp án hoặc giải thích.
- Không có ký tự xuống dòng vô lý trong câu hoặc lựa chọn.
- Không tạo thêm câu không tồn tại trong nguồn.

Trả đúng JSON theo schema, không thêm văn bản bên ngoài JSON.`;

router.post("/extract", requireGuidelineAdmin, upload.array("files", 20), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, message: "Chưa chọn file câu hỏi." });
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return res.status(413).json({ success: false, message: "Tổng dung lượng file không được vượt quá 40 MB." });
    }
    const supportedImages = new Set(["image/png", "image/jpeg"]);
    const unsupported = files.find((file) => !supportedImages.has(file.mimetype) && file.mimetype !== "application/pdf");
    if (unsupported) {
      return res.status(415).json({ success: false, message: `File ${unsupported.originalname} chưa được hỗ trợ. Hãy dùng PDF hoặc ảnh.` });
    }
    const aiCallsRemaining = consumeAiCall();
    if (aiCallsRemaining === null) {
      return res.status(429).json({ success: false, message: "Đã hết lượt AI dùng chung.", aiCallsRemaining: 0 });
    }
    const result = await generateStructuredFromFile({
      files,
      schema,
      prompt,
      maxOutputTokens: 32000,
      timeoutMs: 180_000,
    });
    return res.json({
      success: true,
      data: {
        title: result.title || "Bộ MCQ mới",
        questions: result.questions || [],
      },
      aiCallsRemaining,
    });
  } catch (error) {
    console.error("MCQ import failed", error);
    const status = error?.status === 429 ? 429 : 500;
    return res.status(status).json({ success: false, message: error?.message || "Không thể trích xuất bộ MCQ." });
  }
});

export default router;
