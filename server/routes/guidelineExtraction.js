import express from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import { generateStructuredFromFile } from "../services/gemini.js";
import { consumeAiCall, getAiCallsRemaining } from "../services/aiUsage.js";

const router = express.Router();
const MAX_PDF_BYTES = 14 * 1024 * 1024;
const cache = new Map();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES },
  fileFilter: (_req, file, done) => {
    const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    done(isPdf ? null : new Error("Chỉ hỗ trợ file PDF."), isPdf);
  },
});

const textField = { type: "string" };
const schema = {
  type: "object",
  properties: {
    documentTitle: textField,
    society: textField,
    condition: textField,
    publicationYear: { type: "integer" },
    versionLabel: textField,
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: textField,
          drugName: textField,
          clinicalContext: textField,
          recommendationSummary: textField,
          dose: textField,
          renalAdjustment: textField,
          hepaticAdjustment: textField,
          contraindications: textField,
          monitoring: textField,
          recommendationClass: textField,
          evidenceLevel: textField,
          pageReference: textField,
        },
        required: [
          "topic", "drugName", "clinicalContext", "recommendationSummary", "dose",
          "renalAdjustment", "hepaticAdjustment", "contraindications", "monitoring",
          "recommendationClass", "evidenceLevel", "pageReference",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["documentTitle", "society", "condition", "publicationYear", "versionLabel", "entries"],
  additionalProperties: false,
};

router.post("/", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Chưa có file PDF." });
    const focus = String(req.body?.focus || "").trim();
    const key = createHash("sha256").update(req.file.buffer).update(focus).digest("hex");
    if (cache.has(key)) return res.json({ ...cache.get(key), aiCallsRemaining: getAiCallsRemaining() });

    const aiCallsRemaining = consumeAiCall();
    if (aiCallsRemaining === null) {
      return res.status(429).json({ success: false, message: "Đã hết lượt AI dùng chung.", aiCallsRemaining: 0 });
    }

    const result = await generateStructuredFromFile({
      file: req.file,
      schema,
      maxOutputTokens: 16000,
      timeoutMs: 180_000,
      prompt: `Bạn là bác sĩ chuyên đọc guideline. Hãy trích xuất các khuyến cáo LIÊN QUAN ĐẾN THUỐC từ chính PDF đính kèm thành dữ liệu tiếng Việt để ôn thi và tra cứu.

PHẠM VI NGƯỜI DÙNG QUAN TÂM: ${focus || "Toàn bộ khuyến cáo thuốc quan trọng trong tài liệu"}.

NGUYÊN TẮC AN TOÀN BẮT BUỘC:
- Chỉ dùng thông tin có thật trong PDF này. Tuyệt đối không dùng kiến thức bên ngoài, không suy đoán và không tự điền dữ liệu còn thiếu.
- Mỗi mục phải đại diện cho một thuốc/nhóm thuốc trong một bối cảnh lâm sàng cụ thể. Gộp các câu trùng nhau nhưng không làm mất điều kiện áp dụng.
- Giữ nguyên số liệu, đơn vị, liều, khoảng cách dùng, ngưỡng eGFR/CrCl, chống chỉ định, Class và Level of Evidence như tài liệu.
- pageReference bắt buộc ghi trang in trên tài liệu và/hoặc số bảng/hình/mục, ví dụ "Trang 42, Bảng 8". Nếu không xác định chắc chắn, ghi "Không xác định trong tài liệu"; không bịa số trang.
- Với dose, renalAdjustment, hepaticAdjustment, contraindications, monitoring, recommendationClass hoặc evidenceLevel: nếu PDF không nêu thì ghi "Không nêu trong tài liệu".
- recommendationSummary phải ngắn, chính xác, giữ rõ đối tượng, thời điểm, điều kiện và mức khuyến cáo.
- Không biến nội dung mô tả thành khuyến cáo điều trị. Không trích tài liệu tham khảo nằm cuối PDF như thể đó là khuyến cáo của guideline.
- Không tạo mục trùng lặp. Trả được bao nhiêu mục có căn cứ chắc chắn thì trả bấy nhiêu, không ép số lượng.
- Tất cả mục được xem là BẢN NHÁP chờ người dùng đối chiếu PDF, không được tự tuyên bố đã kiểm duyệt.

Trả đúng JSON theo schema, không thêm văn bản ngoài JSON.`,
    });

    const payload = { success: true, data: result, aiCallsRemaining };
    cache.set(key, payload);
    if (cache.size > 20) cache.delete(cache.keys().next().value);
    return res.json(payload);
  } catch (error) {
    console.error("Guideline extraction failed:", error);
    const isLimit = error?.code === "LIMIT_FILE_SIZE";
    const status = isLimit ? 413 : error?.status === 429 ? 429 : 500;
    const message = isLimit
      ? "PDF quá lớn để AI đọc trực tiếp. Vui lòng dùng file không quá 14 MB."
      : status === 429
        ? "Gemini đã hết hạn mức hoặc đang quá tải. Vui lòng thử lại sau."
        : error.message || "Không thể trích xuất guideline.";
    return res.status(status).json({ success: false, message, aiCallsRemaining: getAiCallsRemaining() });
  }
});

router.use((error, _req, res, _next) => {
  const isLimit = error?.code === "LIMIT_FILE_SIZE";
  return res.status(isLimit ? 413 : 400).json({
    success: false,
    message: isLimit ? "PDF quá lớn để AI đọc trực tiếp. Vui lòng dùng file không quá 14 MB." : error.message || "File PDF không hợp lệ.",
    aiCallsRemaining: getAiCallsRemaining(),
  });
});

export default router;
