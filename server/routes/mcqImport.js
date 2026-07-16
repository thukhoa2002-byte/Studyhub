import express from "express";
import multer from "multer";
import { requireGuidelineAdmin } from "../middleware/guidelineAdmin.js";
import { generateStructuredFromFile } from "../services/gemini.js";
import { consumeAiCall, getAiCallsRemaining } from "../services/aiUsage.js";

const router = express.Router();
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_BYTES = 120 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 20 },
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

ĐẶC ĐIỂM TÀI LIỆU CẦN XỬ LÝ
- PDF có thể được xuất từ Notion/ứng dụng ghi chú: một số trang có lớp chữ, một số nội dung hoặc đề thi nằm trong ảnh chụp, ảnh scan hay ảnh X-quang.
- Bắt buộc quan sát trực tiếp phần hình ảnh của TỪNG TRANG, không chỉ dựa vào lớp text OCR của PDF.
- Ghi chú học tập, phần giảng bài, bảng tóm tắt, tiêu đề, mục “TRẢ LỜI”, đáp án tô màu/gạch chân và lời giải có thể nằm xen giữa các câu.

MỤC TIÊU DUY NHẤT
- Chỉ giữ nguyên nội dung câu hỏi và đúng bốn lựa chọn A, B, C, D.
- Loại bỏ hoàn toàn đáp án đúng, ký hiệu đáp án, gạch chân/tô màu gợi ý đáp án, lời giải, bình luận, chú thích đáp án, thang điểm và phần nhận xét.
- Không tự giải câu hỏi, không thêm kiến thức mới, không sửa nội dung chuyên môn.

QUY TẮC TRÍCH XUẤT
1. Chỉ nhận một khối là MCQ khi thấy chắc chắn: (a) câu hỏi hoặc tình huống lâm sàng hoàn chỉnh; và (b) đủ bốn lựa chọn được ký hiệu A, B, C, D trong nguồn. Ghi chú có bốn gạch đầu dòng vẫn KHÔNG phải MCQ nếu không có ký hiệu A/B/C/D rõ ràng.
2. Đọc theo hai lượt trong cùng một lần xử lý: lượt đầu xác định ranh giới từng câu trên tất cả trang, kể cả chữ nằm trong ảnh; lượt sau đối chiếu lại đề và đủ A/B/C/D trước khi đưa vào JSON.
3. Giữ thứ tự câu như tài liệu gốc. source_number là số câu gốc nếu đọc được; nếu không thì đánh số liên tục từ 1.
4. Mỗi câu phải có đúng bốn lựa chọn với id lần lượt A, B, C, D. Không gộp lựa chọn, không tự xuống dòng giữa một lựa chọn.
5. Chuẩn hóa khoảng trắng, bỏ đầu trang/chân trang/số trang lặp lại và khoảng trống thừa. Không để dòng trống bất thường.
6. Không chép hình trang trí, logo, biểu đồ không cần thiết hoặc ảnh chứa đáp án.
7. Nếu hình chỉ minh họa và có thể diễn đạt CHÍNH XÁC, KHÔNG SUY DIỄN bằng chữ, chuyển thông tin nhìn thấy cần thiết thành một mô tả trung tính ngắn đặt trong question. Nếu hình là dữ kiện quyết định và không thể diễn đạt chắc chắn, loại câu đó.
8. Riêng hình X-quang: nếu hình được gửi dưới dạng file ảnh riêng và thuộc câu hỏi, giữ image_source_name đúng CHÍNH XÁC tên file ảnh đó để hệ thống đặt ảnh dưới đề. Với X-quang nằm bên trong PDF, không được bịa mô tả chẩn đoán; chỉ ghi review_note rằng câu có ảnh X-quang nhúng trong PDF để người duyệt kiểm tra. Nếu không chắc ảnh thuộc câu nào, để image_source_name rỗng.
9. image_alt chỉ mô tả trung tính loại hình (ví dụ “X-quang ngực thẳng”), không diễn giải chẩn đoán hay làm lộ đáp án.
10. review_note chỉ ghi cảnh báo cần người duyệt kiểm tra (OCR khó đọc, ảnh nhúng trong PDF, nghi mất chữ). Nếu không có vấn đề, trả chuỗi rỗng.
11. Loại câu bị thiếu đề, thiếu một trong bốn lựa chọn, không đọc chắc chắn hoặc phụ thuộc hình không thể trích/diễn đạt.
12. Không biến nội dung trong khối “TRẢ LỜI”, nhận xét bên lề, ghi chú học tập hoặc đoạn giải thích thành câu hỏi mới.
13. Không trả correct_answer, answer, explanation hay bất kỳ đáp án nào. Màu nền, gạch chân hoặc ký tự nằm trong khối “TRẢ LỜI” không được xuất hiện trong dữ liệu.

TỰ KIỂM TRA TRƯỚC KHI TRẢ
- Từng câu có đúng A/B/C/D, không trùng id, không rỗng.
- Không còn đáp án hoặc giải thích.
- Không có ký tự xuống dòng vô lý trong câu hoặc lựa chọn.
- Không tạo thêm câu không tồn tại trong nguồn.

Trả đúng JSON theo schema, không thêm văn bản bên ngoài JSON.`;

function normalizeQuestions(rawQuestions) {
  const seen = new Set();
  return (Array.isArray(rawQuestions) ? rawQuestions : []).flatMap((rawQuestion, index) => {
    const question = String(rawQuestion?.question || "").replace(/\s+/g, " ").trim();
    const rawOptions = Array.isArray(rawQuestion?.options) ? rawQuestion.options : [];
    const options = ["A", "B", "C", "D"].map((id) => ({
      id,
      text: String(rawOptions.find((option) => option?.id === id)?.text || "").replace(/\s+/g, " ").trim(),
    }));
    if (!question || options.some((option) => !option.text)) return [];
    const fingerprint = `${question}\n${options.map((option) => option.text).join("\n")}`.toLocaleLowerCase("vi");
    if (seen.has(fingerprint)) return [];
    seen.add(fingerprint);
    return [{
      source_number: Number.isInteger(rawQuestion?.source_number) && rawQuestion.source_number > 0 ? rawQuestion.source_number : index + 1,
      question,
      options,
      image_source_name: String(rawQuestion?.image_source_name || "").trim(),
      image_alt: String(rawQuestion?.image_alt || "").replace(/\s+/g, " ").trim(),
      review_note: String(rawQuestion?.review_note || "").replace(/\s+/g, " ").trim(),
    }];
  });
}

function uploadFiles(req, res, next) {
  upload.array("files", 20)(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ success: false, message: "Mỗi file không được vượt quá 100 MB." });
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT") {
      return res.status(413).json({ success: false, message: "Mỗi lần chỉ được tải tối đa 20 file." });
    }
    return res.status(400).json({ success: false, message: error?.message || "Không thể nhận file tải lên." });
  });
}

router.post("/extract", requireGuidelineAdmin, uploadFiles, async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, message: "Chưa chọn file câu hỏi." });
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return res.status(413).json({ success: false, message: "Tổng dung lượng file không được vượt quá 120 MB." });
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
      timeoutMs: 300_000,
    });
    const questions = normalizeQuestions(result.questions);
    if (!questions.length) {
      return res.status(422).json({
        success: false,
        message: "Gemini chưa tìm thấy câu hỏi nào có đủ đề và bốn lựa chọn A/B/C/D. Hãy kiểm tra PDF hoặc tải riêng các trang chứa đề.",
      });
    }
    return res.json({
      success: true,
      data: {
        title: result.title || "Bộ MCQ mới",
        questions,
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
