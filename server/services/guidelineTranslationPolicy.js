import { createHash } from "node:crypto";

export const TRANSLATION_SCOPES = ["clinical_essentials", "recommendations_only", "selected_content", "full_translation"];
export const TRANSLATION_PROVIDERS = ["gemini", "openai", "gemini_then_openai"];

const recommendationSignals = /\brecommendation(?:s)?\b|class of recommendation|level of evidence|\bclass\s*(?:i|ii|iii|iv)\b|\bloe\b|recommended|should be considered|may be considered|not recommended|should not be used/i;
const dosingSignals = /\bdose|dosage|dosing|regimen|frequency|duration|renal impairment|hepatic impairment|dose adjustment\b/i;
const contraindicationSignals = /\bcontraindication|precaution|warning|what not to do\b/i;
const diagnosticSignals = /\bdiagnos(?:is|tic)|criteria|threshold|risk|score|stratification\b/i;
const treatmentSignals = /\btreatment|management|monitoring|follow-up|follow up|drug interaction|what to do\b/i;
const excludedSignals = /\breferences?\b|bibliography|authors?|table of contents|abbreviations?|glossary|metadata|header|footer|page \d+\b/i;

function text(value) { return String(value || "").trim(); }
function fingerprint(value) { return createHash("sha256").update(text(value)).digest("hex"); }

function tableHasBody(item) {
  const lines = text(item.text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return false;
  const heading = `${item.label || ""} ${item.title || ""}`.trim();
  const bodyLines = lines.filter((line) => line !== heading);
  const body = bodyLines.join(" ");
  // Short dosing and recommendation tables are still complete when their rows
  // are present. Treat actual rows/cells as structure, not as a word-count test.
  return bodyLines.length >= 2 && (body.length >= 24 || bodyLines.some((line) => /\||\t|\s{2,}/.test(line)));
}

function tableClassification(haystack, hasBody) {
  // Recommendation tables are a completion gate. A partial extract can never be
  // silently skipped or translated as if it were complete.
  if (!hasBody && recommendationSignals.test(haystack)) return { contentType: "recommendation_table_incomplete", clinicalImportance: "required", translationEligibility: "blocked_pending_extraction", manualReviewRequired: true, mandatory: true, diagnosticCode: "recommendation_table_incomplete" };
  if (!hasBody) return { contentType: "missing_content", clinicalImportance: "exclude", translationEligibility: "not_required", manualReviewRequired: false, diagnosticCode: "missing_content" };
  if (recommendationSignals.test(haystack)) return { contentType: "recommendation_table", clinicalImportance: "required", translationEligibility: "automatic", manualReviewRequired: false, mandatory: true };
  if (/renal impairment|hepatic impairment|dose adjustment/i.test(haystack)) return { contentType: "dose_adjustment_table", clinicalImportance: "required", translationEligibility: "automatic", manualReviewRequired: false };
  if (/contraindication/i.test(haystack)) return { contentType: "contraindication_table", clinicalImportance: "required", translationEligibility: "automatic", manualReviewRequired: false };
  if (/precaution|warning/i.test(haystack)) return { contentType: "precaution_table", clinicalImportance: "important", translationEligibility: "automatic", manualReviewRequired: false };
  if (/drug interaction/i.test(haystack)) return { contentType: "drug_interaction_table", clinicalImportance: "important", translationEligibility: "automatic", manualReviewRequired: false };
  if (/monitoring|follow-up|follow up/i.test(haystack)) return { contentType: "monitoring_table", clinicalImportance: "important", translationEligibility: "automatic", manualReviewRequired: false };
  if (/diagnos(?:is|tic)|criteria|threshold/i.test(haystack)) return { contentType: "diagnostic_criteria_table", clinicalImportance: "important", translationEligibility: "automatic", manualReviewRequired: false };
  if (/risk|score|stratification/i.test(haystack)) return { contentType: "risk_stratification_table", clinicalImportance: "important", translationEligibility: "automatic", manualReviewRequired: false };
  if (/treatment|management/i.test(haystack)) return { contentType: "treatment_table", clinicalImportance: "important", translationEligibility: "automatic", manualReviewRequired: false };
  if (dosingSignals.test(haystack)) return { contentType: "dosing_table", clinicalImportance: "required", translationEligibility: "automatic", manualReviewRequired: false };
  return { contentType: "general_table", clinicalImportance: "optional", translationEligibility: "manual_only", manualReviewRequired: true };
}

export function classifyGuidelineItem(item) {
  const source = text(item.text);
  const haystack = `${item.label || ""}\n${item.title || ""}\n${source}`;
  let classification;
  if (!source) classification = { contentType: "missing_content", clinicalImportance: "exclude", translationEligibility: "not_required", manualReviewRequired: false, diagnosticCode: "missing_content" };
  else if (excludedSignals.test(`${item.label || ""} ${item.title || ""}`)) classification = { contentType: /glossary|abbreviations?/i.test(haystack) ? "glossary" : "reference", clinicalImportance: "exclude", translationEligibility: "not_required", manualReviewRequired: false, diagnosticCode: "non_actionable_content" };
  else if (item.type === "figure") classification = { contentType: "figure_caption", clinicalImportance: "optional", translationEligibility: "manual_only", manualReviewRequired: false, diagnosticCode: "figure_caption" };
  else if (item.type === "table") classification = tableClassification(haystack, tableHasBody(item));
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
    const duplicate = duplicateOf && duplicateOf !== item.id;
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
    if (["dosing_table", "dose_adjustment_table"].includes(item.contentType)) return 2;
    if (["contraindication_table", "precaution_table"].includes(item.contentType)) return 3;
    if (["diagnostic_criteria_table", "risk_stratification_table"].includes(item.contentType)) return 4;
    if (["treatment_table", "monitoring_table", "drug_interaction_table", "clinically_important_table"].includes(item.contentType)) return 5;
    return 6;
  };
  return (items || []).filter((item) => {
    const state = states[item.id] || {};
    const explicitlySelected = selected.has(String(item.id));
    if (state.status === "translated" || state.status === "needs_review" || state.status === "not_required" || state.status === "skipped" || state.status === "blocked_pending_extraction") return false;
    if ((!explicitlySelected && !item.mandatory) || !isEligibleForScope(item, scope, explicitlySelected)) return false;
    if (state.duplicateOf || uniqueSourceHashes.has(item.sourceHash)) return false;
    uniqueSourceHashes.add(item.sourceHash);
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
    return status !== "translated" && status !== "needs_review" && !(status === "skipped" && state.duplicateOf);
  });
  return { total: mandatory.length, unresolved: unresolved.map((item) => item.id), complete: unresolved.length === 0 };
}

export function translationSummary(items, selectedIds, scope, states = {}) {
  const selected = selectTranslationItems(items, selectedIds, scope, states);
  const count = (types) => selected.filter((item) => types.includes(item.contentType)).length;
  const allStates = Object.values(states);
  return {
    selectedItemIds: selected.map((item) => item.id),
    recommendations: count(["recommendation", "recommendation_title", "recommendation_table", "recommendation_table_row"]),
    dosingTables: count(["dosing_table", "dose_adjustment_table"]),
    importantTables: count(["contraindication_table", "precaution_table", "diagnostic_criteria_table", "risk_stratification_table", "treatment_table", "monitoring_table", "drug_interaction_table", "clinically_important_table"]),
    skipped: (items || []).filter((item) => item.translationEligibility === "not_required").length + allStates.filter((state) => state?.status === "skipped").length,
    manualOnly: (items || []).filter((item) => item.translationEligibility === "manual_only").length,
    completed: allStates.filter((state) => state?.status === "translated" || state?.status === "needs_review").length,
    pending: allStates.filter((state) => ["pending", "queued", "processing", "failed_retryable"].includes(state?.status)).length,
    incompleteMandatory: (items || []).filter((item) => item.contentType === "recommendation_table_incomplete").length,
    estimatedRequests: selected.length,
  };
}
