import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extractDrugDocumentText } from "./drugImport.js";
import { supabaseTableRequest } from "./guidelineImportStore.js";
import { classifyGuidelineItems } from "./guidelineTranslationPolicy.js";
import { generateGuidelineStructured } from "./guidelineTranslationProvider.js";
import { normalizeGuidelineText, sourceSectionIdentity, validSourcePage, canImportStructuredBatch } from "./guidelineExtractionRecovery.js";

export const GUIDELINE_IMPORT_PROMPT_VERSION = "guideline-import-v2-selective";
export const GUIDELINE_IMPORT_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const supportedExtensions = new Set(["pdf", "docx", "md", "markdown", "html", "htm", "txt"]);
const missingTextPattern = /^(?:not\s+(?:specified|mentioned|provided|available)|n\/a|none|unknown|chưa\s+(?:có|được\s+nêu)|không\s+(?:được\s+)?nêu)(?:\s+(?:in|trong|the|provided|source|text|tài liệu|nguồn).*)?[.!:]?$/i;

const importSchema = {
  type: "object",
  properties: {
    document: {
      type: "object",
      properties: {
        title: { type: "string" },
        organization: { type: "string" },
        year: { type: "integer" },
        version: { type: "string" },
        sourceLanguage: { type: "string" },
      },
      required: ["title", "organization", "year", "version", "sourceLanguage"],
      additionalProperties: false,
    },
    sections: {
      type: "array",
      items: { type: "object", properties: {
        sourceKey: { type: "string" },
        parentSourceKey: { type: "string" },
        titleOriginal: { type: "string" },
        titleVi: { type: "string" },
        summaryOriginal: { type: "string" },
        summaryVi: { type: "string" },
        level: { type: "integer" },
        sourcePage: { type: "integer" },
        sourceAnchor: { type: "string" },
        displayOrder: { type: "integer" },
      }, required: ["sourceKey", "parentSourceKey", "titleOriginal", "titleVi", "summaryOriginal", "summaryVi", "level", "sourcePage", "sourceAnchor", "displayOrder"], additionalProperties: false },
    },
    recommendations: {
      type: "array",
      items: { type: "object", properties: {
        sourceKey: { type: "string" },
        sectionSourceKey: { type: "string" },
        tableSourceKey: { type: "string" },
        titleOriginal: { type: "string" },
        recommendationTextOriginal: { type: "string" },
        recommendationTextVi: { type: "string" },
        rationaleVi: { type: "string" },
        recommendationClass: { type: "string" },
        evidenceLevel: { type: "string" },
        evidenceSystem: { type: "string" },
        population: { type: "string" },
        intervention: { type: "string" },
        comparator: { type: "string" },
        outcome: { type: "string" },
        conditions: { type: "string" },
        contraindications: { type: "string" },
        sourcePage: { type: "integer" },
        sourceQuote: { type: "string" },
        sourceAnchor: { type: "string" },
        coordinates: { type: "object" },
        confidence: { type: "number" }, sourceOrder: { type: "integer" }, groupOrder: { type: "integer" }, rowOrder: { type: "integer" },
        displayOrder: { type: "integer" },
      }, required: ["sourceKey", "sectionSourceKey", "tableSourceKey", "titleOriginal", "recommendationTextOriginal", "recommendationTextVi", "rationaleVi", "recommendationClass", "evidenceLevel", "evidenceSystem", "population", "intervention", "comparator", "outcome", "conditions", "contraindications", "sourcePage", "sourceQuote", "sourceAnchor", "coordinates", "confidence", "sourceOrder", "groupOrder", "rowOrder", "displayOrder"], additionalProperties: false },
    },
    tables: {
      type: "array",
      items: { type: "object", properties: {
        sourceKey: { type: "string" }, tableNumber: { type: "string" }, sectionSourceKey: { type: "string" }, titleOriginal: { type: "string" }, titleVi: { type: "string" },
        headersOriginal: { type: "array", items: { type: "string" } }, headersVi: { type: "array", items: { type: "string" } },
        rows: { type: "array", items: { type: "object", properties: { cellsOriginal: { type: "array", items: { type: "string" } }, cellsVi: { type: "array", items: { type: "string" } }, groupOrder: { type: "integer" }, rowOrder: { type: "integer" } }, required: ["cellsOriginal", "cellsVi", "groupOrder", "rowOrder"], additionalProperties: false } },
        footnotesOriginal: { type: "array", items: { type: "string" } }, footnotesVi: { type: "array", items: { type: "string" } }, references: { type: "array", items: { type: "string" } }, groupHeadings: { type: "array", items: { type: "string" } }, sourcePage: { type: "integer" }, sourcePageEnd: { type: "integer" }, sourceOrder: { type: "integer" },
      }, required: ["sourceKey", "tableNumber", "sectionSourceKey", "titleOriginal", "titleVi", "headersOriginal", "headersVi", "rows", "footnotesOriginal", "footnotesVi", "references", "groupHeadings", "sourcePage", "sourcePageEnd", "sourceOrder"], additionalProperties: false },
    },
    figures: {
      type: "array",
      items: { type: "object", properties: {
        sourceKey: { type: "string" }, figureNumber: { type: "string" }, sourceTitle: { type: "string" }, translatedTitle: { type: "string" },
        sourceCaption: { type: "string" }, translatedCaption: { type: "string" }, sourcePages: { type: "array", items: { type: "integer" } },
        altText: { type: "string" }, attribution: { type: "string" }, sectionSourceKey: { type: "string" }, relatedRecommendationSourceKeys: { type: "array", items: { type: "string" } }, relatedTableSourceKeys: { type: "array", items: { type: "string" } },
      }, required: ["sourceKey", "figureNumber", "sourceTitle", "translatedTitle", "sourceCaption", "translatedCaption", "sourcePages", "altText", "attribution", "sectionSourceKey", "relatedRecommendationSourceKeys", "relatedTableSourceKeys"], additionalProperties: false },
    },
    terminology: { type: "array", items: { type: "object", properties: { sourceTerm: { type: "string" }, preferredTranslation: { type: "string" } }, required: ["sourceTerm", "preferredTranslation"], additionalProperties: false } },
    issues: { type: "array", items: { type: "object", properties: { severity: { type: "string", enum: ["info", "warning", "error", "blocking"] }, code: { type: "string" }, message: { type: "string" }, sourcePage: { type: "integer" } }, required: ["severity", "code", "message", "sourcePage"], additionalProperties: false } },
  },
  required: ["document", "sections", "recommendations", "tables", "figures", "terminology", "issues"],
  additionalProperties: false,
};

export function extensionFor(fileName) {
  return String(fileName || "").toLowerCase().split(".").pop() || "";
}

export function isSupportedGuidelineFile(fileName) {
  return supportedExtensions.has(extensionFor(fileName));
}

function cleanText(value) {
  return normalizeGuidelineText(value).split(/\r?\n/).filter((line) => !missingTextPattern.test(line.trim())).join("\n").trim();
}

export function checksumFor(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function reconstructGuidelinePageReadingOrder(items, pageWidth, pageHeight) {
  const rows = [];
  for (const item of items) {
    const value = cleanText(item.str || "");
    if (!value) continue;
    const x = Number(item.transform?.[4] || 0);
    const y = Number(item.transform?.[5] || 0);
    const width = Number(item.width || 0);
    if (y < pageHeight * 0.045 || y > pageHeight * 0.955) continue;
    const row = rows.find((candidate) => candidate.column === (width > pageWidth * .62 ? "full" : x < pageWidth / 2 ? "left" : "right") && Math.abs(candidate.y - y) < 3);
    const part = { x, value };
    if (row) row.parts.push(part);
    else rows.push({ y, column: width > pageWidth * .62 ? "full" : x < pageWidth / 2 ? "left" : "right", parts: [part] });
  }
  const render = (list) => list.sort((a, b) => b.y - a.y).map((row) => row.parts.sort((a, b) => a.x - b.x).map((part) => part.value).join(" "));
  const full = rows.filter((row) => row.column === "full");
  const left = rows.filter((row) => row.column === "left");
  const right = rows.filter((row) => row.column === "right");
  // Full-width regions are kept as their own blocks. This prevents a table
  // spanning the page from being interwoven with the adjacent column.
  return [...render(full), ...render(left), ...render(right)].filter(Boolean);
}

async function extractGuidelinePdfLayout(file) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: new Uint8Array(await readFile(file.path)), disableWorker: true, useSystemFonts: true }).promise;
  const pages = [];
  const pageMetadata = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const rows = reconstructGuidelinePageReadingOrder(content.items, viewport.width, viewport.height);
    pages.push(`[Trang ${pageNumber}]\n${rows.join("\n")}`);
    pageMetadata.push({ pageNumber, width: viewport.width, height: viewport.height, readingOrder: "full_width_then_left_then_right", textBlocks: rows.length });
  }
  return { text: cleanText(pages.join("\n\n")), pageMetadata, pageCount: document.numPages, ocrUsed: false };
}

export async function extractGuidelineInput(file) {
  const extension = extensionFor(file.originalname);
  if (!isSupportedGuidelineFile(file.originalname)) throw Object.assign(new Error("Định dạng được hỗ trợ: PDF, DOCX, Markdown, HTML và TXT."), { status: 415 });
  if (extension === "pdf") {
    const extracted = await extractGuidelinePdfLayout(file);
    return { ...extracted, items: [], sourceType: "pdf", originalFileName: file.originalname, characterCount: extracted.text.length, extension };
  }
  if (["pdf", "docx"].includes(extension)) {
    const extracted = await extractDrugDocumentText(file);
    return { ...extracted, text: cleanText(extracted.text), extension };
  }
  const raw = await readFile(file.path, "utf8");
  const text = extension === "html" || extension === "htm"
    ? raw.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim()
    : raw;
  return { text: cleanText(text), items: [], ocrUsed: false, sourceType: extension, originalFileName: file.originalname, characterCount: text.length, extension };
}

export function buildImportPrompt({ text, item, sourceMetadata, sourceLanguage = "en", targetLanguage = "vi", preserveAbbreviations = true, preserveEnglishTerminology = true }) {
  return `Bạn là nhóm biên tập viên guideline y khoa. Chỉ dịch/trích xuất đúng mục lâm sàng đã được chọn, không bịa và không tóm tắt quá mức.

TÀI LIỆU: ${sourceMetadata.fileName || "không rõ"}
MỤC: ${item.label || "toàn bộ tài liệu"}; trang ${item.pageStart || "?"}-${item.pageEnd || item.pageStart || "?"}
SECTION NGỮ CẢNH TỪ PDF: ${item.sectionContext?.number ? `${item.sectionContext.number} ${item.sectionContext.title}` : "chưa xác định - không được tự đoán"}
PHÂN LOẠI: ${item.contentType || "recommendation"}; mức quan trọng: ${item.clinicalImportance || "required"}.
NGÔN NGỮ NGUỒN: ${sourceLanguage}; NGÔN NGỮ ĐÍCH: ${targetLanguage}.

YÊU CẦU:
- Source Section chỉ là provenance tùy chọn. Không dịch hoặc đưa Section vào checklist hoàn tất. Chỉ tạo recommendation từ một bảng khuyến cáo chính thức; không tạo recommendation từ bảng lâm sàng thông thường, danh mục, bibliography, figure caption, glossary hay diagnostics. sourceKey của bảng phải ổn định; nếu không xác định được Section chủ quản, để sectionSourceKey rỗng và tiếp tục xử lý bảng theo title, page và source order.
- Một khuyến cáo phải giữ nguyên nội dung gốc trong recommendationTextOriginal và bản dịch đầy đủ trong recommendationTextVi.
- Giữ nguyên mọi số liệu, ngưỡng, đơn vị, liều, tên thuốc, viết tắt y khoa, Class/Level/LoE. ${preserveAbbreviations ? "Không dịch viết tắt chuẩn." : "Có thể diễn giải viết tắt khi nguồn có giải thích."}
- ${preserveEnglishTerminology ? "Giữ thuật ngữ tiếng Anh cạnh bản dịch khi cần." : "Ưu tiên tiếng Việt y khoa."}
- Với bảng lâm sàng: luôn trả một phần tử đầy đủ trong mảng tables, gồm tableNumber, sectionSourceKey, tiêu đề, headers, rows, footnotes và sourcePage. Giữ nguyên tiêu đề, header, thứ tự hàng, quan hệ ô, đơn vị, liều, ngưỡng, Class/LoE và chú thích cần thiết. Không suy đoán ô/hàng thiếu, không làm phẳng bảng phức tạp thành đoạn văn không liên quan.
- Bảng khuyến cáo: dịch trọn đơn vị bảng gồm số bảng, sectionSourceKey, tiêu đề, cột, nhãn hàng, mọi hàng/cell, Class/LoE và footnote. Mỗi recommendation từ bảng phải có tableSourceKey đúng bằng sourceKey của bảng. Điền groupOrder và rowOrder theo thứ tự gốc; không xếp theo Class, LoE hoặc bản dịch. Nếu bảng chỉ có tiêu đề hoặc thiếu hàng, trả issue recommendation_table_incomplete và không tạo recommendation từ dữ liệu thiếu.
- Với Figure: không dịch, vẽ lại hoặc ghi chữ trực tiếp lên ảnh. Chỉ trả metadata cho mảng figures: số Figure, tiêu đề/caption gốc và dịch, attribution, sectionSourceKey và liên kết sourceKey của recommendation/bảng nếu có bằng chứng rõ ràng. Không tạo Recommendation mới từ Figure. Giữ asset gốc, tỉ lệ ảnh và bản quyền để hệ thống crop/rà soát riêng.
- Nếu không có dữ liệu, để chuỗi rỗng, không viết câu “Not specified in the provided text”.
- Ghi sourcePage, sourceAnchor và coordinates nếu xác định được. confidence từ 0 đến 1.
- Mọi nội dung AI đều là draft, không tự publish.

Trả JSON đúng schema được cung cấp.

NỘI DUNG MỤC:
${String(text || "").slice(0, 260000)}`;
}

export async function analyzeGuidelineItem({ text, item, sourceMetadata, sourceLanguage, targetLanguage, preserveAbbreviations, preserveEnglishTerminology, provider = "gemini" }) {
  const result = await generateGuidelineStructured({
    provider,
    file: { buffer: Buffer.from(String(text || ""), "utf8"), size: Buffer.byteLength(String(text || "")), mimetype: "text/plain", originalname: `${sourceMetadata.fileName || "guideline"}.txt` },
    prompt: buildImportPrompt({ text, item, sourceMetadata, sourceLanguage, targetLanguage, preserveAbbreviations, preserveEnglishTerminology }),
    schema: importSchema,
    maxOutputTokens: 20_000,
    timeoutMs: 240_000,
  });
  return normalizeImportResult(result);
}

export function normalizeImportResult(result) {
  const document = result?.document && typeof result.document === "object" ? result.document : {};
  const sections = Array.isArray(result?.sections) ? result.sections : [];
  const recommendations = Array.isArray(result?.recommendations) ? result.recommendations : [];
  const tables = Array.isArray(result?.tables) ? result.tables : [];
  const figures = Array.isArray(result?.figures) ? result.figures : [];
  const terminology = Array.isArray(result?.terminology) ? result.terminology : [];
  const issues = Array.isArray(result?.issues) ? result.issues : [];
  const normalized = {
    document: { title: cleanText(document.title), organization: cleanText(document.organization), year: Number.isInteger(document.year) ? document.year : null, version: cleanText(document.version), sourceLanguage: cleanText(document.sourceLanguage) },
    sections: sections.map((section, index) => {
      const base = { ...section, sourceKey: String(section.sourceKey || `section-${index + 1}`), parentSourceKey: String(section.parentSourceKey || ""), titleOriginal: cleanText(section.titleOriginal), titleVi: cleanText(section.titleVi), summaryOriginal: cleanText(section.summaryOriginal), summaryVi: cleanText(section.summaryVi), level: Number.isInteger(section.level) ? Math.max(0, section.level) : 0, sourcePage: validSourcePage(section.sourcePage), displayOrder: Number.isInteger(section.displayOrder) ? Math.max(0, section.displayOrder) : index };
      const identity = sourceSectionIdentity(base);
      return { ...base, sourceNumber: identity.number, temporaryIdentity: identity.temporary, canonicalSourceKey: identity.canonicalKey || base.sourceKey };
    }),
    recommendations: recommendations.map((recommendation, index) => ({ ...recommendation, sourceKey: String(recommendation.sourceKey || `recommendation-${index + 1}`), sectionSourceKey: String(recommendation.sectionSourceKey || ""), tableSourceKey: String(recommendation.tableSourceKey || ""), titleOriginal: cleanText(recommendation.titleOriginal), recommendationTextOriginal: cleanText(recommendation.recommendationTextOriginal), recommendationTextVi: cleanText(recommendation.recommendationTextVi), rationaleVi: cleanText(recommendation.rationaleVi), recommendationClass: cleanText(recommendation.recommendationClass), evidenceLevel: cleanText(recommendation.evidenceLevel), evidenceSystem: cleanText(recommendation.evidenceSystem), population: cleanText(recommendation.population), intervention: cleanText(recommendation.intervention), comparator: cleanText(recommendation.comparator), outcome: cleanText(recommendation.outcome), conditions: cleanText(recommendation.conditions), contraindications: cleanText(recommendation.contraindications), sourcePage: validSourcePage(recommendation.sourcePage), sourceQuote: cleanText(recommendation.sourceQuote), sourceAnchor: cleanText(recommendation.sourceAnchor), confidence: typeof recommendation.confidence === "number" ? Math.max(0, Math.min(1, recommendation.confidence)) : null, sourceOrder: Number.isInteger(recommendation.sourceOrder) ? Math.max(0, recommendation.sourceOrder) : index, groupOrder: Number.isInteger(recommendation.groupOrder) ? Math.max(0, recommendation.groupOrder) : 0, rowOrder: Number.isInteger(recommendation.rowOrder) ? Math.max(0, recommendation.rowOrder) : index, displayOrder: Number.isInteger(recommendation.displayOrder) ? Math.max(0, recommendation.displayOrder) : index })),
    tables: tables.map((table, index) => ({
      sourceKey: String(table?.sourceKey || `table-${index + 1}`), tableNumber: cleanText(table?.tableNumber), sectionSourceKey: cleanText(table?.sectionSourceKey),
      titleOriginal: cleanText(table?.titleOriginal), titleVi: cleanText(table?.titleVi),
      headersOriginal: Array.isArray(table?.headersOriginal) ? table.headersOriginal.map(cleanText) : [],
      headersVi: Array.isArray(table?.headersVi) ? table.headersVi.map(cleanText) : [],
      rows: Array.isArray(table?.rows) ? table.rows.map((row, rowIndex) => ({ cellsOriginal: Array.isArray(row?.cellsOriginal) ? row.cellsOriginal.map(cleanText) : [], cellsVi: Array.isArray(row?.cellsVi) ? row.cellsVi.map(cleanText) : [], groupOrder: Number.isInteger(row?.groupOrder) ? Math.max(0, row.groupOrder) : 0, rowOrder: Number.isInteger(row?.rowOrder) ? Math.max(0, row.rowOrder) : rowIndex })) : [],
      footnotesOriginal: Array.isArray(table?.footnotesOriginal) ? table.footnotesOriginal.map(cleanText) : [],
      footnotesVi: Array.isArray(table?.footnotesVi) ? table.footnotesVi.map(cleanText) : [],
      references: Array.isArray(table?.references) ? table.references.map(cleanText) : [], groupHeadings: Array.isArray(table?.groupHeadings) ? table.groupHeadings.map(cleanText) : [],
      sourcePage: validSourcePage(table?.sourcePage), sourcePageEnd: validSourcePage(table?.sourcePageEnd), sourceOrder: Number.isInteger(table?.sourceOrder) ? Math.max(0, table.sourceOrder) : index,
    })),
    figures: figures.map((figure, index) => ({
      sourceKey: String(figure?.sourceKey || `figure-${index + 1}`),
      figureNumber: cleanText(figure?.figureNumber),
      sourceTitle: cleanText(figure?.sourceTitle),
      translatedTitle: cleanText(figure?.translatedTitle),
      sourceCaption: cleanText(figure?.sourceCaption),
      translatedCaption: cleanText(figure?.translatedCaption),
      sourcePages: Array.isArray(figure?.sourcePages) ? figure.sourcePages.filter((page) => Number.isInteger(page) && page > 0) : [],
      altText: cleanText(figure?.altText),
      attribution: cleanText(figure?.attribution),
      sectionSourceKey: cleanText(figure?.sectionSourceKey),
      relatedRecommendationSourceKeys: Array.isArray(figure?.relatedRecommendationSourceKeys) ? figure.relatedRecommendationSourceKeys.map(String).filter(Boolean) : [],
      relatedTableSourceKeys: Array.isArray(figure?.relatedTableSourceKeys) ? figure.relatedTableSourceKeys.map(String).filter(Boolean) : [],
    })),
    terminology: terminology.filter((term) => term?.sourceTerm).map((term) => ({ sourceTerm: cleanText(term.sourceTerm), preferredTranslation: cleanText(term.preferredTranslation) })),
    issues: issues.map((issue) => ({ severity: ["info", "warning", "error", "blocking"].includes(issue?.severity) ? issue.severity : "warning", code: String(issue?.code || "manual_review"), message: cleanText(issue?.message), sourcePage: validSourcePage(issue?.sourcePage) })),
  };
  normalized.recommendations.forEach((recommendation) => {
    if (!recommendation.recommendationTextOriginal && !recommendation.recommendationTextVi) normalized.issues.push({ severity: "blocking", code: "empty_recommendation", message: `Khuyến cáo ${recommendation.sourceKey} chưa có nội dung.`, sourcePage: recommendation.sourcePage });
    if (!recommendation.recommendationClass || !recommendation.evidenceLevel) normalized.issues.push({ severity: "warning", code: "missing_evidence", message: `Khuyến cáo ${recommendation.sourceKey} thiếu Class hoặc Level/LoE.`, sourcePage: recommendation.sourcePage });
  });
  return normalized;
}

export function createDocumentItems(text) {
  const source = String(text || "").trim();
  if (!source) return [];
  const headingPattern = /^\s*((?:supplementary|supplemental)\s+(?:table|figure)|table|figure|algorithm|flowchart|appendix|chapter|section)\s*(?:([A-Za-z]?\s*\d+(?:\.\d+)*)\s*)?[:.\-]?\s*(.*)$/i;
  const lines = source.split("\n");
  const matches = [];
  const sectionHeadings = [];
  let offset = 0;
  for (const line of lines) {
    const match = line.match(headingPattern);
    if (match && !/table\s+of\s+contents/i.test(line)) {
      matches.push({ start: offset, label: `${match[1]}${match[2] ? ` ${match[2].trim()}` : ""}`.trim(), title: cleanText(match[3] || "") });
    }
    const sectionMatch = line.match(/^\s*(\d+(?:\.\d+){0,5})\.?\s+([A-Z][^\n]{3,})$/);
    if (sectionMatch && !/^(?:table|figure|algorithm|appendix)/i.test(line.trim())) sectionHeadings.push({ start: offset, number: sectionMatch[1], title: cleanText(sectionMatch[2]) });
    offset += line.length + 1;
  }
  if (!matches.length) return classifyGuidelineItems([{ id: "document-1", type: "document", label: "Toàn bộ tài liệu", title: "", pageStart: null, pageEnd: null, startOffset: 0, endOffset: source.length, text: source }]);
  const rawItems = matches.map((match, index) => {
    const end = matches[index + 1]?.start || source.length;
    const text = source.slice(match.start, end).trim();
    const pages = [...text.matchAll(/\[Trang\s+(\d+)\]/gi)].map((item) => Number(item[1])).filter(Number.isInteger);
    const label = match.label.toLowerCase();
    const type = label.includes("table") ? "table" : label.includes("figure") ? "figure" : label.includes("algorithm") ? "algorithm" : label.includes("flowchart") ? "flowchart" : label.includes("appendix") ? "appendix" : "document";
    const context = [...sectionHeadings].reverse().find((heading) => heading.start <= match.start) || null;
    return { id: `document-item-${index + 1}`, type, label: match.label, sourceTableNumber: type === "table" ? match.label : "", sourceOrder: index, title: match.title, pageStart: pages[0] || null, pageEnd: pages.at(-1) || null, startOffset: match.start, endOffset: end, text, sectionContext: context ? { number: context.number, title: context.title } : null };
  });
  const mergedItems = [];
  for (const item of rawItems) {
    const previous = mergedItems.at(-1);
    const continuation = item.type === "table" && /\b(?:continued|continuation|cont\.?|tiếp theo)\b/i.test(`${item.label} ${item.title}`);
    const repeatedTableLabel = item.type === "table" && previous?.type === "table"
      && String(item.label || "").trim().toLowerCase() === String(previous.label || "").trim().toLowerCase();
    if ((continuation || repeatedTableLabel) && previous?.type === "table") {
      previous.text = `${previous.text}\n${item.text}`;
      previous.endOffset = item.endOffset;
      previous.pageEnd = item.pageEnd || previous.pageEnd;
      previous.continuationCount = Number(previous.continuationCount || 0) + 1;
    } else mergedItems.push(item);
  }
  return classifyGuidelineItems(mergedItems);
}

export function validateImportForBulkImport(job, sections, recommendations, issues) {
  const errors = [];
  if (!job?.id) errors.push("Import job không tồn tại.");
  if (!recommendations.some((recommendation) => recommendation.review_status === "accepted")) errors.push("Cần duyệt ít nhất một khuyến cáo.");
  if (issues.some((issue) => issue.severity === "blocking" && !issue.resolved)) errors.push("Còn issue blocking chưa được xử lý.");
  if (recommendations.some((recommendation) => recommendation.review_status === "accepted" && !recommendation.recommendation_text_vi && !recommendation.recommendation_text_original)) errors.push("Khuyến cáo được duyệt phải có nội dung.");
  if (recommendations.some((recommendation) => recommendation.review_status === "accepted" && ["exact", "possible", "update"].includes(recommendation.duplicate_status))) errors.push("Khuyến cáo trùng hoặc có khả năng trùng phải được kiểm tra và bỏ duyệt trước khi import.");
  const structural = canImportStructuredBatch({
    items: job?.analysis_metadata?.items || [],
    sections,
    recommendations,
    tables: Object.entries(job?.analysis_metadata?.tableTranslations || {}).flatMap(([itemId, tables]) => (Array.isArray(tables) ? tables : []).map((table) => ({ ...table, itemId }))),
    issues,
  });
  if (!structural.valid) errors.push("Batch import chưa đạt kiểm tra cấu trúc nguồn: còn Bảng/Trang nguồn hoặc ngôn ngữ chưa khớp.");
  return errors;
}

export async function findDuplicateRecommendations(token, guidelineId, recommendations) {
  if (!guidelineId || recommendations.length === 0) return new Map();
  const existing = await supabaseTableRequest("guideline_recommendations", token, { query: { select: "id,title,recommendation_text_original,recommendation_text_vi", guideline_id: `eq.${guidelineId}` } });
  const byText = new Map();
  for (const item of existing || []) {
    for (const value of [item.recommendation_text_vi, item.recommendation_text_original, item.title]) {
      if (value) byText.set(String(value).trim().toLocaleLowerCase(), item.id);
    }
  }
  return new Map(recommendations.map((item) => {
    const key = String(item.recommendation_text_vi || item.recommendation_text_original || item.titleOriginal || "").trim().toLocaleLowerCase();
    return [item.id, key && byText.has(key) ? byText.get(key) : null];
  }));
}
