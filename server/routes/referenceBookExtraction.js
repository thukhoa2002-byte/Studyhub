import express from "express";
import multer from "multer";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, setWordSpacing } from "pdf-lib";
import { generateStructuredFromFile } from "../services/gemini.js";
import { requireGuidelineAdmin } from "../middleware/guidelineAdmin.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024, fieldSize: 20 * 1024 * 1024 } });
const ROUTE_DIR = dirname(fileURLToPath(import.meta.url));
const text = { type: "string" };
const schema = {
  type: "object",
  properties: {
    title: text,
    author: text,
    publicationYear: { type: "integer" },
    pages: { type: "array", items: { type: "object", properties: { pageNumber: { type: "integer" }, width: { type: "number" }, height: { type: "number" }, blocks: { type: "array", items: { type: "object", properties: { text, x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" }, fontSize: { type: "number" }, fontWeight: { type: "string", enum: ["normal", "bold"] }, italic: { type: "boolean" }, role: { type: "string", enum: ["text", "heading", "table", "caption", "header", "footer", "page_number", "metadata", "diagram_label", "diagram_caption"] } }, required: ["text", "x", "y", "width", "height", "fontSize", "fontWeight", "italic", "role"], additionalProperties: false } } }, required: ["pageNumber", "width", "height", "blocks"], additionalProperties: false } },
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

function createFontSanitizer(fontBytes) {
  const face = fontkit.create(fontBytes);
  return (value) => Array.from(String(value || "")).filter((character) => {
    if (character === "\n" || character === "\r") return true;
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && face.hasGlyphForCodePoint(codePoint);
  }).join("");
}

const prompt = `Bạn là hệ thống OCR và phân tích bố cục PDF. Đọc toàn bộ file PDF scan được gửi kèm và trả JSON đúng schema.
Mục tiêu là tái tạo một PDF có chữ thật nhưng giữ bố cục nhìn thấy của bản scan.
- Tự nhận diện tên sách, tác giả và năm xuất bản từ bìa/trang thông tin; nếu không chắc chắn thì trả chuỗi rỗng và publicationYear = 0.
- Đọc tất cả chữ tiếng Việt, tiếng Anh, số, ký hiệu, tiêu đề, chú thích và nội dung bảng.
- Mỗi khối chữ là một block, tọa độ x/y/width/height dùng số chuẩn hóa 0..1 theo trang; gốc tọa độ ở góc trái trên.
- Giữ thứ tự đọc từ trên xuống dưới, trái sang phải. Không tóm tắt, không dịch, không tự sửa nội dung.
- Nhận diện heading, text, table và caption. Với bảng, giữ từng ô/hàng ở thứ tự đọc; không gộp nội dung khác ô.
- Phân loại phần không phải nội dung bài học: header là đầu trang lặp lại hoặc tên sách/chương chạy ở đầu trang; footer là chân trang lặp lại; page_number là số trang; metadata là tên tác giả, mã tài liệu, thông tin xuất bản hoặc dòng hành chính. Không gán các nhãn này cho tiêu đề mục và kiến thức chỉ vì chúng nằm ở đầu trang.
- Không bỏ block bị phân loại là header/footer/page_number/metadata; vẫn trả về để người kiểm tra có thể sửa hoặc xóa.
- Với sơ đồ, lưu chữ trong từng ô/nhãn là diagram_label và tiêu đề/chú thích sơ đồ là diagram_caption. Không biến đường nối, mũi tên hoặc quan hệ không phải chữ thành block văn bản; giữ nguyên vị trí tương đối để hình sơ đồ gốc được bảo toàn.
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
  const pdf = await getDocument({ data: new Uint8Array(pageFile.buffer), disableWorker: true, useSystemFonts: true }).promise;
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

async function createVisibleOcrPdf(file, editedLayout = null) {
  const pdf = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
  pdf.registerFontkit(fontkit);
  const fontPath = join(ROUTE_DIR, "../node_modules/@fontsource/noto-serif/files/noto-serif-vietnamese-400-normal.woff2");
  const fontBytes = await readFile(fontPath);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const sanitizeText = createFontSanitizer(fontBytes);

  for (let pageIndex = 0; pageIndex < pdf.getPageCount(); pageIndex += 1) {
    const pageFile = await makeSinglePagePdf(pdf, pageIndex, file.originalname || "reference-book");
    const ocrPage = editedLayout?.pages?.[pageIndex]?.blocks ? editedLayout.pages[pageIndex] : (await ocrPageLocally(pageFile, pageIndex, pdf.getPageCount())).page;
    const page = pdf.getPage(pageIndex);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    for (const block of ocrPage.blocks) {
      const value = sanitizeText(String(block.text || "").replace(/\s+/g, " ").trim());
      if (!value) continue;
      const x = Math.max(0, block.x * pageWidth);
      const width = Math.max(12, Math.min(pageWidth - x, block.width * pageWidth));
      const height = Math.max(8, block.height * pageHeight);
      const y = Math.max(0, pageHeight - (block.y + block.height) * pageHeight);
      const size = Math.max(6, Math.min(28, height * 0.82));

      if (["header", "footer", "page_number", "metadata", "diagram_label", "diagram_caption"].includes(block.role)) {
        if (["diagram_label", "diagram_caption"].includes(block.role)) {
          page.drawText(value, { x, y: y + Math.max(0, height - size) * 0.25, size, font, color: rgb(0.05, 0.05, 0.05), opacity: 0.01, maxWidth: width, lineHeight: size * 1.15 });
        }
        continue;
      }

      // Cover the scanned glyphs locally, then draw selectable OCR text in their place.
      page.drawRectangle({ x: Math.max(0, x - 1), y: Math.max(0, y - 1), width: Math.min(pageWidth - x + 1, width + 2), height: height + 2, color: rgb(1, 1, 1) });
      page.drawText(value, { x, y: y + Math.max(0, height - size) * 0.25, size, font, color: rgb(0.05, 0.05, 0.05), maxWidth: width, lineHeight: size * 1.15 });
    }
  }

  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

function wrapFlowText(textValue, font, size, maxWidth) {
  return String(textValue || "").split(/\r?\n/).flatMap((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  });
}

async function embedFlowFonts(pdf) {
  pdf.registerFontkit(fontkit);
  const fontDir = join(ROUTE_DIR, "../node_modules/@fontsource/noto-serif/files");
  const [regular, bold, italic, boldItalic] = await Promise.all([
    readFile(join(fontDir, "noto-serif-vietnamese-400-normal.woff2")),
    readFile(join(fontDir, "noto-serif-vietnamese-700-normal.woff2")),
    readFile(join(fontDir, "noto-serif-vietnamese-400-italic.woff2")),
    readFile(join(fontDir, "noto-serif-vietnamese-700-italic.woff2")),
  ]);
  const sanitize = createFontSanitizer(regular);
  return {
    regular: await pdf.embedFont(regular, { subset: true }),
    bold: await pdf.embedFont(bold, { subset: true }),
    italic: await pdf.embedFont(italic, { subset: true }),
    boldItalic: await pdf.embedFont(boldItalic, { subset: true }),
    sanitize,
  };
}

async function renderDiagramCrop(file, pageIndex, blocks) {
  const diagramBlocks = blocks.filter((block) => ["diagram_label", "diagram_caption"].includes(block.role));
  if (!diagramBlocks.length) return null;
  const [{ getDocument }, { createCanvas }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("@napi-rs/canvas"),
  ]);
  const sourcePdf = await getDocument({ data: new Uint8Array(file.buffer), disableWorker: true, useSystemFonts: true }).promise;
  const sourcePage = await sourcePdf.getPage(pageIndex + 1);
  const scale = 1.5;
  const viewport = sourcePage.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await sourcePage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  const minX = Math.max(0, Math.min(...diagramBlocks.map((block) => block.x)) - 0.04);
  const minY = Math.max(0, Math.min(...diagramBlocks.map((block) => block.y)) - 0.04);
  const maxX = Math.min(1, Math.max(...diagramBlocks.map((block) => block.x + block.width)) + 0.04);
  const maxY = Math.min(1, Math.max(...diagramBlocks.map((block) => block.y + block.height)) + 0.04);
  const sx = Math.round(minX * viewport.width);
  const sy = Math.round(minY * viewport.height);
  const sw = Math.max(1, Math.round((maxX - minX) * viewport.width));
  const sh = Math.max(1, Math.round((maxY - minY) * viewport.height));
  const crop = createCanvas(sw, sh);
  crop.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return { png: crop.toBuffer("image/png"), width: sw, height: sh };
}

async function createReflowPdf(file, editedLayout = null) {
  const sourcePdf = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
  const output = await PDFDocument.create();
  const fonts = await embedFlowFonts(output);
  const pageSize = { width: 595.28, height: 841.89 };
  const margin = { left: 64, right: 64, top: 58, bottom: 58 };
  const contentWidth = pageSize.width - margin.left - margin.right;
  let page = output.addPage([pageSize.width, pageSize.height]);
  let cursorY = pageSize.height - margin.top;

  const newPage = () => {
    page = output.addPage([pageSize.width, pageSize.height]);
    cursorY = pageSize.height - margin.top;
  };
  const ensureSpace = (height) => {
    if (cursorY - height < margin.bottom) newPage();
  };
  const addTextBlock = (block) => {
    const role = block.role || "text";
    if (["header", "footer", "page_number", "metadata", "diagram_label"].includes(role)) return;
    const isHeading = role === "heading";
    const isCaption = role === "caption" || role === "diagram_caption";
    const isList = /^\s*(?:[-•*]|\d+[.)]|[A-Z][.)])\s/.test(block.text || "");
    const size = isHeading ? 17 : isCaption ? 10.5 : role === "table" ? 11 : 13;
    const lineHeight = size * (isHeading ? 1.25 : 1.45);
    const indent = !isHeading && !isCaption && !isList ? 18 : 0;
    const font = isHeading ? fonts.bold : block.fontWeight === "bold" && block.italic ? fonts.boldItalic : block.fontWeight === "bold" ? fonts.bold : block.italic || isCaption ? fonts.italic : fonts.regular;
    const lines = wrapFlowText(fonts.sanitize(block.text), font, size, contentWidth - indent);
    ensureSpace(lines.length * lineHeight + (isHeading ? 12 : 8));
    cursorY -= isHeading ? 6 : 2;
    lines.forEach((line, index) => {
      const lineIndent = index === 0 ? indent : 0;
      const spaces = (line.match(/ /g) || []).length;
      const justify = !isHeading && !isCaption && !isList && index < lines.length - 1 && spaces > 0;
      const lineWidth = contentWidth - lineIndent;
      const extraWordSpacing = justify ? Math.max(0, (lineWidth - font.widthOfTextAtSize(line, size)) / spaces) : 0;
      if (extraWordSpacing > 0) page.pushOperators(setWordSpacing(extraWordSpacing));
      page.drawText(line, { x: margin.left + lineIndent, y: cursorY - size, size, font, color: rgb(0.08, 0.08, 0.08), maxWidth: lineWidth, lineHeight });
      if (extraWordSpacing > 0) page.pushOperators(setWordSpacing(0));
      cursorY -= lineHeight;
    });
    cursorY -= isHeading ? 7 : 5;
  };
  const addDiagram = async (diagram) => {
    const image = await output.embedPng(diagram.png);
    const maxWidth = contentWidth;
    const maxHeight = 310;
    const scale = Math.min(maxWidth / diagram.width, maxHeight / diagram.height, 1);
    const width = diagram.width * scale;
    const height = diagram.height * scale;
    ensureSpace(height + 20);
    page.drawImage(image, { x: margin.left + (contentWidth - width) / 2, y: cursorY - height, width, height });
    cursorY -= height + 16;
  };

  for (let pageIndex = 0; pageIndex < sourcePdf.getPageCount(); pageIndex += 1) {
    const pageData = editedLayout?.pages?.[pageIndex]?.blocks ? editedLayout.pages[pageIndex] : (await ocrPageLocally(await makeSinglePagePdf(sourcePdf, pageIndex, file.originalname || "reference-book"), pageIndex, sourcePdf.getPageCount())).page;
    let diagramAdded = false;
    for (const block of pageData.blocks) {
      if (!diagramAdded && ["diagram_label", "diagram_caption"].includes(block.role)) {
        const diagram = await renderDiagramCrop(file, pageIndex, pageData.blocks);
        if (diagram) await addDiagram(diagram);
        diagramAdded = true;
      }
      addTextBlock(block);
    }
  }

  return Buffer.from(await output.save({ useObjectStreams: true }));
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

router.post("/ocr-pdf", requireGuidelineAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Chưa chọn PDF sách." });
    if (req.file.mimetype !== "application/pdf") return res.status(415).json({ success: false, message: "Chỉ hỗ trợ PDF sách." });
    let editedLayout = null;
    if (req.body.layout) {
      try { editedLayout = JSON.parse(req.body.layout); } catch { return res.status(400).json({ success: false, message: "Bố cục OCR chỉnh sửa không hợp lệ." }); }
    }
    const format = req.body.format || "reflow";
    const pdf = format === "scan" ? await createVisibleOcrPdf(req.file, editedLayout) : await createReflowPdf(req.file, editedLayout);
    res.type("application/pdf").send(pdf);
  } catch (error) {
    const status = error?.status === 429 ? 429 : 500;
    return res.status(status).json({ success: false, message: error?.message || "Không thể tạo PDF OCR." });
  }
});

export default router;
