import express from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { generateStructuredFromFile } from "../services/gemini.js";
import { consumeAiCall, getAiCallsRemaining } from "../services/aiUsage.js";
import { requireGuidelineAdmin } from "../middleware/guidelineAdmin.js";

const router = express.Router();
const MAX_PDF_BYTES = 40 * 1024 * 1024;
const PDF_PAGES_PER_PASS = 6;
const EXTRACTION_VERSION = "full-pages-v7-adaptive-chunking";
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
const tableCellSchema = {
  type: "object",
  properties: {
    text: textField,
    colSpan: { type: "integer" },
    rowSpan: { type: "integer" },
    backgroundColor: textField,
    textColor: textField,
    textAlign: { type: "string", enum: ["left", "center", "right"] },
    fontWeight: { type: "string", enum: ["normal", "bold"] },
  },
  required: ["text", "colSpan", "rowSpan", "backgroundColor", "textColor", "textAlign", "fontWeight"],
  additionalProperties: false,
};
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
          tableKind: { type: "string", enum: ["recommendation", "data"] },
          tableRowRole: { type: "string", enum: ["header", "section", "body"] },
          tableCells: { type: "array", items: tableCellSchema },
        },
        required: [
          "topic", "drugName", "clinicalContext", "recommendationSummary", "dose",
          "renalAdjustment", "hepaticAdjustment", "contraindications", "monitoring",
          "recommendationClass", "evidenceLevel", "pageReference",
          "tableKind", "tableRowRole", "tableCells",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["documentTitle", "society", "condition", "publicationYear", "versionLabel", "sourceUrl", "entries"],
  additionalProperties: false,
};

async function splitPdfIntoPageRanges(file, sourceLabel) {
  const sourcePdf = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
  const pageCount = sourcePdf.getPageCount();
  const chunks = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += PDF_PAGES_PER_PASS) {
    const endIndex = Math.min(pageIndex + PDF_PAGES_PER_PASS, pageCount);
    const chunkPdf = await PDFDocument.create();
    const pageIndexes = Array.from({ length: endIndex - pageIndex }, (_, offset) => pageIndex + offset);
    const copiedPages = await chunkPdf.copyPages(sourcePdf, pageIndexes);
    copiedPages.forEach((page) => chunkPdf.addPage(page));
    const bytes = await chunkPdf.save({ useObjectStreams: true });
    chunks.push({
      file: {
        ...file,
        buffer: Buffer.from(bytes),
        size: bytes.length,
        mimetype: "application/pdf",
        originalname: `${sourceLabel}-pages-${pageIndex + 1}-${endIndex}.pdf`,
      },
      sourceLabel,
      startPage: pageIndex + 1,
      endPage: endIndex,
      totalPages: pageCount,
    });
  }

  return chunks;
}

async function splitChunkInHalf(chunk) {
  const sourcePdf = await PDFDocument.load(chunk.file.buffer, { ignoreEncryption: true });
  const pageCount = sourcePdf.getPageCount();
  if (pageCount < 2) return [];
  const firstCount = Math.ceil(pageCount / 2);
  const ranges = [[0, firstCount], [firstCount, pageCount]];
  const halves = [];

  for (const [startIndex, endIndex] of ranges) {
    const halfPdf = await PDFDocument.create();
    const pageIndexes = Array.from({ length: endIndex - startIndex }, (_, offset) => startIndex + offset);
    const copiedPages = await halfPdf.copyPages(sourcePdf, pageIndexes);
    copiedPages.forEach((page) => halfPdf.addPage(page));
    const bytes = await halfPdf.save({ useObjectStreams: true });
    const startPage = chunk.startPage + startIndex;
    const endPage = chunk.startPage + endIndex - 1;
    halves.push({
      ...chunk,
      file: {
        ...chunk.file,
        buffer: Buffer.from(bytes),
        size: bytes.length,
        originalname: `${chunk.sourceLabel}-pages-${startPage}-${endPage}.pdf`,
      },
      startPage,
      endPage,
    });
  }
  return halves;
}

function reachedOutputLimit(error) {
  return /MAX_TOKENS|đầu ra AI đã chạm giới hạn/i.test(String(error?.message || ""));
}

async function extractChunkAdaptively(chunk, focus) {
  try {
    const partial = await generateStructuredFromFile({
      file: chunk.file,
      schema,
      maxOutputTokens: 32768,
      timeoutMs: 240_000,
      prompt: extractionPrompt({ ...chunk, focus }),
    });
    return [partial];
  } catch (error) {
    const halves = reachedOutputLimit(error) ? await splitChunkInHalf(chunk) : [];
    if (halves.length === 0) throw error;
    console.warn(`Guideline chunk ${chunk.startPage}-${chunk.endPage} reached the output limit; splitting it again.`);
    const partials = [];
    for (const half of halves) partials.push(...await extractChunkAdaptively(half, focus));
    return partials;
  }
}

function extractionPrompt({ sourceLabel, startPage, endPage, totalPages, focus }) {
  return `Bạn là nhóm bác sĩ và biên dịch viên guideline. Bạn đang xử lý một CỤM TRANG của tài liệu, không được tóm tắt và không được chọn lọc ý quan trọng.

NGUỒN: ${sourceLabel}.
PHẠM VI CỤM TRANG: trang PDF ${startPage}-${endPage} trên tổng số ${totalPages} trang.
GHI CHÚ CỦA NGƯỜI DÙNG (chỉ để chú ý thêm, không phải bộ lọc): ${focus || "Không có"}.

NHIỆM VỤ BẮT BUỘC:
1. Đọc tuần tự TỪNG TRANG trong cụm và tạo đầu ra cho TỪNG TRANG, không được chỉ lấy các bảng. Dịch đầy đủ tiêu đề, đề mục, đoạn văn, gạch đầu dòng, chú thích hình, chú thích cuối trang, chú thích bảng, phần What’s new, New/Revised recommendations, bảng Recommendation/Recommendations và mọi bảng dữ liệu.
2. Không bỏ phần văn xuôi vì không có cột Class/Level/LoE. Với một đoạn hoặc bullet ngoài bảng, tạo một entry tableKind="data" với một tableCell duy nhất chứa nguyên khối đã dịch, giữ các xuống dòng/bullet bằng ký tự xuống dòng. Với tiêu đề trang hoặc tiêu đề mục, tạo một entry tableRowRole="section".
3. Một khối nguồn theo đúng thứ tự đọc = một entry và phải giữ đúng thứ tự xuất hiện trong trang rồi mới sang trang tiếp theo. Không tóm tắt, không chọn lọc “ý quan trọng”, không gộp các đoạn xa nhau và không bỏ phần giải thích.
4. recommendationSummary là bản dịch tiếng Việt ĐẦY ĐỦ của nguyên văn ô Recommendations hoặc đoạn khuyến cáo; không rút gọn, không diễn giải, không bỏ điều kiện, ngoại lệ, ngưỡng, thời điểm, số liệu hay chú thích gắn trực tiếp.
5. topic phải nhận diện được trang hoặc bảng: với bảng dùng “Chương/Mục › Supplementary Table [số] — [tên bảng đã dịch]”; với văn bản ngoài bảng dùng “Trang PDF [số] — [tiêu đề mục đã dịch]”. Mọi dòng trong cùng một bảng dùng topic giống hệt nhau để giao diện dựng lại đúng một bảng.
6. Nếu trong thân bảng có hàng tiêu đề phân nhóm phủ ngang như “WHY?”, “IN WHOM AND WHEN?”, “ECG”, “Imaging”, “Antithrombotic therapy”, hãy dịch tiêu đề đó, đặt tableRowRole="section", giữ colSpan/rowSpan và màu nền của ô. Các dòng kế tiếp trong cùng phân nhóm giữ đúng thứ tự.
7. recommendationClass và evidenceLevel sao chép chính xác ký hiệu nguồn (I, IIa, IIb, III; A, B, C...). Không có thì để rỗng, tuyệt đối không suy đoán.
8. pageReference bắt buộc ghi “${sourceLabel} — Trang PDF [số trang thực tế trong toàn file], [số bảng/mục nếu đọc được]” cho MỌI entry, kể cả đoạn văn và chú thích. Số trang phải cộng theo phạm vi ${startPage}-${endPage}, không được bắt đầu lại từ 1.
9. Với bảng bị cắt ở đầu/cuối cụm trang, vẫn trích toàn bộ các dòng nhìn thấy. Giữ đúng topic/tên bảng đọc được từ trang tiếp diễn; nếu tên nằm ở trang trước và không hiện trong cụm, dùng “Bảng tiếp diễn — [mục/chương đọc được]”, không bịa tên.
10. Chỉ điền drugName, dose, renalAdjustment, hepaticAdjustment, contraindications, monitoring khi chính bảng/ghi chú trong cụm nêu rõ. Không có thì để chuỗi rỗng.
11. Chỉ dùng PDF. Không bổ sung kiến thức ngoài, không tự tạo khuyến cáo hoặc nguồn. Tài liệu tham khảo vẫn phải giữ nếu chúng xuất hiện trên trang; chỉ không biến chúng thành khuyến cáo.

QUY TẮC GIỮ NGUYÊN CẤU TRÚC BẢNG:
- Với bảng Recommendation chuẩn có cột Recommendations/Class/Level, đặt tableKind="recommendation", tableRowRole="body", tableCells=[] và điền các trường khuyến cáo như trên.
- Với mọi bảng dữ liệu khác (đặc biệt Supplementary Table, bảng liều thuốc, cách dùng thuốc, theo dõi và tương tác), đặt tableKind="data". MỖI HÀNG VẬT LÝ của bảng gốc, kể cả hàng tiêu đề nhiều tầng và hàng phân nhóm phủ ngang, phải là một entry riêng theo đúng thứ tự xuất hiện.
- topic của tất cả hàng trong cùng bảng phải giống hệt nhau và là tên bảng/tựa đề đã dịch sang tiếng Việt. Không gộp hai bảng khác nhau vào một topic.
- tableRowRole="header" cho hàng tiêu đề cột, "section" cho hàng phân nhóm phủ ngang, "body" cho hàng dữ liệu.
- tableCells chứa từng ô từ trái sang phải. text là nội dung ô đã dịch sang tiếng Việt; colSpan và rowSpan giữ đúng số cột/hàng mà ô chiếm trong bảng gốc (không gộp thì đều là 1). Không thêm, bớt, đổi thứ tự cột/hàng hoặc chuyển một ô sang cột khác.
- Giữ định dạng nhìn thấy của từng ô: backgroundColor và textColor là mã HEX (ví dụ #55C58F; không xác định thì để rỗng), textAlign là left/center/right, fontWeight là normal/bold. Không tự trang trí hoặc đổi màu so với nguồn.
- Với tableKind="data", recommendationSummary và các trường Class/LoE có thể để rỗng. Tuyệt đối không ép bảng liều thuốc thành bảng Khuyến cáo/Nhóm/Mức độ chứng cứ.
- Với đoạn văn/bullet ngoài bảng, tableKind="data", tableRowRole="body", tableCells chỉ có một ô; không đưa nguyên đoạn đó vào recommendationSummary nếu nó không phải khuyến cáo.
- Giữ nguyên tuyệt đối tên thuốc generic, số, dấu thập phân, khoảng liều, đơn vị, đường dùng viết tắt, tần suất và ký hiệu toán học; chỉ dịch tựa đề, tiêu đề cột, nhãn hàng và phần chữ mô tả.

YÊU CẦU NGÔN NGỮ — BẮT BUỘC KIỂM TRA TRƯỚC KHI TRẢ:
- Dịch SANG TIẾNG VIỆT TOÀN BỘ tên chương/mục trong topic, tên bảng, hàng tiêu đề phân nhóm trong clinicalContext, recommendationSummary, dose, renalAdjustment, hepaticAdjustment, contraindications và monitoring.
- Không được chép nguyên một câu, một mệnh đề hoặc một tiêu đề tiếng Anh vào các trường trên. Nếu phát hiện còn câu tiếng Anh, phải dịch lại trước khi trả JSON.
- Chỉ giữ nguyên: tên thuốc generic, tên riêng, tên thang điểm/công cụ, ký hiệu khoa học, đơn vị đo và các viết tắt y khoa quốc tế như ACS, ECG, STEMI, NSTEMI, CCTA, hs-cTn. Khi một viết tắt xuất hiện lần đầu trong một bảng và nguồn có đủ nghĩa, viết tiếng Việt trước rồi giữ viết tắt trong ngoặc.
- Dùng cách diễn đạt chuẩn guideline: “is recommended” = “được khuyến cáo”; “should be considered” = “nên được cân nhắc”; “may be considered” = “có thể cân nhắc”; “is not recommended” = “không được khuyến cáo”. Không làm thay đổi mức độ mạnh/yếu của câu nguồn.
- documentTitle có thể giữ tên chính thức của guideline; society, tên hiệp hội, tên thuốc và pageReference có thể giữ tên riêng/nguồn chính thức. Ngoài các ngoại lệ này, đầu ra phải là tiếng Việt tự nhiên, chính xác và đầy đủ.
- Tự rà soát từng entry: topic tiếng Việt; clinicalContext tiếng Việt nếu có; recommendationSummary không còn câu tiếng Anh; các trường thông tin thuốc bằng tiếng Việt nếu có. Chỉ sau khi đạt đủ mới trả JSON.
- Tự rà soát độ phủ: mỗi trang trong phạm vi ${startPage}-${endPage} phải có ít nhất một entry nếu trang có chữ/hình/chú thích; không được kết thúc cụm chỉ vì đã gặp một bảng.

METADATA: documentTitle, society, condition, publicationYear, versionLabel và sourceUrl lấy từ tài liệu nếu nhìn thấy; nếu cụm này không chứa metadata thì dùng chuỗi rỗng và publicationYear = 0. entries chỉ được rỗng nếu toàn bộ cụm không có chữ, hình hay chú thích đọc được.

Trả đúng JSON theo schema, không thêm văn bản ngoài JSON.`;
}

function mergeExtractionResults(results) {
  const metadata = results.find((result) => result.documentTitle || result.society || result.publicationYear > 0) || results[0];
  const seen = new Set();
  const entries = [];
  for (const result of results) {
    for (const entry of result.entries || []) {
      const cells = Array.isArray(entry.tableCells) ? entry.tableCells : [];
      const key = [entry.topic, entry.tableKind, entry.tableRowRole, entry.recommendationSummary, JSON.stringify(cells), entry.recommendationClass, entry.evidenceLevel, entry.pageReference]
        .map((value) => String(value || "").trim().toLowerCase())
        .join("|");
      const hasRecommendation = Boolean(entry.recommendationSummary?.trim());
      const hasTableRow = entry.tableKind === "data" && cells.some((cell) => cell?.text?.trim());
      if ((!hasRecommendation && !hasTableRow) || seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
  }
  return {
    documentTitle: metadata?.documentTitle || "",
    society: metadata?.society || "",
    condition: metadata?.condition || "",
    publicationYear: Number(metadata?.publicationYear) || new Date().getFullYear(),
    versionLabel: metadata?.versionLabel || "",
    sourceUrl: metadata?.sourceUrl || "",
    entries,
  };
}

async function runGuidelineExtraction(document, supplement, focus, onChunk) {
  const inputFiles = [document, supplement].filter(Boolean);
  const totalBytes = inputFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_PDF_BYTES) {
    const error = new Error("Tổng dung lượng guideline và supplement không được vượt quá 40 MB.");
    error.code = "LIMIT_FILE_SIZE";
    throw error;
  }
  const hash = createHash("sha256").update(document.buffer);
  if (supplement) hash.update(supplement.buffer);
  const key = hash.update(`${EXTRACTION_VERSION}:${focus}`).digest("hex");
  if (cache.has(key)) {
    const cached = { ...cache.get(key), aiCallsRemaining: getAiCallsRemaining() };
    await onChunk?.({ completedChunks: 1, totalChunks: 1, sourceLabel: "Kết quả đã lưu tạm", startPage: 1, endPage: 1, entries: cached.data.entries });
    return cached;
  }

  const aiCallsRemaining = consumeAiCall();
  if (aiCallsRemaining === null) {
    const error = new Error("Đã hết lượt AI dùng chung.");
    error.status = 429;
    throw error;
  }

  const chunkGroups = await Promise.all([
    splitPdfIntoPageRanges(document, "Guideline chính"),
    supplement ? splitPdfIntoPageRanges(supplement, "Supplementary Data") : Promise.resolve([]),
  ]);
  const chunks = chunkGroups.flat();
  const partialResults = [];
  for (const [index, chunk] of chunks.entries()) {
    const extractedParts = await extractChunkAdaptively(chunk, focus);
    partialResults.push(...extractedParts);
    await onChunk?.({
      completedChunks: index + 1,
      totalChunks: chunks.length,
      sourceLabel: chunk.sourceLabel,
      startPage: chunk.startPage,
      endPage: chunk.endPage,
      entries: extractedParts.flatMap((part) => part.entries || []),
    });
  }
  const result = mergeExtractionResults(partialResults);
  const payload = { success: true, data: result, aiCallsRemaining };
  cache.set(key, payload);
  if (cache.size > 20) cache.delete(cache.keys().next().value);
  return payload;
}

function extractionErrorPayload(error) {
  const isLimit = error?.code === "LIMIT_FILE_SIZE";
  const status = isLimit ? 413 : error?.status === 429 ? 429 : 500;
  const message = isLimit
    ? "Tổng dung lượng PDF vượt quá 40 MB. Vui lòng nén file hoặc chia nhỏ tài liệu."
    : status === 429
      ? "Gemini đã hết hạn mức hoặc đang quá tải. Vui lòng thử lại sau."
      : error?.message || "Không thể trích xuất guideline.";
  return { status, message, aiCallsRemaining: getAiCallsRemaining() };
}

function writeStreamEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function extractGuidelineJson(req, res) {
  try {
    const document = req.files?.document?.[0];
    const supplement = req.files?.supplement?.[0];
    if (!document) return res.status(400).json({ success: false, message: "Chưa có file guideline chính." });
    const focus = String(req.body?.focus || "").trim();
    return res.json(await runGuidelineExtraction(document, supplement, focus));
  } catch (error) {
    console.error("Guideline extraction failed:", error);
    const payload = extractionErrorPayload(error);
    return res.status(payload.status).json({ success: false, message: payload.message, aiCallsRemaining: payload.aiCallsRemaining });
  }
}

async function extractGuidelineStream(req, res) {
  res.status(200);
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  try {
    const document = req.files?.document?.[0];
    const supplement = req.files?.supplement?.[0];
    if (!document) throw new Error("Chưa có file guideline chính.");
    const focus = String(req.body?.focus || "").trim();
    const payload = await runGuidelineExtraction(document, supplement, focus, async (progress) => writeStreamEvent(res, "progress", progress));
    writeStreamEvent(res, "complete", payload);
  } catch (error) {
    console.error("Guideline stream extraction failed:", error);
    writeStreamEvent(res, "error", extractionErrorPayload(error));
  } finally {
    res.end();
  }
}

router.post("/", requireGuidelineAdmin, upload.fields([{ name: "document", maxCount: 1 }, { name: "supplement", maxCount: 1 }]), extractGuidelineJson);
router.post("/stream", requireGuidelineAdmin, upload.fields([{ name: "document", maxCount: 1 }, { name: "supplement", maxCount: 1 }]), extractGuidelineStream);

router.use((error, _req, res, _next) => {
  const isLimit = error?.code === "LIMIT_FILE_SIZE";
  return res.status(isLimit ? 413 : 400).json({
    success: false,
    message: isLimit ? "Tổng dung lượng PDF vượt quá 40 MB. Vui lòng nén file hoặc chia nhỏ tài liệu." : error.message || "File PDF không hợp lệ.",
    aiCallsRemaining: getAiCallsRemaining(),
  });
});

export default router;
