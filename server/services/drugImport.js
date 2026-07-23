import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { generateStructuredFromFile } from "./gemini.js";
import { buildDrugExtractionPrompt, buildGuidelineTableExtractionPrompt } from "../prompts/drugExtractionPrompt.js";

const execFileAsync = promisify(execFile);
export const DRUG_IMPORT_PROMPT_VERSION = "drug-extraction-v1";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const AI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const MAX_AI_TEXT_CHARS = 1_200_000;
const AI_CHUNK_CHARS = 180_000;

const textFields = ["genericName", "titleVi", "drugClass", "indications", "contraindications", "dosing", "renalAdjustment", "hepaticAdjustment", "elderlyAdjustment", "pediatricAdjustment", "specialPopulationAdjustments", "pregnancy", "breastfeeding", "precautions", "adverseEffects", "interactions", "monitoring", "mechanism", "pharmacodynamics", "notes", "summary"];
const arrayFields = ["aliases", "brandNames", "dosageForms", "routes", "specialties", "references", "guidelineReferences", "flashcardReferences", "quizReferences", "calculatorReferences", "flowchartReferences", "imageReferences"];
const objectArrayFields = ["indicationsDetailed", "dosingRegimens", "sourceReferences", "guidelineLinks"];
const drugProperties = { id: { type: "string" }, slug: { type: "string" }, genericName: { type: "string" }, titleVi: { type: "string" }, aliases: { type: "array", items: { type: "string" } }, brandNames: { type: "array", items: { type: "string" } }, drugClass: { type: "string" }, specialties: { type: "array", items: { type: "string" } }, indications: { type: "string" }, contraindications: { type: "string" }, dosing: { type: "string" }, renalAdjustment: { type: "string" }, hepaticAdjustment: { type: "string" }, pregnancy: { type: "string" }, breastfeeding: { type: "string" }, adverseEffects: { type: "string" }, interactions: { type: "string" }, monitoring: { type: "string" }, mechanism: { type: "string" }, references: { type: "array", items: { type: "string" } }, guidelineReferences: { type: "array", items: { type: "string" } }, flashcardReferences: { type: "array", items: { type: "string" } }, quizReferences: { type: "array", items: { type: "string" } }, calculatorReferences: { type: "array", items: { type: "string" } }, flowchartReferences: { type: "array", items: { type: "string" } }, imageReferences: { type: "array", items: { type: "string" } }, notes: { type: "string" }, summary: { type: "string" } };
const drugSchema = { type: "object", properties: { drug: { type: "object", properties: drugProperties, required: Object.keys(drugProperties).filter((field) => !["id", "slug"].includes(field)), additionalProperties: false }, provenance: { type: "array", items: { type: "object", properties: { sourceId: { type: "string" }, title: { type: "string" }, organization: { type: "string" }, year: { type: "integer" }, url: { type: "string" }, pages: { type: "string" }, sections: { type: "array", items: { type: "string" } } }, required: ["sourceId", "title", "organization", "year", "url", "pages", "sections"], additionalProperties: false } } }, required: ["drug", "provenance"], additionalProperties: false };
const tableCellSchema = { type: "object", properties: { text: { type: "string" }, colSpan: { type: "integer" }, rowSpan: { type: "integer" }, backgroundColor: { type: "string" }, textColor: { type: "string" }, textAlign: { type: "string", enum: ["left", "center", "right"] }, fontWeight: { type: "string", enum: ["normal", "bold"] } }, required: ["text", "colSpan", "rowSpan", "backgroundColor", "textColor", "textAlign", "fontWeight"], additionalProperties: false };
const commonGuidanceSchema = { type: "object", properties: { why: { type: "string" }, indications: { type: "string" }, contraindications: { type: "string" }, cautions: { type: "string" }, monitoring: { type: "string" }, initiation: { type: "string" }, titration: { type: "string" }, problemSolving: { type: "string" } }, required: ["why", "indications", "contraindications", "cautions", "monitoring", "initiation", "titration", "problemSolving"], additionalProperties: false };
const guidelineTableSchema = { type: "object", properties: { guideline: { type: "object", properties: { id: { type: "string" }, slug: { type: "string" }, title: { type: "string" }, titleVi: { type: "string" }, organization: { type: "string" }, publicationYear: { type: "integer" }, version: { type: "string" }, specialty: { type: "string" }, topics: { type: "array", items: { type: "string" } }, summary: { type: "string" }, sourceUrl: { type: "string" } }, required: ["id", "slug", "title", "titleVi", "organization", "publicationYear", "version", "specialty", "topics", "summary", "sourceUrl"], additionalProperties: false }, table: { type: "object", properties: { name: { type: "string" }, number: { type: "string" }, page: { type: "string" }, section: { type: "string" } }, required: ["name", "number", "page", "section"], additionalProperties: false }, commonGuidance: commonGuidanceSchema, rows: { type: "array", items: { type: "object", properties: { drugName: { type: "string" }, drugId: { type: "string" }, drugClass: { type: "string" }, brandNames: { type: "array", items: { type: "string" } }, indications: { type: "string" }, dose: { type: "string" }, startingDose: { type: "string" }, targetDose: { type: "string" }, frequency: { type: "string" }, route: { type: "string" }, notes: { type: "string" }, renalAdjustment: { type: "string" }, hepaticAdjustment: { type: "string" }, contraindications: { type: "string" }, monitoring: { type: "string" }, clinicalContext: { type: "string" }, relationType: { type: "string" }, page: { type: "string" }, section: { type: "string" }, tableCells: { type: "array", items: tableCellSchema } }, required: ["drugName", "drugId", "drugClass", "brandNames", "indications", "dose", "startingDose", "targetDose", "frequency", "route", "notes", "renalAdjustment", "hepaticAdjustment", "contraindications", "monitoring", "clinicalContext", "relationType", "page", "section", "tableCells"], additionalProperties: false } }, provenance: { type: "array", items: { type: "object", properties: { guidelineId: { type: "string" }, title: { type: "string" }, tableName: { type: "string" }, tableNumber: { type: "string" }, page: { type: "string" }, section: { type: "string" }, documentTitle: { type: "string" }, publicationYear: { type: "integer" }, organization: { type: "string" }, url: { type: "string" } }, required: ["guidelineId", "title", "tableName", "tableNumber", "page", "section", "documentTitle", "publicationYear", "organization", "url"], additionalProperties: false } } }, required: ["guideline", "table", "commonGuidance", "rows", "provenance"], additionalProperties: false };

function decodeXml(value) { return String(value).replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCodePoint(Number.parseInt(code, 16))).replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code))).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"); }
function cleanName(value) { return String(value || "document").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180); }
function extension(file) { return String(file?.originalname || "").toLowerCase().split(".").pop(); }

async function extractDocxText(file) {
  let xml;
  try { ({ stdout: xml } = await execFileAsync("unzip", ["-p", file.path, "word/document.xml"], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 })); }
  catch { throw new Error("DOCX không đọc được. Hãy kiểm tra file có phải Word .docx hợp lệ không."); }
  const text = String(xml).replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n").replace(/<\/w:tc>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, (_m, value) => decodeXml(value)).replace(/<[^>]+>/g, "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("DOCX không có văn bản để trích xuất.");
  return text;
}

async function extractPdfText(file) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: new Uint8Array(await readFile(file.path)), disableWorker: true, useSystemFonts: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || "").join(" ").replace(/\s+/g, " ").trim());
  }
  const text = pages.filter(Boolean).join("\n\n").trim();
  if (text) return { text, ocrUsed: false };
  try {
    const { createCanvas } = await import("@napi-rs/canvas");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const ocrPages = [];
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 10); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const result = await worker.recognize(canvas.toBuffer("image/png"));
      if (result.data.text?.trim()) ocrPages.push(result.data.text.trim());
    }
    await worker.terminate();
    const ocrText = ocrPages.join("\n\n").trim();
    if (ocrText) return { text: ocrText, ocrUsed: true };
  } catch { /* scan OCR is optional; return a clear error below */ }
  throw new Error("Không trích xuất được văn bản. Tài liệu có thể là bản scan không đọc được.");
}

export async function extractDrugDocumentText(file) {
  const bytes = await readFile(file.path);
  const ext = extension(file);
  const isPdf = ext === "pdf" && bytes.subarray(0, 4).toString() === "%PDF";
  const isDocx = ext === "docx" && bytes.subarray(0, 2).toString() === "PK";
  if (!isPdf && !isDocx) throw new Error("Chỉ hỗ trợ PDF hoặc DOCX hợp lệ.");
  const extracted = isPdf ? await extractPdfText(file) : { text: await extractDocxText(file), ocrUsed: false };
  return { text: extracted.text, ocrUsed: extracted.ocrUsed, sourceType: isPdf ? "pdf" : "docx", originalFileName: cleanName(file.originalname), characterCount: extracted.text.length };
}

export function validateDrugRecord(drug) {
  const errors = [];
  const warnings = [];
  if (drug?.slug && (typeof drug.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(drug.slug.trim()))) errors.push("slug: không đúng định dạng.");
  if (typeof drug?.genericName !== "string" || !drug.genericName.trim()) errors.push("genericName: bắt buộc và không được để trống.");
  for (const field of textFields) if (drug?.[field] !== undefined && typeof drug[field] !== "string") errors.push(`${field}: phải là chuỗi.`);
  for (const field of arrayFields) if (drug?.[field] !== undefined && (!Array.isArray(drug[field]) || drug[field].some((item) => typeof item !== "string"))) errors.push(`${field}: phải là mảng chuỗi.`);
  for (const field of objectArrayFields) if (drug?.[field] !== undefined && (!Array.isArray(drug[field]) || drug[field].some((item) => !item || typeof item !== "object" || Array.isArray(item)))) errors.push(`${field}: phải là mảng object.`);
  if (drug?.status && drug.status !== "draft") errors.push("status: import chỉ được lưu dưới dạng draft.");
  if (drug?.sourceVerified === true) errors.push("sourceVerified: import không được tự đánh dấu đã xác minh.");
  if (!String(drug?.dosing || "").trim()) warnings.push("Chưa có liều dùng.");
  if (!String(drug?.references?.length ? "x" : "").trim()) warnings.push("Chưa có nguồn tham khảo.");
  return { errors, warnings };
}

export function parseDrugJsonPayload(payload) {
  let parsed;
  try { parsed = typeof payload === "string" ? JSON.parse(payload) : payload; }
  catch (error) { const message = error instanceof SyntaxError ? error.message : "JSON không hợp lệ."; throw Object.assign(new Error(`JSON không hợp lệ: ${message}`), { status: 422 }); }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "drugs" in parsed && !Array.isArray(parsed.drugs)) throw Object.assign(new Error("Trường drugs phải là một mảng thuốc."), { status: 422 });
  const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.drugs) ? parsed.drugs : [parsed];
  if (!records.length || records.some((record) => !record || typeof record !== "object" || Array.isArray(record))) throw Object.assign(new Error("JSON phải là một object thuốc, một mảng thuốc hoặc object có trường drugs."), { status: 422 });
  const seenIds = new Set(); const seenSlugs = new Set();
  return records.map((drug, index) => {
    const validation = validateDrugRecord(drug);
    if (drug.id && seenIds.has(drug.id)) validation.errors.push(`id: trùng trong batch ở bản ghi ${index + 1}.`); else if (drug.id) seenIds.add(drug.id);
    if (drug.slug && seenSlugs.has(drug.slug)) validation.errors.push(`slug: trùng trong batch ở bản ghi ${index + 1}.`); else if (drug.slug) seenSlugs.add(drug.slug);
    return { candidateId: `json-${index + 1}`, sourceType: "json", sourceMetadata: {}, parsedDrug: { ...drug, status: "draft", sourceVerified: false }, validationErrors: validation.errors, validationWarnings: validation.warnings, duplicateStatus: "new_record", importStatus: validation.errors.length ? "invalid" : "ready" };
  });
}

export function validateGuidelineTableBundle(bundle) {
  const errors = [];
  const warnings = [];
  if (!bundle?.guideline || typeof bundle.guideline !== "object") errors.push("guideline: thiếu nội dung guideline chung.");
  if (!String(bundle?.guideline?.title || "").trim()) errors.push("guideline.title: bắt buộc.");
  if (!Array.isArray(bundle?.rows) || bundle.rows.length === 0) errors.push("rows: không nhận diện được dòng thuốc nào.");
  const seen = new Set();
  for (const [index, row] of (Array.isArray(bundle?.rows) ? bundle.rows : []).entries()) {
    if (!String(row?.drugName || "").trim()) errors.push(`rows[${index}].drugName: bắt buộc.`);
    const key = String(row?.drugName || "").trim().toLocaleLowerCase();
    if (key && seen.has(key)) warnings.push(`rows[${index}].drugName: hoạt chất xuất hiện nhiều lần; cần kiểm tra bảng.`);
    if (key) seen.add(key);
    if (!String(row?.dose || "").trim()) warnings.push(`rows[${index}].dose: chưa nhận diện được liều.`);
  }
  if (!Array.isArray(bundle?.provenance) || bundle.provenance.length === 0) warnings.push("provenance: chưa có nguồn đầy đủ cho bảng.");
  if (!bundle?.commonGuidance || typeof bundle.commonGuidance !== "object") warnings.push("commonGuidance: chưa nhận diện được hướng dẫn chung của nhóm thuốc.");
  else for (const field of ["why", "indications", "contraindications", "cautions", "monitoring", "initiation", "titration", "problemSolving"]) if (bundle.commonGuidance[field] !== undefined && typeof bundle.commonGuidance[field] !== "string") errors.push(`commonGuidance.${field}: phải là chuỗi.`);
  return { errors, warnings };
}

function splitTextIntoChunks(text, maxChars) {
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > maxChars) {
    const boundary = remaining.lastIndexOf("\n", maxChars);
    const splitAt = boundary > Math.floor(maxChars * 0.6) ? boundary : maxChars;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function mergeAiResults(results) {
  const drugs = results.map((item) => item?.drug || {}).filter((drug) => drug && typeof drug === "object");
  const merged = { ...(drugs[0] || {}) };
  const warnings = [];
  for (const field of textFields) {
    const values = [...new Set(drugs.map((drug) => String(drug[field] || "").trim()).filter(Boolean))];
    if (values.length > 1) warnings.push(`Có nhiều giá trị khác nhau ở trường ${field}; đã giữ tất cả để rà soát.`);
    if (values.length) merged[field] = values.join("\n\n");
  }
  for (const field of arrayFields) merged[field] = [...new Set(drugs.flatMap((drug) => Array.isArray(drug[field]) ? drug[field].filter((item) => typeof item === "string" && item.trim()) : []))];
  const provenance = results.flatMap((item) => Array.isArray(item?.provenance) ? item.provenance : []);
  return { drug: merged, provenance, warnings };
}

function mergeGuidelineTableResults(results) {
  const first = results.find((item) => item?.guideline) || {};
  const rows = results.flatMap((item) => Array.isArray(item?.rows) ? item.rows : []);
  const seenRows = new Set();
  const uniqueRows = rows.filter((row) => {
    const key = [row.drugName, row.dose, row.page, row.section].map((value) => String(value || "").trim().toLocaleLowerCase()).join("|");
    if (!row.drugName || seenRows.has(key)) return false;
    seenRows.add(key);
    return true;
  });
  const provenance = results.flatMap((item) => Array.isArray(item?.provenance) ? item.provenance : []);
  const commonFields = ["why", "indications", "contraindications", "cautions", "monitoring", "initiation", "titration", "problemSolving"];
  const commonGuidance = Object.fromEntries(commonFields.map((field) => [field, [...new Set(results.map((item) => String(item?.commonGuidance?.[field] || "").trim()).filter(Boolean))].join("\n\n")]));
  const seenProvenance = new Set();
  return {
    guideline: first.guideline || {},
    table: first.table || {},
    commonGuidance,
    rows: uniqueRows,
    provenance: provenance.filter((item) => {
      const key = JSON.stringify(item);
      if (seenProvenance.has(key)) return false;
      seenProvenance.add(key);
      return true;
    }),
  };
}

export async function extractDrugWithAi({ text, drugName, sourceMetadata = {} }) {
  if (!String(text || "").trim()) throw Object.assign(new Error("Chưa có văn bản nguồn để AI trích xuất."), { status: 422 });
  if (String(text).length > MAX_AI_TEXT_CHARS) throw Object.assign(new Error("Văn bản quá dài cho một phiên xử lý. Hãy chia tài liệu thành các phần nhỏ hơn."), { status: 413 });
  const chunks = splitTextIntoChunks(String(text), AI_CHUNK_CHARS);
  const results = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const prompt = buildDrugExtractionPrompt({ text: chunk, drugName, sourceMetadata, chunkIndex: index, chunkCount: chunks.length });
    const result = await generateStructuredFromFile({ file: { buffer: Buffer.from(chunk, "utf8"), size: Buffer.byteLength(chunk, "utf8"), mimetype: "text/plain", originalname: "drug-source.txt" }, prompt, schema: drugSchema, maxOutputTokens: 12_000, timeoutMs: 120_000 });
    results.push(result);
  }
  const merged = mergeAiResults(results);
  return { result: { drug: merged.drug, provenance: merged.provenance }, warnings: merged.warnings, chunksProcessed: chunks.length, aiModel: AI_MODEL, promptVersion: DRUG_IMPORT_PROMPT_VERSION };
}

export async function extractGuidelineTableWithAi({ text, sourceMetadata = {} }) {
  if (!String(text || "").trim()) throw Object.assign(new Error("Chưa có văn bản guideline để trích xuất."), { status: 422 });
  if (String(text).length > MAX_AI_TEXT_CHARS) throw Object.assign(new Error("Văn bản guideline quá dài cho một phiên xử lý. Hãy chia tài liệu thành các phần nhỏ hơn."), { status: 413 });
  const chunks = splitTextIntoChunks(String(text), AI_CHUNK_CHARS);
  const results = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const prompt = buildGuidelineTableExtractionPrompt({ text: chunk, sourceMetadata, chunkIndex: index, chunkCount: chunks.length });
    results.push(await generateStructuredFromFile({ file: { buffer: Buffer.from(chunk, "utf8"), size: Buffer.byteLength(chunk, "utf8"), mimetype: "text/plain", originalname: "guideline-source.txt" }, prompt, schema: guidelineTableSchema, maxOutputTokens: 16_000, timeoutMs: 120_000 }));
  }
  return { result: mergeGuidelineTableResults(results), chunksProcessed: chunks.length, aiModel: AI_MODEL, promptVersion: DRUG_IMPORT_PROMPT_VERSION };
}
