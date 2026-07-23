import express from "express";
import multer from "multer";
import os from "node:os";
import { unlink } from "node:fs/promises";
import { requireDrugImportAdmin } from "../middleware/drugAdmin.js";
import { consumeAiCall } from "../services/aiUsage.js";
import { extractDrugDocumentText, extractDrugWithAi, extractGuidelineTableWithAi, parseDrugJsonPayload, validateDrugRecord, validateGuidelineTableBundle } from "../services/drugImport.js";

const router = express.Router();
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: MAX_FILE_BYTES, files: 1 } });

async function cleanup(file) { if (file?.path) await unlink(file.path).catch(() => null); }

router.post("/parse-json", requireDrugImportAdmin, (req, res) => {
  try { return res.json({ success: true, candidates: parseDrugJsonPayload(req.body?.raw) }); }
  catch (error) { return res.status(error.status || 422).json({ success: false, message: error.message || "Không thể đọc JSON thuốc." }); }
});

router.post("/extract-file", requireDrugImportAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Chưa chọn file PDF hoặc DOCX." });
    const extracted = await extractDrugDocumentText(req.file);
    return res.json({ success: true, data: extracted });
  } catch (error) { return res.status(error.status || 422).json({ success: false, message: error.message || "Không thể trích xuất văn bản tài liệu." }); }
  finally { await cleanup(req.file); }
});

router.post("/extract-ai", requireDrugImportAdmin, async (req, res) => {
  const text = String(req.body?.text || "");
  try {
    const remaining = consumeAiCall();
    if (remaining === null) return res.status(429).json({ success: false, message: "Đã hết lượt AI dùng chung. Hãy chờ quota reset rồi thử lại.", aiCallsRemaining: 0 });
    if (req.body?.documentKind === "guideline_table") {
      const result = await extractGuidelineTableWithAi({ text, sourceMetadata: req.body?.sourceMetadata || {} });
      const validation = validateGuidelineTableBundle(result.result);
      if (validation.errors.length) return res.status(422).json({ success: false, message: validation.errors.join(" "), validation });
      return res.json({ success: true, mode: "guideline_table", bundle: result.result, validation, chunksProcessed: result.chunksProcessed, aiModel: result.aiModel, promptVersion: result.promptVersion, aiCallsRemaining: remaining });
    }
    const result = await extractDrugWithAi({ text, drugName: req.body?.drugName, sourceMetadata: req.body?.sourceMetadata || {} });
    const rawDrug = { ...(result.result?.drug || result.result) };
    const derivedSlug = String(rawDrug.slug || rawDrug.genericName || rawDrug.titleVi || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!rawDrug.id && derivedSlug) rawDrug.id = derivedSlug;
    if (!rawDrug.slug && derivedSlug) rawDrug.slug = derivedSlug;
    const validation = validateDrugRecord(rawDrug);
    const candidate = { candidateId: `ai-${Date.now()}`, sourceType: "ai", sourceMetadata: req.body?.sourceMetadata || {}, rawFileName: req.body?.rawFileName, parsedDrug: { ...rawDrug, status: "draft", sourceVerified: false, provenance: result.result?.provenance || [] }, validationErrors: validation.errors, validationWarnings: [...validation.warnings, ...(result.warnings || [])], duplicateStatus: "new_record", importStatus: validation.errors.length ? "invalid" : "ready", aiMetadata: { importMethod: "ai", originalFileName: req.body?.rawFileName, importedAt: new Date().toISOString(), importedBy: req.drugAdmin?.email, aiGenerated: true, aiModel: result.aiModel, promptVersion: result.promptVersion, sourceDocumentTitle: req.body?.sourceMetadata?.title || "", sourceType: req.body?.sourceMetadata?.type || "" } };
    return res.json({ success: true, candidate, aiCallsRemaining: remaining });
  } catch (error) { return res.status(error.status || 422).json({ success: false, message: error.message || "AI không thể trích xuất dữ liệu thuốc." }); }
});

export default router;
