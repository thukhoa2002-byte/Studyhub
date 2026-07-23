import { AlertTriangle, CheckCircle2, ClipboardCheck, FileInput, FileText, Loader2, Save, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import type { Drug } from "../types/drug";
import { extractDrugDocument, extractDrugWithAi, parseDrugImportJson } from "../services/api";
import { candidateFromDrug, type DrugImportCandidate } from "../utils/drugImport";
import { buildGuidelineImportCandidate, type GuidelineImportCandidate, type GuidelineImportScope } from "../utils/guidelineImport";
import { saveGuidelineTableImport } from "../services/guidelineImportService";
import { createThuoc, getAllThuoc, updateThuoc } from "../services/thuocService";

type Mode = "json" | "files" | "text" | "document";
type FileState = { file: File; status: "pending" | "parsing" | "ready" | "error"; count: number; validCount: number; errorCount: number; error?: string; candidates: DrugImportCandidate[] };

interface Props { user: User; onNavigate: (path: string) => void }

const modeItems: Array<{ id: Mode; label: string; description: string }> = [
  { id: "json", label: "Dán JSON", description: "Một thuốc hoặc mảng thuốc" },
  { id: "files", label: "Tải file JSON", description: "Nhiều file, xử lý độc lập" },
  { id: "text", label: "Dán văn bản nguồn", description: "Trích xuất có nguồn" },
  { id: "document", label: "PDF / DOCX", description: "Trích text rồi dùng AI" },
];

export default function AdminDrugImportPage({ user, onNavigate }: Props) {
  const [mode, setMode] = useState<Mode>("json");
  const [candidates, setCandidates] = useState<DrugImportCandidate[]>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [duplicateChoices, setDuplicateChoices] = useState<Record<string, "skip" | "copy" | "update">>({});
  const [guidelineCandidate, setGuidelineCandidate] = useState<GuidelineImportCandidate | null>(null);
  const [guidelineScope, setGuidelineScope] = useState<GuidelineImportScope>("both");

  function addCandidates(next: DrugImportCandidate[]) {
    const existing = getAllThuoc();
    const prepared = next.map((candidate) => candidateFromDrug(candidate.parsedDrug, candidate.sourceType, candidate.sourceMetadata, existing, candidate.rawFileName, candidate.aiMetadata));
    setCandidates(prepared);
    setSelectedIds(prepared.filter((candidate) => candidate.importStatus === "ready" && candidate.duplicateStatus !== "exact_duplicate").map((candidate) => candidate.candidateId));
    setNotice(prepared.some((candidate) => candidate.validationErrors.length) ? { type: "warning", text: "Đã nhận dữ liệu nhưng có bản ghi cần sửa trước khi lưu." } : { type: "success", text: `Đã chuẩn bị ${prepared.length} candidate để xem trước.` });
    return prepared;
  }

  function handleAiResult(result: Awaited<ReturnType<typeof extractDrugWithAi>>, sourceType: "text" | "pdf" | "docx") {
    if (result.bundle) {
      const built = buildGuidelineImportCandidate(result.bundle, sourceType, getAllThuoc());
      const prepared = addCandidates(built.drugCandidates);
      setGuidelineCandidate({ ...built, drugCandidates: prepared });
      setGuidelineScope("both");
      return;
    }
    if (result.candidate) {
      setGuidelineCandidate(null);
      addCandidates([result.candidate]);
    }
  }

  function updateCandidate(candidateId: string, raw: string) {
    try {
      const parsed = JSON.parse(raw) as Partial<Drug>;
      const current = candidates.find((candidate) => candidate.candidateId === candidateId);
      if (!current) return;
      const next = candidateFromDrug(parsed, current.sourceType, current.sourceMetadata, getAllThuoc(), current.rawFileName, current.aiMetadata);
      setCandidates((items) => items.map((item) => item.candidateId === candidateId ? next : item));
    } catch { setNotice({ type: "error", text: "JSON trong bản xem trước không hợp lệ." }); }
  }

  function toggleSelected(candidateId: string) { setSelectedIds((ids) => ids.includes(candidateId) ? ids.filter((id) => id !== candidateId) : [...ids, candidateId]); }

  async function saveDrafts() {
    if (guidelineCandidate) {
      if (guidelineCandidate.validationErrors.length) { setNotice({ type: "error", text: "Không thể lưu vì guideline/table còn lỗi validation." }); return; }
      setSaving(true);
      try {
        const result = await saveGuidelineTableImport({ candidate: guidelineCandidate, scope: guidelineScope, selectedDrugIds: selectedIds, duplicateChoices, userId: user.id });
        setGuidelineCandidate((current) => current ? { ...current, importStatus: "saved" } : current);
        setNotice({ type: "success", text: `Đã lưu ${guidelineScope === "drugs" ? "thuốc" : "guideline"} ở trạng thái draft${result.guidelineId ? ` (${result.guidelineId})` : ""}. Chưa xuất bản tự động.` });
      } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Không thể lưu guideline/table." }); }
      finally { setSaving(false); }
      return;
    }
    const selected = candidates.filter((candidate) => selectedIds.includes(candidate.candidateId));
    const invalid = selected.filter((candidate) => candidate.validationErrors.length);
    if (!selected.length) { setNotice({ type: "warning", text: "Chưa chọn candidate hợp lệ để lưu." }); return; }
    if (invalid.length) { setNotice({ type: "error", text: "Không thể lưu vì còn candidate có lỗi validation." }); return; }
    setSaving(true);
    try {
      const existing = getAllThuoc();
      selected.forEach((candidate) => {
        const choice = duplicateChoices[candidate.candidateId] || "skip";
        const duplicate = existing.find((drug) => drug.id === candidate.parsedDrug.id || drug.slug === candidate.parsedDrug.slug);
        if (duplicate && choice === "skip") return;
        const payload = { ...candidate.parsedDrug, status: "draft" as const, sourceVerified: false, importMetadata: candidate.aiMetadata || { importMethod: candidate.sourceType, originalFileName: candidate.rawFileName, importedAt: new Date().toISOString(), importedBy: user.email || "", aiGenerated: candidate.sourceType === "ai", sourceDocumentTitle: String(candidate.sourceMetadata.title || ""), sourceType: String(candidate.sourceMetadata.type || candidate.sourceType) } };
        if (duplicate && choice === "update") updateThuoc(duplicate.id, payload);
        else if (duplicate && choice === "copy") createThuoc({ ...payload, id: `${payload.id || "thuoc"}-import-${Date.now()}`, slug: `${payload.slug || "thuoc"}-import-${Date.now()}` });
        else createThuoc(payload);
      });
      setCandidates((items) => items.map((candidate) => selectedIds.includes(candidate.candidateId) ? { ...candidate, importStatus: "saved" } : candidate));
      setNotice({ type: "success", text: "Đã lưu candidate thành bản nháp. Nội dung chưa được xuất bản." });
    } finally { setSaving(false); }
  }

  function prefillForm(candidate: DrugImportCandidate) {
    if (typeof window !== "undefined") window.localStorage.setItem("studyhub:thuoc:prefill", JSON.stringify(candidate.parsedDrug));
    onNavigate("/admin/thuoc/new");
  }

  return <section aria-labelledby="drug-import-title"><div className="flex flex-wrap items-start justify-between gap-4"><div><button type="button" onClick={() => onNavigate("/admin/thuoc")} className="text-sm font-bold text-teal-700">← Danh mục thuốc</button><p className="mt-5 text-xs font-extrabold uppercase tracking-[.16em] text-violet-700">Nhập dữ liệu thuốc</p><h1 id="drug-import-title" className="mt-1 text-2xl font-extrabold text-rose-950">Nhập dữ liệu thuốc</h1><p className="mt-1 text-sm font-semibold text-slate-500">Parse, kiểm tra, xem trước và lưu bản nháp. AI không được tự xuất bản.</p></div><button type="button" onClick={() => onNavigate("/admin/thuoc")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600">Hủy import</button></div><div className="mt-6 grid gap-2 rounded-2xl border border-violet-100 bg-white/80 p-2 sm:grid-cols-2 lg:grid-cols-4">{modeItems.map((item) => <button key={item.id} type="button" onClick={() => { setMode(item.id); setNotice(null); }} className={`rounded-xl p-3 text-left transition ${mode === item.id ? "bg-violet-100 text-violet-800" : "text-slate-600 hover:bg-violet-50"}`}><span className="block text-sm font-extrabold">{item.label}</span><span className="mt-1 block text-xs font-semibold opacity-70">{item.description}</span></button>)}</div>{notice && <div className={`mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${notice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : notice.type === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-teal-200 bg-teal-50 text-teal-800"}`} role="alert">{notice.type === "error" ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}{notice.text}</div>}<div className="mt-5">{mode === "json" && <JsonMode onCandidates={addCandidates} />}{mode === "files" && <FilesMode onCandidates={addCandidates} />}{mode === "text" && <TextMode onResult={(result) => handleAiResult(result, "text")} />}{mode === "document" && <DocumentMode onResult={(result, sourceType) => handleAiResult(result, sourceType)} />}</div>{guidelineCandidate && <GuidelineTablePanel candidate={guidelineCandidate} scope={guidelineScope} onScopeChange={setGuidelineScope} />}{candidates.length > 0 && <PreviewPanel candidates={candidates} selectedIds={selectedIds} duplicateChoices={duplicateChoices} onToggle={toggleSelected} onDuplicateChoice={(id, choice) => setDuplicateChoices((items) => ({ ...items, [id]: choice }))} onEdit={updateCandidate} onPrefill={prefillForm} onSave={saveDrafts} saving={saving} />}</section>;
}

function JsonMode({ onCandidates }: { onCandidates: (candidates: DrugImportCandidate[]) => void }) {
  const [raw, setRaw] = useState(""); const [busy, setBusy] = useState(false);
  async function check() { setBusy(true); try { onCandidates(await parseDrugImportJson(raw)); } catch (error) { throwNotice(error); } finally { setBusy(false); } }
  return <SourceBox title="Dán JSON thuốc" description="Hỗ trợ object, mảng hoặc wrapper { drugs: [...] }."><textarea value={raw} onChange={(event) => setRaw(event.target.value)} placeholder={'{\n  "id": "aspirin",\n  "slug": "aspirin",\n  "genericName": "Aspirin"\n}'} className="min-h-64 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-sm outline-none focus:border-violet-300" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy || !raw.trim()} onClick={() => void check()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><ClipboardCheck size={16} />{busy ? "Đang kiểm tra..." : "Kiểm tra JSON"}</button><span className="self-center text-xs font-semibold text-slate-500">Chưa lưu nếu JSON chưa hợp lệ.</span></div></SourceBox>;
}

function FilesMode({ onCandidates }: { onCandidates: (candidates: DrugImportCandidate[]) => void }) {
  const [files, setFiles] = useState<FileState[]>([]);
  async function parseFiles(nextFiles: File[]) {
    const states: FileState[] = nextFiles.filter((file) => file.name.toLowerCase().endsWith(".json")).map((file) => ({ file, status: "pending", count: 0, validCount: 0, errorCount: 0, candidates: [] }));
    setFiles(states); const all: DrugImportCandidate[] = [];
    for (const state of states) { state.status = "parsing"; setFiles([...states]); try { state.candidates = await parseDrugImportJson(await state.file.text()); state.count = state.candidates.length; state.validCount = state.candidates.filter((candidate) => candidate.validationErrors.length === 0).length; state.errorCount = state.count - state.validCount; state.status = "ready"; all.push(...state.candidates); } catch (error) { state.status = "error"; state.error = error instanceof Error ? error.message : "JSON không hợp lệ."; } setFiles([...states]); }
    if (all.length) onCandidates(all);
  }
  return <SourceBox title="Tải một hoặc nhiều file JSON" description="File lỗi không làm hỏng các file hợp lệ trong cùng batch."><label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void parseFiles([...event.dataTransfer.files]); }} className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-violet-300 bg-violet-50/30 text-center"><FileInput className="text-violet-600" /><strong className="mt-2 text-sm text-slate-700">Kéo file JSON vào đây hoặc chọn file</strong><span className="mt-1 text-xs text-slate-500">Tối đa 20 file, mỗi file 25 MB</span><input type="file" accept="application/json,.json" multiple className="hidden" onChange={(event) => void parseFiles([...(event.target.files || [])])} /></label><div className="mt-3 grid gap-2">{files.map((state, index) => <div key={`${state.file.name}-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate font-bold text-slate-700">{state.file.name} <small className="font-semibold text-slate-400">({Math.ceil(state.file.size / 1024)} KB)</small></span><button type="button" title="Loại bỏ file" aria-label={`Loại bỏ ${state.file.name}`} onClick={() => setFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X size={15} /></button></div><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold"><span className={state.status === "error" ? "text-rose-600" : "text-teal-700"}>{state.status === "parsing" ? "Đang đọc..." : state.status === "error" ? "Parse lỗi" : `${state.count} bản ghi · ${state.validCount} hợp lệ · ${state.errorCount} lỗi`}</span>{state.error && <details><summary className="cursor-pointer text-rose-600">Xem lỗi</summary><p className="mt-1 max-w-xl text-rose-600">{state.error}</p></details>}</div></div>)}</div></SourceBox>;
}

type AiResult = Awaited<ReturnType<typeof extractDrugWithAi>>;
function TextMode({ onResult }: { onResult: (result: AiResult) => void }) { return <SourceTextForm onResult={onResult} />; }
function DocumentMode({ onResult }: { onResult: (result: AiResult, sourceType: "pdf" | "docx") => void }) { return <DocumentImportForm onResult={onResult} />; }

function SourceTextForm({ onResult }: { onResult: (result: AiResult) => void }) {
  return <AiSourceForm onResult={onResult} />;
}

function AiSourceForm({ onResult }: { onResult: (result: AiResult) => void }) {
  const [drugName, setDrugName] = useState(""); const [text, setText] = useState(""); const [documentKind, setDocumentKind] = useState<"drug" | "guideline_table">("drug"); const [metadata, setMetadata] = useState({ type: "Dược thư", title: "", organization: "", year: "", url: "", pages: "" }); const [busy, setBusy] = useState(false);
  async function extract() { setBusy(true); try { onResult(await extractDrugWithAi({ text, drugName, documentKind, sourceMetadata: metadata })); } catch (error) { throwNotice(error); } finally { setBusy(false); } }
  return <SourceBox title="Dán văn bản nguồn" description="AI chỉ được dùng nội dung bạn cung cấp trong ô văn bản."><div className="grid gap-3 md:grid-cols-2"><input value={drugName} onChange={(event) => setDrugName(event.target.value)} placeholder="Tên thuốc cần trích xuất (bỏ trống nếu là bảng nhiều thuốc)" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><select value={documentKind} onChange={(event) => setDocumentKind(event.target.value as "drug" | "guideline_table")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm"><option value="drug">Tài liệu của một thuốc</option><option value="guideline_table">Guideline / supplementary table nhiều thuốc</option></select><select value={metadata.type} onChange={(event) => setMetadata({ ...metadata, type: event.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 text-sm"><option>Dược thư</option><option>Tờ hướng dẫn sử dụng</option><option>SmPC</option><option>Prescribing Information</option><option>Guideline</option><option>Supplementary table</option><option>Tài liệu nội bộ</option><option>Khác</option></select><input value={metadata.title} onChange={(event) => setMetadata({ ...metadata, title: event.target.value })} placeholder="Tiêu đề nguồn" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input value={metadata.organization} onChange={(event) => setMetadata({ ...metadata, organization: event.target.value })} placeholder="Tổ chức / nhà sản xuất" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input value={metadata.year} onChange={(event) => setMetadata({ ...metadata, year: event.target.value })} placeholder="Năm xuất bản" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input value={metadata.url} onChange={(event) => setMetadata({ ...metadata, url: event.target.value })} placeholder="URL nguồn" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input value={metadata.pages} onChange={(event) => setMetadata({ ...metadata, pages: event.target.value })} placeholder="Trang / mục liên quan" className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" /></div><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Dán nguyên văn tài liệu nguồn..." className="mt-3 min-h-64 w-full rounded-xl border border-slate-200 p-3 text-sm leading-6" /><button type="button" disabled={busy || (documentKind === "drug" && !drugName.trim()) || !text.trim()} onClick={() => void extract()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}AI trích xuất dữ liệu</button></SourceBox>;
}

function DocumentImportForm({ onResult }: { onResult: (result: AiResult, sourceType: "pdf" | "docx") => void }) {
  const [file, setFile] = useState<File | null>(null); const [extracted, setExtracted] = useState<{ text: string; sourceType: "pdf" | "docx"; originalFileName: string; characterCount: number; ocrUsed?: boolean } | null>(null); const [drugName, setDrugName] = useState(""); const [documentKind, setDocumentKind] = useState<"drug" | "guideline_table">("drug"); const [title, setTitle] = useState(""); const [organization, setOrganization] = useState(""); const [year, setYear] = useState(""); const [url, setUrl] = useState(""); const [pages, setPages] = useState(""); const [busy, setBusy] = useState(false);
  async function read() { if (!file) return; setBusy(true); try { setExtracted(await extractDrugDocument(file)); } catch (error) { throwNotice(error); } finally { setBusy(false); } }
  async function extract() { if (!extracted) return; setBusy(true); try { const result = await extractDrugWithAi({ text: extracted.text, drugName, documentKind, rawFileName: extracted.originalFileName, sourceMetadata: { type: extracted.sourceType, title, organization, year: Number(year) || null, url, pages } }); onResult(result, extracted.sourceType); } catch (error) { throwNotice(error); } finally { setBusy(false); } }
  return <SourceBox title="Tải tài liệu PDF hoặc DOCX" description="MVP xử lý một file mỗi lần; file tạm được xóa sau khi trích xuất."><label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-teal-300 bg-teal-50/30 text-center"><FileText className="text-teal-700" /><strong className="mt-2 text-sm text-slate-700">Chọn PDF hoặc DOCX</strong><span className="mt-1 max-w-full truncate px-4 text-xs text-slate-500">{file ? file.name : "Tối đa 25 MB"}</span><input type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] || null); setExtracted(null); }} /></label><button type="button" disabled={busy || !file} onClick={() => void read()} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-bold text-teal-700 disabled:opacity-50">{busy && !extracted ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}Trích xuất văn bản</button>{extracted && <div className="mt-4 grid gap-3 rounded-xl border border-teal-100 bg-teal-50/50 p-4"><p className="text-sm font-bold text-teal-800">Đã đọc {extracted.characterCount.toLocaleString("vi-VN")} ký tự từ {extracted.originalFileName}.</p><div className="grid gap-3 md:grid-cols-2"><select value={documentKind} onChange={(event) => setDocumentKind(event.target.value as "drug" | "guideline_table")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm"><option value="drug">Tài liệu của một thuốc</option><option value="guideline_table">Guideline / supplementary table nhiều thuốc</option></select><input value={drugName} onChange={(event) => setDrugName(event.target.value)} placeholder="Tên thuốc (bỏ trống nếu là bảng nhiều thuốc)" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tiêu đề nguồn" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Tổ chức / nhà sản xuất" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input value={year} onChange={(event) => setYear(event.target.value)} placeholder="Năm xuất bản" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="URL nguồn" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input value={pages} onChange={(event) => setPages(event.target.value)} placeholder="Trang / mục liên quan" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /></div><button type="button" disabled={busy || (documentKind === "drug" && !drugName.trim())} onClick={() => void extract()} className="inline-flex w-fit items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}Dùng AI trích xuất</button></div>}</SourceBox>;
}

function SourceBox({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white/85 p-5"><div className="flex items-start gap-3"><FileInput className="text-violet-600" size={21} /><div><h2 className="font-extrabold text-slate-800">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div></div><div className="mt-4">{children}</div></section>; }

function GuidelineTablePanel({ candidate, scope, onScopeChange }: { candidate: GuidelineImportCandidate; scope: GuidelineImportScope; onScopeChange: (scope: GuidelineImportScope) => void }) {
  return <section className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/35 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-teal-700">Guideline / supplementary table</p><h2 className="mt-1 text-xl font-extrabold text-slate-800">{candidate.guideline.titleVi || candidate.guideline.title}</h2><p className="mt-1 text-sm font-semibold text-slate-600">{candidate.table.number ? `${candidate.table.number} · ` : ""}{candidate.table.name || "Chưa rõ tên bảng"}{candidate.table.page ? ` · ${candidate.table.page}` : ""}</p>{candidate.guideline.summary && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{candidate.guideline.summary}</p>}</div><label className="min-w-64 text-xs font-extrabold text-slate-600">Phạm vi tạo dữ liệu<select value={scope} onChange={(event) => onScopeChange(event.target.value as GuidelineImportScope)} className="mt-1 h-11 w-full rounded-xl border border-teal-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="guideline">Chỉ tạo Guideline</option><option value="drugs">Chỉ tạo/cập nhật Thuốc</option><option value="both">Tạo cả Guideline và Thuốc</option><option value="link_existing">Chỉ liên kết thuốc đã tồn tại</option></select></label></div><div className="mt-4 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3"><span>Section: {candidate.table.section || "Chưa rõ"}</span><span>Provenance: {candidate.provenance.length} mục</span><span>{candidate.rows.length} dòng thuốc riêng</span></div><p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Kiểm tra lại liều, đơn vị và tần suất của từng dòng trước khi lưu. Nội dung hướng dẫn chung không được sao chép vào hồ sơ thuốc.</p><div className="mt-4 overflow-x-auto rounded-xl border border-teal-100 bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-teal-50 text-xs font-extrabold uppercase text-teal-800"><tr><th className="px-3 py-2">Hoạt chất</th><th className="px-3 py-2">Liều / tần suất</th><th className="px-3 py-2">Chỉnh liều</th><th className="px-3 py-2">Trang / section</th></tr></thead><tbody>{candidate.rows.map((row, index) => <tr key={`${row.drugName}-${index}`} className="border-t border-slate-100"><td className="px-3 py-3 font-extrabold text-slate-800">{row.drugName}</td><td className="whitespace-pre-line px-3 py-3 font-semibold text-slate-600">{row.dose || "Chưa nhận diện"}</td><td className="whitespace-pre-line px-3 py-3 text-slate-600">{[row.renalAdjustment, row.hepaticAdjustment].filter(Boolean).join("\n") || "Chưa có"}</td><td className="px-3 py-3 text-slate-500">{row.page || candidate.table.page || "Chưa rõ"}<br />{row.section || candidate.table.section || ""}</td></tr>)}</tbody></table></div></section>;
}

function PreviewPanel({ candidates, selectedIds, duplicateChoices, onToggle, onDuplicateChoice, onEdit, onPrefill, onSave, saving }: { candidates: DrugImportCandidate[]; selectedIds: string[]; duplicateChoices: Record<string, "skip" | "copy" | "update">; onToggle: (id: string) => void; onDuplicateChoice: (id: string, choice: "skip" | "copy" | "update") => void; onEdit: (id: string, raw: string) => void; onPrefill: (candidate: DrugImportCandidate) => void; onSave: () => void; saving: boolean }) {
  const validCount = useMemo(() => candidates.filter((candidate) => !candidate.validationErrors.length).length, [candidates]);
  return <section className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/30 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-violet-700">Preview</p><h2 className="mt-1 text-lg font-extrabold text-slate-800">{candidates.length} candidate · {validCount} hợp lệ</h2></div><button type="button" disabled={saving || !selectedIds.length} onClick={onSave} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}Lưu bản nháp</button></div><div className="mt-4 grid gap-3">{candidates.map((candidate) => <article key={candidate.candidateId} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><input type="checkbox" checked={selectedIds.includes(candidate.candidateId)} onChange={() => onToggle(candidate.candidateId)} className="mt-1 h-4 w-4 accent-teal-600" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-extrabold text-slate-800">{String(candidate.parsedDrug.titleVi || candidate.parsedDrug.genericName || "Thuốc chưa đặt tên")}</h3><p className="text-xs font-semibold text-slate-500">{candidate.parsedDrug.id || "Chưa có ID"} · {candidate.parsedDrug.slug || "Chưa có slug"}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${candidate.validationErrors.length ? "bg-rose-50 text-rose-700" : candidate.duplicateStatus === "exact_duplicate" ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-teal-700"}`}>{candidate.validationErrors.length ? "Có lỗi" : candidate.duplicateStatus === "exact_duplicate" ? "Trùng bản ghi" : candidate.importStatus === "saved" ? "Đã lưu draft" : "Sẵn sàng"}</span></div>{candidate.validationErrors.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs font-semibold text-rose-700">{candidate.validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>}{candidate.validationWarnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs font-semibold text-amber-700">{candidate.validationWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}{candidate.duplicateStatus === "exact_duplicate" && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-slate-600">Xử lý trùng:</span><select value={duplicateChoices[candidate.candidateId] || "skip"} onChange={(event) => onDuplicateChoice(candidate.candidateId, event.target.value as "skip" | "copy" | "update")} className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-bold"><option value="skip">Bỏ qua</option><option value="copy">Tạo bản sao</option><option value="update">Cập nhật sau xác nhận</option></select></div>}<details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-violet-700">Xem và chỉnh JSON</summary><textarea value={JSON.stringify(candidate.parsedDrug, null, 2)} onChange={(event) => onEdit(candidate.candidateId, event.target.value)} className="mt-2 min-h-48 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs" /></details><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onPrefill(candidate)} className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-bold text-violet-700">Điền vào biểu mẫu</button><button type="button" onClick={() => onToggle(candidate.candidateId)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">{selectedIds.includes(candidate.candidateId) ? "Bỏ chọn" : "Chọn lưu"}</button></div></div></div></article>)}</div></section>;
}

function throwNotice(error: unknown): void { if (typeof window !== "undefined") window.alert(error instanceof Error ? error.message : "Không thể xử lý dữ liệu import."); }
