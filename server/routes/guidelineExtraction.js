import express from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import { generateStructuredFromFile } from "../services/gemini.js";
import { consumeAiCall, getAiCallsRemaining } from "../services/aiUsage.js";
import { requireGuidelineAdmin } from "../middleware/guidelineAdmin.js";

const router = express.Router();
const MAX_PDF_BYTES = 40 * 1024 * 1024;
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
    sourceUrl: textField,
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
  required: ["documentTitle", "society", "condition", "publicationYear", "versionLabel", "sourceUrl", "entries"],
  additionalProperties: false,
};

router.post("/", requireGuidelineAdmin, upload.fields([{ name: "document", maxCount: 1 }, { name: "supplement", maxCount: 1 }]), async (req, res) => {
  try {
    const document = req.files?.document?.[0];
    const supplement = req.files?.supplement?.[0];
    if (!document) return res.status(400).json({ success: false, message: "Chưa có file guideline chính." });
    const inputFiles = [document, supplement].filter(Boolean);
    const totalBytes = inputFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_PDF_BYTES) return res.status(413).json({ success: false, message: "Tổng dung lượng guideline và supplement không được vượt quá 40 MB." });
    const focus = String(req.body?.focus || "").trim();
    const hash = createHash("sha256").update(document.buffer);
    if (supplement) hash.update(supplement.buffer);
    const key = hash.update(focus).digest("hex");
    if (cache.has(key)) return res.json({ ...cache.get(key), aiCallsRemaining: getAiCallsRemaining() });

    const aiCallsRemaining = consumeAiCall();
    if (aiCallsRemaining === null) {
      return res.status(429).json({ success: false, message: "Đã hết lượt AI dùng chung.", aiCallsRemaining: 0 });
    }

    const result = await generateStructuredFromFile({
      files: inputFiles,
      schema,
      maxOutputTokens: 24000,
      timeoutMs: 300_000,
      prompt: `Bạn là bác sĩ chuyên đọc guideline và supplementary data. Hãy trích xuất TOÀN BỘ KHUYẾN CÁO CHÍNH THỨC từ các PDF đính kèm, dịch chính xác sang tiếng Việt và cấu trúc thành dữ liệu để ôn thi, tra cứu.

PHẠM VI NGƯỜI DÙNG QUAN TÂM: ${focus || "Toàn bộ khuyến cáo thuốc quan trọng trong tài liệu"}.

NGUYÊN TẮC AN TOÀN BẮT BUỘC:
- Tự đọc metadata ở trang bìa/đầu tài liệu: documentTitle, society, condition, publicationYear, versionLabel. sourceUrl chỉ lấy URL/DOI chính thức có in trong PDF; nếu không có thì để chuỗi rỗng, không tự đoán URL.
- Chỉ dùng thông tin có thật trong PDF này. Tuyệt đối không dùng kiến thức bên ngoài, không suy đoán và không tự điền dữ liệu còn thiếu.
- Mỗi mục phải đại diện cho một khuyến cáo độc lập. Bao gồm cả khuyến cáo dùng thuốc và khuyến cáo không dùng thuốc.
- Trả entries đúng thứ tự xuất hiện trong tài liệu, từ chương đầu đến chương cuối; không sắp xếp lại theo tên thuốc.
- topic phải giữ cấu trúc đề mục của nguồn và dịch sang tiếng Việt theo mẫu "Chương/Mục lớn › Mục nhỏ › Bảng khuyến cáo". Nếu là bảng, phải ghi đúng số và tên bảng; không gom các bảng khác nhau vào cùng một topic.
- Với khuyến cáo liên quan thuốc: drugName ghi đúng thuốc/nhóm thuốc; trích đầy đủ chỉ định, đối tượng, thời điểm, liều/cách dùng, điều chỉnh gan-thận, chống chỉ định/thận trọng và theo dõi nếu tài liệu có nêu.
- Với khuyến cáo không liên quan thuốc: drugName ghi chính xác "Không áp dụng"; không tự gán thuốc.
- Giữ nguyên số liệu, đơn vị, liều, khoảng cách dùng, ngưỡng eGFR/CrCl, chống chỉ định, Class và Level of Evidence như tài liệu.
- recommendationClass và evidenceLevel phải được lấy cho mọi khuyến cáo nếu bảng/câu nguồn có ghi. Không suy ra Class hoặc LoE từ cách diễn đạt.
- pageReference bắt buộc mở đầu bằng "Guideline chính" hoặc "Supplementary Data", sau đó ghi trang in trên tài liệu và/hoặc số bảng/hình/mục, ví dụ "Supplementary Data — Trang 42, Bảng S8". Nếu không xác định chắc chắn, ghi "Không xác định trong tài liệu"; không bịa số trang.
- Với dose, renalAdjustment, hepaticAdjustment, contraindications, monitoring, recommendationClass hoặc evidenceLevel: nếu PDF không nêu thì ghi "Không nêu trong tài liệu".
- recommendationSummary là bản dịch tiếng Việt trung thành, rõ chủ thể, hành động, đối tượng, thời điểm và điều kiện. Giữ nguyên tên thuốc quốc tế, viết tắt chuẩn và số liệu; không diễn giải làm thay đổi mức độ mạnh/yếu của câu nguồn.
- Không biến nội dung mô tả thành khuyến cáo điều trị. Không trích tài liệu tham khảo nằm cuối PDF như thể đó là khuyến cáo của guideline.
- Quét các bảng Recommendation, bảng trong phụ lục, chú thích bảng và phần văn bản liên quan thuốc trong Supplementary Data.
- Không tạo mục trùng lặp giữa guideline chính và supplement. Nếu supplement bổ sung liều, gan-thận, chống chỉ định hoặc theo dõi cho một khuyến cáo chính, hãy hợp nhất và trích cả hai nguồn trong pageReference.
- Mục tiêu là trích đủ tất cả khuyến cáo có căn cứ, không chỉ chọn ý nổi bật. Tuy nhiên, bỏ nội dung mô tả không phải khuyến cáo và không đủ căn cứ.
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
      ? "Tổng dung lượng PDF vượt quá 40 MB. Vui lòng nén file hoặc chia nhỏ tài liệu."
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
    message: isLimit ? "Tổng dung lượng PDF vượt quá 40 MB. Vui lòng nén file hoặc chia nhỏ tài liệu." : error.message || "File PDF không hợp lệ.",
    aiCallsRemaining: getAiCallsRemaining(),
  });
});

export default router;
