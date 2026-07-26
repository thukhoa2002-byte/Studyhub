import { AlertTriangle, Check, ChevronRight, FileArchive, FileText, Pause, Play, RefreshCw, Search, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { GuidelineCoreDocument } from "../services/guidelineCoreTypes";
import { listGuidelineCoreDocuments } from "../services/guidelineRepository";
import {
  bulkImportGuideline,
  correctGuidelineImportItemClassification,
  deleteGuidelineImportJob,
  getGuidelineImportJob,
  listGuidelineImportJobs,
  processGuidelineImport,
  resumeGuidelineImport,
  updateGuidelineImportRecommendation,
  updateGuidelineImportSection,
  uploadGuidelineImport,
  type GuidelineImportItem,
  type GuidelineImportJob,
  type GuidelineImportJobData,
  type GuidelineImportRecommendation,
  type GuidelineImportSection,
  type GuidelineTranslationProvider,
  type GuidelineTranslationScope,
} from "../services/guidelineImportService";

type Notice = { type: "error" | "success" | "info"; text: string } | null;
const statusLabels: Record<string, string> = { uploaded: "Đã tải lên", analysing: "Đang phân tích", ready_for_review: "Chờ chọn mục", processing: "Đang xử lý AI", review: "Đang rà soát", ready_to_import: "Sẵn sàng nhập", importing: "Đang nhập Core", completed: "Đã nhập draft", paused: "Đã tạm dừng", failed: "Lỗi" };
const stageLabels: Record<string, string> = { document_analysis: "Đã phân tích, chờ chọn mục", selection: "Đang chọn phạm vi dịch", queued: "Đang xếp hàng xử lý", ai_extraction: "AI đang trích xuất", review: "Đang chuẩn bị rà soát", resuming: "Đang tiếp tục xử lý", quota_paused: "Tạm dừng do quota", mandatory_tables_pending: "Còn bảng khuyến cáo bắt buộc", core_import: "Đang nhập Core", completed: "Hoàn tất", error: "Có lỗi" };
const itemLabels: Record<GuidelineImportItem["type"], string> = { table: "Bảng", figure: "Hình", algorithm: "Thuật toán", flowchart: "Lưu đồ", appendix: "Phụ lục", document: "Tài liệu" };

function errorText(error: unknown): string { return error instanceof Error ? error.message : "Không thể hoàn tất thao tác."; }
function issueClass(severity: string): string { return severity === "blocking" || severity === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-200 bg-sky-50 text-sky-800"; }
function reviewClass(status: string): string { return status === "accepted" ? "bg-teal-50 text-teal-700" : status === "rejected" ? "bg-rose-50 text-rose-700" : status === "needs_review" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"; }
const scopeLabels: Record<GuidelineTranslationScope, string> = { clinical_essentials: "Nội dung lâm sàng thiết yếu", recommendations_only: "Chỉ khuyến cáo", selected_content: "Nội dung đã chọn", full_translation: "Dịch toàn bộ" };
const recommendationTypes = new Set(["recommendation", "recommendation_title", "recommendation_table", "recommendation_table_row", "recommendation_table_incomplete"]);
function defaultScopeSelection(items: GuidelineImportItem[], scope: GuidelineTranslationScope) {
  return items.filter((item) => {
    if (item.mandatory && item.translationEligibility === "automatic") return true;
    if (item.translationEligibility === "not_required" || item.translationEligibility === "blocked_pending_extraction") return false;
    if (scope === "full_translation") return true;
    if (scope === "recommendations_only") return recommendationTypes.has(item.contentType || "");
    if (scope === "selected_content") return false;
    return item.translationEligibility === "automatic";
  }).map((item) => item.id);
}
function enforceMandatorySelection(items: GuidelineImportItem[], selected: string[]) {
  return [...new Set([...selected, ...items.filter((item) => item.mandatory && item.translationEligibility === "automatic").map((item) => item.id)])];
}

export default function AdminGuidelineImportPage({ onNavigate }: { user: User; onNavigate: (path: string) => void }) {
  const [jobs, setJobs] = useState<GuidelineImportJob[]>([]);
  const [documents, setDocuments] = useState<GuidelineCoreDocument[]>([]);
  const [jobData, setJobData] = useState<GuidelineImportJobData | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [targetGuidelineId, setTargetGuidelineId] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("vi");
  const [preserveTerminology, setPreserveTerminology] = useState(true);
  const [preserveAbbreviations, setPreserveAbbreviations] = useState(true);
  const [translationScope, setTranslationScope] = useState<GuidelineTranslationScope>("clinical_essentials");
  const [translationProvider, setTranslationProvider] = useState<GuidelineTranslationProvider>("gemini");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  async function loadJobs() { try { setJobs(await listGuidelineImportJobs()); } catch (error) { setNotice({ type: "error", text: errorText(error) }); } }
  useEffect(() => { void loadJobs(); void listGuidelineCoreDocuments().then(setDocuments).catch(() => undefined); }, []);

  useEffect(() => {
    const jobId = jobData?.job.id;
    const jobStatus = jobData?.job.status;
    if (!jobId || !["processing", "analysing", "importing"].includes(jobStatus || "")) return;
    const timer = window.setInterval(() => { void getGuidelineImportJob(jobId).then(setJobData).catch(() => undefined); }, 1800);
    return () => window.clearInterval(timer);
  }, [jobData?.job.id, jobData?.job.status]);

  const items = (jobData?.job.analysis_metadata?.items || []) as GuidelineImportItem[];
  const visibleRecommendations = useMemo(() => {
    if (!jobData) return [];
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return jobData.recommendations;
    return jobData.recommendations.filter((item) => [item.title_original, item.recommendation_text_original, item.recommendation_text_vi, item.evidence_level].some((value) => value.toLocaleLowerCase().includes(needle)));
  }, [jobData, search]);
  const blockingIssues = jobData?.issues.filter((issue) => ["blocking", "error"].includes(issue.severity) && !issue.resolved) || [];
  const acceptedSections = jobData?.sections.filter((item) => item.review_status === "accepted").length || 0;
  const acceptedRecommendations = jobData?.recommendations.filter((item) => item.review_status === "accepted").length || 0;

  async function upload() {
    if (!file) { setNotice({ type: "error", text: "Hãy chọn PDF, DOCX, Markdown, HTML hoặc TXT." }); return; }
    setBusy(true); setNotice(null);
    try { const result = await uploadGuidelineImport({ file, targetGuidelineId: targetGuidelineId || undefined, sourceLanguage, targetLanguage, preserveEnglishTerminology: preserveTerminology, preserveAbbreviations, translationScope, translationProvider }); const data = await getGuidelineImportJob(result.job.id); setJobData(data); setSelectedItems(defaultScopeSelection(result.items, translationScope)); await loadJobs(); setNotice({ type: "success", text: "Đã phân loại nội dung. Chỉ mục lâm sàng thiết yếu được chọn tự động." }); }
    catch (error) { setNotice({ type: "error", text: errorText(error) }); }
    finally { setBusy(false); }
  }

  async function processSelected() {
    if (!jobData || selectedItems.length === 0) return;
    if (translationScope === "full_translation" && !window.confirm("Dịch toàn bộ có thể dùng nhiều quota hơn. Bạn có muốn tiếp tục?")) return;
    setBusy(true); setNotice(null);
    try {
      await processGuidelineImport(jobData.job.id, enforceMandatorySelection(items, selectedItems), translationScope, translationProvider);
      setJobData(await getGuidelineImportJob(jobData.job.id));
      await loadJobs();
      setNotice({ type: "info", text: "Đã bắt đầu xử lý nền. Bạn có thể chuyển tab và quay lại." });
    }
    catch (error) { setNotice({ type: "error", text: errorText(error) }); }
    finally { setBusy(false); }
  }

  async function resume() {
    if (!jobData) return;
    setBusy(true);
    try {
      await resumeGuidelineImport(jobData.job.id, enforceMandatorySelection(items, selectedItems), translationScope, translationProvider);
      setJobData(await getGuidelineImportJob(jobData.job.id));
      await loadJobs();
      setNotice({ type: "info", text: "Đã tiếp tục từ checkpoint gần nhất." });
    }
    catch (error) { setNotice({ type: "error", text: errorText(error) }); }
    finally { setBusy(false); }
  }

  async function importCore() {
    if (!jobData || blockingIssues.length || acceptedSections === 0 || acceptedRecommendations === 0) return;
    if (!window.confirm("Nhập các mục đã duyệt thành Guideline Core draft? Nội dung sẽ không tự xuất bản.")) return;
    setBusy(true);
    try { const result = await bulkImportGuideline(jobData.job.id); setNotice({ type: "success", text: "Đã tạo Guideline Core draft. Cần rà soát và xuất bản riêng." }); await loadJobs(); const data = await getGuidelineImportJob(jobData.job.id); setJobData(data); if (result.guidelineId) onNavigate(`/admin/guidelines/${result.guidelineId}/edit`); }
    catch (error) { setNotice({ type: "error", text: errorText(error) }); }
    finally { setBusy(false); }
  }

  async function removeJob() {
    if (!jobData || !window.confirm("Xóa phiên import và file nguồn riêng tư?")) return;
    setBusy(true); try { await deleteGuidelineImportJob(jobData.job.id); setJobData(null); setFile(null); await loadJobs(); setNotice({ type: "success", text: "Đã xóa phiên import." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); } finally { setBusy(false); }
  }

  async function updateTableClassification(item: GuidelineImportItem, classification: "not_recommendation_table" | "clinically_important_table") {
    if (!jobData) return;
    const reason = window.prompt(classification === "not_recommendation_table" ? "Lý do xác nhận đây không phải bảng khuyến cáo:" : "Lý do đánh dấu đây là bảng lâm sàng quan trọng:");
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await correctGuidelineImportItemClassification(jobData.job.id, item.id, reason.trim(), classification);
      const data = await getGuidelineImportJob(jobData.job.id);
      setJobData(data);
      setSelectedItems(enforceMandatorySelection((data.job.analysis_metadata.items || []) as GuidelineImportItem[], data.job.analysis_metadata.selectedItemIds || []));
      setNotice({ type: "success", text: classification === "clinically_important_table" ? "Đã đánh dấu bảng lâm sàng quan trọng kèm lý do rà soát." : "Đã lưu điều chỉnh phân loại kèm lý do rà soát." });
    } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto w-full max-w-[1500px]">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-violet-600">Guideline Import Pipeline</p><h1 className="mt-1 text-2xl font-extrabold text-rose-950">Nhập Guideline bằng AI</h1><p className="mt-1 text-sm font-semibold text-slate-500">Upload → phân tích cấu trúc → rà soát → nhập thành Core draft.</p></div><button type="button" onClick={() => onNavigate("/admin/guidelines")} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-600">Danh sách Guideline</button></div>
    {notice && <div role="alert" className={`mt-4 rounded-xl border px-4 py-3 text-sm font-bold ${notice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : notice.type === "success" ? "border-teal-200 bg-teal-50 text-teal-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}>{notice.text}</div>}
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(330px,.75fr)_minmax(0,1.6fr)]">
      <aside className="space-y-4"><section className="rounded-2xl border border-violet-200 bg-white/85 p-4"><div className="flex items-center gap-2"><Upload size={18} className="text-violet-700" /><h2 className="font-extrabold text-slate-800">Tài liệu nguồn</h2></div><label className="mt-4 block rounded-xl border border-dashed border-violet-300 bg-violet-50/30 p-5 text-center"><input type="file" accept=".pdf,.docx,.md,.markdown,.html,.htm,.txt" onChange={(event) => setFile(event.target.files?.[0] || null)} className="sr-only" /><FileArchive className="mx-auto text-violet-600" size={28} /><strong className="mt-2 block text-sm text-slate-800">{file?.name || "Chọn PDF, DOCX, Markdown, HTML hoặc TXT"}</strong><span className="mt-1 block text-xs font-semibold text-slate-500">Tài liệu riêng tư, không tự công khai</span></label><label className="mt-4 block text-xs font-extrabold text-slate-700">Đích nhập<select value={targetGuidelineId} onChange={(event) => setTargetGuidelineId(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="">Tạo Guideline mới</option>{documents.map((document) => <option key={document.id} value={document.id}>Cập nhật: {document.title}</option>)}</select></label><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs font-extrabold text-slate-700">Ngôn ngữ nguồn<select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold"><option value="en">English</option><option value="vi">Tiếng Việt</option><option value="other">Khác</option></select></label><label className="text-xs font-extrabold text-slate-700">Ngôn ngữ đích<select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold"><option value="vi">Tiếng Việt</option><option value="en">English</option><option value="bilingual">Song ngữ</option></select></label></div><label className="mt-3 block text-xs font-extrabold text-slate-700">Nhà cung cấp AI<select value={translationProvider} onChange={(event) => setTranslationProvider(event.target.value as GuidelineTranslationProvider)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold"><option value="gemini">Gemini only — dừng khi hết quota</option><option value="openai">OpenAI only</option><option value="gemini_then_openai">Gemini rồi OpenAI fallback</option></select></label><p className="mt-1 text-[11px] font-semibold text-amber-700">OpenAI chỉ được dùng khi bạn chọn rõ tùy chọn có OpenAI.</p><label className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={preserveTerminology} onChange={(event) => setPreserveTerminology(event.target.checked)} />Giữ thuật ngữ tiếng Anh khi cần</label><label className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={preserveAbbreviations} onChange={(event) => setPreserveAbbreviations(event.target.checked)} />Giữ viết tắt chuẩn</label><button type="button" disabled={busy || !file} onClick={() => void upload()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"><Upload size={16} />{busy ? "Đang xử lý..." : "Tải lên & phân tích"}</button></section><ImportHistory jobs={jobs} selectedId={jobData?.job.id || ""} onSelect={async (id) => { setNotice(null); try { const data = await getGuidelineImportJob(id); const scope = data.job.analysis_metadata.translationScope || "clinical_essentials"; setJobData(data); setTranslationScope(scope); setTranslationProvider(data.job.analysis_metadata.translationProvider || "gemini"); setSelectedItems(enforceMandatorySelection((data.job.analysis_metadata.items || []) as GuidelineImportItem[], data.job.analysis_metadata.selectedItemIds || defaultScopeSelection((data.job.analysis_metadata.items || []) as GuidelineImportItem[], scope))); } catch (error) { setNotice({ type: "error", text: errorText(error) }); } }} /></aside>
      <main className="min-w-0">{!jobData ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-14 text-center"><FileText className="mx-auto text-slate-400" size={36} /><h2 className="mt-3 text-base font-extrabold text-slate-700">Chưa chọn phiên import</h2><p className="mt-1 text-sm font-semibold text-slate-500">Chọn tài liệu bên trái để bắt đầu phân tích toàn bộ cấu trúc.</p></div> : <><TranslationScopePanel items={items} scope={translationScope} onScopeChange={(scope) => { setTranslationScope(scope); setSelectedItems(defaultScopeSelection(items, scope)); }} onCorrectMandatoryTable={(item) => void updateTableClassification(item, "not_recommendation_table")} onMarkClinicallyImportant={(item) => void updateTableClassification(item, "clinically_important_table")} /><JobReview data={jobData} items={items} selectedItems={selectedItems} setSelectedItems={(next) => setSelectedItems(enforceMandatorySelection(items, next))} visibleRecommendations={visibleRecommendations} search={search} setSearch={setSearch} blockingIssues={blockingIssues} busy={busy} onProcess={() => void processSelected()} onResume={() => void resume()} onImport={() => void importCore()} onDelete={() => void removeJob()} onRefresh={() => void getGuidelineImportJob(jobData.job.id).then((data) => { setJobData(data); setTranslationScope(data.job.analysis_metadata.translationScope || "clinical_essentials"); setTranslationProvider(data.job.analysis_metadata.translationProvider || "gemini"); setSelectedItems(enforceMandatorySelection((data.job.analysis_metadata.items || []) as GuidelineImportItem[], data.job.analysis_metadata.selectedItemIds || [])); })} onSectionChange={(section) => setJobData({ ...jobData, sections: jobData.sections.map((item) => item.id === section.id ? section : item) })} onRecommendationChange={(recommendation) => setJobData({ ...jobData, recommendations: jobData.recommendations.map((item) => item.id === recommendation.id ? recommendation : item) })} /></>}</main>
    </div>
  </div>;
}

function TranslationScopePanel({ items, scope, onScopeChange, onCorrectMandatoryTable, onMarkClinicallyImportant }: { items: GuidelineImportItem[]; scope: GuidelineTranslationScope; onScopeChange: (scope: GuidelineTranslationScope) => void; onCorrectMandatoryTable: (item: GuidelineImportItem) => void; onMarkClinicallyImportant: (item: GuidelineImportItem) => void }) {
  const count = (types: string[]) => items.filter((item) => types.includes(item.contentType || "")).length;
  const mandatory = items.filter((item) => item.mandatory).length;
  const incomplete = items.filter((item) => item.contentType === "recommendation_table_incomplete").length;
  const excluded = items.filter((item) => item.translationEligibility === "not_required").length;
  const incompleteItems = items.filter((item) => item.contentType === "recommendation_table_incomplete");
  const manualTables = items.filter((item) => item.type === "table" && item.translationEligibility === "manual_only");
  return <section className="mb-4 rounded-2xl border border-violet-200 bg-white/85 p-4"><div className="flex flex-wrap items-end justify-between gap-3"><label className="min-w-60 text-xs font-extrabold text-slate-700">Phạm vi dịch<select value={scope} onChange={(event) => onScopeChange(event.target.value as GuidelineTranslationScope)} className="mt-1 h-10 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm font-bold text-slate-800"><option value="clinical_essentials">Clinical essentials</option><option value="recommendations_only">Recommendations only</option><option value="selected_content">Selected content</option><option value="full_translation">Full translation (tốn quota hơn)</option></select></label><p className="max-w-xl text-xs font-semibold text-slate-500">{scopeLabels[scope]}. Bảng khuyến cáo bắt buộc luôn được giữ trong checklist; bảng thiếu nội dung sẽ chặn hoàn tất để khôi phục trang tiếp theo.</p></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5"><ScopeStat label="Khuyến cáo" value={count(["recommendation", "recommendation_title", "recommendation_table", "recommendation_table_row"])} tone="violet" /><ScopeStat label="Bảng liều" value={count(["dosing_table", "dose_adjustment_table"])} tone="teal" /><ScopeStat label="Bảng lâm sàng khác" value={count(["contraindication_table", "precaution_table", "diagnostic_criteria_table", "risk_stratification_table", "treatment_table", "monitoring_table", "drug_interaction_table", "clinically_important_table"])} tone="sky" /><ScopeStat label="Bắt buộc" value={mandatory} tone="rose" /><ScopeStat label="Loại trừ tự động" value={excluded} tone="slate" /></div>{incomplete > 0 && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800"><p>Có {incomplete} bảng khuyến cáo chưa đủ thân bảng. Không gửi fragment cho AI và không thể hoàn tất cho đến khi khôi phục/rà soát thủ công.</p>{incompleteItems.map((item) => <div key={item.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-rose-100 bg-white/70 px-2 py-1"><span>{item.label} {item.title ? `- ${item.title}` : ""}</span><button type="button" onClick={() => onCorrectMandatoryTable(item)} className="rounded border border-rose-300 bg-white px-2 py-1 text-[10px] font-extrabold text-rose-700">Không phải bảng khuyến cáo</button></div>)}</div>}{manualTables.length > 0 && <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800"><p>Bảng tùy chọn: chỉ đánh dấu quan trọng khi có lý do lâm sàng rõ ràng.</p>{manualTables.map((item) => <div key={item.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-sky-100 bg-white/70 px-2 py-1"><span>{item.label} {item.title ? `- ${item.title}` : ""}</span><button type="button" onClick={() => onMarkClinicallyImportant(item)} className="rounded border border-sky-300 bg-white px-2 py-1 text-[10px] font-extrabold text-sky-700">Đánh dấu quan trọng</button></div>)}</div>}</section>;
}

function ScopeStat({ label, value, tone }: { label: string; value: number; tone: "violet" | "teal" | "sky" | "rose" | "slate" }) { const classes = { violet: "border-violet-200 bg-violet-50 text-violet-800", teal: "border-teal-200 bg-teal-50 text-teal-800", sky: "border-sky-200 bg-sky-50 text-sky-800", rose: "border-rose-200 bg-rose-50 text-rose-800", slate: "border-slate-200 bg-slate-50 text-slate-700" }; return <div className={`rounded-lg border px-3 py-2 ${classes[tone]}`}><span className="block text-lg font-extrabold">{value}</span><span className="text-[11px] font-bold">{label}</span></div>; }

function ImportHistory({ jobs, selectedId, onSelect }: { jobs: GuidelineImportJob[]; selectedId: string; onSelect: (id: string) => void }) { return <section className="rounded-2xl border border-slate-200 bg-white/80 p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-extrabold text-slate-800">Lịch sử import</h2><RefreshCw size={15} className="text-slate-400" /></div>{jobs.length === 0 ? <p className="mt-3 text-xs font-semibold text-slate-500">Chưa có phiên nào.</p> : <div className="mt-3 space-y-2">{jobs.map((job) => <button type="button" key={job.id} onClick={() => onSelect(job.id)} className={`w-full rounded-xl border p-3 text-left ${job.id === selectedId ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between gap-2"><span className="truncate text-xs font-extrabold text-slate-700">{String(job.source_metadata?.fileName || job.id)}</span><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{statusLabels[job.status] || job.status}</span></div><p className="mt-1 text-[11px] font-semibold text-slate-500">{job.progress}% · {stageLabels[job.current_stage] || job.current_stage}</p></button>)}</div>}</section>; }

function JobReview({ data, items, selectedItems, setSelectedItems, visibleRecommendations, search, setSearch, blockingIssues, busy, onProcess, onResume, onImport, onDelete, onRefresh, onSectionChange, onRecommendationChange }: { data: GuidelineImportJobData; items: GuidelineImportItem[]; selectedItems: string[]; setSelectedItems: (items: string[]) => void; visibleRecommendations: GuidelineImportRecommendation[]; search: string; setSearch: (value: string) => void; blockingIssues: GuidelineImportJobData["issues"]; busy: boolean; onProcess: () => void; onResume: () => void; onImport: () => void; onDelete: () => void; onRefresh: () => void; onSectionChange: (section: GuidelineImportSection) => void; onRecommendationChange: (recommendation: GuidelineImportRecommendation) => void }) {
  const isProcessing = ["processing", "analysing", "importing"].includes(data.job.status);
  const acceptedSections = data.sections.filter((section) => section.review_status === "accepted").length;
  const acceptedRecommendations = data.recommendations.filter((recommendation) => recommendation.review_status === "accepted").length;
  return <div className="space-y-4"><section className="rounded-2xl border border-slate-200 bg-white/85 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-violet-600">{data.document?.original_filename || "Guideline import"}</p><h2 className="mt-1 text-xl font-extrabold text-rose-950">{statusLabels[data.job.status] || data.job.status}</h2><p className="mt-1 text-xs font-semibold text-slate-500">Giai đoạn: {stageLabels[data.job.current_stage] || data.job.current_stage} · Tiến độ: {data.job.progress}% · OCR: {data.document?.ocr_required ? "đã dùng" : "không cần"}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={onRefresh} className="rounded-lg border border-slate-200 p-2 text-slate-600" title="Làm mới"><RefreshCw size={16} /></button>{["failed", "paused"].includes(data.job.status) && <button type="button" disabled={busy} onClick={onResume} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-800"><Play size={14} />Tiếp tục</button>}<button type="button" disabled={busy || isProcessing} onClick={onDelete} className="rounded-lg border border-rose-200 p-2 text-rose-700" title="Xóa phiên"><X size={16} /></button></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-violet-600 transition-all" style={{ width: `${data.job.progress}%` }} /></div></section>
    {data.job.status === "ready_for_review" && data.recommendations.length === 0 && <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 text-sm font-semibold text-sky-800">Chọn các bảng/figure/section cần xử lý rồi gửi cho AI. Mỗi mục sẽ được xử lý độc lập.</section>}
    {items.length > 0 && data.recommendations.length === 0 && <section className="rounded-2xl border border-violet-200 bg-white/85 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-extrabold text-slate-800">Mục phát hiện trong tài liệu</h3><p className="mt-1 text-xs font-semibold text-slate-500">Không dừng ở bảng đầu tiên. Hãy chọn toàn bộ mục muốn trích xuất.</p></div><button type="button" onClick={() => setSelectedItems(selectedItems.length === items.length ? [] : items.map((item) => item.id))} className="text-xs font-extrabold text-violet-700">{selectedItems.length === items.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}</button></div><div className="mt-3 space-y-2">{items.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-violet-300 hover:bg-violet-50/30"><input type="checkbox" checked={selectedItems.includes(item.id)} onChange={(event) => setSelectedItems(event.target.checked ? [...selectedItems, item.id] : selectedItems.filter((id) => id !== item.id))} /><span className="rounded-lg bg-violet-100 p-2 text-violet-700"><FileText size={15} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-800">{itemLabels[item.type]} · {item.label} {item.title ? `— ${item.title}` : ""}</strong><small className="text-xs font-semibold text-slate-500">Trang {item.pageStart || "?"}{item.pageEnd && item.pageEnd !== item.pageStart ? `–${item.pageEnd}` : ""}</small></span></label>)}</div><button type="button" disabled={busy || selectedItems.length === 0} onClick={onProcess} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"><Play size={16} />Gửi {selectedItems.length} mục cho AI</button></section>}
    <TranslatedTables tables={data.job.analysis_metadata.tableTranslations} />
    {isProcessing && <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm font-semibold text-amber-800"><Pause className="mr-2 inline" size={16} />Đang chạy dưới nền. Có thể chuyển tab; trạng thái sẽ được lưu và tiếp tục khi quay lại.</section>}
    {(data.sections.length > 0 || data.recommendations.length > 0) && <><section className="rounded-2xl border border-teal-200 bg-white/85 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-teal-700">Bước rà soát</p><h3 className="mt-1 text-lg font-extrabold text-slate-800">Cấu trúc phát hiện</h3></div><span className="text-xs font-bold text-slate-500">{data.sections.length} sections · {data.recommendations.length} khuyến cáo</span></div><div className="mt-3 space-y-2">{data.sections.map((section) => <SectionReview key={section.id} section={section} onChange={onSectionChange} />)}</div></section><section className="rounded-2xl border border-violet-200 bg-white/85 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-lg font-extrabold text-slate-800">Khuyến cáo</h3><p className="mt-1 text-xs font-semibold text-slate-500">Duyệt từng bản dịch trước khi nhập draft.</p></div><label className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm bản gốc, bản dịch, Level..." className="h-9 w-64 rounded-lg border border-slate-200 pl-9 pr-3 text-xs font-semibold" /></label></div><div className="mt-3 space-y-3">{visibleRecommendations.map((recommendation) => <RecommendationReview key={recommendation.id} recommendation={recommendation} onChange={onRecommendationChange} />)}{visibleRecommendations.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500">Không có khuyến cáo phù hợp.</p>}</div></section><Issues issues={data.issues} blockingIssues={blockingIssues} /><section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/85 p-4"><div className="text-xs font-semibold text-slate-500">Đã duyệt: {acceptedSections} section · {acceptedRecommendations} khuyến cáo · {data.terminology.length} thuật ngữ</div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || blockingIssues.length > 0 || acceptedSections === 0 || acceptedRecommendations === 0} onClick={onImport} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"><Check size={16} />Nhập thành Core draft</button></div></section></>}
  </div>;
}

type ImportedTable = {
  titleOriginal?: string;
  titleVi?: string;
  headersOriginal?: string[];
  headersVi?: string[];
  rows?: Array<{ cellsOriginal?: string[]; cellsVi?: string[] }>;
  footnotesOriginal?: string[];
  footnotesVi?: string[];
  sourcePage?: number | null;
};

function TranslatedTables({ tables }: { tables: Record<string, unknown> | undefined }) {
  const entries = Object.entries(tables || {}).flatMap(([itemId, value]) => Array.isArray(value)
    ? value.map((table, index) => ({ itemId, index, table: table as ImportedTable }))
    : []);
  if (entries.length === 0) return null;
  return <section className="rounded-2xl border border-sky-200 bg-white/85 p-4">
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[.14em] text-sky-700">Bảng đã trích xuất</p>
      <h3 className="mt-1 text-lg font-extrabold text-slate-800">Rà soát cấu trúc bảng</h3>
      <p className="mt-1 text-xs font-semibold text-slate-500">Đối chiếu tiêu đề, cột, hàng, liều và đơn vị trước khi nhập Core draft.</p>
    </div>
    <div className="mt-3 space-y-3">
      {entries.map(({ itemId, index, table }) => <article key={`${itemId}-${index}`} className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-extrabold text-slate-800">{table.titleVi || table.titleOriginal || "Bảng chưa có tiêu đề"}</h4>
          <span className="text-[11px] font-bold text-slate-500">Trang {table.sourcePage || "?"}</span>
        </div>
        {table.titleOriginal && table.titleVi && table.titleOriginal !== table.titleVi && <p className="mt-1 text-xs font-semibold text-slate-500">{table.titleOriginal}</p>}
        <table className="mt-3 min-w-full border-collapse text-left text-xs">
          <thead><tr>{(table.headersVi?.length ? table.headersVi : table.headersOriginal || []).map((header, headerIndex) => <th key={headerIndex} className="border border-slate-200 bg-white px-2 py-1.5 font-extrabold text-slate-700">{header}</th>)}</tr></thead>
          <tbody>{(table.rows || []).map((row, rowIndex) => <tr key={rowIndex}>{(row.cellsVi?.length ? row.cellsVi : row.cellsOriginal || []).map((cell, cellIndex) => <td key={cellIndex} className="border border-slate-200 px-2 py-1.5 font-semibold text-slate-600">{cell}</td>)}</tr>)}</tbody>
        </table>
        {table.footnotesVi?.length ? <p className="mt-2 text-[11px] font-semibold text-slate-500">{table.footnotesVi.join(" ")}</p> : null}
      </article>)}
    </div>
  </section>;
}

function SectionReview({ section, onChange }: { section: GuidelineImportSection; onChange: (section: GuidelineImportSection) => void }) { const [saving, setSaving] = useState(false); async function save(patch: Partial<GuidelineImportSection>) { setSaving(true); try { onChange(await updateGuidelineImportSection(section.id, patch)); } finally { setSaving(false); } } return <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3" style={{ marginLeft: Math.min(section.level, 4) * 18 }}><div className="flex flex-wrap items-center gap-2"><ChevronRight size={15} className="text-slate-400" /><strong className="flex-1 text-sm text-slate-800">{section.title_original || "Section chưa có tiêu đề"}</strong><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${reviewClass(section.review_status)}`}>{section.review_status}</span><select disabled={saving} value={section.review_status} onChange={(event) => void save({ review_status: event.target.value as GuidelineImportSection["review_status"] })} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold"><option value="pending">Chờ duyệt</option><option value="accepted">Chấp nhận</option><option value="needs_review">Cần xem lại</option><option value="rejected">Từ chối</option></select></div><div className="mt-2 grid gap-2 md:grid-cols-2"><input value={section.title_original} onChange={(event) => onChange({ ...section, title_original: event.target.value })} onBlur={(event) => void save({ title_original: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold" /><input value={section.title_vi} onChange={(event) => onChange({ ...section, title_vi: event.target.value })} onBlur={(event) => void save({ title_vi: event.target.value })} className="h-9 rounded-lg border border-teal-200 bg-teal-50/30 px-3 text-xs font-semibold" placeholder="Bản dịch tiếng Việt" /></div><p className="mt-2 text-[11px] font-semibold text-slate-500">Trang {section.source_page || "?"} · {section.duplicate_status} · {saving ? "Đang lưu..." : "Đã đồng bộ"}</p></div>; }

function RecommendationReview({ recommendation, onChange }: { recommendation: GuidelineImportRecommendation; onChange: (recommendation: GuidelineImportRecommendation) => void }) { const [saving, setSaving] = useState(false); async function save(patch: Partial<GuidelineImportRecommendation>) { setSaving(true); try { onChange(await updateGuidelineImportRecommendation(recommendation.id, patch)); } finally { setSaving(false); } } return <article className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-violet-600">{recommendation.source_key} · Trang {recommendation.source_page || "?"}</p><h4 className="mt-1 text-sm font-extrabold text-slate-800">{recommendation.title_original || "Khuyến cáo chưa có tiêu đề"}</h4></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${reviewClass(recommendation.review_status)}`}>{recommendation.review_status}</span><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{recommendation.confidence == null ? "confidence ?" : `confidence ${Math.round(recommendation.confidence * 100)}%`}</span>{recommendation.duplicate_status !== "new" && <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">Trùng: {recommendation.duplicate_status}</span>}</div></div><div className="mt-3 grid gap-3 lg:grid-cols-2"><label className="text-[11px] font-extrabold text-slate-500">Nguyên bản<textarea value={recommendation.recommendation_text_original} onChange={(event) => onChange({ ...recommendation, recommendation_text_original: event.target.value })} onBlur={(event) => void save({ recommendation_text_original: event.target.value })} className="mt-1 min-h-32 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700" /></label><label className="text-[11px] font-extrabold text-teal-700">Tiếng Việt<textarea value={recommendation.recommendation_text_vi} onChange={(event) => onChange({ ...recommendation, recommendation_text_vi: event.target.value })} onBlur={(event) => void save({ recommendation_text_vi: event.target.value })} className="mt-1 min-h-32 w-full rounded-lg border border-teal-200 bg-teal-50/30 p-3 text-sm font-semibold text-slate-700" /></label></div><div className="mt-3 flex flex-wrap items-center gap-2"><input value={recommendation.recommendation_class} onChange={(event) => onChange({ ...recommendation, recommendation_class: event.target.value })} onBlur={(event) => void save({ recommendation_class: event.target.value })} placeholder="Class / strength" className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-semibold" /><input value={recommendation.evidence_level} onChange={(event) => onChange({ ...recommendation, evidence_level: event.target.value })} onBlur={(event) => void save({ evidence_level: event.target.value })} placeholder="Level / LoE" className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-semibold" /><select disabled={saving} value={recommendation.review_status} onChange={(event) => void save({ review_status: event.target.value as GuidelineImportRecommendation["review_status"] })} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold"><option value="pending">Chờ duyệt</option><option value="accepted">Chấp nhận</option><option value="needs_review">Cần xem lại</option><option value="rejected">Từ chối</option></select><span className="text-[11px] font-semibold text-slate-400">{saving ? "Đang lưu..." : "Lưu tự động khi rời ô"}</span></div></article>; }

function Issues({ issues, blockingIssues }: { issues: GuidelineImportJobData["issues"]; blockingIssues: GuidelineImportJobData["issues"] }) { return <section className="rounded-2xl border border-amber-200 bg-white/85 p-4"><div className="flex items-center gap-2"><AlertTriangle size={18} className="text-amber-600" /><h3 className="font-extrabold text-slate-800">Quality checks</h3><span className="text-xs font-bold text-slate-500">{issues.length} issue · {blockingIssues.length} blocking</span></div>{issues.length === 0 ? <p className="mt-3 text-sm font-semibold text-teal-700">Không có cảnh báo từ pipeline.</p> : <div className="mt-3 space-y-2">{issues.map((issue) => <div key={issue.id} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${issueClass(issue.severity)}`}><strong>{issue.severity.toUpperCase()} · {issue.issue_code}</strong><p className="mt-1">{issue.message}</p></div>)}</div>}</section>; }
