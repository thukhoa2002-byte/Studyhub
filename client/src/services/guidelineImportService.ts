import { supabase } from "./supabase";
import { createGuidelineDocument, createGuidelineEntries, type NewGuidelineEntry } from "./guidelines";
import { createThuoc, getAllThuoc, updateThuoc } from "./thuocService";
import type { Drug } from "../types/drug";
import type { GuidelineImportCandidate, GuidelineImportScope } from "../utils/guidelineImport";
import type { DrugImportCandidate } from "../utils/drugImport";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);

export interface GuidelineImportItem {
  id: string;
  type: "table" | "figure" | "algorithm" | "flowchart" | "appendix" | "document";
  label: string;
  title: string;
  pageStart: number | null;
  pageEnd: number | null;
  startOffset?: number;
  endOffset?: number;
  contentType?: string;
  clinicalImportance?: "required" | "important" | "optional" | "exclude";
  translationEligibility?: "automatic" | "manual_only" | "not_required" | "blocked_pending_extraction";
  manualReviewRequired?: boolean;
  mandatory?: boolean;
  sourceHash?: string;
  translationStatus?: string;
}

export type GuidelineTranslationScope = "clinical_essentials" | "recommendations_only" | "selected_content" | "full_translation";
export type GuidelineTranslationProvider = "gemini" | "openai" | "gemini_then_openai";

export interface GuidelineImportJob {
  id: string;
  owner_id: string;
  target_guideline_id: string | null;
  import_mode: "create_new" | "existing_guideline";
  source_language: string;
  target_language: string;
  preserve_english_terminology: boolean;
  preserve_abbreviations: boolean;
  status: string;
  progress: number;
  current_stage: string;
  total_pages: number | null;
  processed_pages: number;
  source_metadata: Record<string, unknown>;
  analysis_metadata: { items?: GuidelineImportItem[]; document?: Record<string, unknown>; selectedItemIds?: string[]; translationScope?: GuidelineTranslationScope; translationProvider?: GuidelineTranslationProvider; itemStates?: Record<string, { status?: string; selected?: boolean; [key: string]: unknown }>; translationSummary?: Record<string, number>; localDiagnostics?: Array<{ code: string; count: number; itemIds: string[] }>; tableTranslations?: Record<string, unknown>; [key: string]: unknown };
  imported_guideline_id: string | null;
  error_message: string;
  created_at: string;
  updated_at: string;
}

export interface GuidelineImportDocument {
  id: string;
  original_filename: string;
  mime_type: string;
  source_language: string;
  storage_path: string;
  checksum: string;
  file_size: number;
  page_count: number | null;
  ocr_required: boolean;
  ocr_status: string;
}

export interface GuidelineImportSection {
  id: string;
  parent_section_id: string | null;
  source_key: string;
  title_original: string;
  title_vi: string;
  summary_original: string;
  summary_vi: string;
  level: number;
  source_page: number | null;
  source_anchor: string;
  display_order: number;
  review_status: "pending" | "accepted" | "rejected" | "needs_review";
  duplicate_status: "new" | "exact" | "possible" | "update";
}

export interface GuidelineImportRecommendation {
  id: string;
  import_section_id: string | null;
  source_key: string;
  title_original: string;
  recommendation_text_original: string;
  recommendation_text_vi: string;
  rationale_vi: string;
  recommendation_class: string;
  evidence_level: string;
  evidence_system: string;
  population: string;
  intervention: string;
  comparator: string;
  outcome: string;
  conditions: string;
  contraindications: string;
  source_page: number | null;
  source_quote: string;
  source_anchor: string;
  coordinates: Record<string, unknown>;
  confidence: number | null;
  review_status: "pending" | "accepted" | "rejected" | "needs_review";
  verification_status: "unverified" | "needs_review" | "verified" | "rejected";
  duplicate_status: "new" | "exact" | "possible" | "update";
  duplicate_target_id: string | null;
  issue_count: number;
  display_order: number;
}

export interface GuidelineImportIssue {
  id: string;
  recommendation_id: string | null;
  severity: "info" | "warning" | "error" | "blocking";
  issue_code: string;
  message: string;
  source_page: number | null;
  resolved: boolean;
}

export interface GuidelineImportJobData {
  job: GuidelineImportJob;
  document: GuidelineImportDocument | null;
  sections: GuidelineImportSection[];
  recommendations: GuidelineImportRecommendation[];
  issues: GuidelineImportIssue[];
  terminology: Array<{ id: string; source_term: string; preferred_translation: string; locked: boolean }>;
  events: Array<{ id: string; event_type: string; stage: string; payload: Record<string, unknown>; created_at: string }>;
}

async function accessToken(): Promise<string> {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session?.access_token) throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
    session = refreshed.data.session;
  }
  return session.access_token;
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; validationErrors?: string[] } | null;
    const error = new Error(body?.message || `Máy chủ trả về lỗi ${response.status}.`);
    (error as Error & { validationErrors?: string[] }).validationErrors = body?.validationErrors;
    throw error;
  }
  return response;
}

export async function listGuidelineImportJobs(): Promise<GuidelineImportJob[]> {
  const response = await request("/api/admin/guideline-import/jobs");
  return ((await response.json()) as { jobs?: GuidelineImportJob[] }).jobs || [];
}

export async function uploadGuidelineImport(input: { file: File; targetGuidelineId?: string; sourceLanguage: string; targetLanguage: string; preserveEnglishTerminology: boolean; preserveAbbreviations: boolean; translationScope: GuidelineTranslationScope; translationProvider: GuidelineTranslationProvider; note?: string }): Promise<{ job: GuidelineImportJob; items: GuidelineImportItem[] }> {
  const body = new FormData();
  body.append("file", input.file);
  if (input.targetGuidelineId) body.append("targetGuidelineId", input.targetGuidelineId);
  body.append("sourceLanguage", input.sourceLanguage);
  body.append("targetLanguage", input.targetLanguage);
  body.append("preserveEnglishTerminology", String(input.preserveEnglishTerminology));
  body.append("preserveAbbreviations", String(input.preserveAbbreviations));
  body.append("translationScope", input.translationScope);
  body.append("translationProvider", input.translationProvider);
  if (input.note) body.append("note", input.note);
  const response = await request("/api/admin/guideline-import/jobs", { method: "POST", body });
  return await response.json() as { job: GuidelineImportJob; items: GuidelineImportItem[] };
}

export async function getGuidelineImportJob(jobId: string): Promise<GuidelineImportJobData> {
  const response = await request(`/api/admin/guideline-import/jobs/${encodeURIComponent(jobId)}`);
  return await response.json() as GuidelineImportJobData;
}

export async function processGuidelineImport(jobId: string, itemIds: string[], translationScope: GuidelineTranslationScope, translationProvider: GuidelineTranslationProvider): Promise<void> {
  await request(`/api/admin/guideline-import/jobs/${encodeURIComponent(jobId)}/process`, { method: "POST", body: JSON.stringify({ itemIds, translationScope, translationProvider }) });
}

export async function resumeGuidelineImport(jobId: string, itemIds: string[] | undefined, translationScope: GuidelineTranslationScope, translationProvider: GuidelineTranslationProvider): Promise<void> {
  await request(`/api/admin/guideline-import/jobs/${encodeURIComponent(jobId)}/resume`, { method: "POST", body: JSON.stringify({ itemIds, translationScope, translationProvider }) });
}

export async function correctGuidelineImportItemClassification(jobId: string, itemId: string, reason: string, classification: "not_recommendation_table" | "clinically_important_table" = "not_recommendation_table"): Promise<GuidelineImportItem> {
  const response = await request(`/api/admin/guideline-import/jobs/${encodeURIComponent(jobId)}/items/${encodeURIComponent(itemId)}/classification`, { method: "POST", body: JSON.stringify({ reason, classification }) });
  return ((await response.json()) as { item: GuidelineImportItem }).item;
}

export async function updateGuidelineImportSection(sectionId: string, patch: Partial<GuidelineImportSection>): Promise<GuidelineImportSection> {
  const response = await request(`/api/admin/guideline-import/sections/${encodeURIComponent(sectionId)}`, { method: "PATCH", body: JSON.stringify(patch) });
  return ((await response.json()) as { section: GuidelineImportSection }).section;
}

export async function updateGuidelineImportRecommendation(recommendationId: string, patch: Partial<GuidelineImportRecommendation>): Promise<GuidelineImportRecommendation> {
  const response = await request(`/api/admin/guideline-import/recommendations/${encodeURIComponent(recommendationId)}`, { method: "PATCH", body: JSON.stringify(patch) });
  return ((await response.json()) as { recommendation: GuidelineImportRecommendation }).recommendation;
}

export async function bulkImportGuideline(jobId: string): Promise<{ guidelineId: string }> {
  const response = await request(`/api/admin/guideline-import/jobs/${encodeURIComponent(jobId)}/import`, { method: "POST", body: JSON.stringify({}) });
  return await response.json() as { guidelineId: string };
}

export async function deleteGuidelineImportJob(jobId: string): Promise<void> {
  await request(`/api/admin/guideline-import/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
}

// Kept for the existing Drug import flow. The Sprint D API is exposed above
// without changing the legacy guideline-table import contract.
type DuplicateChoice = "skip" | "copy" | "update";

function condition(value: string): "ACS" | "HF" | "AF" | "Khác" {
  const normalized = value.toLocaleLowerCase();
  if (normalized.includes("acs") || normalized.includes("coronary")) return "ACS";
  if (normalized.includes("heart failure") || normalized.includes("suy tim")) return "HF";
  if (normalized.includes("atrial") || normalized.includes("rung nhĩ")) return "AF";
  return "Khác";
}

function duplicateFor(candidate: DrugImportCandidate, existing: Drug[]): Drug | undefined {
  return existing.find((drug) => drug.id === candidate.parsedDrug.id || drug.slug === candidate.parsedDrug.slug || drug.genericName.toLocaleLowerCase() === String(candidate.parsedDrug.genericName || "").toLocaleLowerCase());
}

function saveDrug(candidate: DrugImportCandidate, choice: DuplicateChoice, existing: Drug[], guidelineId?: string): Drug | undefined {
  const duplicate = duplicateFor(candidate, existing);
  if (duplicate && choice === "skip") return duplicate;
  const guidelineReferences = [...new Set([...(duplicate?.guidelineReferences || []), ...(candidate.parsedDrug.guidelineReferences || []), ...(guidelineId ? [guidelineId] : [])])];
  const payload = { ...candidate.parsedDrug, status: "draft" as const, sourceVerified: false, guidelineReferences, provenance: candidate.provenance || candidate.parsedDrug.provenance || [], importMetadata: candidate.aiMetadata };
  if (duplicate && choice === "update") return updateThuoc(duplicate.id, payload);
  if (duplicate && choice === "copy") {
    const suffix = `-import-${Date.now()}`;
    return createThuoc({ ...payload, id: `${payload.id || "thuoc"}${suffix}`, slug: `${payload.slug || "thuoc"}${suffix}` });
  }
  return createThuoc(payload);
}

export async function saveGuidelineTableImport({ candidate, scope, selectedDrugIds, duplicateChoices, userId }: { candidate: GuidelineImportCandidate; scope: GuidelineImportScope; selectedDrugIds: string[]; duplicateChoices: Record<string, DuplicateChoice>; userId: string }): Promise<{ guidelineId?: string; savedDrugIds: string[]; skippedDrugNames: string[] }> {
  const existing = getAllThuoc();
  const shouldCreateGuideline = scope !== "drugs";
  let document: Awaited<ReturnType<typeof createGuidelineDocument>> | undefined;
  if (shouldCreateGuideline) {
    document = await createGuidelineDocument(userId, {
      title: candidate.guideline.titleVi || candidate.guideline.title || candidate.table.name,
      society: candidate.guideline.organization || "Chưa xác định",
      condition: condition(candidate.guideline.specialty),
      publicationYear: candidate.guideline.publicationYear || new Date().getFullYear(),
      versionLabel: candidate.guideline.version || "",
      sourceUrl: candidate.guideline.sourceUrl || "",
      visibility: "private",
      tableName: candidate.table.name,
      tableNumber: candidate.table.number,
      summary: candidate.guideline.summary || candidate.commonGuidance.why || "",
      topics: candidate.guideline.topics || [],
      provenance: [...candidate.provenance, { kind: "group_guidance", ...candidate.commonGuidance }, { kind: "localized_content", data: candidate.localizedContent }],
    });
  }

  const savedDrugs: Drug[] = [];
  const savedByCandidate = new Map<string, Drug>();
  const skippedDrugNames: string[] = [];
  if (scope === "drugs" || scope === "both") {
    for (const drugCandidate of candidate.drugCandidates.filter((item) => selectedDrugIds.includes(item.candidateId))) {
      const choice = duplicateChoices[drugCandidate.candidateId] || "skip";
      const duplicate = duplicateFor(drugCandidate, existing);
      if (scope === "drugs" && duplicate && choice === "skip") { skippedDrugNames.push(String(drugCandidate.parsedDrug.genericName || "Thuốc")); continue; }
      const saved = saveDrug(drugCandidate, choice, existing, document?.id);
      if (saved) { savedDrugs.push(saved); savedByCandidate.set(drugCandidate.candidateId, saved); }
    }
  }

  if (!document) return { savedDrugIds: savedDrugs.map((drug) => drug.id), skippedDrugNames };

  const entries: NewGuidelineEntry[] = candidate.rows.map((row, index) => {
    const linkedCandidate = candidate.drugCandidates[index];
    const linkedDrug = linkedCandidate ? savedByCandidate.get(linkedCandidate.candidateId) || duplicateFor(linkedCandidate, existing) : undefined;
    const page = row.page || candidate.table.page;
    return {
      document_id: document!.id,
      drug_id: scope === "guideline" ? null : linkedDrug?.id || null,
      topic: candidate.table.name || candidate.guideline.titleVi,
      drug_name: row.drugName,
      clinical_context: row.clinicalContext,
      recommendation_summary: "",
      dose: row.dose,
      renal_adjustment: row.renalAdjustment,
      hepatic_adjustment: row.hepaticAdjustment,
      contraindications: row.contraindications,
      monitoring: row.monitoring,
      recommendation_class: "",
      evidence_level: "",
      page_reference: `${candidate.guideline.titleVi}${page ? ` — ${page}` : ""}${candidate.table.number ? ` — ${candidate.table.number}` : ""}`,
      source_order: index + 1,
      table_kind: "data" as const,
      table_row_role: "body" as const,
      table_cells: row.tableCells,
      provenance: [...candidate.provenance, { kind: "localized_content", data: row.localizedContent }],
    };
  }).filter((entry) => scope !== "link_existing" || Boolean(entry.drug_id));
  await createGuidelineEntries(userId, entries);

  const linkedIds = entries.flatMap((entry) => entry.drug_id ? [entry.drug_id] : []);
  for (const drugId of linkedIds) {
    const drug = getAllThuoc().find((item) => item.id === drugId);
    if (drug && !drug.guidelineReferences.includes(document.id)) updateThuoc(drug.id, { guidelineReferences: [...drug.guidelineReferences, document.id] });
  }
  return { guidelineId: document.id, savedDrugIds: savedDrugs.map((drug) => drug.id), skippedDrugNames };
}
