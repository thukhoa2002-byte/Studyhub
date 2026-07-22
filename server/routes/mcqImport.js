import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";
import { requireMcqAdmin } from "../middleware/mcqAdmin.js";
import { generateStructuredFromFile } from "../services/gemini.js";
import { consumeAiCall, getAiCallsRemaining } from "../services/aiUsage.js";

const router = express.Router();
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_BYTES = 120 * 1024 * 1024;
const INLINE_FILE_THRESHOLD_BYTES = 14 * 1024 * 1024;
const PDF_PAGES_PER_PASS = 6;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOCX_CHARS_PER_PASS = 8_000;
const DOCX_QUESTIONS_PER_PASS = 5;
const MCQ_CHUNK_CONCURRENCY = 3;
const MCQ_REQUEST_INTERVAL_MS = 3_200;
const mcqImportJobs = new Map();
const MCQ_JOB_TTL_MS = 60 * 60 * 1000;
const execFileAsync = promisify(execFile);
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
          shared_context: { type: "string" },
        },
        required: ["source_number", "question", "options", "correct_answer", "explanation", "image_source_name", "image_alt", "review_note", "has_image", "image_page", "source_page", "shared_context"],
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
- File Word (.docx) có thể dùng các mẫu “Câu 1”, “1.” hoặc đánh số tương tự; lựa chọn có thể viết thường a-d hoặc viết hoa A-D, và đáp án có thể nằm ngay sau câu dưới dạng “Đáp án: A”, “Đáp án A” hoặc một phần đáp án ở cuối tài liệu.
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
3b. Nếu tài liệu có tiêu đề như “Tình huống này dùng cho câu 56-58”, “Dữ kiện chung cho câu 1-5” hoặc một bệnh cảnh nằm trước nhiều câu, xác định đúng phạm vi câu và chép nguyên văn bệnh cảnh vào shared_context của TỪNG câu trong nhóm. Không lặp bệnh cảnh vào question.
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
      shared_context: String(rawQuestion?.shared_context || "").replace(/\s+/g, " ").trim(),
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
    current.shared_context ||= rawQuestion.shared_context || "";
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

function attachDocxImages(questions, files) {
  const imageMap = new Map();
  for (const file of files) {
    for (const image of file.embeddedImages || []) {
      imageMap.set(image.originalname, image);
    }
  }
  const markerPattern = /\[HÌNH WORD:\s*([^\]]+)\]/iu;
  for (const question of questions) {
    const sourceText = question.question + " " + question.explanation;
    const markerName = sourceText.match(markerPattern)?.[1]?.trim() || "";
    const imageName = question.image_source_name?.trim() || markerName;
    const image = imageMap.get(imageName) || imageMap.get(imageName.split("/").pop());
    const stripMarkers = (value) => value.replace(/\s*\[HÌNH WORD:\s*[^\]]+\]\s*/giu, " ").replace(/\s{2,}/g, " ").trim();
    question.question = stripMarkers(question.question);
    question.explanation = stripMarkers(question.explanation);
    if (!image) continue;
    question.has_image = true;
    question.image_source_name = image.originalname;
    question.image_url = "data:" + image.mimetype + ";base64," + image.buffer.toString("base64");
    question.image_alt = question.image_alt || "Hình minh họa trong file Word";
    question.review_note = [question.review_note, "Đã gắn ảnh nhúng trong file Word ngay dưới câu hỏi để đối chiếu."].filter(Boolean).join(" ");
  }
  return questions;
}

async function splitPdfPart(part, pagesPerPass) {
  const sourceBytes = part.file.buffer || await readFile(part.file.path);
  const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const partPageCount = source.getPageCount();
  if (partPageCount <= 1) return [];
  const totalPages = part.totalPages || part.startPage + partPageCount - 1;
  const chunks = [];
  const chunkStep = Math.max(1, pagesPerPass - 1);
  for (let pageIndex = 0; pageIndex < partPageCount; pageIndex += chunkStep) {
    const endIndex = Math.min(pageIndex + pagesPerPass, partPageCount);
    const globalStart = part.startPage + pageIndex;
    const globalEnd = part.startPage + endIndex - 1;
    const chunkPdf = await PDFDocument.create();
    const copiedPages = await chunkPdf.copyPages(source, Array.from({ length: endIndex - pageIndex }, (_, offset) => pageIndex + offset));
    copiedPages.forEach((page) => chunkPdf.addPage(page));
    const bytes = await chunkPdf.save({ useObjectStreams: true });
    chunks.push({
      file: {
        ...part.file,
        path: undefined,
        buffer: Buffer.from(bytes),
        size: bytes.length,
        originalname: `${part.file.originalname.replace(/\.pdf$/i, "")}-pages-${globalStart}-${globalEnd}.pdf`,
      },
      startPage: globalStart,
      endPage: globalEnd,
      totalPages,
    });
    if (endIndex === partPageCount) break;
  }
  return chunks;
}

async function splitLargePdf(file) {
  if (isDocxFile(file)) return splitDocxText(file);
  if (file.mimetype !== "application/pdf" || file.size <= INLINE_FILE_THRESHOLD_BYTES) return [{ file, startPage: 1, endPage: 0, totalPages: 0 }];
  return splitPdfPart({ file, startPage: 1, endPage: 0, totalPages: 0 }, PDF_PAGES_PER_PASS);
}

function isDocxFile(file) {
  return file?.sourceFormat === "docx" || file?.mimetype === DOCX_MIME || /\.docx$/i.test(file?.originalname || "");
}

function decodeXmlEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function xmlAttribute(attributes, name) {
  const escapedName = name.replace(/[.*+?^()|[\]\\]/g, "\\$&");
  return attributes.match(new RegExp("(^|\\s)" + escapedName + "=\"([^\"]*)\"", "i"))?.[2] || "";
}

function docxEntryPath(target) {
  const decodedTarget = decodeXmlEntities(target).replace(/^\/+/, "");
  if (decodedTarget.startsWith("../")) return "word/" + decodedTarget.replace(/^(\.\.\/)+/, "");
  if (decodedTarget.startsWith("word/")) return decodedTarget;
  return "word/" + decodedTarget;
}

function docxImageMimeType(filename) {
  const extension = filename.toLowerCase().split(".").pop();
  return { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" }[extension] || "application/octet-stream";
}

async function extractDocxContent(file) {
  if (!file?.path) throw new Error("Không thể đọc file Word tạm thời.");
  let documentXml;
  try {
    ({ stdout: documentXml } = await execFileAsync("unzip", ["-p", file.path, "word/document.xml"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }));
  } catch {
    throw new Error("Không thể đọc nội dung file Word. Hãy thử lưu lại file dưới dạng .docx rồi tải lên lại.");
  }
  let relationshipsXml = "";
  try {
    ({ stdout: relationshipsXml } = await execFileAsync("unzip", ["-p", file.path, "word/_rels/document.xml.rels"], { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 }));
  } catch {
    relationshipsXml = "";
  }
  const relationships = new Map();
  for (const match of String(relationshipsXml).matchAll(/<Relationship\b([^>]+?)(?:\/>|>)/g)) {
    const relationshipId = xmlAttribute(match[1], "Id");
    const target = xmlAttribute(match[1], "Target");
    if (relationshipId && target) relationships.set(relationshipId, docxEntryPath(target));
  }
  const referencedImages = new Map();
  const xml = String(documentXml)
    .replace(/<w:drawing\b[\s\S]*?<\/w:drawing>/g, (drawing) => {
      const relationshipId = drawing.match(/r:embed="([^"]+)"/)?.[1] || "";
      const entry = relationships.get(relationshipId);
      if (!entry) return "";
      const filename = entry.split("/").pop() || entry;
      referencedImages.set(entry, filename);
      return "\n<w:t>[HÌNH WORD: " + filename + "]</w:t>\n";
    })
    .replace(/<w:pict\b[\s\S]*?<\/w:pict>/g, (picture) => {
      const relationshipId = picture.match(/r:id="([^"]+)"/)?.[1] || "";
      const entry = relationships.get(relationshipId);
      if (!entry) return "";
      const filename = entry.split("/").pop() || entry;
      referencedImages.set(entry, filename);
      return "\n<w:t>[HÌNH WORD: " + filename + "]</w:t>\n";
    });
  const images = (await Promise.all([...referencedImages.entries()].map(async ([entry, filename]) => {
    try {
      const { stdout } = await execFileAsync("unzip", ["-p", file.path, entry], { encoding: "buffer", maxBuffer: 20 * 1024 * 1024 });
      const buffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
      return {
        originalname: filename,
        mimetype: docxImageMimeType(filename),
        sourceFormat: "docx-image",
        buffer,
        size: buffer.length,
        path: undefined,
      };
    } catch {
      return null;
    }
  }))).filter(Boolean);
  const text = xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n")
    .replace(/<\/w:tc>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, (_match, value) => decodeXmlEntities(value))
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) throw new Error("File Word không có phần văn bản để trích xuất.");
  return { text, images };
}

async function prepareMcqFile(file) {
  if (!isDocxFile(file)) return file;
  const { text, images } = await extractDocxContent(file);
  return {
    ...file,
    sourceFormat: "docx",
    mimetype: "text/plain",
    buffer: Buffer.from(text, "utf8"),
    path: undefined,
    size: Buffer.byteLength(text, "utf8"),
    embeddedImages: images,
  };
}

function splitDocxText(file, maxChars = DOCX_CHARS_PER_PASS, maxQuestions = DOCX_QUESTIONS_PER_PASS) {
  const text = file.buffer?.toString("utf8") || "";
  if (!text) return [{ file, startPage: 1, endPage: 0, totalPages: 0 }];
  const questionStarts = [...text.matchAll(/(?:^|\n)\s*(?:(?:câu|question)\s*)?\d+\s*[.)\-:]/giu)]
    .map((match) => match.index ?? 0)
    .filter((index, position, indexes) => position === 0 || index > indexes[position - 1]);
  if (text.length <= maxChars && questionStarts.length <= maxQuestions) return [{ file, startPage: 1, endPage: 0, totalPages: 0 }];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const firstQuestionIndex = questionStarts.findIndex((index) => index >= start);
    const questionBoundary = firstQuestionIndex >= 0 ? questionStarts[firstQuestionIndex + maxQuestions] : undefined;
    const target = Math.min(text.length, start + maxChars);
    const nextQuestion = questionStarts.find((index) => index > target);
    const end = questionBoundary || nextQuestion || target;
    const chunkText = text.slice(start, end).trim();
    if (chunkText) {
      const embeddedImages = (file.embeddedImages || []).filter((image) => chunkText.includes("[HÌNH WORD: " + image.originalname + "]"));
      chunks.push({
        file: { ...file, embeddedImages, buffer: Buffer.from(chunkText, "utf8"), size: Buffer.byteLength(chunkText, "utf8"), originalname: file.originalname.replace(/\.docx$/i, "") + "-part-" + (chunks.length + 1) + ".docx" },
        startPage: 1,
        endPage: 0,
        totalPages: 0,
      });
    }
    if (end <= start) break;
    start = end;
  }
  return chunks.length > 0 ? chunks : [{ file, startPage: 1, endPage: 0, totalPages: 0 }];
}

function isOutputLimitError(error) {
  return /MAX_TOKENS|đầu ra AI đã chạm giới hạn|tài liệu quá dài/i.test(error instanceof Error ? error.message : String(error));
}

async function generateChunkWithFallback(chunk) {
  try {
    return [await generateStructuredFromFile({
      file: chunk.file,
      files: [chunk.file, ...(chunk.file.embeddedImages || [])],
      schema,
      prompt: promptForFilePart(chunk.file, chunk.startPage, chunk.endPage, chunk.totalPages),
      maxOutputTokens: 8192,
      timeoutMs: 300_000,
    })];
  } catch (error) {
    const pageCount = chunk.endPage ? chunk.endPage - chunk.startPage + 1 : chunk.totalPages;
    if (!isOutputLimitError(error)) throw error;
    const smallerChunks = isDocxFile(chunk.file)
      ? splitDocxText(chunk.file, Math.max(4_000, Math.floor((chunk.file.buffer?.length || 0) / 2)), 3)
      : pageCount > 1
        ? await splitPdfPart(chunk, Math.max(1, Math.ceil(pageCount / 2)))
        : [];
    const sameSingleChunk = smallerChunks.length === 1 && smallerChunks[0].file.buffer?.length === chunk.file.buffer?.length;
    if (!smallerChunks.length || sameSingleChunk) throw error;
    console.warn(`MCQ chunk ${chunk.file.originalname} hit MAX_TOKENS; retrying as ${smallerChunks.length} smaller chunks.`);
    const results = [];
    for (const smallerChunk of smallerChunks) results.push(...await generateChunkWithFallback(smallerChunk));
    return results;
  }
}

function promptForFilePart(file, startPage, endPage, totalPages) {
  const isDocx = isDocxFile(file);
  const docxInstructions = isDocx ? `\n\nQUY TẮC RIÊNG CHO FILE WORD: Đây chỉ là MỘT PHẦN của file Word lớn. Phải trích xuất TẤT CẢ câu hỏi xuất hiện trong phần này, không dừng sau 10 câu và không bỏ các câu ở cuối phần. Các marker [HÌNH WORD: ten-file] trong văn bản là ảnh nhúng thật được gửi kèm cùng phần này. Ảnh nằm sau nội dung câu nào thì thuộc câu đó; đặt has_image=true, giữ chính xác tên file vào image_source_name và đặt image_alt là mô tả trung tính. Không biến marker ảnh thành câu hỏi mới, không bỏ ảnh, và phải đặt ảnh ngay dưới câu hỏi tương ứng trong cùng thẻ MCQ. Phân biệt rõ phần thân câu hỏi với phần “Đáp án”, “Đáp án đúng”, “Giải thích” hoặc bảng đáp án. Gắn đáp án gần nhất vào câu tương ứng; nếu file không có đáp án thì để correct_answer là chuỗi rỗng. Không biến dòng “Đáp án: A” thành một câu hỏi mới. Nếu câu hỏi và lựa chọn bị dính trên cùng một đoạn, tách lại theo ký hiệu a., b., c., d. hoặc A., B., C., D.` : "";
  if (!endPage) return `${prompt}${docxInstructions}`;
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

function validateMcqFiles(files) {
  if (!files.length) return { status: 400, message: "Chưa chọn file câu hỏi." };
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) return { status: 413, message: "Tổng dung lượng file không được vượt quá 120 MB." };
  const supportedImages = new Set(["image/png", "image/jpeg"]);
  const unsupported = files.find((file) => !supportedImages.has(file.mimetype) && file.mimetype !== "application/pdf" && file.mimetype !== DOCX_MIME && !/\.docx$/i.test(file.originalname || ""));
  if (unsupported) return { status: 415, message: "File " + unsupported.originalname + " chưa được hỗ trợ. Hãy dùng PDF, Word hoặc ảnh." };
  return null;
}

async function processMcqImport(files, aiCallsRemaining) {
  const preparedFiles = await Promise.all(files.map(prepareMcqFile));
  const chunks = (await Promise.all(preparedFiles.map(splitLargePdf))).flat();
  const chunkResults = Array.from({ length: chunks.length });
  let nextChunkIndex = 0;
  let nextRequestAt = 0;
  async function processNextChunk() {
    while (nextChunkIndex < chunks.length) {
      const chunkIndex = nextChunkIndex;
      nextChunkIndex += 1;
      const now = Date.now();
      const waitMs = Math.max(0, nextRequestAt - now);
      nextRequestAt = Math.max(now, nextRequestAt) + MCQ_REQUEST_INTERVAL_MS;
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      chunkResults[chunkIndex] = await generateChunkWithFallback(chunks[chunkIndex]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(MCQ_CHUNK_CONCURRENCY, chunks.length) }, () => processNextChunk()));
  const results = chunkResults.flat();
  const questions = normalizeQuestions(mergeChunkQuestions(results.flatMap((result) => result.questions || [])));
  attachDocxImages(questions, preparedFiles);
  await attachPdfPageImages(questions, files);
  if (!questions.length) {
    const error = new Error("Gemini chưa tìm thấy khối câu hỏi nào trong tài liệu. Hãy kiểm tra lại file nguồn hoặc thử chia nhỏ tài liệu.");
    error.status = 422;
    throw error;
  }
  return {
    success: true,
    data: {
      title: results.find((result) => result.title?.trim())?.title || "Bộ MCQ mới",
      questions,
    },
    aiCallsRemaining,
  };
}

function startMcqImportJob(files, ownerId, aiCallsRemaining) {
  const job = { id: randomUUID(), ownerId, status: "running", result: null, error: null };
  mcqImportJobs.set(job.id, job);
  void processMcqImport(files, aiCallsRemaining)
    .then((result) => { job.result = result; job.status = "complete"; })
    .catch((error) => {
      console.error("MCQ background import failed", error);
      job.error = { status: error?.status || 500, message: error?.message || "Không thể trích xuất bộ MCQ." };
      job.status = "error";
    })
    .finally(() => { void cleanupUploadedFiles(files); });
  setTimeout(() => mcqImportJobs.delete(job.id), MCQ_JOB_TTL_MS).unref();
  return job;
}

function findMcqImportJob(req, res) {
  const job = mcqImportJobs.get(req.params.jobId);
  if (!job || job.ownerId !== req.mcqAdmin?.id) {
    res.status(404).json({ success: false, message: "Phiên trích xuất không còn trên máy chủ. Hãy bắt đầu lại." });
    return null;
  }
  return job;
}

router.post("/jobs", requireMcqAdmin, uploadFiles, (req, res) => {
  const files = req.files || [];
  const validation = validateMcqFiles(files);
  if (validation) {
    void cleanupUploadedFiles(files);
    return res.status(validation.status).json({ success: false, message: validation.message });
  }
  const aiCallsRemaining = consumeAiCall();
  if (aiCallsRemaining === null) {
    void cleanupUploadedFiles(files);
    return res.status(429).json({ success: false, message: "Đã hết lượt AI dùng chung.", aiCallsRemaining: 0 });
  }
  const job = startMcqImportJob(files, req.mcqAdmin.id, aiCallsRemaining);
  return res.status(202).json({ success: true, jobId: job.id });
});

router.get("/jobs/:jobId", requireMcqAdmin, (req, res) => {
  const job = findMcqImportJob(req, res);
  if (!job) return;
  if (job.status === "complete") return res.json(job.result);
  if (job.status === "error") return res.status(job.error?.status || 500).json({ success: false, message: job.error?.message || "Không thể trích xuất bộ MCQ." });
  return res.json({ success: true, status: "running" });
});

router.post("/extract", requireMcqAdmin, uploadFiles, async (req, res) => {
  const files = req.files || [];
  try {
    if (!files.length) return res.status(400).json({ success: false, message: "Chưa chọn file câu hỏi." });
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return res.status(413).json({ success: false, message: "Tổng dung lượng file không được vượt quá 120 MB." });
    }
    const supportedImages = new Set(["image/png", "image/jpeg"]);
    const unsupported = files.find((file) => !supportedImages.has(file.mimetype) && file.mimetype !== "application/pdf" && file.mimetype !== DOCX_MIME && !/\.docx$/i.test(file.originalname || ""));
    if (unsupported) {
      return res.status(415).json({ success: false, message: `File ${unsupported.originalname} chưa được hỗ trợ. Hãy dùng PDF, Word hoặc ảnh.` });
    }
    const aiCallsRemaining = consumeAiCall();
    if (aiCallsRemaining === null) {
      return res.status(429).json({ success: false, message: "Đã hết lượt AI dùng chung.", aiCallsRemaining: 0 });
    }
    return res.json(await processMcqImport(files, aiCallsRemaining));
  } catch (error) {
    console.error("MCQ import failed", error);
    const status = error?.status === 429 ? 429 : 500;
    return res.status(status).json({ success: false, message: error?.message || "Không thể trích xuất bộ MCQ." });
  } finally {
    await cleanupUploadedFiles(files);
  }
});

export default router;
