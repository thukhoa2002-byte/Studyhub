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

async function makePageRegionPdf(source, pageIndex, originalName, regionName, y, height) {
  const pagePdf = await PDFDocument.create();
  const [page] = await pagePdf.copyPages(source, [pageIndex]);
  page.setCropBox(0, y, page.getWidth(), height);
  pagePdf.addPage(page);
  const bytes = await pagePdf.save({ useObjectStreams: true });
  return {
    fieldname: "file",
    originalname: `${originalName.replace(/\.pdf$/i, "")}-page-${pageIndex + 1}-${regionName}.pdf`,
    encoding: "7bit",
    mimetype: "application/pdf",
    buffer: Buffer.from(bytes),
    size: bytes.length,
  };
}

function makeFallbackPage(pageText, yOffset = 0, yScale = 1) {
  const lines = String(pageText || "").split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  return {
    pageNumber: 1,
    width: 1,
    height: 1,
    blocks: lines.map((line, index) => ({
      text: line,
      x: 0.03,
      y: Math.min(0.97, yOffset + (0.03 + index * 0.03) * yScale),
      width: 0.94,
      height: 0.02 * yScale,
      fontSize: 0.015 * yScale,
      fontWeight: "normal",
      italic: false,
      role: "text",
    })),
  };
}

async function ocrPageLocally(pageFile, pageIndex, totalPages) {
  const [{ getDocument }, { createCanvas }, { createWorker }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("@napi-rs/canvas"),
    import("tesseract.js"),
  ]);
  const pdf = await getDocument({ data: pageFile.buffer, disableWorker: true, useSystemFonts: true }).promise;
  const pdfPage = await pdf.getPage(1);
  const viewport = pdfPage.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  const worker = await createWorker("vie+eng");
  try {
    const { data } = await worker.recognize(canvas.toBuffer("image/png"));
    const sourceBlocks = data.blocks?.length ? data.blocks : data.lines?.length ? data.lines : [];
    const blocks = sourceBlocks.map((block) => {
      const bbox = block.bbox || { x0: 0, y0: 0, x1: viewport.width, y1: viewport.height };
      return {
        text: String(block.text || "").replace(/\s+/g, " ").trim(),
        x: bbox.x0 / viewport.width,
        y: bbox.y0 / viewport.height,
        width: (bbox.x1 - bbox.x0) / viewport.width,
        height: (bbox.y1 - bbox.y0) / viewport.height,
        fontSize: Math.max(0.01, (bbox.y1 - bbox.y0) / viewport.height),
        fontWeight: "normal",
        italic: false,
        role: "text",
      };
    }).filter((block) => block.text);
    if (!blocks.length && String(data.text || "").trim()) blocks.push(...makeFallbackPage(data.text).blocks);
    if (!blocks.length) throw new Error(`OCR cục bộ không nhận diện được trang ${pageIndex + 1}/${totalPages}.`);
    return { result: {}, page: { pageNumber: pageIndex + 1, width: 1, height: 1, blocks } };
  } finally {
    await worker.terminate();
  }
}

async function extractPage(pageFile, pageIndex, totalPages, source, originalName) {
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
    if (/RECITATION/i.test(layoutError?.message || "")) {
      try {
        console.warn(`Gemini blocked page ${pageIndex + 1}/${totalPages}; using local OCR.`);
        return await ocrPageLocally(pageFile, pageIndex, totalPages);
      } catch (localError) {
        throw new Error(`Gemini chặn trang ${pageIndex + 1}/${totalPages}; OCR cục bộ chưa chạy được: ${localError instanceof Error ? localError.message : String(localError)}`);
      }
    }
    console.warn(`Reference OCR layout failed for page ${pageIndex + 1}/${totalPages}; retrying split text OCR.`, layoutError);
    const sourcePage = source.getPage(pageIndex);
    const pageHeight = sourcePage.getHeight();
    const halfHeight = pageHeight / 2;
    const regions = [
      { name: "top", y: halfHeight, offset: 0 },
      { name: "bottom", y: 0, offset: 0.5 },
    ];
    const blocks = [];
    let result = {};
    for (const region of regions) {
      const regionFile = await makePageRegionPdf(source, pageIndex, originalName, region.name, region.y, halfHeight);
      const regionResult = await generateStructuredFromFile({
        file: regionFile,
        schema: fallbackTextSchema,
        prompt: `Bạn đang trích xuất nội dung từ một vùng của trang tài liệu do người dùng cung cấp. Hãy liệt kê tất cả thông tin đọc được trong vùng này theo thứ tự từ trên xuống dưới và trái sang phải: tiêu đề, nhãn, số liệu, đơn vị, chú thích và các ô bảng. Không nhận xét, không giải thích, không thêm kiến thức ngoài vùng ảnh. Trả pageText là các đoạn ngắn theo dòng để giữ đủ dữ liệu. Chỉ trả JSON theo schema. Đây là vùng ${region.name} của trang ${pageIndex + 1}/${totalPages}.`,
        maxOutputTokens: 8192,
        timeoutMs: 300_000,
      });
      if (!String(regionResult.pageText || "").trim()) throw new Error(`Gemini không đọc được vùng ${region.name} của trang ${pageIndex + 1}/${totalPages}.`);
      result = { ...result, ...regionResult };
      blocks.push(...makeFallbackPage(regionResult.pageText, region.offset, 0.5).blocks);
    }
    return { result, page: { pageNumber: 1, width: 1, height: 1, blocks } };
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
    const { result, page } = await extractPage(pageFile, pageIndex, totalPages, source, file.originalname || "reference-book");

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
