import express from "express";
import multer from "multer";
import { PDFDocument } from "pdf-lib";
import { generateStructuredFromFile } from "../services/gemini.js";
import { requireGuidelineAdmin } from "../middleware/guidelineAdmin.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const text = { type: "string" };
const schema = {
  type: "object",
  properties: {
    title: text,
    author: text,
    publicationYear: { type: "integer" },
    pages: { type: "array", items: { type: "object", properties: { pageNumber: { type: "integer" }, width: { type: "number" }, height: { type: "number" }, blocks: { type: "array", items: { type: "object", properties: { text, x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" }, fontSize: { type: "number" }, fontWeight: { type: "string", enum: ["normal", "bold"] }, italic: { type: "boolean" }, role: { type: "string", enum: ["text", "heading", "table", "caption"] } }, required: ["text", "x", "y", "width", "height", "fontSize", "fontWeight", "italic", "role"], additionalProperties: false } } }, required: ["pageNumber", "width", "height", "blocks"], additionalProperties: false } },
  },
  required: ["title", "author", "publicationYear", "pages"],
  additionalProperties: false,
};
const pageSchema = {
  type: "object",
  properties: {
    title: text,
    author: text,
    publicationYear: { type: "integer" },
    pages: schema.properties.pages,
  },
  required: ["pages"],
  additionalProperties: false,
};
const fallbackTextSchema = {
  type: "object",
  properties: {
    title: text,
    author: text,
    publicationYear: { type: "integer" },
    pageText: text,
  },
  required: ["pageText"],
  additionalProperties: false,
};

const prompt = `Bạn là hệ thống OCR và phân tích bố cục PDF. Đọc toàn bộ file PDF scan được gửi kèm và trả JSON đúng schema.
Mục tiêu là tái tạo một PDF có chữ thật nhưng giữ bố cục nhìn thấy của bản scan.
- Tự nhận diện tên sách, tác giả và năm xuất bản từ bìa/trang thông tin; nếu không chắc chắn thì trả chuỗi rỗng và publicationYear = 0.
- Đọc tất cả chữ tiếng Việt, tiếng Anh, số, ký hiệu, tiêu đề, chú thích và nội dung bảng.
- Mỗi khối chữ là một block, tọa độ x/y/width/height dùng số chuẩn hóa 0..1 theo trang; gốc tọa độ ở góc trái trên.
- Giữ thứ tự đọc từ trên xuống dưới, trái sang phải. Không tóm tắt, không dịch, không tự sửa nội dung.
- Nhận diện heading, text, table và caption. Với bảng, giữ từng ô/hàng ở thứ tự đọc; không gộp nội dung khác ô.
- fontSize là kích thước tương đối theo chiều cao trang; fontWeight/italic phản ánh chữ nhìn thấy.
- Nếu chữ không đọc rõ, giữ phần đọc được và đánh dấu trong text bằng [KHÓ ĐỌC], không bịa.
Chỉ trả JSON, không thêm markdown.`;

async function makeSinglePagePdf(source, pageIndex, originalName) {
  const pagePdf = await PDFDocument.create();
  const [page] = await pagePdf.copyPages(source, [pageIndex]);
  pagePdf.addPage(page);
  const bytes = await pagePdf.save({ useObjectStreams: true });
  return {
    fieldname: "file",
    originalname: `${originalName.replace(/\.pdf$/i, "")}-page-${pageIndex + 1}.pdf`,
    encoding: "7bit",
    mimetype: "application/pdf",
    buffer: Buffer.from(bytes),
    size: bytes.length,
  };
}

function makeFallbackPage(pageText) {
  const lines = String(pageText || "").split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  return {
    pageNumber: 1,
    width: 1,
    height: 1,
    blocks: lines.map((line, index) => ({
      text: line,
      x: 0.03,
      y: Math.min(0.97, 0.03 + index * 0.03),
      width: 0.94,
      height: 0.02,
      fontSize: 0.015,
      fontWeight: "normal",
      italic: false,
      role: "text",
    })),
  };
}

async function extractPage(pageFile, pageIndex, totalPages) {
  try {
    const result = await generateStructuredFromFile({
      file: pageFile,
      schema: pageSchema,
      prompt: `${prompt}\n\nĐÂY LÀ TRANG ${pageIndex + 1}/${totalPages} CỦA TÀI LIỆU GỐC. Chỉ trả đúng một phần tử trong pages cho trang này. Không bỏ qua bất kỳ chữ, bảng, chú thích hoặc hình có chữ nào trên trang. pageNumber phải là 1 vì file gửi kèm chỉ chứa trang hiện tại. Trường title, author và publicationYear có thể để trống nếu trang này không chứa thông tin thư mục.`,
      maxOutputTokens: 8192,
      timeoutMs: 300_000,
    });
    const page = Array.isArray(result.pages) ? result.pages[0] : null;
    if (!page) throw new Error("Gemini không trả về page layout.");
    return { result, page };
  } catch (layoutError) {
    console.warn(`Reference OCR layout failed for page ${pageIndex + 1}/${totalPages}; retrying text-only OCR.`, layoutError);
    const fallback = await generateStructuredFromFile({
      file: pageFile,
      schema: fallbackTextSchema,
      prompt: `Bạn là OCR văn bản. Đọc toàn bộ chữ nhìn thấy trên đúng trang PDF được gửi kèm. Chép nguyên văn theo thứ tự từ trên xuống dưới, trái sang phải; giữ tiêu đề, bảng, số liệu, đơn vị, chú thích và nội dung trong ảnh. Không tóm tắt, không dịch, không bỏ dòng, không bịa. Trả pageText là toàn bộ văn bản của trang, có thể dùng xuống dòng. Nếu có bảng, chép từng hàng/ô theo thứ tự đọc. Chỉ trả JSON theo schema. Đây là trang ${pageIndex + 1}/${totalPages}.`,
      maxOutputTokens: 8192,
      timeoutMs: 300_000,
    });
    if (!String(fallback.pageText || "").trim()) throw new Error(`Gemini không đọc được trang ${pageIndex + 1}/${totalPages}: ${layoutError instanceof Error ? layoutError.message : String(layoutError)}`);
    return { result: fallback, page: makeFallbackPage(fallback.pageText) };
  }
}

async function extractAllPages(file) {
  const source = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
  const totalPages = source.getPageCount();
  if (!totalPages) throw new Error("PDF không có trang để đọc.");

  const pages = [];
  let title = "";
  let author = "";
  let publicationYear = 0;

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const pageFile = await makeSinglePagePdf(source, pageIndex, file.originalname || "reference-book");
    const { result, page } = await extractPage(pageFile, pageIndex, totalPages);

    if (!title && result.title?.trim()) title = result.title.trim();
    if (!author && result.author?.trim()) author = result.author.trim();
    if (!publicationYear && Number.isInteger(result.publicationYear) && result.publicationYear > 0) publicationYear = result.publicationYear;

    pages.push({ ...page, pageNumber: pageIndex + 1 });
  }

  return { title, author, publicationYear, pages };
}

router.post("/extract", requireGuidelineAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Chưa chọn PDF sách." });
    if (req.file.mimetype !== "application/pdf") return res.status(415).json({ success: false, message: "Chỉ hỗ trợ PDF sách." });
    const result = await extractAllPages(req.file);
    return res.json({ success: true, data: result });
  } catch (error) {
    const status = error?.status === 429 ? 429 : 500;
    return res.status(status).json({ success: false, message: error?.message || "Không thể OCR sách bằng Gemini." });
  }
});

export default router;
