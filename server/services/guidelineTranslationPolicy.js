import { createHash } from "node:crypto";

export const TRANSLATION_SCOPES = ["clinical_essentials", "recommendations_only", "selected_content", "full_translation"];
export const TRANSLATION_PROVIDERS = ["gemini", "openai", "gemini_then_openai"];

const recommendationSignals = /\brecommendation(?:s)?\b|class of recommendation|level of evidence|\bclass\s*(?:i|ii|iii|iv)\b|\bloe\b|recommended|should be considered|may be considered|not recommended|should not be used/i;
const dosingSignals = /\bdose|dosage|dosing|regimen|frequency|duration|renal impairment|hepatic impairment|dose adjustment\b/i;
const contraindicationSignals = /\bcontraindication|precaution|warning|what not to do\b/i;
const diagnosticSignals = /\bdiagnos(?:is|tic)|criteria|threshold|risk|score|stratification\b/i;
const treatmentSignals = /\btreatment|management|monitoring|follow-up|follow up|drug interaction|what to do\b/i;
const excludedSignals = /\breferences?\b|bibliography|authors?|table of contents|abbreviations?|glossary|metadata|header|footer|page \d+\b/i;
const formalRecommendationStatementSignals = /\b(?:is|are)\s+(?:recommended|not recommended)|\bshould(?:\s+not)?\b|\bshould be considered\b|\bmay be considered\b|\bshould not be used\b|\bdo not use\b|\bwe recommend\b/i;
const recommendationDefinitionSignals = /\b(?:classes?|levels?)\s+of\s+(?:recommendations?|evidence)\b|\bdefinition(?:s)?\s+of\s+(?:recommendations?|evidence)\b|\bgrading system\b/i;

export const GUIDELINE_RESOURCE_TYPES = ["recommendation_table", "clinical_table", "figure"];
export const CLINICAL_TABLE_SUBTYPES = ["framework", "evidence", "definitions", "new_revised", "dosing", "safety", "evidence_gap", "key_message", "other"];
export const FIGURE_EXTRACTION_STATUSES = ["detected", "extracted", "needs_crop_review", "caption_extracted", "related", "permission_pending", "ready_private", "ready_public", "failed"];
export const FIGURE_PERMISSION_STATUSES = ["private_educational_use", "permission_pending", "permission_granted", "link_only", "public_not_allowed"];
export const ESC_ACS_2023_EXPECTED_INVENTORY = Object.freeze({ recommendationTables: 17, clinicalTables: 9, figures: 20 });

function text(value) { return String(value || "").trim(); }
function fingerprint(value) { return createHash("sha256").update(text(value)).digest("hex"); }

function tableHasBody(item) {
  const lines = text(item.text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const heading = `${item.label || ""} ${item.title || ""}`.trim();
  const bodyLines = lines.filter((line) => line !== heading);
  const body = bodyLines.join(" ");
  // Short dosing and recommendation tables are still complete when their rows
  // are present. Treat actual rows/cells as structure, not as a word-count test.
  const hasStructuredRow = bodyLines.some((line) => /\||\t|\s{2,}/.test(line));
  return (bodyLines.length >= 2 && (body.length >= 24 || hasStructuredRow)) || (bodyLines.length === 1 && hasStructuredRow);
}

function hasFormalRecommendationContent(item, hasBody) {
  const title = `${item.label || ""} ${item.title || ""}`;
  const source = text(item.text);
  const body = source.replace(title, " ");
  if (recommendationDefinitionSignals.test(title)) return false;
  // A table is mandatory only when the body has actual formal recommendation
  // language. "Classes of recommendations" is a framework table, not a table
  // of clinical recommendations.
  // A standalone sentence containing "recommended" is not enough: dosing,
  // definitions, evidence-gap and supplementary tables often contain that
  // word without being a formal recommendation table. Require an explicit
  // recommendation-table title or Class/Level structure.
  if (/\brecommendations?\b/i.test(title)) return true;
  // Only inspect the table's opening block. Later prose can contain
  // cross-references such as "see Recommendation Table 6" and must not turn
  // a dosing/supplementary table into a mandatory recommendation table.
  const opening = body.slice(0, 1800);
  if (hasBody && /recommendation statement/i.test(opening)) return true;
  if (hasBody && /\bclass\b|\bloe\b|level of evidence/i.test(opening) && /\b(?:recommended|should|may|not recommended|do not)\b/i.test(opening)) return true;
  return false;
}

function clinicalTableSubtype(haystack) {
  if (recommendationDefinitionSignals.test(haystack)) return "framework";
  if (/\bnew\b|\brevised\b|\bchanged\b/i.test(haystack)) return "new_revised";
  if (/monitoring|follow-up|follow up/i.test(haystack)) return "other";
  if (/dose|dosage|dosing|regimen|frequency|duration|renal impairment|hepatic impairment|dose adjustment/i.test(haystack)) return "dosing";
  if (/contraindication|precaution|warning|adverse|safety|interaction/i.test(haystack)) return "safety";
  if (/evidence gap|knowledge gap|research need/i.test(haystack)) return "evidence_gap";
  if (/key message|take-home|take home/i.test(haystack)) return "key_message";
  if (/evidence|trial|study|meta-analysis/i.test(haystack)) return "evidence";
  if (/definition|terminology|criteria|classification/i.test(haystack)) return "definitions";
  return "other";
}

function clinicalTableClassification(haystack) {
  const subtype = clinicalTableSubtype(haystack);
  const required = ["dosing", "safety"].includes(subtype);
  const actionableMonitoringOrTreatment = /monitoring|follow-up|follow up|treatment|management|diagnos(?:is|tic)|risk|score|stratification/i.test(haystack);
  const important = required || actionableMonitoringOrTreatment || ["evidence", "new_revised", "key_message"].includes(subtype);
  return {
    resourceType: "clinical_table",
    clinicalTableSubtype: subtype,
    contentType: "clinical_table",
    clinicalImportance: required ? "required" : important ? "important" : "optional",
    translationEligibility: required || important ? "automatic" : "manual_only",
    manualReviewRequired: subtype === "framework" || subtype === "definitions" || subtype === "other",
  };
}

function tableClassification(item, haystack, hasBody) {
  // Recommendation tables are a completion gate. A partial extract can never be
  // silently skipped or translated as if it were complete.
  const formalRecommendation = hasFormalRecommendationContent(item, hasBody);
  if (!hasBody && formalRecommendation) return { resourceType: "recommendation_table", contentType: "recommendation_table_incomplete", clinicalImportance: "required", translationEligibility: "blocked_pending_extraction", manualReviewRequired: true, mandatory: true, diagnosticCode: "recommendation_table_incomplete" };
  if (!hasBody) return { resourceType: "clinical_table", clinicalTableSubtype: clinicalTableSubtype(haystack), contentType: "missing_content", clinicalImportance: "exclude", translationEligibility: "not_required", manualReviewRequired: false, diagnosticCode: "missing_content" };
  if (formalRecommendation) return { resourceType: "recommendation_table", contentType: "recommendation_table", clinicalImportance: "required", translationEligibility: "automatic", manualReviewRequired: false, mandatory: true };
  return clinicalTableClassification(haystack);
}

function figureNumber(label) {
  const match = String(label || "").match(/(?:figure|hình)\s*([A-Za-z]?\s*\d+(?:\.\d+)?)/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function classifyFigure(item) {
  const hasCaption = text(item.text).split(/\r?\n/).filter(Boolean).length > 1 || text(item.title).length > 0;
  const page = Number.isInteger(item.pageStart) && item.pageStart > 0 ? item.pageStart : null;
  return {
    resourceType: "figure",
    contentType: "figure",
    clinicalImportance: "optional",
    translationEligibility: hasCaption ? "manual_only" : "not_required",
    manualReviewRequired: true,
    diagnosticCode: hasCaption ? "figure_caption" : "figure_missing_caption",
    figure: {
      id: item.id,
      guidelineId: null,
      sectionId: null,
      figureNumber: figureNumber(item.label),
      sourceTitle: text(item.title),
      translatedTitle: "",
      sourceCaption: text(item.text),
      translatedCaption: "",
      sourcePages: page ? [page] : [],
      originalAssetPath: "",
      assetMimeType: "",
      width: null,
      height: null,
      checksum: "",
      altText: "",
      publicationStatus: "ready_private",
      permissionStatus: "private_educational_use",
      attribution: "",
      relatedRecommendationIds: [],
      relatedTableIds: [],
      extractionStatus: hasCaption ? "caption_extracted" : "detected",
    },
  };
}

export function classifyGuidelineItem(item) {
  const source = text(item.text);
  const haystack = `${item.label || ""}\n${item.title || ""}\n${source}`;
  let classification;
  if (item.type === "figure") classification = classifyFigure(item);
  else if (!source) classification = { contentType: "missing_content", clinicalImportance: "exclude", translationEligibility: "not_required", manualReviewRequired: false, diagnosticCode: "missing_content" };
  // A table's cells take precedence over a generic title. For example, a table
  // with a reference-like heading can still contain formal recommendations.
  else if (item.type === "table") classification = tableClassification(item, haystack, tableHasBody(item));
  else if (excludedSignals.test(`${item.label || ""} ${item.title || ""}`)) classification = { contentType: /glossary|abbreviations?/i.test(haystack) ? "glossary" : "reference", clinicalImportance: "exclude", translationEligibility: "not_required", manualReviewRequired: false, diagnosticCode: "non_actionable_content" };
  else if (recommendationSignals.test(haystack)) classification = { contentType: "recommendation", clinicalImportance: "required", translationEligibility: "automatic", manualReviewRequired: false, mandatory: true };
  else if (dosingSignals.test(haystack) || contraindicationSignals.test(haystack) || diagnosticSignals.test(haystack) || treatmentSignals.test(haystack)) classification = { contentType: "clinically_important_table", clinicalImportance: "important", translationEligibility: "automatic", manualReviewRequired: false };
  else classification = { contentType: "unknown", clinicalImportance: "optional", translationEligibility: "manual_only", manualReviewRequired: true };

  return {
    ...item,
    ...classification,
    sourceHash: fingerprint(source),
    translationStatus: classification.translationEligibility === "not_required" ? "not_required" : classification.translationEligibility === "blocked_pending_extraction" ? "blocked_pending_extraction" : "pending",
  };
}

export function classifyGuidelineItems(items) {
  return (items || []).map(classifyGuidelineItem);
}

export function isEligibleForScope(item, scope, explicitlySelected = false) {
  if (item.translationEligibility === "blocked_pending_extraction" || item.translationEligibility === "not_required") return false;
  if (item.mandatory) return item.translationEligibility === "automatic";
  if (scope === "full_translation") return true;
  if (scope === "selected_content") return explicitlySelected;
  if (scope === "recommendations_only") return ["recommendation", "recommendation_title", "recommendation_table", "recommendation_table_row"].includes(item.contentType);
  return item.translationEligibility === "automatic";
}

export function defaultSelection(items, scope = "clinical_essentials") {
  return (items || []).filter((item) => isEligibleForScope(item, scope, false)).map((item) => item.id);
}

export function initializeItemStates(items, selectedIds = []) {
  const selected = new Set((selectedIds || []).map(String));
  const firstByHash = new Map();
  return Object.fromEntries((items || []).map((item) => {
    const duplicateOf = item.sourceHash && firstByHash.get(item.sourceHash);
    if (item.sourceHash && !duplicateOf) firstByHash.set(item.sourceHash, item.id);
    // A mandatory recommendation table must never disappear merely because a
    // similar fragment was found elsewhere in the source document.
    const duplicate = !item.mandatory && duplicateOf && duplicateOf !== item.id;
    return [item.id, {
      status: duplicate ? "skipped" : item.translationStatus,
      selected: selected.has(String(item.id)),
      sourceHash: item.sourceHash,
      contentType: item.contentType,
      clinicalImportance: item.clinicalImportance,
      translationEligibility: item.translationEligibility,
      ...(duplicate ? { duplicateOf, errorCode: "duplicate_content" } : {}),
    }];
  }));
}

export function selectTranslationItems(items, selectedIds, scope, states = {}) {
  const selected = new Set((selectedIds || []).map(String));
  const uniqueSourceHashes = new Set();
  const priority = (item) => {
    if (["recommendation", "recommendation_title", "recommendation_table", "recommendation_table_row"].includes(item.contentType)) return 1;
    if (item.resourceType === "clinical_table" && item.clinicalTableSubtype === "dosing") return 2;
    if (item.resourceType === "clinical_table" && item.clinicalTableSubtype === "safety") return 3;
    if (item.resourceType === "clinical_table") return 4;
    if (item.resourceType === "figure") return 7;
    return 6;
  };
  return (items || []).filter((item) => {
    const state = states[item.id] || {};
    const explicitlySelected = selected.has(String(item.id));
    if (state.status === "translated" || state.status === "needs_review" || state.status === "reviewed" || state.status === "not_required" || state.status === "skipped" || state.status === "blocked_pending_extraction") return false;
    if ((!explicitlySelected && !item.mandatory) || !isEligibleForScope(item, scope, explicitlySelected)) return false;
    if ((!item.mandatory && state.duplicateOf) || (!item.mandatory && uniqueSourceHashes.has(item.sourceHash))) return false;
    if (!item.mandatory) uniqueSourceHashes.add(item.sourceHash);
    return ["pending", "failed_retryable", "queued", "processing", undefined].includes(state.status);
  }).sort((left, right) => priority(left) - priority(right));
}

export function groupedLocalDiagnostics(items, states = {}) {
  const groups = new Map();
  for (const item of items || []) {
    if (!item.diagnosticCode) continue;
    const existing = groups.get(item.diagnosticCode) || { code: item.diagnosticCode, count: 0, itemIds: [] };
    existing.count += 1;
    existing.itemIds.push(item.id);
    groups.set(item.diagnosticCode, existing);
  }
  for (const item of items || []) {
    const state = states[item.id];
    if (!state?.duplicateOf) continue;
    const existing = groups.get("duplicate_content") || { code: "duplicate_content", count: 0, itemIds: [] };
    existing.count += 1;
    existing.itemIds.push(item.id);
    groups.set("duplicate_content", existing);
  }
  return [...groups.values()];
}

export function mandatoryRecommendationCompletion(items, itemStates = {}) {
  const mandatory = (items || []).filter((item) => item.mandatory);
  const unresolved = mandatory.filter((item) => {
    const state = itemStates[item.id] || {};
    const status = state.status || item.translationStatus;
    // Full recommendation tables are not complete until a human explicitly
    // confirms the preserved title, headers, rows, notes and evidence cells.
    if (item.contentType === "recommendation_table") return status !== "reviewed";
    return status !== "translated" && status !== "needs_review" && status !== "reviewed";
  });
  return { total: mandatory.length, unresolved: unresolved.map((item) => item.id), complete: unresolved.length === 0 };
}

export function translationSummary(items, selectedIds, scope, states = {}) {
  const selected = selectTranslationItems(items, selectedIds, scope, states);
  const count = (types) => selected.filter((item) => types.includes(item.contentType)).length;
  const allStates = Object.values(states);
  const countResources = (resourceType) => (items || []).filter((item) => item.resourceType === resourceType).length;
  const stateFor = (item) => states[item.id]?.status || item.translationStatus;
  const translatedResources = (resourceType) => (items || []).filter((item) => item.resourceType === resourceType && ["translated", "needs_review", "reviewed"].includes(stateFor(item))).length;
  return {
    selectedItemIds: selected.map((item) => item.id),
    recommendations: count(["recommendation", "recommendation_title", "recommendation_table", "recommendation_table_row"]),
    dosingTables: selected.filter((item) => item.resourceType === "clinical_table" && item.clinicalTableSubtype === "dosing").length,
    importantTables: selected.filter((item) => item.resourceType === "clinical_table" && item.clinicalTableSubtype !== "dosing").length,
    skipped: (items || []).filter((item) => item.translationEligibility === "not_required").length + allStates.filter((state) => state?.status === "skipped").length,
    manualOnly: (items || []).filter((item) => item.translationEligibility === "manual_only").length,
    completed: allStates.filter((state) => state?.status === "translated" || state?.status === "needs_review" || state?.status === "reviewed").length,
    awaitingReview: allStates.filter((state) => state?.status === "needs_review").length,
    pending: allStates.filter((state) => ["pending", "queued", "processing", "failed_retryable"].includes(state?.status)).length,
    incompleteMandatory: (items || []).filter((item) => item.contentType === "recommendation_table_incomplete").length,
    resources: {
      recommendationTables: { expected: null, extracted: countResources("recommendation_table"), translated: translatedResources("recommendation_table") },
      clinicalTables: { expected: null, extracted: countResources("clinical_table"), translated: translatedResources("clinical_table") },
      figures: { expected: null, extracted: countResources("figure"), translated: translatedResources("figure"), needsCropReview: (items || []).filter((item) => item.resourceType === "figure" && item.figure?.extractionStatus === "needs_crop_review").length, permissionBlocked: (items || []).filter((item) => item.resourceType === "figure" && !["permission_granted", "link_only"].includes(item.figure?.permissionStatus)).length },
    },
    estimatedRequests: selected.length,
  };
}

export function expectedInventoryForDocument(metadata = {}) {
  const haystack = `${metadata.title || ""} ${metadata.fileName || ""} ${metadata.organization || ""}`;
  return /2023\s+esc.*(?:acute coronary syndrome|acs)|(?:acute coronary syndrome|acs).*2023\s+esc/i.test(haystack)
    ? ESC_ACS_2023_EXPECTED_INVENTORY
    : null;
}

export function inventoryDiagnostics(items, metadata = {}) {
  const expected = expectedInventoryForDocument(metadata);
  if (!expected) return [];
  const count = (resourceType) => (items || []).filter((item) => item.resourceType === resourceType).length;
  const actual = { recommendationTables: count("recommendation_table"), clinicalTables: count("clinical_table"), figures: count("figure") };
  return Object.entries(expected).flatMap(([key, expectedCount]) => actual[key] >= expectedCount
    ? []
    : [{ code: `inventory_missing_${key}`, severity: key === "figures" ? "warning" : "warning", expected: expectedCount, extracted: actual[key], message: `Phát hiện ${actual[key]}/${expectedCount} ${key}; cần xác nhận đây là đúng ấn bản hoặc bổ sung mục còn thiếu.` }]);
}
