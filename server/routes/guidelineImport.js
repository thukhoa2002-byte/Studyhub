import express from "express";
import multer from "multer";
import os from "node:os";
import path from "node:path";
import { readFile, unlink } from "node:fs/promises";
import { requireGuidelineAdmin } from "../middleware/guidelineAdmin.js";
import {
  analyzeGuidelineItem,
  checksumFor,
  createDocumentItems,
  extractGuidelineInput,
  findDuplicateRecommendations,
  isSupportedGuidelineFile,
  normalizeImportResult,
  validateImportForBulkImport,
  GUIDELINE_IMPORT_MODEL,
  GUIDELINE_IMPORT_PROMPT_VERSION,
} from "../services/guidelineImport.js";
import { deleteImportObject, supabaseTableRequest, tokenFromRequest, uploadImportObject } from "../services/guidelineImportStore.js";
import { TRANSLATION_PROVIDERS, TRANSLATION_SCOPES, defaultSelection, groupedLocalDiagnostics, initializeItemStates, mandatoryRecommendationCompletion, selectTranslationItems, translationSummary } from "../services/guidelineTranslationPolicy.js";
import { isProviderQuotaError } from "../services/guidelineTranslationProvider.js";

const router = express.Router();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 100 * 1024 * 1024, files: 1 } });

function first(payload) { return Array.isArray(payload) ? payload[0] : payload; }
function jobQuery(req, id) { return { id: `eq.${id}`, owner_id: `eq.${req.guidelineAdmin.id}`, select: "*" }; }
function text(value) { return String(value ?? "").trim(); }
function safeFileName(value) { return path.basename(String(value || "document")).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "document"; }
function errorMessage(error) { return error?.message || "Không thể xử lý phiên import Guideline."; }
function statusCode(error) { return Number.isInteger(error?.status) ? error.status : 422; }
function translationScope(value) { return TRANSLATION_SCOPES.includes(value) ? value : "clinical_essentials"; }
function translationProvider(value) { return TRANSLATION_PROVIDERS.includes(value) ? value : "gemini"; }
function itemStates(metadata) { return metadata?.itemStates && typeof metadata.itemStates === "object" ? metadata.itemStates : {}; }
function parseResumeToken(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? { itemIds: parsed, translationScope: "clinical_essentials", translationProvider: "gemini" } : { itemIds: Array.isArray(parsed?.itemIds) ? parsed.itemIds : [], translationScope: translationScope(parsed?.translationScope), translationProvider: translationProvider(parsed?.translationProvider) };
  } catch { return { itemIds: [], translationScope: "clinical_essentials", translationProvider: "gemini" }; }
}

async function readJobData(req, id) {
  const token = tokenFromRequest(req);
  const job = first(await supabaseTableRequest("guideline_import_jobs", token, { query: jobQuery(req, id) }));
  if (!job) return null;
  const [documents, sections, recommendations, issues, terminology, events] = await Promise.all([
    supabaseTableRequest("guideline_import_documents", token, { query: { job_id: `eq.${id}`, owner_id: `eq.${req.guidelineAdmin.id}`, select: "*" } }),
    supabaseTableRequest("guideline_import_sections", token, { query: { job_id: `eq.${id}`, select: "*", order: "display_order.asc" } }),
    supabaseTableRequest("guideline_import_recommendations", token, { query: { job_id: `eq.${id}`, select: "*", order: "display_order.asc,created_at.asc" } }),
    supabaseTableRequest("guideline_import_issues", token, { query: { job_id: `eq.${id}`, select: "*", order: "created_at.asc" } }),
    supabaseTableRequest("guideline_import_terminology", token, { query: { job_id: `eq.${id}`, select: "*", order: "source_term.asc" } }),
    supabaseTableRequest("guideline_import_events", token, { query: { job_id: `eq.${id}`, select: "*", order: "created_at.desc", limit: "50" } }),
  ]);
  return { job, document: documents?.[0] || null, sections: sections || [], recommendations: recommendations || [], issues: issues || [], terminology: terminology || [], events: events || [] };
}

async function updateJob(req, id, patch) {
  return first(await supabaseTableRequest("guideline_import_jobs", tokenFromRequest(req), { method: "PATCH", query: { id: `eq.${id}`, owner_id: `eq.${req.guidelineAdmin.id}` }, body: patch }));
}

async function addEvent(req, jobId, eventType, stage, payload = {}) {
  await supabaseTableRequest("guideline_import_events", tokenFromRequest(req), { method: "POST", body: { job_id: jobId, actor_id: req.guidelineAdmin.id, event_type: eventType, stage, payload } });
}

function coreCondition(value) {
  return ["ACS", "HF", "AF", "Khác"].includes(value) ? value : "Khác";
}

function slugify(value) {
  return String(value || "guideline").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guideline";
}

async function processJob(req, jobId, selectedItemIds, requestedScope = "clinical_essentials", requestedProvider = "gemini") {
  const token = tokenFromRequest(req);
  const data = await readJobData(req, jobId);
  if (!data?.document) throw new Error("Không tìm thấy tài liệu import.");
  const items = Array.isArray(data.job.analysis_metadata?.items) ? data.job.analysis_metadata.items : [];
  const scope = translationScope(requestedScope);
  const provider = translationProvider(requestedProvider);
  const states = { ...itemStates(data.job.analysis_metadata) };
  const selected = selectTranslationItems(items, selectedItemIds, scope, states);
  const persistMetadata = (extra = {}) => ({
    ...(data.job.analysis_metadata || {}),
    ...extra,
    translationScope: scope,
    translationProvider: provider,
    selectedItemIds,
    itemStates: states,
    translationSummary: translationSummary(items, selectedItemIds, scope, states),
  });
  if (!selected.length) {
    const completion = mandatoryRecommendationCompletion(items, states);
    await updateJob(req, jobId, {
      status: completion.complete ? "ready_for_review" : "paused",
      current_stage: completion.complete ? "review" : "mandatory_tables_pending",
      progress: completion.complete ? 100 : Math.max(25, data.job.progress || 0),
      analysis_metadata: persistMetadata(),
    });
    return;
  }
  for (const item of selected) states[item.id] = { ...(states[item.id] || {}), status: "queued", selected: true, sourceHash: item.sourceHash, provider, model: provider === "openai" ? (process.env.OPENAI_GUIDELINE_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini") : GUIDELINE_IMPORT_MODEL, attemptCount: Number(states[item.id]?.attemptCount || 0) };
  await updateJob(req, jobId, { status: "processing", current_stage: "ai_extraction", progress: 5, error_message: "", started_at: new Date().toISOString(), resume_token: JSON.stringify({ itemIds: selectedItemIds, translationScope: scope, translationProvider: provider }), analysis_metadata: persistMetadata() });
  await addEvent(req, jobId, "processing_started", "ai_extraction", { itemCount: selected.length, translationScope: scope, provider, model: GUIDELINE_IMPORT_MODEL, promptVersion: GUIDELINE_IMPORT_PROMPT_VERSION });

  const sourceText = String(data.document.extracted_text || "");
  let discoveredDocument = { ...(data.job.analysis_metadata?.document || {}) };
  const existingSections = await supabaseTableRequest("guideline_import_sections", token, { query: { job_id: `eq.${jobId}`, select: "*", order: "display_order.asc" } });
  const sectionByKey = new Map((existingSections || []).map((section) => [section.source_key, section]));
  const sectionByTitle = new Map((existingSections || []).map((section) => [text(section.title_original).toLocaleLowerCase(), section]));
  let latestRecommendations = await supabaseTableRequest("guideline_import_recommendations", token, { query: { job_id: `eq.${jobId}`, select: "*" } });
  let tableTranslations = { ...(data.job.analysis_metadata?.tableTranslations || {}) };

  for (const [index, item] of selected.entries()) {
    try {
      states[item.id] = { ...(states[item.id] || {}), status: "processing", attemptCount: Number(states[item.id]?.attemptCount || 0) + 1 };
      await updateJob(req, jobId, { analysis_metadata: persistMetadata({ tableTranslations }) });
      const itemText = sourceText.slice(Number(item.startOffset || 0), Number(item.endOffset || sourceText.length));
      let result;
      let usedProvider = provider;
      try {
        result = normalizeImportResult(await analyzeGuidelineItem({
          text: itemText, item, sourceMetadata: { fileName: data.document.original_filename },
          sourceLanguage: data.job.source_language, targetLanguage: data.job.target_language,
          preserveAbbreviations: data.job.preserve_abbreviations, preserveEnglishTerminology: data.job.preserve_english_terminology,
          provider: provider === "gemini_then_openai" ? "gemini" : provider,
        }));
      } catch (error) {
        if (provider === "gemini_then_openai" && isProviderQuotaError(error)) {
          usedProvider = "openai";
          await addEvent(req, jobId, "provider_fallback", "ai_extraction", { itemId: item.id, from: "gemini", to: "openai", reason: "quota_exhausted" });
          result = normalizeImportResult(await analyzeGuidelineItem({
            text: itemText, item, sourceMetadata: { fileName: data.document.original_filename },
            sourceLanguage: data.job.source_language, targetLanguage: data.job.target_language,
            preserveAbbreviations: data.job.preserve_abbreviations, preserveEnglishTerminology: data.job.preserve_english_terminology, provider: "openai",
          }));
        } else throw error;
      }
      discoveredDocument = {
        ...discoveredDocument,
        title: result.document.title || discoveredDocument.title || "",
        organization: result.document.organization || discoveredDocument.organization || "",
        year: result.document.year || discoveredDocument.year || null,
        version: result.document.version || discoveredDocument.version || "",
        sourceLanguage: result.document.sourceLanguage || discoveredDocument.sourceLanguage || data.job.source_language,
      };
      tableTranslations = { ...tableTranslations, [item.id]: result.tables || [] };
      states[item.id] = { ...(states[item.id] || {}), status: "translated", translatedAt: new Date().toISOString(), provider: usedProvider, model: usedProvider === "openai" ? (process.env.OPENAI_GUIDELINE_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini") : GUIDELINE_IMPORT_MODEL, errorCode: null, errorMessage: null };
      await updateJob(req, jobId, { analysis_metadata: persistMetadata({ document: discoveredDocument, tableTranslations }) });
      for (const [sectionIndex, section] of result.sections.entries()) {
        const key = `${item.id}:${section.sourceKey}`;
        const titleKey = text(section.titleOriginal || section.titleVi).toLocaleLowerCase();
        let current = sectionByKey.get(key) || (titleKey && sectionByTitle.get(titleKey));
        if (!current) {
          const parent = section.parentSourceKey ? sectionByKey.get(`${item.id}:${section.parentSourceKey}`) : null;
          current = first(await supabaseTableRequest("guideline_import_sections", token, { method: "POST", body: {
            job_id: jobId,
            parent_section_id: parent?.id || null,
            source_key: key,
            title_original: section.titleOriginal,
            title_vi: section.titleVi,
            summary_original: section.summaryOriginal,
            summary_vi: section.summaryVi,
            level: section.level,
            source_page: section.sourcePage,
            source_anchor: section.sourceAnchor,
            display_order: section.displayOrder + index * 1000 + sectionIndex,
            review_status: "pending",
            original_payload: section,
          } }));
          sectionByKey.set(key, current);
          if (titleKey) sectionByTitle.set(titleKey, current);
        }
      }
      const insertedRecommendations = [];
      for (const [recommendationIndex, recommendation] of result.recommendations.entries()) {
        const section = sectionByKey.get(`${item.id}:${recommendation.sectionSourceKey}`) || sectionByTitle.get(text(recommendation.sectionSourceKey).toLocaleLowerCase());
        const sourceKey = `${item.id}:${recommendation.sourceKey}`;
        const existingRecommendation = (latestRecommendations || []).find((candidate) => candidate.source_key === sourceKey);
        const recommendationPayload = {
          import_section_id: section?.id || null,
          source_key: sourceKey,
          title_original: recommendation.titleOriginal,
          recommendation_text_original: recommendation.recommendationTextOriginal,
          recommendation_text_vi: recommendation.recommendationTextVi,
          rationale_vi: recommendation.rationaleVi,
          recommendation_class: recommendation.recommendationClass,
          evidence_level: recommendation.evidenceLevel,
          evidence_system: recommendation.evidenceSystem,
          population: recommendation.population || "",
          intervention: recommendation.intervention || "",
          comparator: recommendation.comparator || "",
          outcome: recommendation.outcome || "",
          conditions: recommendation.conditions || "",
          contraindications: recommendation.contraindications || "",
          source_page: recommendation.sourcePage,
          source_quote: recommendation.sourceQuote,
          source_anchor: recommendation.sourceAnchor,
          coordinates: recommendation.coordinates || {},
          confidence: recommendation.confidence,
          review_status: existingRecommendation?.review_status || "pending",
          verification_status: existingRecommendation?.verification_status || "unverified",
          display_order: recommendation.displayOrder + index * 1000 + recommendationIndex,
          original_payload: recommendation,
        };
        const created = first(await supabaseTableRequest("guideline_import_recommendations", token, existingRecommendation
          ? { method: "PATCH", query: { id: `eq.${existingRecommendation.id}` }, body: recommendationPayload }
          : { method: "POST", body: { job_id: jobId, ...recommendationPayload } }));
        insertedRecommendations.push(created);
        if (!section) result.issues.push({ severity: "blocking", code: "missing_section", message: `Không ghép được section cho ${recommendation.sourceKey}.`, sourcePage: recommendation.sourcePage });
        if (recommendation.confidence != null && recommendation.confidence < 0.75) result.issues.push({ severity: "warning", code: "low_confidence", message: `Độ tin cậy thấp ở ${recommendation.sourceKey}.`, sourcePage: recommendation.sourcePage });
        if (recommendation.recommendationTextOriginal && recommendation.recommendationTextVi && /\d/.test(recommendation.recommendationTextOriginal) && !/\d/.test(recommendation.recommendationTextVi)) result.issues.push({ severity: "blocking", code: "number_mismatch", message: `Bản dịch của ${recommendation.sourceKey} không giữ số liệu nguồn.`, sourcePage: recommendation.sourcePage });
      }
      for (const issue of result.issues) {
        await supabaseTableRequest("guideline_import_issues", token, { method: "POST", body: { job_id: jobId, recommendation_id: insertedRecommendations[0]?.id || null, severity: issue.severity, issue_code: issue.code, message: issue.message, source_page: issue.sourcePage } });
      }
      for (const term of result.terminology) {
        const existing = await supabaseTableRequest("guideline_import_terminology", token, { query: { job_id: `eq.${jobId}`, source_term: `eq.${term.sourceTerm}`, select: "id,locked" } });
        if (!existing?.length) await supabaseTableRequest("guideline_import_terminology", token, { method: "POST", body: { job_id: jobId, source_term: term.sourceTerm, preferred_translation: term.preferredTranslation, created_by: req.guidelineAdmin.id } });
      }
      latestRecommendations = await supabaseTableRequest("guideline_import_recommendations", token, { query: { job_id: `eq.${jobId}`, select: "*" } });
      const duplicates = await findDuplicateRecommendations(token, data.job.target_guideline_id, latestRecommendations || []);
      for (const recommendation of latestRecommendations || []) if (duplicates.get(recommendation.id)) await supabaseTableRequest("guideline_import_recommendations", token, { method: "PATCH", query: { id: `eq.${recommendation.id}` }, body: { duplicate_status: "exact", duplicate_target_id: duplicates.get(recommendation.id) } });
      await updateJob(req, jobId, { progress: Math.min(95, Math.round(((index + 1) / selected.length) * 90) + 5), processed_pages: item.pageEnd || item.pageStart || 0, current_stage: "review" });
      await addEvent(req, jobId, "item_processed", "review", { itemId: item.id, provider: usedProvider, sections: result.sections.length, recommendations: result.recommendations.length, tables: result.tables.length, issues: result.issues.length });
    } catch (error) {
      const quotaExhausted = isProviderQuotaError(error);
      states[item.id] = { ...(states[item.id] || {}), status: "failed_retryable", errorCode: quotaExhausted ? "provider_quota_exhausted" : "provider_error", errorMessage: errorMessage(error) };
      await updateJob(req, jobId, { analysis_metadata: persistMetadata({ tableTranslations }) }).catch(() => null);
      await supabaseTableRequest("guideline_import_issues", token, { method: "POST", body: { job_id: jobId, severity: quotaExhausted ? "warning" : "error", issue_code: quotaExhausted ? "provider_quota_exhausted" : "processing_error", message: errorMessage(error) } }).catch(() => null);
      await addEvent(req, jobId, quotaExhausted ? "processing_paused_quota" : "item_processing_failed", quotaExhausted ? "quota_paused" : "review", { itemId: item.id, message: errorMessage(error) }).catch(() => null);
      if (quotaExhausted) {
        await updateJob(req, jobId, { status: "paused", current_stage: "quota_paused", error_message: errorMessage(error), analysis_metadata: persistMetadata({ tableTranslations }) }).catch(() => null);
        return;
      }
    }
  }
  const finalData = await readJobData(req, jobId);
  const completion = mandatoryRecommendationCompletion(items, itemStates(finalData?.job?.analysis_metadata));
  const pending = selectTranslationItems(items, selectedItemIds, scope, itemStates(finalData?.job?.analysis_metadata));
  await updateJob(req, jobId, { status: completion.complete && pending.length === 0 ? "ready_for_review" : "paused", current_stage: completion.complete && pending.length === 0 ? "review" : "mandatory_tables_pending", progress: completion.complete && pending.length === 0 ? 100 : 95, completed_at: completion.complete && pending.length === 0 ? new Date().toISOString() : null });
  await addEvent(req, jobId, "processing_completed", "review", { selectedItemIds: selectedItemIds.length, pendingItemIds: pending.map((item) => item.id) });
}

async function importAccepted(req, jobId) {
  const token = tokenFromRequest(req);
  const data = await readJobData(req, jobId);
  if (!data) throw new Error("Import job không tồn tại.");
  const errors = validateImportForBulkImport(data.job, data.sections, data.recommendations, data.issues);
  if (errors.length) throw Object.assign(new Error(errors.join(" ")), { status: 422, validationErrors: errors });
  if (data.job.status === "completed") throw new Error("Import job này đã hoàn tất và không được import lần nữa.");
  await updateJob(req, jobId, { status: "importing", current_stage: "core_import", progress: 5 });
  await addEvent(req, jobId, "bulk_import_started", "core_import");
  let guidelineId = data.job.target_guideline_id;
  const metadata = data.job.analysis_metadata || {};
  const document = data.document;
  if (!guidelineId) {
    const title = text(metadata.document?.title) || text(document.original_filename).replace(/\.[^.]+$/, "") || "Guideline import";
    const created = first(await supabaseTableRequest("guideline_documents", token, { method: "POST", body: {
      owner_id: req.guidelineAdmin.id,
      title,
      society: text(metadata.document?.organization),
      condition: coreCondition(metadata.document?.condition),
      publication_year: Number.isInteger(metadata.document?.year) && metadata.document.year >= 1900 && metadata.document.year <= 2200 ? metadata.document.year : null,
      version_label: text(metadata.document?.version) || "",
      source_url: null,
      doi: null,
      citation: `Imported from ${document.original_filename}`,
      provenance: [{ filename: document.original_filename, checksum: document.checksum, pages: document.page_count, importedAt: new Date().toISOString() }],
      summary: text(metadata.document?.summary),
      topics: [],
      visibility: "private",
      status: "draft",
    } }));
    guidelineId = created?.id;
  }
  if (!guidelineId) throw new Error("Không tạo được Guideline Core draft.");
  const acceptedSections = data.sections.filter((section) => section.review_status === "accepted");
  const acceptedRecommendations = data.recommendations.filter((recommendation) => recommendation.review_status === "accepted");
  const coreSectionByImportId = new Map();
  for (const section of [...acceptedSections].sort((a, b) => a.level - b.level || a.display_order - b.display_order)) {
    const parentId = section.parent_section_id ? coreSectionByImportId.get(section.parent_section_id) || null : null;
    const created = first(await supabaseTableRequest("guideline_sections", token, { method: "POST", body: {
      guideline_id: guidelineId,
      owner_id: req.guidelineAdmin.id,
      parent_section_id: parentId,
      slug: slugify(section.title_vi || section.title_original),
      section_number: "",
      title: section.title_original || section.title_vi || "Section",
      title_vi: section.title_vi || section.title_original || "Section",
      summary: section.summary_vi || section.summary_original || "",
      display_order: section.display_order,
      status: "draft",
    } }));
    coreSectionByImportId.set(section.id, created?.id);
  }
  for (const recommendation of acceptedRecommendations) {
    const sectionId = recommendation.import_section_id ? coreSectionByImportId.get(recommendation.import_section_id) || null : null;
    await supabaseTableRequest("guideline_recommendations", token, { method: "POST", body: {
      guideline_id: guidelineId,
      section_id: sectionId,
      owner_id: req.guidelineAdmin.id,
      title: recommendation.title_original,
      recommendation_text_original: recommendation.recommendation_text_original,
      recommendation_text_vi: recommendation.recommendation_text_vi,
      rationale_vi: recommendation.rationale_vi,
      recommendation_class: recommendation.recommendation_class,
      evidence_level: recommendation.evidence_level,
      evidence_system: recommendation.evidence_system,
      population: recommendation.population,
      intervention: recommendation.intervention,
      comparator: recommendation.comparator,
      outcome: recommendation.outcome,
      conditions: recommendation.conditions,
      contraindications: recommendation.contraindications,
      source_page: recommendation.source_page,
      source_quote: recommendation.source_quote,
      source_anchor: recommendation.source_anchor,
      verification_status: "unverified",
      review_note: "Imported as draft; human review required.",
      status: "draft",
      sort_order: recommendation.created_at ? 0 : 0,
    } });
  }
  await supabaseTableRequest("guideline_source_documents", token, { method: "POST", body: { guideline_id: guidelineId, owner_id: req.guidelineAdmin.id, original_filename: document.original_filename, storage_path: `guideline-imports/${document.storage_path}`, mime_type: document.mime_type, source_kind: "primary", checksum: document.checksum, page_count: document.page_count, extraction_status: "completed" } }).catch(() => null);
  await updateJob(req, jobId, { status: "completed", current_stage: "completed", progress: 100, imported_guideline_id: guidelineId, completed_at: new Date().toISOString() });
  await addEvent(req, jobId, "bulk_import_completed", "completed", { guidelineId, sections: acceptedSections.length, recommendations: acceptedRecommendations.length });
  return guidelineId;
}

router.use(requireGuidelineAdmin);

router.get("/jobs", async (req, res) => {
  try {
    const jobs = await supabaseTableRequest("guideline_import_jobs", tokenFromRequest(req), { query: { owner_id: `eq.${req.guidelineAdmin.id}`, select: "id,import_mode,source_language,target_language,status,progress,current_stage,source_metadata,imported_guideline_id,error_message,created_at,updated_at", order: "updated_at.desc", limit: "30" } });
    return res.json({ success: true, jobs: jobs || [] });
  } catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error) }); }
});

router.post("/jobs", upload.single("file"), async (req, res) => {
  const file = req.file;
  const token = tokenFromRequest(req);
  try {
    if (!file || !isSupportedGuidelineFile(file.originalname)) return res.status(415).json({ success: false, message: "Định dạng được hỗ trợ: PDF, DOCX, Markdown, HTML và TXT." });
    const fileBytes = await readFile(file.path);
    const extracted = await extractGuidelineInput(file);
    if (!extracted.text) throw new Error("Không đọc được văn bản trong tài liệu.");
    const scope = translationScope(req.body?.translationScope);
    const provider = translationProvider(req.body?.translationProvider);
    const job = first(await supabaseTableRequest("guideline_import_jobs", token, { method: "POST", body: { owner_id: req.guidelineAdmin.id, target_guideline_id: text(req.body?.targetGuidelineId) || null, import_mode: req.body?.targetGuidelineId ? "existing_guideline" : "create_new", source_language: text(req.body?.sourceLanguage) || "en", target_language: text(req.body?.targetLanguage) || "vi", preserve_english_terminology: req.body?.preserveEnglishTerminology !== "false", preserve_abbreviations: req.body?.preserveAbbreviations !== "false", status: "analysing", current_stage: "document_analysis", progress: 10, source_metadata: { fileName: file.originalname, mimeType: file.mimetype, note: text(req.body?.note) } } }));
    const storagePath = `${req.guidelineAdmin.id}/${job.id}/${safeFileName(file.originalname)}`;
    try { await uploadImportObject(storagePath, { ...file, buffer: fileBytes, size: fileBytes.length }, token); } catch (error) { await supabaseTableRequest("guideline_import_jobs", token, { method: "DELETE", query: { id: `eq.${job.id}` } }).catch(() => null); throw error; }
    const items = createDocumentItems(extracted.text);
    const selectedItemIds = defaultSelection(items, scope);
    const states = initializeItemStates(items, selectedItemIds);
    const diagnostics = groupedLocalDiagnostics(items, states);
    const updatedJob = first(await supabaseTableRequest("guideline_import_jobs", token, { method: "PATCH", query: { id: `eq.${job.id}` }, body: { status: "ready_for_review", current_stage: "selection", progress: 25, total_pages: extracted.pageCount || items.at(-1)?.pageEnd || null, analysis_metadata: { items: items.map(({ text: _text, ...item }) => item), document: { title: "", organization: "", year: null, version: "", condition: "" }, ocrUsed: Boolean(extracted.ocrUsed), sourceType: extracted.sourceType, translationScope: scope, translationProvider: provider, selectedItemIds, itemStates: states, translationSummary: translationSummary(items, selectedItemIds, scope, states), localDiagnostics: diagnostics } } }));
    await supabaseTableRequest("guideline_import_documents", token, { method: "POST", body: { job_id: job.id, owner_id: req.guidelineAdmin.id, original_filename: file.originalname, mime_type: file.mimetype || "application/octet-stream", source_language: text(req.body?.sourceLanguage) || "en", storage_path: storagePath, checksum: checksumFor(fileBytes), file_size: fileBytes.length, page_count: extracted.pageCount || items.at(-1)?.pageEnd || null, ocr_required: Boolean(extracted.ocrUsed), ocr_status: extracted.ocrUsed ? "completed" : "not_started", extracted_text: extracted.text, page_metadata: [] } });
    for (const diagnostic of diagnostics) {
      const mandatoryIncomplete = diagnostic.code === "recommendation_table_incomplete";
      const message = mandatoryIncomplete
        ? `${diagnostic.count} bảng khuyến cáo thiếu nội dung hoặc trang tiếp theo. Cần khôi phục/trà soát trước khi hoàn tất.`
        : diagnostic.code === "duplicate_content"
          ? `${diagnostic.count} mục trùng nội dung được dùng lại checkpoint thay vì gọi AI lần nữa.`
          : `${diagnostic.count} mục không đủ nội dung lâm sàng để dịch tự động.`;
      await supabaseTableRequest("guideline_import_issues", token, { method: "POST", body: { job_id: job.id, severity: mandatoryIncomplete ? "blocking" : "info", issue_code: diagnostic.code, message } });
    }
    await addEvent(req, job.id, "uploaded", "document_analysis", { fileName: file.originalname, itemCount: items.length, ocrUsed: Boolean(extracted.ocrUsed) });
    return res.status(201).json({ success: true, job: updatedJob, items: items.map(({ text: _text, ...item }) => item) });
  } catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error) }); }
  finally { if (file?.path) await unlink(file.path).catch(() => null); }
});

router.get("/jobs/:jobId", async (req, res) => {
  try { const data = await readJobData(req, req.params.jobId); if (!data) return res.status(404).json({ success: false, message: "Không tìm thấy phiên import." }); return res.json({ success: true, ...data }); }
  catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error) }); }
});

router.post("/jobs/:jobId/process", async (req, res) => {
  const selectedItemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.map(String) : [];
  if (!selectedItemIds.length) return res.status(422).json({ success: false, message: "Hãy chọn ít nhất một mục tài liệu." });
  const scope = translationScope(req.body?.translationScope);
  const provider = translationProvider(req.body?.translationProvider);
  try { await updateJob(req, req.params.jobId, { status: "processing", current_stage: "queued", resume_token: JSON.stringify({ itemIds: selectedItemIds, translationScope: scope, translationProvider: provider }) }); void processJob(req, req.params.jobId, selectedItemIds, scope, provider).catch(async (error) => { await updateJob(req, req.params.jobId, { status: "failed", current_stage: "error", error_message: errorMessage(error) }).catch(() => null); }); return res.status(202).json({ success: true, status: "processing", message: "Đã bắt đầu xử lý nền. Có thể đóng tab và quay lại phiên import." }); }
  catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error) }); }
});

router.post("/jobs/:jobId/resume", async (req, res) => {
  try {
    const job = first(await supabaseTableRequest("guideline_import_jobs", tokenFromRequest(req), { query: jobQuery(req, req.params.jobId) }));
    const checkpoint = parseResumeToken(job?.resume_token);
    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.map(String) : checkpoint.itemIds;
    if (!itemIds.length) return res.status(422).json({ success: false, message: "Không có checkpoint để tiếp tục." });
    await updateJob(req, req.params.jobId, { status: "processing", current_stage: "resuming", error_message: "" });
    void processJob(req, req.params.jobId, itemIds, translationScope(req.body?.translationScope || checkpoint.translationScope), translationProvider(req.body?.translationProvider || checkpoint.translationProvider)).catch(async (error) => { await updateJob(req, req.params.jobId, { status: "failed", current_stage: "error", error_message: errorMessage(error) }).catch(() => null); });
    return res.status(202).json({ success: true, status: "processing" });
  } catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error) }); }
});

router.post("/jobs/:jobId/items/:itemId/classification", async (req, res) => {
  try {
    const reason = text(req.body?.reason);
    const classification = text(req.body?.classification || "not_recommendation_table");
    if (!reason) return res.status(422).json({ success: false, message: "Cần ghi rõ lý do điều chỉnh phân loại." });
    if (!["not_recommendation_table", "clinically_important_table"].includes(classification)) return res.status(422).json({ success: false, message: "Loại điều chỉnh phân loại không hợp lệ." });
    const data = await readJobData(req, req.params.jobId);
    if (!data) return res.status(404).json({ success: false, message: "Không tìm thấy phiên import." });
    const items = Array.isArray(data.job.analysis_metadata?.items) ? [...data.job.analysis_metadata.items] : [];
    const index = items.findIndex((item) => item.id === req.params.itemId);
    if (index < 0) return res.status(404).json({ success: false, message: "Không tìm thấy mục cần điều chỉnh." });
    const item = items[index];
    if (item.type !== "table") return res.status(422).json({ success: false, message: "Chỉ bảng mới có thể điều chỉnh phân loại." });
    if (classification === "not_recommendation_table" && !item.mandatory) return res.status(422).json({ success: false, message: "Mục này không phải bảng khuyến cáo bắt buộc." });
    if (classification === "clinically_important_table" && item.mandatory) return res.status(422).json({ success: false, message: "Bảng khuyến cáo đã là nội dung bắt buộc." });
    items[index] = classification === "clinically_important_table"
      ? { ...item, contentType: "clinically_important_table", clinicalImportance: "important", translationEligibility: "automatic", manualReviewRequired: false, mandatory: false, diagnosticCode: "classification_corrected", classificationCorrection: { classification, reason, actorId: req.guidelineAdmin.id, correctedAt: new Date().toISOString() } }
      : { ...item, contentType: "general_table", clinicalImportance: "optional", translationEligibility: "manual_only", manualReviewRequired: true, mandatory: false, diagnosticCode: "classification_corrected", classificationCorrection: { classification, reason, actorId: req.guidelineAdmin.id, correctedAt: new Date().toISOString() } };
    const states = { ...itemStates(data.job.analysis_metadata), [item.id]: { ...(itemStates(data.job.analysis_metadata)[item.id] || {}), status: "pending", errorCode: "classification_corrected", errorMessage: reason, selected: false } };
    const selectedItemIds = classification === "clinically_important_table"
      ? [...new Set([...(data.job.analysis_metadata?.selectedItemIds || []), item.id])]
      : (data.job.analysis_metadata?.selectedItemIds || []).filter((id) => id !== item.id);
    const completion = mandatoryRecommendationCompletion(items, states);
    await updateJob(req, req.params.jobId, { status: data.job.status === "paused" && completion.complete ? "ready_for_review" : data.job.status, current_stage: data.job.status === "paused" && completion.complete ? "selection" : data.job.current_stage, analysis_metadata: { ...(data.job.analysis_metadata || {}), items, itemStates: states, selectedItemIds, translationSummary: translationSummary(items, selectedItemIds, translationScope(data.job.analysis_metadata?.translationScope), states), localDiagnostics: groupedLocalDiagnostics(items, states) } });
    const diagnostics = groupedLocalDiagnostics(items, states);
    await supabaseTableRequest("guideline_import_issues", tokenFromRequest(req), { method: "DELETE", query: { job_id: `eq.${req.params.jobId}`, issue_code: "eq.recommendation_table_incomplete" } }).catch(() => null);
    const remainingMandatoryDiagnostic = diagnostics.find((diagnostic) => diagnostic.code === "recommendation_table_incomplete");
    if (remainingMandatoryDiagnostic) await supabaseTableRequest("guideline_import_issues", tokenFromRequest(req), { method: "POST", body: { job_id: req.params.jobId, severity: "blocking", issue_code: "recommendation_table_incomplete", message: `${remainingMandatoryDiagnostic.count} bảng khuyến cáo thiếu nội dung hoặc trang tiếp theo. Cần khôi phục/trà soát trước khi hoàn tất.` } });
    await addEvent(req, req.params.jobId, "classification_corrected", "selection", { itemId: item.id, from: item.contentType, to: items[index].contentType, reason });
    return res.json({ success: true, item: items[index] });
  } catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error) }); }
});

router.patch("/sections/:sectionId", async (req, res) => {
  try { const section = first(await supabaseTableRequest("guideline_import_sections", tokenFromRequest(req), { query: { id: `eq.${req.params.sectionId}`, select: "*" } })); if (!section) return res.status(404).json({ success: false, message: "Không tìm thấy section import." }); const allowed = {}; for (const key of ["title_original", "title_vi", "summary_original", "summary_vi", "display_order", "review_status"]) if (req.body?.[key] !== undefined) allowed[key] = req.body[key]; const updated = first(await supabaseTableRequest("guideline_import_sections", tokenFromRequest(req), { method: "PATCH", query: { id: `eq.${section.id}` }, body: allowed })); return res.json({ success: true, section: updated }); }
  catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error) }); }
});

router.patch("/recommendations/:recommendationId", async (req, res) => {
  try { const recommendation = first(await supabaseTableRequest("guideline_import_recommendations", tokenFromRequest(req), { query: { id: `eq.${req.params.recommendationId}`, select: "*" } })); if (!recommendation) return res.status(404).json({ success: false, message: "Không tìm thấy khuyến cáo import." }); const allowed = {}; for (const key of ["title_original", "recommendation_text_original", "recommendation_text_vi", "rationale_vi", "recommendation_class", "evidence_level", "evidence_system", "population", "intervention", "comparator", "outcome", "conditions", "contraindications", "source_page", "source_quote", "source_anchor", "review_status", "verification_status"]) if (req.body?.[key] !== undefined) allowed[key] = req.body[key]; const updated = first(await supabaseTableRequest("guideline_import_recommendations", tokenFromRequest(req), { method: "PATCH", query: { id: `eq.${recommendation.id}` }, body: allowed })); return res.json({ success: true, recommendation: updated }); }
  catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error) }); }
});

router.post("/jobs/:jobId/import", async (req, res) => {
  try { const guidelineId = await importAccepted(req, req.params.jobId); return res.status(201).json({ success: true, guidelineId, status: "completed", message: "Đã nhập các mục được duyệt thành Guideline Core draft." }); }
  catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error), validationErrors: error.validationErrors || [] }); }
});

router.delete("/jobs/:jobId", async (req, res) => {
  try { const data = await readJobData(req, req.params.jobId); if (!data) return res.status(404).json({ success: false, message: "Không tìm thấy phiên import." }); await deleteImportObject(data.document?.storage_path, tokenFromRequest(req)); await supabaseTableRequest("guideline_import_jobs", tokenFromRequest(req), { method: "DELETE", query: { id: `eq.${req.params.jobId}`, owner_id: `eq.${req.guidelineAdmin.id}` } }); return res.json({ success: true }); }
  catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error) }); }
});

export default router;
