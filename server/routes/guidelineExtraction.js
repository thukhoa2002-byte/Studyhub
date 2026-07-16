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
      maxOutputTokens: 65536,
      timeoutMs: 600_000,
      prompt: `Bạn là nhóm bác sĩ và biên dịch viên guideline. Nhiệm vụ là tạo BẢN DỊCH ĐẦY ĐỦ CÓ CẤU TRÚC của tất cả nội dung khuyến cáo trong PDF đính kèm, không phải bản tóm tắt và không chỉ tập trung vào thuốc.

GHI CHÚ ƯU TIÊN CỦA NGƯỜI DÙNG (chỉ để chú ý thêm, TUYỆT ĐỐI không được dùng làm bộ lọc hay bỏ qua phần khác): ${focus || "Không có; phải xử lý toàn bộ tài liệu"}.

PHẠM VI BẮT BUỘC — QUÉT TỪ ĐẦU ĐẾN CUỐI TÀI LIỆU:
1. Bắt đầu từ bảng/phần “What’s new”, “New recommendations”, “Revised recommendations” hoặc tên tương đương. Dịch TỪNG DÒNG trong các bảng này thành một entry, kể cả khi dòng đó không ghi Class/LoE.
2. Tiếp tục qua TOÀN BỘ các chương, mục, phụ lục và Supplementary Data. Lấy TỪNG DÒNG của mọi bảng có tiêu đề hoặc nội dung là Recommendation/Recommendations/Khuyến cáo.
3. Bao gồm mọi lĩnh vực: chẩn đoán, phân tầng nguy cơ, xét nghiệm, hình ảnh, theo dõi, dự phòng, thuốc, thủ thuật, can thiệp, phẫu thuật, tổ chức chăm sóc, nhóm bệnh nhân đặc biệt và những khuyến cáo không dùng thuốc.
4. Không dừng sau bảng đầu tiên, không chọn “ý quan trọng”, không giới hạn số lượng. Phải tiếp tục tới bảng khuyến cáo cuối cùng của guideline chính và supplement.
5. Trước khi tạo JSON, hãy âm thầm lập danh mục tất cả bảng/phần khuyến cáo theo thứ tự trang để kiểm tra độ phủ; không xuất danh mục đó riêng ra ngoài JSON.

QUY TẮC CHUYỂN MỖI BẢNG THÀNH ENTRIES:
- Một dòng bảng tương ứng một entry. Nếu một ô chứa nhiều khuyến cáo độc lập thì tách thành nhiều entries nhưng giữ cùng topic và pageReference.
- topic phải là ĐỀ MỤC TIẾNG VIỆT ĐẦY ĐỦ nằm phía trên bảng, theo mẫu “Chương/Mục lớn › Mục nhỏ › Bảng [số] — [dịch đầy đủ tên bảng]”. Giữ số chương, số mục, số bảng và thứ tự nguồn. Không gom hai bảng khác nhau vào một topic.
- recommendationSummary phải dịch đầy đủ toàn bộ câu/ô khuyến cáo, không rút gọn, không diễn giải thành ý khác và không bỏ điều kiện, quần thể, thời điểm, ngoại lệ hay chú thích trực tiếp gắn với khuyến cáo.
- clinicalContext chứa bản dịch đầy đủ của cột/bối cảnh/nhóm bệnh nhân nếu nó tách riêng khỏi câu khuyến cáo; nếu không có thì để chuỗi rỗng.
- recommendationClass và evidenceLevel sao chép đúng ký hiệu nguồn (I, IIa, IIb, III; A, B, C...). Không suy diễn. Nếu dòng không ghi thì để chuỗi rỗng.
- pageReference bắt buộc mở đầu bằng “Guideline chính” hoặc “Supplementary Data”, sau đó ghi trang in trên tài liệu, số bảng và mục, ví dụ “Guideline chính — Trang 19, Bảng 3, Mục 3.2”. Không bịa số trang; nếu không đọc được số trang thì vẫn phải ghi số bảng/mục nhận diện được.

THÔNG TIN THUỐC (chỉ áp dụng khi chính dòng/bảng có thuốc):
- drugName ghi đúng tên thuốc/nhóm thuốc quốc tế. Với khuyến cáo không liên quan thuốc, để chuỗi rỗng.
- dose, renalAdjustment, hepaticAdjustment, contraindications và monitoring chỉ điền khi PDF thật sự nêu trong dòng, chú thích bảng hoặc Supplementary Data liên quan. Không có thì để chuỗi rỗng để tiết kiệm đầu ra.
- Nếu supplement bổ sung dữ liệu cho đúng khuyến cáo chính, hợp nhất thông tin và ghi cả hai nguồn trong pageReference; không tạo bản sao trùng lặp.

AN TOÀN VÀ TÍNH TRUNG THÀNH:
- Tự đọc metadata: documentTitle, society, condition, publicationYear, versionLabel. sourceUrl chỉ lấy URL/DOI chính thức có in trong PDF; không có thì để rỗng.
- Chỉ dùng dữ liệu trong PDF. Không dùng kiến thức ngoài, không suy đoán, không tự tạo khuyến cáo, Class, LoE, liều hoặc nguồn.
- Giữ nguyên tên riêng, viết tắt chuyên môn, số liệu, đơn vị, ngưỡng, khoảng thời gian và mức độ mạnh/yếu của câu nguồn.
- Không lấy đoạn mô tả thuần túy, tài liệu tham khảo cuối bài hoặc lời bàn không mang tính khuyến cáo, ngoại trừ các dòng trong bảng “What’s new” bắt buộc nêu trên.
- entries phải đúng thứ tự xuất hiện từ trang đầu tới trang cuối. Tất cả là BẢN NHÁP để người dùng đối chiếu, không được tự đánh dấu đã kiểm duyệt.

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
