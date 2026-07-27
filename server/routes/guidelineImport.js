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
import { deleteImportObject, downloadImportObject, supabaseTableRequest, tokenFromRequest, uploadImportObject } from "../services/guidelineImportStore.js";
import { TRANSLATION_PROVIDERS, TRANSLATION_SCOPES, defaultSelection, expectedInventoryForDocument, groupedLocalDiagnostics, initializeItemStates, inventoryDiagnostics, mandatoryRecommendationCompletion, selectTranslationItems, translationSummary } from "../services/guidelineTranslationPolicy.js";
import { isProviderQuotaError } from "../services/guidelineTranslationProvider.js";
import { renderOriginalFigureCrop, normalizeFigureCropBox } from "../services/guidelineFigureAssets.js";
import { figureDisplayModel, normalizeFigurePermissionStatus } from "../services/guidelineFigurePolicy.js";
import { sourceSectionIdentity, validSourcePage, structuralImportDiagnostics } from "../services/guidelineExtractionRecovery.js";

const router = express.Router();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 100 * 1024 * 1024, files: 1 } });

function first(payload) { return Array.isArray(payload) ? payload[0] : payload; }
function jobQuery(req, id) { return { id: `eq.${id}`, owner_id: `eq.${req.guidelineAdmin.id}`, select: "*" }; }
const importJobStatusColumns = "id,status,progress,current_stage,error_message,imported_guideline_id,updated_at";
function text(value) { return String(value ?? "").trim(); }
function safeFileName(value) { return path.basename(String(value || "document")).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "document"; }
function errorMessage(error) { return error?.message || "Không thể xử lý phiên import Guideline."; }
function statusCode(error) { return Number.isInteger(error?.status) ? error.status : 422; }
function translationScope(value) { return TRANSLATION_SCOPES.includes(value) ? value : "clinical_essentials"; }
function translationProvider(value) { return TRANSLATION_PROVIDERS.includes(value) ? value : "gemini"; }
function itemStates(metadata) { return metadata?.itemStates && typeof metadata.itemStates === "object" ? metadata.itemStates : {}; }
function hasMeaningfulCell(value) { return text(value).length > 0; }
function hasCompleteRecommendationTable(tables) {
  return (tables || []).some((table) => {
    const headers = Array.isArray(table?.headersOriginal) ? table.headersOriginal : [];
    const rows = Array.isArray(table?.rows) ? table.rows : [];
    return hasMeaningfulCell(table?.titleOriginal || table?.titleVi)
      && headers.some(hasMeaningfulCell)
      && rows.length > 0
      && rows.every((row) => {
        const original = Array.isArray(row?.cellsOriginal) ? row.cellsOriginal : [];
        const translated = Array.isArray(row?.cellsVi) ? row.cellsVi : [];
        return original.some(hasMeaningfulCell) && translated.some(hasMeaningfulCell);
      });
  });
}
function figureForJob(data, figureId) {
  const figures = data?.job?.analysis_metadata?.figureResources || {};
  return figures[figureId] ? { figures, figure: figures[figureId] } : { figures, figure: null };
}
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
  let latestRecommendations = await supabaseTableRequest("guideline_import_recommendations", token, { query: { job_id: `eq.${jobId}`, select: "*" } });
  let tableTranslations = { ...(data.job.analysis_metadata?.tableTranslations || {}) };
  let figureResources = { ...(data.job.analysis_metadata?.figureResources || {}) };

  for (const [index, item] of selected.entries()) {
    try {
      states[item.id] = { ...(states[item.id] || {}), status: "processing", attemptCount: Number(states[item.id]?.attemptCount || 0) + 1 };
      await updateJob(req, jobId, { analysis_metadata: persistMetadata({ tableTranslations, figureResources }) });
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
      if (item.contentType === "recommendation_table" && !hasCompleteRecommendationTable(result.tables)) {
        throw Object.assign(new Error("Bảng khuyến cáo chưa được trích xuất đủ tiêu đề, cột và hàng. Cần khôi phục bảng hoặc trang tiếp theo trước khi dịch."), {
          code: "recommendation_table_incomplete",
          blocking: true,
        });
      }
      // A clinical table is valuable content, but its rows are not automatically
      // clinical recommendations. Figures never create recommendations either.
      if (item.resourceType === "clinical_table" || item.resourceType === "figure") {
        if (result.recommendations.length) result.issues.push({ severity: "info", code: "recommendations_omitted_for_resource_type", message: `${item.label} được giữ là ${item.resourceType}; các hàng/caption không được tự tạo khuyến cáo.`, sourcePage: item.pageStart || null });
        result.recommendations = [];
      }
      discoveredDocument = {
        ...discoveredDocument,
        title: result.document.title || discoveredDocument.title || "",
        organization: result.document.organization || discoveredDocument.organization || "",
        year: result.document.year || discoveredDocument.year || null,
        version: result.document.version || discoveredDocument.version || "",
        sourceLanguage: result.document.sourceLanguage || discoveredDocument.sourceLanguage || data.job.source_language,
      };
      const sourceOrder = Number.isInteger(item.sourceOrder) ? item.sourceOrder : index;
      const sourceTableNumber = item.sourceTableNumber || item.label || "";
      const orderedTables = (result.tables || []).map((table) => ({
        ...table,
        itemId: item.id,
        tableNumber: table.tableNumber || sourceTableNumber,
        sourceTableNumber: table.tableNumber || sourceTableNumber,
        sourceOrder,
        sourcePage: validSourcePage(table.sourcePage) || validSourcePage(item.pageStart),
        sourcePageEnd: validSourcePage(table.sourcePageEnd) || validSourcePage(item.pageEnd),
        rows: (table.rows || []).map((row, rowIndex) => ({ ...row, groupOrder: Number.isInteger(row.groupOrder) ? row.groupOrder : 0, rowOrder: Number.isInteger(row.rowOrder) ? row.rowOrder : rowIndex })),
      }));
      tableTranslations = { ...tableTranslations, [item.id]: orderedTables };
      if (item.resourceType === "figure") {
        const extractedFigure = result.figures?.[0] || {};
        const baseFigure = item.figure || {};
        figureResources = {
          ...figureResources,
          [item.id]: {
            ...baseFigure,
            ...extractedFigure,
            id: item.id,
            sourcePages: extractedFigure.sourcePages?.length ? extractedFigure.sourcePages : baseFigure.sourcePages || [],
            originalAssetPath: baseFigure.originalAssetPath || "",
            assetMimeType: baseFigure.assetMimeType || "",
            width: baseFigure.width ?? null,
            height: baseFigure.height ?? null,
            checksum: baseFigure.checksum || "",
            // A PDF page is not treated as an extracted figure asset. It must
            // be cropped from the original at high resolution and reviewed.
            extractionStatus: baseFigure.originalAssetPath ? "caption_extracted" : "needs_crop_review",
            publicationStatus: "ready_private",
            permissionStatus: baseFigure.permissionStatus || "private_educational_use",
          },
        };
      }
      const reviewRequired = item.contentType === "recommendation_table";
      states[item.id] = {
        ...(states[item.id] || {}),
        status: reviewRequired ? "needs_review" : "translated",
        translatedAt: new Date().toISOString(),
        reviewRequired,
        provider: usedProvider,
        model: usedProvider === "openai" ? (process.env.OPENAI_GUIDELINE_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini") : GUIDELINE_IMPORT_MODEL,
        errorCode: null,
        errorMessage: null,
      };
      await updateJob(req, jobId, { analysis_metadata: persistMetadata({ document: discoveredDocument, tableTranslations, figureResources }) });
      const resolvedSectionKeys = new Map();
      for (const [sectionIndex, section] of [...result.sections].sort((a, b) => a.level - b.level || a.displayOrder - b.displayOrder).entries()) {
        const identity = sourceSectionIdentity(section);
        const key = identity.canonicalKey || `${item.id}:${section.sourceKey}`;
        // Table-first imports retain detected headings inside the structured
        // payload as provenance. They do not create translatable/reviewable
        // Section records in the active workflow.
        resolvedSectionKeys.set(section.sourceKey, key);
        let current = sectionByKey.get(key);
        if (!current && process.env.GUIDELINE_LEGACY_SECTION_IMPORT === "enabled") {
          const parentKey = section.parentSourceKey ? (resolvedSectionKeys.get(section.parentSourceKey) || `${item.id}:${section.parentSourceKey}`) : null;
          const parent = parentKey ? sectionByKey.get(parentKey) : null;
          current = first(await supabaseTableRequest("guideline_import_sections", token, { method: "POST", body: {
            job_id: jobId,
            parent_section_id: parent?.id || null,
            source_key: key,
            title_original: section.titleOriginal,
            title_vi: section.titleVi,
            summary_original: section.summaryOriginal,
            summary_vi: section.summaryVi,
            level: section.level,
            source_page: validSourcePage(section.sourcePage),
            source_anchor: section.sourceAnchor,
            display_order: section.displayOrder + index * 1000 + sectionIndex,
            review_status: "pending",
            original_payload: { ...section, sourceNumber: identity.number, temporaryIdentity: identity.temporary, canonicalSourceKey: key },
          } }));
          sectionByKey.set(key, current);
        }
        resolvedSectionKeys.set(section.sourceKey, key);
        if (identity.temporary) result.issues.push({ severity: "info", code: "source_section_provenance_unresolved", message: `Mục nguồn ${section.sourceKey || section.titleOriginal} chưa có số nguồn ổn định; Bảng khuyến cáo vẫn dùng title, trang và thứ tự nguồn.`, sourcePage: section.sourcePage });
      }
      const insertedRecommendations = [];
      for (const [recommendationIndex, recommendation] of result.recommendations.entries()) {
        const sourceKey = `${item.id}:${recommendation.sourceKey}`;
        const existingRecommendation = (latestRecommendations || []).find((candidate) => candidate.source_key === sourceKey);
        const recommendationPayload = {
          import_section_id: null,
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
          source_page: validSourcePage(recommendation.sourcePage),
          source_quote: recommendation.sourceQuote,
          source_anchor: recommendation.sourceAnchor,
          coordinates: recommendation.coordinates || {},
          confidence: recommendation.confidence,
          review_status: existingRecommendation?.review_status || "pending",
          verification_status: existingRecommendation?.verification_status || "unverified",
          display_order: sourceOrder * 1000000 + recommendation.groupOrder * 1000 + recommendation.rowOrder,
          original_payload: {
            ...recommendation,
            sourceTitle: recommendation.titleOriginal,
            translatedTitle: recommendation.titleVi || recommendation.titleOriginal,
            sourceText: recommendation.recommendationTextOriginal,
            translatedText: recommendation.recommendationTextVi,
            sourceAudience: recommendation.population || "",
            translatedAudience: recommendation.population || "",
            sourceContext: recommendation.conditions || "",
            translatedContext: recommendation.conditions || "",
            tableSourceKey: recommendation.tableSourceKey || "",
            sourceTableNumber,
            sourceOrder,
            groupOrder: recommendation.groupOrder,
            rowOrder: recommendation.rowOrder,
          },
        };
        const created = first(await supabaseTableRequest("guideline_import_recommendations", token, existingRecommendation
          ? { method: "PATCH", query: { id: `eq.${existingRecommendation.id}` }, body: recommendationPayload }
          : { method: "POST", body: { job_id: jobId, ...recommendationPayload } }));
        insertedRecommendations.push(created);
        if (!validSourcePage(recommendation.sourcePage)) result.issues.push({ severity: "blocking", code: "missing_source_page", message: `Khuyến cáo ${recommendation.sourceKey} thiếu trang nguồn.`, sourcePage: null });
        if (recommendation.confidence != null && recommendation.confidence < 0.75) result.issues.push({ severity: "warning", code: "low_confidence", message: `Độ tin cậy thấp ở ${recommendation.sourceKey}.`, sourcePage: recommendation.sourcePage });
        if (recommendation.recommendationTextOriginal && recommendation.recommendationTextVi && /\d/.test(recommendation.recommendationTextOriginal) && !/\d/.test(recommendation.recommendationTextVi)) result.issues.push({ severity: "blocking", code: "number_mismatch", message: `Bản dịch của ${recommendation.sourceKey} không giữ số liệu nguồn.`, sourcePage: recommendation.sourcePage });
      }
      for (const issue of result.issues) {
        await supabaseTableRequest("guideline_import_issues", token, { method: "POST", body: { job_id: jobId, recommendation_id: insertedRecommendations[0]?.id || null, severity: issue.severity, issue_code: issue.code, message: issue.message, source_page: validSourcePage(issue.sourcePage) } });
      }
      for (const term of result.terminology) {
        const existing = await supabaseTableRequest("guideline_import_terminology", token, { query: { job_id: `eq.${jobId}`, source_term: `eq.${term.sourceTerm}`, select: "id,locked" } });
        if (!existing?.length) await supabaseTableRequest("guideline_import_terminology", token, { method: "POST", body: { job_id: jobId, source_term: term.sourceTerm, preferred_translation: term.preferredTranslation, created_by: req.guidelineAdmin.id } });
      }
      latestRecommendations = await supabaseTableRequest("guideline_import_recommendations", token, { query: { job_id: `eq.${jobId}`, select: "*" } });
      const duplicates = await findDuplicateRecommendations(token, data.job.target_guideline_id, latestRecommendations || []);
      for (const recommendation of latestRecommendations || []) if (duplicates.get(recommendation.id)) await supabaseTableRequest("guideline_import_recommendations", token, { method: "PATCH", query: { id: `eq.${recommendation.id}` }, body: { duplicate_status: "exact", duplicate_target_id: duplicates.get(recommendation.id) } });
      await updateJob(req, jobId, { progress: Math.min(95, Math.round(((index + 1) / selected.length) * 90) + 5), processed_pages: item.pageEnd || item.pageStart || 0, current_stage: "review" });
      await addEvent(req, jobId, "item_processed", "review", { itemId: item.id, provider: usedProvider, resourceType: item.resourceType || null, sections: result.sections.length, recommendations: result.recommendations.length, tables: result.tables.length, figures: result.figures.length, issues: result.issues.length });
    } catch (error) {
      const quotaExhausted = isProviderQuotaError(error);
      const incompleteMandatoryTable = error?.code === "recommendation_table_incomplete" || error?.blocking === true;
      states[item.id] = {
        ...(states[item.id] || {}),
        status: incompleteMandatoryTable ? "blocked_pending_extraction" : "failed_retryable",
        errorCode: incompleteMandatoryTable ? "recommendation_table_incomplete" : quotaExhausted ? "provider_quota_exhausted" : "provider_error",
        errorMessage: errorMessage(error),
      };
      await updateJob(req, jobId, { analysis_metadata: persistMetadata({ tableTranslations, figureResources }) }).catch(() => null);
      await supabaseTableRequest("guideline_import_issues", token, { method: "POST", body: { job_id: jobId, severity: incompleteMandatoryTable ? "blocking" : quotaExhausted ? "warning" : "error", issue_code: incompleteMandatoryTable ? "recommendation_table_incomplete" : quotaExhausted ? "provider_quota_exhausted" : "processing_error", message: errorMessage(error), source_page: item.pageStart || null } }).catch(() => null);
      await addEvent(req, jobId, quotaExhausted ? "processing_paused_quota" : incompleteMandatoryTable ? "mandatory_table_blocked" : "item_processing_failed", quotaExhausted ? "quota_paused" : "review", { itemId: item.id, message: errorMessage(error) }).catch(() => null);
      if (quotaExhausted) {
        await updateJob(req, jobId, { status: "paused", current_stage: "quota_paused", error_message: errorMessage(error), analysis_metadata: persistMetadata({ tableTranslations, figureResources }) }).catch(() => null);
        return;
      }
    }
  }
  const finalData = await readJobData(req, jobId);
  const completion = mandatoryRecommendationCompletion(items, itemStates(finalData?.job?.analysis_metadata));
  const pending = selectTranslationItems(items, selectedItemIds, scope, itemStates(finalData?.job?.analysis_metadata));
  const structuralDiagnostics = structuralImportDiagnostics({
    items,
    sections: finalData?.sections || [],
    recommendations: finalData?.recommendations || [],
    tables: Object.entries(tableTranslations).flatMap(([itemId, tables]) => (Array.isArray(tables) ? tables : []).map((table) => ({ ...table, itemId }))),
    issues: finalData?.issues || [],
  });
  const structurallyReady = !structuralDiagnostics.some((diagnostic) => diagnostic.severity === "blocking");
  const ready = completion.complete && pending.length === 0 && structurallyReady;
  await updateJob(req, jobId, {
    status: ready ? "ready_for_review" : "paused",
    current_stage: ready ? "review" : structurallyReady ? "mandatory_tables_pending" : "structural_repair_required",
    progress: ready ? 100 : 95,
    completed_at: ready ? new Date().toISOString() : null,
    analysis_metadata: persistMetadata({ tableTranslations, figureResources, structuralDiagnostics }),
  });
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
  // Source sections are persisted only as optional provenance. They are never
  // a translation, review, or publication prerequisite for table-first content.
  const sourceSections = [];
  const acceptedRecommendations = data.recommendations.filter((recommendation) => recommendation.review_status === "accepted");
  const coreSectionByImportId = new Map();
  const coreSectionBySourceKey = new Map();
  for (const section of [...sourceSections].sort((a, b) => a.level - b.level || a.display_order - b.display_order)) {
    const parentId = section.parent_section_id ? coreSectionByImportId.get(section.parent_section_id) || null : null;
    const sourceIdentity = sourceSectionIdentity({
      sourceKey: section.original_payload?.canonicalSourceKey || section.source_key,
      titleOriginal: section.title_original,
      titleVi: section.title_vi,
    });
    const created = first(await supabaseTableRequest("guideline_sections", token, { method: "POST", body: {
      guideline_id: guidelineId,
      owner_id: req.guidelineAdmin.id,
      parent_section_id: parentId,
      slug: slugify(section.title_vi || section.title_original),
      section_number: sourceIdentity.number,
      title: section.title_original || section.title_vi || "Section",
      title_vi: section.title_original || section.title_vi || "Source section",
      summary: section.summary_original || "",
      display_order: section.display_order,
      status: "draft",
    } }));
    coreSectionByImportId.set(section.id, created?.id);
    coreSectionBySourceKey.set(section.source_key, created?.id);
    coreSectionBySourceKey.set(section.original_payload?.sourceKey, created?.id);
    coreSectionBySourceKey.set(sourceIdentity.canonicalKey, created?.id);
  }
  const coreTableBySourceKey = new Map();
  const coreGroupByTableSourceKey = new Map();
  const importItemById = new Map((metadata.items || []).map((item) => [item.id, item]));
  const importedTables = Object.entries(metadata.tableTranslations || {})
    .flatMap(([itemId, tables]) => importItemById.get(itemId)?.resourceType === "recommendation_table" && Array.isArray(tables)
      ? tables.map((table) => ({ ...table, itemId }))
      : [])
    .sort((left, right) => Number(left.sourceOrder || 0) - Number(right.sourceOrder || 0)
      || Number(left.sourcePage || Number.MAX_SAFE_INTEGER) - Number(right.sourcePage || Number.MAX_SAFE_INTEGER));
  for (const table of importedTables) {
    const sectionId = coreSectionBySourceKey.get(table.sectionSourceKey) || null;
    if (!table.sourceKey) continue;
    const sourceOrder = Number.isInteger(table.sourceOrder) ? table.sourceOrder : 0;
    const created = first(await supabaseTableRequest("guideline_recommendation_tables", token, { method: "POST", body: {
      guideline_id: guidelineId,
      section_id: sectionId,
      owner_id: req.guidelineAdmin.id,
      table_number: text(table.tableNumber || table.sourceTableNumber),
      title: text(table.titleOriginal),
      title_vi: text(table.titleVi || table.titleOriginal),
      source_page: validSourcePage(table.sourcePage),
      source_quote: text(table.sourceQuote),
      source_anchor: text(table.sourceAnchor),
      source_table_number: text(table.sourceTableNumber || table.tableNumber),
      source_page_start: validSourcePage(table.sourcePage),
      source_page_end: validSourcePage(table.sourcePageEnd),
      source_order: sourceOrder,
      is_complete: Array.isArray(table.rows) && table.rows.length > 0,
      status: "draft",
      display_order: sourceOrder,
    } }));
    coreTableBySourceKey.set(table.sourceKey, created?.id);
    if (created?.id) {
      const createdGroup = first(await supabaseTableRequest("guideline_recommendation_groups", token, { method: "POST", body: {
        guideline_id: guidelineId,
        section_id: sectionId,
        recommendation_table_id: created.id,
        owner_id: req.guidelineAdmin.id,
        source_heading: "",
        title_vi: "Khuyến cáo",
        context: "",
        source_page: validSourcePage(table.sourcePage),
        group_order: 0,
        status: "draft",
      } }));
      coreGroupByTableSourceKey.set(table.sourceKey, createdGroup?.id || null);
    }
  }
  // Clinical tables are stored as their own canonical resource. They retain
  // source order and provenance, but never generate Recommendation rows.
  const importedClinicalTables = Object.entries(metadata.tableTranslations || {})
    .flatMap(([itemId, tables]) => importItemById.get(itemId)?.resourceType === "clinical_table" && Array.isArray(tables)
      ? tables.map((table) => ({ ...table, itemId }))
      : [])
    .sort((left, right) => Number(left.sourceOrder || 0) - Number(right.sourceOrder || 0)
      || Number(left.sourcePage || Number.MAX_SAFE_INTEGER) - Number(right.sourcePage || Number.MAX_SAFE_INTEGER));
  for (const table of importedClinicalTables) {
    const sourceRows = Array.isArray(table.rows) ? table.rows : [];
    const headersOriginal = Array.isArray(table.headersOriginal) ? table.headersOriginal : [];
    const headersVi = Array.isArray(table.headersVi) ? table.headersVi : headersOriginal;
    const rowsOriginal = sourceRows.map((row) => Array.isArray(row?.cellsOriginal) ? row.cellsOriginal : []);
    const rowsVi = sourceRows.map((row) => Array.isArray(row?.cellsVi) && row.cellsVi.length ? row.cellsVi : (Array.isArray(row?.cellsOriginal) ? row.cellsOriginal : []));
    await supabaseTableRequest("guideline_clinical_tables", token, { method: "POST", body: {
      guideline_id: guidelineId,
      section_id: coreSectionBySourceKey.get(table.sectionSourceKey) || null,
      owner_id: req.guidelineAdmin.id,
      table_number: text(table.tableNumber || table.sourceTableNumber),
      title: text(table.titleOriginal),
      title_vi: text(table.titleVi || table.titleOriginal),
      short_description: text(table.summaryVi || table.summaryOriginal),
      source_page_start: validSourcePage(table.sourcePage),
      source_page_end: validSourcePage(table.sourcePageEnd),
      source_order: Number.isInteger(table.sourceOrder) ? table.sourceOrder : 0,
      headers_original: headersOriginal,
      headers_vi: headersVi,
      rows_original: rowsOriginal,
      rows_vi: rowsVi,
      footnotes_original: Array.isArray(table.footnotesOriginal) ? table.footnotesOriginal : [],
      footnotes_vi: Array.isArray(table.footnotesVi) ? table.footnotesVi : (Array.isArray(table.footnotesOriginal) ? table.footnotesOriginal : []),
      is_complete: Boolean(headersOriginal.length && rowsOriginal.length),
      status: "draft",
    } });
  }
  const coreRecommendationBySourceKey = new Map();
  const sourceSortOrder = (recommendation) => {
    const payload = recommendation.original_payload || {};
    const sourceOrder = Number(payload.sourceOrder);
    const groupOrder = Number(payload.groupOrder);
    const rowOrder = Number(payload.rowOrder);
    return (Number.isFinite(sourceOrder) ? sourceOrder : Number(recommendation.display_order || 0)) * 1000000
      + (Number.isFinite(groupOrder) ? groupOrder : 0) * 1000
      + (Number.isFinite(rowOrder) ? rowOrder : 0);
  };
  for (const recommendation of [...acceptedRecommendations].sort((left, right) => sourceSortOrder(left) - sourceSortOrder(right))) {
    const tableSourceKey = recommendation.original_payload?.tableSourceKey || "";
    const sectionId = recommendation.import_section_id ? coreSectionByImportId.get(recommendation.import_section_id) || null : null;
    const created = first(await supabaseTableRequest("guideline_recommendations", token, { method: "POST", body: {
      guideline_id: guidelineId,
      section_id: sectionId,
      recommendation_table_id: coreTableBySourceKey.get(tableSourceKey) || null,
      recommendation_group_id: coreGroupByTableSourceKey.get(tableSourceKey) || null,
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
      sort_order: sourceSortOrder(recommendation),
    } }));
    coreRecommendationBySourceKey.set(recommendation.source_key, created?.id);
  }
  const figureResources = Object.fromEntries(Object.entries(metadata.figureResources || {}).map(([figureId, figure]) => [figureId, {
    ...figure,
    guidelineId,
    sectionId: coreSectionBySourceKey.get(figure.sectionSourceKey) || figure.sectionId || null,
    relatedRecommendationIds: (figure.relatedRecommendationSourceKeys || []).map((sourceKey) => coreRecommendationBySourceKey.get(sourceKey)).filter(Boolean),
    relatedTableIds: figure.relatedTableSourceKeys || [],
  }]));
  await supabaseTableRequest("guideline_source_documents", token, { method: "POST", body: { guideline_id: guidelineId, owner_id: req.guidelineAdmin.id, original_filename: document.original_filename, storage_path: `guideline-imports/${document.storage_path}`, mime_type: document.mime_type, source_kind: "primary", checksum: document.checksum, page_count: document.page_count, extraction_status: "completed" } }).catch(() => null);
  await updateJob(req, jobId, { status: "completed", current_stage: "completed", progress: 100, imported_guideline_id: guidelineId, completed_at: new Date().toISOString(), analysis_metadata: { ...metadata, figureResources } });
  await addEvent(req, jobId, "bulk_import_completed", "completed", { guidelineId, sourceSections: sourceSections.length, recommendationTables: importedTables.length, clinicalTables: importedClinicalTables.length, recommendations: acceptedRecommendations.length });
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
    const diagnostics = [...groupedLocalDiagnostics(items, states), ...inventoryDiagnostics(items, { fileName: file.originalname })];
    const expectedInventory = expectedInventoryForDocument({ fileName: file.originalname });
    const summary = translationSummary(items, selectedItemIds, scope, states);
    if (expectedInventory) summary.resources = {
      ...summary.resources,
      recommendationTables: { ...summary.resources.recommendationTables, expected: expectedInventory.recommendationTables },
      clinicalTables: { ...summary.resources.clinicalTables, expected: expectedInventory.clinicalTables },
      figures: { ...summary.resources.figures, expected: expectedInventory.figures },
    };
    const updatedJob = first(await supabaseTableRequest("guideline_import_jobs", token, { method: "PATCH", query: { id: `eq.${job.id}` }, body: { status: "ready_for_review", current_stage: "selection", progress: 25, total_pages: extracted.pageCount || items.at(-1)?.pageEnd || null, analysis_metadata: { items: items.map(({ text: _text, ...item }) => item), document: { title: "", organization: "", year: null, version: "", condition: "" }, ocrUsed: Boolean(extracted.ocrUsed), sourceType: extracted.sourceType, translationScope: scope, translationProvider: provider, selectedItemIds, itemStates: states, translationSummary: summary, localDiagnostics: diagnostics, figureResources: {} } } }));
    await supabaseTableRequest("guideline_import_documents", token, { method: "POST", body: { job_id: job.id, owner_id: req.guidelineAdmin.id, original_filename: file.originalname, mime_type: file.mimetype || "application/octet-stream", source_language: text(req.body?.sourceLanguage) || "en", storage_path: storagePath, checksum: checksumFor(fileBytes), file_size: fileBytes.length, page_count: extracted.pageCount || items.at(-1)?.pageEnd || null, ocr_required: Boolean(extracted.ocrUsed), ocr_status: extracted.ocrUsed ? "completed" : "not_started", extracted_text: extracted.text, page_metadata: [] } });
    for (const diagnostic of diagnostics) {
      const mandatoryIncomplete = diagnostic.code === "recommendation_table_incomplete";
      const inventoryMissing = String(diagnostic.code || "").startsWith("inventory_missing_");
      const message = mandatoryIncomplete
        ? `${diagnostic.count} bảng khuyến cáo thiếu nội dung hoặc trang tiếp theo. Cần khôi phục/trà soát trước khi hoàn tất.`
        : diagnostic.code === "duplicate_content"
          ? `${diagnostic.count} mục trùng nội dung được dùng lại checkpoint thay vì gọi AI lần nữa.`
          : inventoryMissing
            ? diagnostic.message
            : `${diagnostic.count} mục không đủ nội dung lâm sàng để dịch tự động.`;
      await supabaseTableRequest("guideline_import_issues", token, { method: "POST", body: { job_id: job.id, severity: mandatoryIncomplete ? "blocking" : inventoryMissing ? "warning" : "info", issue_code: diagnostic.code, message } });
    }
    await addEvent(req, job.id, "uploaded", "document_analysis", { fileName: file.originalname, itemCount: items.length, ocrUsed: Boolean(extracted.ocrUsed) });
    return res.status(201).json({ success: true, job: updatedJob, items: items.map(({ text: _text, ...item }) => item) });
  } catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error) }); }
  finally { if (file?.path) await unlink(file.path).catch(() => null); }
});

router.get("/jobs/:jobId", async (req, res) => {
  try {
    if (req.query.view === "status") {
      const job = first(await supabaseTableRequest("guideline_import_jobs", tokenFromRequest(req), { query: { id: `eq.${req.params.jobId}`, owner_id: `eq.${req.guidelineAdmin.id}`, select: importJobStatusColumns } }));
      if (!job) return res.status(404).json({ success: false, message: "Không tìm thấy phiên import." });
      return res.json({ success: true, job });
    }
    const data = await readJobData(req, req.params.jobId); if (!data) return res.status(404).json({ success: false, message: "Không tìm thấy phiên import." }); return res.json({ success: true, ...data });
  }
  catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error) }); }
});

router.post("/jobs/:jobId/figures/:figureId/crop", async (req, res) => {
  try {
    const data = await readJobData(req, req.params.jobId);
    if (!data?.document) return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu nguồn của phiên import." });
    const { figures, figure } = figureForJob(data, req.params.figureId);
    if (!figure) return res.status(404).json({ success: false, message: "Không tìm thấy Figure cần crop." });
    if (!/pdf/i.test(data.document.mime_type || "") && !/\.pdf$/i.test(data.document.original_filename || "")) return res.status(422).json({ success: false, message: "Hiện chỉ hỗ trợ crop Figure trực tiếp từ PDF gốc." });
    const sourceBytes = await downloadImportObject(data.document.storage_path, tokenFromRequest(req));
    const sourcePage = Number(req.body?.pageNumber || figure.sourcePages?.[0] || 1);
    const rendered = await renderOriginalFigureCrop(sourceBytes, sourcePage, normalizeFigureCropBox(req.body?.cropBox));
    const assetPath = `${req.guidelineAdmin.id}/${req.params.jobId}/figures/${safeFileName(req.params.figureId)}.png`;
    await uploadImportObject(assetPath, { buffer: rendered.png, size: rendered.png.length, mimetype: "image/png" }, tokenFromRequest(req), { upsert: true });
    const updatedFigure = {
      ...figure,
      id: req.params.figureId,
      originalAssetPath: assetPath,
      assetMimeType: "image/png",
      width: rendered.width,
      height: rendered.height,
      checksum: rendered.checksum,
      sourcePages: [rendered.pageNumber],
      cropBox: rendered.cropBox,
      extractionStatus: "ready_private",
      publicationStatus: normalizeFigurePermissionStatus(figure.permissionStatus) === "permission_granted" ? "ready_public" : "ready_private",
    };
    await updateJob(req, req.params.jobId, { analysis_metadata: { ...(data.job.analysis_metadata || {}), figureResources: { ...figures, [req.params.figureId]: updatedFigure } } });
    await addEvent(req, req.params.jobId, "figure_original_cropped", "review", { figureId: req.params.figureId, sourcePage: rendered.pageNumber, cropBox: rendered.cropBox });
    return res.json({ success: true, figure: figureDisplayModel(updatedFigure, { isOwnerOrAdmin: true }) });
  } catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error) }); }
});

router.get("/jobs/:jobId/figures/:figureId/asset", async (req, res) => {
  try {
    const data = await readJobData(req, req.params.jobId);
    const { figure } = figureForJob(data, req.params.figureId);
    if (!figure?.originalAssetPath) return res.status(404).json({ success: false, message: "Figure chưa có asset crop gốc." });
    const asset = await downloadImportObject(figure.originalAssetPath, tokenFromRequest(req));
    res.set("Cache-Control", "private, no-store");
    res.type(figure.assetMimeType || "image/png");
    return res.send(asset);
  } catch (error) { return res.status(statusCode(error)).json({ success: false, message: errorMessage(error) }); }
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
      ? { ...item, resourceType: "clinical_table", clinicalTableSubtype: "other", contentType: "clinical_table", clinicalImportance: "important", translationEligibility: "automatic", manualReviewRequired: false, mandatory: false, diagnosticCode: "classification_corrected", classificationCorrection: { classification, reason, actorId: req.guidelineAdmin.id, correctedAt: new Date().toISOString() } }
      : { ...item, resourceType: "clinical_table", clinicalTableSubtype: "other", contentType: "clinical_table", clinicalImportance: "optional", translationEligibility: "manual_only", manualReviewRequired: true, mandatory: false, diagnosticCode: "classification_corrected", classificationCorrection: { classification, reason, actorId: req.guidelineAdmin.id, correctedAt: new Date().toISOString() } };
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

router.post("/jobs/:jobId/items/:itemId/review", async (req, res) => {
  try {
    const data = await readJobData(req, req.params.jobId);
    if (!data) return res.status(404).json({ success: false, message: "Không tìm thấy phiên import." });
    const items = Array.isArray(data.job.analysis_metadata?.items) ? data.job.analysis_metadata.items : [];
    const item = items.find((candidate) => candidate.id === req.params.itemId);
    if (!item || item.contentType !== "recommendation_table") return res.status(422).json({ success: false, message: "Chỉ bảng khuyến cáo đầy đủ mới cần xác nhận rà soát." });
    const tables = data.job.analysis_metadata?.tableTranslations?.[item.id];
    if (!Array.isArray(tables) || tables.length === 0 || tables.some((table) => !hasCompleteRecommendationTable([table]))) return res.status(422).json({ success: false, message: "Bảng khuyến cáo chưa đủ tiêu đề, cột và hàng để xác nhận. Hãy khôi phục nội dung hoặc trang tiếp theo trước." });
    const tableSourceKeys = new Set(tables.map((table) => String(table?.sourceKey || "")).filter(Boolean));
    const tableRecommendations = data.recommendations.filter((recommendation) => tableSourceKeys.has(String(recommendation.original_payload?.tableSourceKey || "")));
    if (tableRecommendations.length === 0) return res.status(422).json({ success: false, message: "Bảng khuyến cáo chưa có Recommendation nào để phê duyệt. Hãy kiểm tra lại kết quả trích xuất." });
    const invalidRecommendations = tableRecommendations.filter((recommendation) => !String(recommendation.recommendation_text_vi || recommendation.recommendation_text_original || "").trim());
    if (invalidRecommendations.length) return res.status(422).json({ success: false, message: `${invalidRecommendations.length} khuyến cáo trong bảng chưa có nội dung để phê duyệt.` });
    const duplicateRecommendations = tableRecommendations.filter((recommendation) => ["exact", "possible", "update"].includes(recommendation.duplicate_status));
    if (duplicateRecommendations.length) return res.status(422).json({ success: false, message: `${duplicateRecommendations.length} khuyến cáo trong bảng có khả năng trùng. Hãy kiểm tra và xử lý trước khi phê duyệt cả bảng.` });
    for (const recommendation of tableRecommendations) {
      await supabaseTableRequest("guideline_import_recommendations", tokenFromRequest(req), { method: "PATCH", query: { id: `eq.${recommendation.id}` }, body: { review_status: "accepted", verification_status: "verified" } });
    }
    const states = {
      ...itemStates(data.job.analysis_metadata),
      [item.id]: {
        ...(itemStates(data.job.analysis_metadata)[item.id] || {}),
        status: "reviewed",
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.guidelineAdmin.id,
        reviewRequired: false,
        errorCode: null,
        errorMessage: null,
      },
    };
    const scope = translationScope(data.job.analysis_metadata?.translationScope);
    const selectedItemIds = data.job.analysis_metadata?.selectedItemIds || [];
    const completion = mandatoryRecommendationCompletion(items, states);
    const pending = selectTranslationItems(items, selectedItemIds, scope, states);
    const ready = completion.complete && pending.length === 0;
    await updateJob(req, req.params.jobId, {
      status: ready ? "ready_for_review" : "paused",
      current_stage: ready ? "review" : "mandatory_tables_pending",
      progress: ready ? 100 : Math.max(25, data.job.progress || 0),
      analysis_metadata: {
        ...(data.job.analysis_metadata || {}),
        itemStates: states,
        translationSummary: translationSummary(items, selectedItemIds, scope, states),
      },
    });
    await addEvent(req, req.params.jobId, "recommendation_table_reviewed", "review", { itemId: item.id, reviewedBy: req.guidelineAdmin.id, acceptedRecommendations: tableRecommendations.length });
    return res.json({ success: true, status: states[item.id], readyForReview: ready, acceptedRecommendations: tableRecommendations.length });
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
