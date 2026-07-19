import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import os from "node:os";
import { PDFDocument } from "pdf-lib";
import { requireMcqAdmin } from "../middleware/mcqAdmin.js";
import { generateStructuredFromFile } from "../services/gemini.js";
import { consumeAiCall, getAiCallsRemaining } from "../services/aiUsage.js";

const router = express.Router();
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_BYTES = 120 * 1024 * 1024;
const INLINE_FILE_THRESHOLD_BYTES = 14 * 1024 * 1024;
const PDF_PAGES_PER_PASS = 6;
const upload = multer({
  // Large PDFs must not occupy the Render process heap while Gemini is reading them.
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, os.tmpdir()),
    filename: (_req, _file, callback) => callback(null, `mcq-${randomUUID()}.upload`),
  }),
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
          options: { type: "array", items: optionSchema },
          correct_answer: { type: "string" },
          explanation: { type: "string" },
          image_source_name: { type: "string" },
          image_alt: { type: "string" },
          review_note: { type: "string" },
          has_image: { type: "boolean" },
          image_page: { type: "integer" },
          source_page: { type: "integer" },
        },
        required: ["source_number", "question", "options", "correct_answer", "explanation", "image_source_name", "image_alt", "review_note", "has_image", "image_page", "source_page"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "questions"],
  additionalProperties: false,
};

const prompt = `Bạn là biên tập viên ngân hàng câu hỏi y khoa. Hãy đọc TOÀN BỘ các file được cung cấp và chuyển toàn bộ đề trắc nghiệm thành dữ liệu học tập có thể đưa vào Front/Back.

ĐẶC ĐIỂM TÀI LIỆU CẦN XỬ LÝ
- PDF có thể được xuất từ Notion/ứng dụng ghi chú: một số trang có lớp chữ, một số nội dung hoặc đề thi nằm trong ảnh chụp, ảnh scan hay ảnh X-quang.
- Bắt buộc quan sát trực tiếp phần hình ảnh của TỪNG TRANG, không chỉ dựa vào lớp text OCR của PDF.
- Ghi chú học tập, phần giảng bài, bảng tóm tắt, tiêu đề, mục “TRẢ LỜI”, đáp án tô màu/gạch chân và lời giải có thể nằm xen giữa các câu.

MỤC TIÊU DUY NHẤT
- Giữ nguyên và đầy đủ mọi câu hỏi trắc nghiệm có trong tài liệu, theo đúng thứ tự xuất hiện.
- Tách riêng từng thành phần vào đúng trường: đề vào question, lựa chọn vào options, đáp án vào correct_answer, lời giải/ghi chú liên quan vào explanation.
- Không bỏ qua các trang hoặc các đoạn có nhãn “ĐÁP ÁN”, “TRẢ LỜI”, “GIẢI THÍCH”, “GHI CHÚ”, “NHẬN XÉT”, “ĐÁP ÁN THAM KHẢO”, bảng đáp án hoặc chú thích dưới câu.
- Không tự tạo câu hỏi mới. Không sửa nội dung chuyên môn, ngoại trừ chuẩn hóa khoảng trắng và nối các dòng bị ngắt do bố cục PDF.

QUY TẮC TRÍCH XUẤT
1. Đọc theo hai lượt trong cùng một lần xử lý: lượt đầu xác định ranh giới từng câu trên tất cả trang, kể cả chữ nằm trong ảnh; lượt sau đối chiếu lại đề, lựa chọn, bảng đáp án và lời giải.
2. Một MCQ hợp lệ cần đề hoàn chỉnh và đủ bốn lựa chọn được ký hiệu A, B, C, D. Ghi chú có bốn gạch đầu dòng nhưng không có cấu trúc câu hỏi thì không được biến thành MCQ.
3. Đánh số lại source_number từ 1, 2, 3... theo thứ tự các câu được trích xuất trong tài liệu. Không giữ số trang làm số câu và không sắp xếp lại theo chủ đề.
3a. source_page phải là số trang PDF GỐC nơi bắt đầu câu hỏi. Nếu câu kéo dài nhiều trang, dùng trang bắt đầu. Không được để trống trường này.
4. Mỗi bản ghi luôn phải có bốn ô lựa chọn với id lần lượt A, B, C, D. Nếu nguồn khó đọc hoặc Gemini chưa nhận ra một lựa chọn, giữ đúng ô đó với chuỗi rỗng và ghi cảnh báo; không được xóa cả câu.
5. Tìm đáp án ở cả ngay sau câu, cuối trang, cuối chương, bảng đáp án và phần “TRẢ LỜI”. Nếu nguồn ghi bằng chữ thay vì A/B/C/D, đối chiếu với options rồi đổi thành đúng một id A, B, C hoặc D. Nếu không tìm thấy đáp án chắc chắn, để correct_answer là chuỗi rỗng, tuyệt đối không đoán.
6. explanation phải chứa đầy đủ lời giải, lý do chọn đáp án, ghi chú học tập và thông tin phân biệt liên quan đến câu đó. Giữ số liệu, đơn vị, tiêu chuẩn, ngoại lệ và thứ tự ý; không rút gọn thành một câu nếu làm mất nội dung. Nếu nguồn không có lời giải, để chuỗi rỗng.
7. Chuẩn hóa khoảng trắng, bỏ đầu trang/chân trang/số trang lặp lại và khoảng trống thừa. Không để dòng trống bất thường.
8. Không chép hình trang trí, logo, biểu đồ không cần thiết hoặc ảnh chứa đáp án.
9. Mỗi câu phải có has_image=true nếu câu hoặc phần giải thích có hình, sơ đồ, bảng hình, X-quang, ECG hoặc ảnh scan minh họa; image_page là số trang PDF GỐC chứa hình đó, hoặc 0 nếu không có hình. Nếu hình chỉ minh họa và có thể diễn đạt CHÍNH XÁC, KHÔNG SUY DIỄN bằng chữ, chuyển thông tin nhìn thấy cần thiết thành một mô tả trung tính ngắn đặt trong question. Nếu hình là dữ kiện quyết định và không thể diễn đạt chắc chắn, vẫn giữ nguyên câu, ghi vị trí hình trong question và ghi cảnh báo trong review_note để hệ thống gắn ảnh trang PDF, không tự loại câu.
10. Riêng hình X-quang: nếu hình được gửi dưới dạng file ảnh riêng và thuộc câu hỏi, giữ image_source_name đúng CHÍNH XÁC tên file ảnh đó để hệ thống đặt ảnh dưới đề. Với X-quang nằm bên trong PDF, không bịa mô tả chẩn đoán; chèn đúng vị trí dữ kiện trong question chuỗi “[HÌNH X-QUANG CỦA CÂU NÀY — CẦN GẮN ẢNH]”, đặt image_alt là mô tả trung tính như “X-quang ngực thẳng”, và ghi review_note rằng ảnh nằm trong PDF để người duyệt gắn ảnh đúng câu. Nếu không chắc ảnh thuộc câu nào, vẫn giữ câu và để image_source_name rỗng.
11. image_alt chỉ mô tả trung tính loại hình, không diễn giải chẩn đoán hay làm lộ đáp án.
12. review_note chỉ ghi cảnh báo cần người duyệt kiểm tra như OCR khó đọc, ảnh nhúng trong PDF hoặc nghi mất chữ. Nếu không có vấn đề, trả chuỗi rỗng.
13. Không biến nội dung trong khối “TRẢ LỜI”, nhận xét bên lề, ghi chú học tập hoặc đoạn giải thích thành câu hỏi mới; phải gắn chúng vào câu ngay trước đó khi có thể xác định được.
14. Tuyệt đối không loại một câu chỉ vì thiếu một lựa chọn, thiếu đáp án, OCR khó đọc hoặc câu kéo dài qua trang sau. Vẫn trả về bản ghi đó với các lựa chọn A-D còn thiếu để chuỗi rỗng và ghi rõ phần thiếu trong review_note. Người dùng sẽ sửa trong xưởng MCQ.

TỰ KIỂM TRA TRƯỚC KHI TRẢ
- Từng câu có đủ các ô A/B/C/D, không trùng id; ô chưa đọc được được để chuỗi rỗng và ghi trong review_note.
- correct_answer là A/B/C/D hoặc chuỗi rỗng, và không bị đặt nhầm vào question/options.
- explanation đã chứa phần giải thích/ghi chú tương ứng, không làm mất số liệu hoặc ngoại lệ.
- Không có ký tự xuống dòng vô lý trong câu hoặc lựa chọn.
- source_number liên tục từ 1 đến hết danh sách.
- Không tạo thêm câu không tồn tại trong nguồn và không loại các câu hợp lệ chỉ vì chưa tìm thấy đáp án.

Trả đúng JSON theo schema, không thêm văn bản bên ngoài JSON.`;

function normalizeQuestions(rawQuestions) {
  let nextSourceNumber = 0;
  return (Array.isArray(rawQuestions) ? rawQuestions : []).flatMap((rawQuestion) => {
    const question = String(rawQuestion?.question || "").replace(/\s+/g, " ").trim();
    const rawOptions = Array.isArray(rawQuestion?.options) ? rawQuestion.options : [];
    const options = ["A", "B", "C", "D"].map((id) => ({
      id,
      text: String(rawOptions.find((option) => option?.id === id)?.text || "").replace(/\s+/g, " ").trim(),
    }));
    const answerValue = String(rawQuestion?.correct_answer || "").trim().toUpperCase();
    const answerByText = options.find((option) => option.text.toLocaleLowerCase("vi") === answerValue.toLocaleLowerCase("vi"));
    const correctAnswer = ["A", "B", "C", "D"].includes(answerValue) ? answerValue : answerByText?.id || "";
    const explanation = String(rawQuestion?.explanation || "").replace(/\s+/g, " ").trim();
    const missing = options.filter((option) => !option.text).map((option) => option.id);
    const originalNote = String(rawQuestion?.review_note || "").replace(/\s+/g, " ").trim();
    const reviewNote = [originalNote, missing.length ? `Thiếu lựa chọn ${missing.join(", ")} trong dữ liệu AI; cần kiểm tra lại trang nguồn.` : "", correctAnswer ? "" : "Chưa tìm thấy đáp án chắc chắn trong tài liệu."]
      .filter(Boolean)
      .join(" ");
    const hasContent = question || options.some((option) => option.text) || correctAnswer || explanation || originalNote;
    if (!hasContent) return [];
    nextSourceNumber += 1;
    return [{
      source_number: nextSourceNumber,
      question,
      options,
      correct_answer: correctAnswer,
      explanation,
      image_source_name: String(rawQuestion?.image_source_name || "").trim(),
      image_alt: String(rawQuestion?.image_alt || "").replace(/\s+/g, " ").trim(),
      review_note: reviewNote,
      has_image: rawQuestion?.has_image === true,
      image_page: Number(rawQuestion?.image_page) > 0 ? Number(rawQuestion.image_page) : 0,
      source_page: Number(rawQuestion?.source_page) > 0 ? Number(rawQuestion.source_page) : 0,
    }];
  });
}

function mergeChunkQuestions(rawQuestions) {
  const merged = new Map();
  for (const [rawIndex, rawQuestion] of (Array.isArray(rawQuestions) ? rawQuestions : []).entries()) {
    const questionText = String(rawQuestion?.question || "").replace(/\s+/g, " ").trim();
    const sourcePage = Number(rawQuestion?.source_page) || 0;
    const key = `${sourcePage}|${questionText.toLocaleLowerCase("vi")}`;
    if (!questionText || !sourcePage) {
      merged.set(`unlocated|${sourcePage}|${rawIndex}`, { ...rawQuestion });
      continue;
    }
    if (!merged.has(key)) {
      merged.set(key, { ...rawQuestion });
      continue;
    }
    const current = merged.get(key);
    current.options = ["A", "B", "C", "D"].map((id) => {
      const currentOption = current.options?.find((option) => option?.id === id);
      const nextOption = rawQuestion.options?.find((option) => option?.id === id);
      return { id, text: String(nextOption?.text || currentOption?.text || "").trim() };
    });
    if (!current.correct_answer && rawQuestion.correct_answer) current.correct_answer = rawQuestion.correct_answer;
    const currentExplanation = String(current.explanation || "").trim();
    const nextExplanation = String(rawQuestion.explanation || "").trim();
    if (nextExplanation && !currentExplanation.includes(nextExplanation)) current.explanation = [currentExplanation, nextExplanation].filter(Boolean).join(" ");
    current.review_note = [current.review_note, rawQuestion.review_note].filter((note, index, notes) => Boolean(note) && notes.indexOf(note) === index).join(" ");
    current.has_image = current.has_image || rawQuestion.has_image === true;
    current.image_page = Number(current.image_page) || Number(rawQuestion.image_page) || 0;
    current.image_source_name ||= rawQuestion.image_source_name || "";
    current.image_alt ||= rawQuestion.image_alt || "";
  }
  return [...merged.values()];
}

function questionNeedsPageImage(question) {
  return question.has_image || /\[HÌNH|x[- ]?quang|hình ảnh|hình minh họa|sơ đồ|biểu đồ|ảnh/i.test(`${question.question} ${question.explanation} ${question.review_note}`);
}

async function renderPdfPage(file, pageNumber) {
  if (!file?.path || file.mimetype !== "application/pdf" || !Number.isInteger(pageNumber) || pageNumber < 1) return null;
  const [{ getDocument }, { createCanvas }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("@napi-rs/canvas"),
  ]);
  const pdf = await getDocument({ data: new Uint8Array(await readFile(file.path)), disableWorker: true, useSystemFonts: true }).promise;
  if (pageNumber > pdf.numPages) return null;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.35 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`;
}

async function attachPdfPageImages(questions, files) {
  const pdfFiles = files.filter((file) => file.mimetype === "application/pdf");
  if (!pdfFiles.length) return questions;
  const pageCache = new Map();
  for (const question of questions) {
    if (!questionNeedsPageImage(question) || !(question.image_page || question.source_page)) continue;
    const file = pdfFiles[0];
    const pageNumber = question.image_page || question.source_page;
    const cacheKey = `${file.path}:${pageNumber}`;
    try {
      if (!pageCache.has(cacheKey)) pageCache.set(cacheKey, await renderPdfPage(file, pageNumber));
      const imageUrl = pageCache.get(cacheKey);
      if (imageUrl) {
        question.image_url = imageUrl;
        question.image_alt = question.image_alt || `Trang ${pageNumber} của tài liệu nguồn`;
        question.review_note = [question.review_note, "Đã gắn ảnh trang PDF nguồn để đối chiếu."].filter(Boolean).join(" ");
      }
    } catch (error) {
      question.review_note = [question.review_note, `Không render được ảnh trang ${pageNumber}: ${error instanceof Error ? error.message : "lỗi không xác định"}.`].filter(Boolean).join(" ");
    }
  }
  return questions;
}

async function splitLargePdf(file) {
  if (file.mimetype !== "application/pdf" || file.size <= INLINE_FILE_THRESHOLD_BYTES) return [{ file, startPage: 1, endPage: 0, totalPages: 0 }];
  const source = await PDFDocument.load(await readFile(file.path), { ignoreEncryption: true });
  const totalPages = source.getPageCount();
  const chunks = [];
  const chunkStep = Math.max(1, PDF_PAGES_PER_PASS - 1);
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += chunkStep) {
    const endIndex = Math.min(pageIndex + PDF_PAGES_PER_PASS, totalPages);
    const chunkPdf = await PDFDocument.create();
    const copiedPages = await chunkPdf.copyPages(source, Array.from({ length: endIndex - pageIndex }, (_, offset) => pageIndex + offset));
    copiedPages.forEach((page) => chunkPdf.addPage(page));
    const bytes = await chunkPdf.save({ useObjectStreams: true });
    chunks.push({
      file: {
        ...file,
        buffer: Buffer.from(bytes),
        size: bytes.length,
        originalname: `${file.originalname.replace(/\.pdf$/i, "")}-pages-${pageIndex + 1}-${endIndex}.pdf`,
      },
      startPage: pageIndex + 1,
      endPage: endIndex,
      totalPages,
    });
    if (endIndex === totalPages) break;
  }
  return chunks;
}

function promptForFilePart(file, startPage, endPage, totalPages) {
  if (!endPage) return prompt;
  return `${prompt}\n\nPHẠM VI XỬ LÝ HIỆN TẠI: Đây là trang PDF ${startPage}-${endPage} trên tổng ${totalPages} trang của file ${file.originalname}. Chỉ trích các câu hỏi nhìn thấy trong cụm này. Giữ nguyên thứ tự trong cụm; đáp án hoặc lời giải không xuất hiện trong cụm thì để trống, không đoán.`;
}

function uploadFiles(req, res, next) {
  upload.array("files", 20)(req, res, (error) => {
    if (!error) return next();
    void cleanupUploadedFiles(req.files);
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ success: false, message: "Mỗi file không được vượt quá 100 MB." });
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT") {
      return res.status(413).json({ success: false, message: "Mỗi lần chỉ được tải tối đa 20 file." });
    }
    return res.status(400).json({ success: false, message: error?.message || "Không thể nhận file tải lên." });
  });
}

async function cleanupUploadedFiles(files) {
  await Promise.allSettled((files || []).filter((file) => file.path).map((file) => unlink(file.path)));
}

router.post("/extract", requireMcqAdmin, uploadFiles, async (req, res) => {
  const files = req.files || [];
  try {
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
    const chunks = (await Promise.all(files.map(splitLargePdf))).flat();
    const results = [];
    for (const chunk of chunks) {
      results.push(await generateStructuredFromFile({
        file: chunk.file,
        schema,
        prompt: promptForFilePart(chunk.file, chunk.startPage, chunk.endPage, chunk.totalPages),
        maxOutputTokens: 8192,
        timeoutMs: 300_000,
      }));
    }
    const questions = normalizeQuestions(mergeChunkQuestions(results.flatMap((result) => result.questions || [])));
    await attachPdfPageImages(questions, files);
    if (!questions.length) {
      return res.status(422).json({
        success: false,
        message: "Gemini chưa tìm thấy khối câu hỏi nào trong PDF. Hãy kiểm tra lại file nguồn hoặc thử chia theo chương.",
      });
    }
    return res.json({
      success: true,
      data: {
        title: results.find((result) => result.title?.trim())?.title || "Bộ MCQ mới",
        questions,
      },
      aiCallsRemaining,
    });
  } catch (error) {
    console.error("MCQ import failed", error);
    const status = error?.status === 429 ? 429 : 500;
    return res.status(status).json({ success: false, message: error?.message || "Không thể trích xuất bộ MCQ." });
  } finally {
    await cleanupUploadedFiles(files);
  }
});

export default router;
