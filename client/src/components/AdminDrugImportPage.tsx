import { AlertTriangle, CheckCircle2, ClipboardCheck, FileInput, FileText, Loader2, Save, Upload } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import type { Drug } from "../types/drug";
import { extractDrugDocument, extractDrugWithAi, parseDrugImportJson, type DocumentContentItem } from "../services/api";
import { createThuoc, getAllThuoc, updateThuoc } from "../services/thuocService";
import { saveGuidelineTableImport } from "../services/guidelineImportService";
import { candidateFromDrug, type DrugImportCandidate } from "../utils/drugImport";
import { buildGuidelineImportCandidate, type GuidelineImportCandidate, type GuidelineImportScope } from "../utils/guidelineImport";
import { LanguageToggle, LocalizedTextView, useLanguageMode } from "../utils/language";
import type { LanguageMode } from "../types/language";

type Mode = "json" | "text" | "document";
type DuplicateChoice = "skip" | "copy" | "update";
type Notice = { type: "success" | "error" | "warning"; text: string };
type SourceMetadata = { type: string; title: string; organization: string; year: string; url: string; pages: string };
type OutputLanguage = "vi" | "en" | "bilingual";
type AiResult = Awaited<ReturnType<typeof extractDrugWithAi>>;
interface Props { user: User; onNavigate: (path: string) => void }

const modes: Array<{ id: Mode; label: string; description: string }> = [
  { id: "json", label: "Dán / tải JSON", description: "Một thuốc hoặc nhiều thuốc" },
  { id: "text", label: "Dán văn bản nguồn", description: "Trích xuất có nguồn" },
  { id: "document", label: "PDF / DOCX", description: "Guideline hoặc dược thư" },
];
const emptyMetadata: SourceMetadata = { type: "Guideline", title: "", organization: "", year: "", url: "", pages: "" };
const documentItemLabels: Record<DocumentContentItem["type"], string> = {
  table: "Bảng",
  figure: "Hình",
  algorithm: "Thuật toán",
  flowchart: "Lưu đồ",
  appendix: "Phụ lục",
  document: "Tài liệu",
};

export default function AdminDrugImportPage({ user, onNavigate }: Props) {
  const [mode, setMode] = useState<Mode>("json");
  const [candidates, setCandidates] = useState<DrugImportCandidate[]>([]);
  const [guidelineCandidates, setGuidelineCandidates] = useState<GuidelineImportCandidate[]>([]);
  const [scope, setScope] = useState<GuidelineImportScope>("both");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [duplicateChoices, setDuplicateChoices] = useState<Record<string, DuplicateChoice>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [languageMode, setLanguageMode] = useLanguageMode();

  function setCandidatesForImport(next: DrugImportCandidate[]) {
    const existing = getAllThuoc();
    const prepared = next.map((candidate) => candidateFromDrug(candidate.parsedDrug, candidate.sourceType, candidate.sourceMetadata, existing, candidate.rawFileName, candidate.aiMetadata));
    setCandidates(prepared);
    setSelectedIds(prepared.filter((item) => item.importStatus === "ready" && item.duplicateStatus !== "exact_duplicate").map((item) => item.candidateId));
    setNotice(prepared.some((item) => item.validationErrors.length) ? { type: "warning", text: "Có candidate cần sửa trước khi lưu." } : { type: "success", text: "Đã chuẩn bị " + prepared.length + " candidate để xem trước." });
  }

  function handleAiResults(results: AiResult[], sourceType: "text" | "pdf" | "docx") {
    const bundles = results.flatMap((result) => result.bundle ? [buildGuidelineImportCandidate(result.bundle, sourceType, getAllThuoc())] : []);
    if (bundles.length) {
      const drugCandidates = bundles.flatMap((bundle) => bundle.drugCandidates);
      setGuidelineCandidates(bundles);
      setScope("both");
      setCandidates(drugCandidates);
      setSelectedIds(drugCandidates.filter((item) => item.importStatus === "ready" && item.duplicateStatus !== "exact_duplicate").map((item) => item.candidateId));
      setNotice({ type: "success", text: "Đã tách " + bundles.length + " mục và " + drugCandidates.length + " hoạt chất riêng." });
      return;
    }
    setGuidelineCandidates([]);
    const drugCandidates = results.flatMap((result) => result.candidate ? [result.candidate] : []);
    if (drugCandidates.length) setCandidatesForImport(drugCandidates);
  }

  function handleAiResult(result: AiResult, sourceType: "text" | "pdf" | "docx", allResults?: AiResult[]) { handleAiResults(allResults || [result], sourceType); }

  function updateCandidate(id: string, raw: string) {
    try {
      const current = candidates.find((item) => item.candidateId === id);
      if (!current) return;
      const next = candidateFromDrug(JSON.parse(raw) as Partial<Drug>, current.sourceType, current.sourceMetadata, getAllThuoc(), current.rawFileName, current.aiMetadata);
      const updated = { ...next, candidateId: id, provenance: current.provenance };
      setCandidates((items) => items.map((item) => item.candidateId === id ? updated : item));
      setGuidelineCandidates((bundles) => bundles.map((bundle) => ({ ...bundle, drugCandidates: bundle.drugCandidates.map((item) => item.candidateId === id ? updated : item) })));
    } catch { setNotice({ type: "error", text: "JSON trong bản xem trước không hợp lệ." }); }
  }

  function toggle(id: string) { setSelectedIds((items) => items.includes(id) ? items.filter((item) => item !== id) : items.concat(id)); }

  async function saveDrafts() {
    if (guidelineCandidates.length) {
      if (guidelineCandidates.some((item) => item.validationErrors.length)) { setNotice({ type: "error", text: "Có Guideline/table còn lỗi validation." }); return; }
      const selectedDrugCandidates = candidates.filter((item) => selectedIds.includes(item.candidateId));
      if (scope !== "guideline" && selectedDrugCandidates.some((item) => item.validationErrors.length)) { setNotice({ type: "error", text: "Có thuốc được chọn còn lỗi validation. Hãy sửa hoặc bỏ chọn trước khi lưu." }); return; }
      setSaving(true);
      try {
        const results = [];
        for (const candidate of guidelineCandidates) results.push(await saveGuidelineTableImport({ candidate: { ...candidate, drugCandidates: candidate.drugCandidates.map((item) => candidates.find((current) => current.candidateId === item.candidateId) || item) }, scope, selectedDrugIds: selectedIds.filter((id) => candidate.drugCandidates.some((item) => item.candidateId === id)), duplicateChoices, userId: user.id }));
        setGuidelineCandidates((items) => items.map((item) => ({ ...item, importStatus: "saved" })));
        const guidelineCount = results.filter((item) => item.guidelineId).length;
        setNotice({ type: "success", text: "Đã lưu " + guidelineCount + " Guideline và các candidate hợp lệ ở trạng thái draft. Chưa publish." });
      } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Không thể lưu guideline/table." }); }
      finally { setSaving(false); }
      return;
    }
    const selected = candidates.filter((item) => selectedIds.includes(item.candidateId));
    if (!selected.length) { setNotice({ type: "warning", text: "Chưa chọn candidate để lưu." }); return; }
    if (selected.some((item) => item.validationErrors.length)) { setNotice({ type: "error", text: "Không thể lưu candidate có lỗi validation." }); return; }
    setSaving(true);
    try {
      const existing = getAllThuoc();
      selected.forEach((candidate) => {
        const duplicate = findExisting(candidate, existing);
        const choice = duplicateChoices[candidate.candidateId] || "skip";
        if (duplicate && choice === "skip") return;
        const payload = { ...candidate.parsedDrug, status: "draft" as const, sourceVerified: false, provenance: candidate.provenance || candidate.parsedDrug.provenance || [], importMetadata: candidate.aiMetadata };
        if (duplicate && choice === "update") updateThuoc(duplicate.id, payload);
        else if (duplicate && choice === "copy") createThuoc({ ...payload, id: String(payload.id || "thuoc") + "-copy-" + Date.now(), slug: String(payload.slug || "thuoc") + "-copy-" + Date.now() });
        else createThuoc(payload);
      });
      setCandidates((items) => items.map((item) => selectedIds.includes(item.candidateId) ? { ...item, importStatus: "saved" } : item));
      setNotice({ type: "success", text: "Đã lưu candidate thành bản nháp. Chưa publish." });
    } finally { setSaving(false); }
  }

  function prefill(candidate: DrugImportCandidate) {
    window.localStorage.setItem("studyhub:thuoc:prefill", JSON.stringify(candidate.parsedDrug));
    onNavigate("/admin/thuoc/new");
  }

  return <section aria-labelledby="drug-import-title"><div className="flex flex-wrap items-start justify-between gap-4"><div><button type="button" onClick={() => onNavigate("/admin/thuoc")} className="text-sm font-bold text-teal-700">← Danh mục thuốc</button><p className="mt-5 text-xs font-extrabold uppercase tracking-[.16em] text-violet-700">Drug Import Engine</p><h1 id="drug-import-title" className="mt-1 text-2xl font-extrabold text-rose-950">Nhập dữ liệu Thuốc</h1><p className="mt-1 text-sm font-semibold text-slate-500">Tách hướng dẫn chung và từng hoạt chất thành các bản nháp độc lập.</p></div><div className="flex flex-wrap items-center gap-2"><LanguageToggle value={languageMode} onChange={setLanguageMode} /><button type="button" onClick={() => onNavigate("/admin/thuoc")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600">Hủy import</button></div></div><div className="mt-6 grid gap-2 rounded-2xl border border-violet-100 bg-white/80 p-2 sm:grid-cols-3">{modes.map((item) => <button key={item.id} type="button" onClick={() => { setMode(item.id); setNotice(null); }} className={"rounded-xl p-3 text-left transition " + (mode === item.id ? "bg-violet-100 text-violet-800" : "text-slate-600 hover:bg-violet-50")}><span className="block text-sm font-extrabold">{item.label}</span><span className="mt-1 block text-xs font-semibold opacity-70">{item.description}</span></button>)}</div>{notice && <div className={"mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-bold " + (notice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : notice.type === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-teal-200 bg-teal-50 text-teal-800")} role="alert">{notice.type === "error" ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}{notice.text}</div>}<div className="mt-5">{mode === "json" && <JsonMode onCandidates={setCandidatesForImport} />}{mode === "text" && <TextMode onResult={(result) => handleAiResult(result, "text")} />}{mode === "document" && <DocumentMode onResult={(result, sourceType, allResults) => handleAiResult(result, sourceType, allResults)} />}</div>{guidelineCandidates.map((candidate) => <GuidelineTablePanel key={candidate.candidateId} candidate={candidate} scope={scope} onScopeChange={setScope} languageMode={languageMode} />)}{candidates.length > 0 && <PreviewPanel candidates={candidates} selectedIds={selectedIds} duplicateChoices={duplicateChoices} onToggle={toggle} onDuplicateChoice={(id, choice) => setDuplicateChoices((items) => ({ ...items, [id]: choice }))} onEdit={updateCandidate} onPrefill={prefill} onSave={saveDrafts} saving={saving} />}</section>;
}

function JsonMode({ onCandidates }: { onCandidates: (items: DrugImportCandidate[]) => void }) {
  const [raw, setRaw] = useState(""); const [busy, setBusy] = useState(false);
  async function check() { setBusy(true); try { onCandidates(await parseDrugImportJson(raw)); } catch (error) { notify(error); } finally { setBusy(false); } }
  return <SourceBox title="Dán hoặc tải JSON thuốc" description="Hỗ trợ object, mảng hoặc wrapper drugs."><textarea value={raw} onChange={(event) => setRaw(event.target.value)} placeholder='{ "id": "aspirin", "genericName": "Aspirin" }' className="min-h-56 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-sm" /><div className="mt-3 flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-violet-200 px-4 py-2 text-sm font-bold text-violet-700"><input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setRaw); }} /><FileInput size={16} />Tải JSON</label><button type="button" disabled={busy || !raw.trim()} onClick={() => void check()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><ClipboardCheck size={16} />{busy ? "Đang kiểm tra..." : "Kiểm tra JSON"}</button></div></SourceBox>;
}

function TextMode({ onResult }: { onResult: (result: AiResult) => void }) { return <SourceBox title="Dán văn bản nguồn" description="Chọn guideline nhiều thuốc để tách phần chung và từng hoạt chất."><AiSourceForm onResult={onResult} /></SourceBox>; }

function AiSourceForm({ onResult }: { onResult: (result: AiResult) => void }) {
  const [text, setText] = useState(""); const [drugName, setDrugName] = useState(""); const [kind, setKind] = useState<"drug" | "guideline_table">("guideline_table"); const [metadata, setMetadata] = useState<SourceMetadata>(emptyMetadata); const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>("vi"); const [busy, setBusy] = useState(false);
  async function extract() { setBusy(true); try { onResult(await extractDrugWithAi({ text, drugName, documentKind: kind, outputLanguage, sourceMetadata: { ...metadata, outputLanguage, year: Number(metadata.year) || null } })); } catch (error) { notify(error); } finally { setBusy(false); } }
  return <div><SourceFields metadata={metadata} onChange={setMetadata} /><div className="mt-3 grid gap-3 md:grid-cols-3"><select value={kind} onChange={(event) => setKind(event.target.value as "drug" | "guideline_table")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm"><option value="guideline_table">Guideline / supplementary table nhiều thuốc</option><option value="drug">Tài liệu của một thuốc</option></select><input value={drugName} onChange={(event) => setDrugName(event.target.value)} placeholder="Tên thuốc, bỏ trống nếu là bảng nhóm" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><LanguageSelect value={outputLanguage} onChange={setOutputLanguage} /></div><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Dán nguyên văn tài liệu nguồn..." className="mt-3 min-h-64 w-full rounded-xl border border-slate-200 p-3 text-sm leading-6" /><button type="button" disabled={busy || !text.trim() || (kind === "drug" && !drugName.trim())} onClick={() => void extract()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}AI trích xuất</button></div>;
}

function LanguageSelect({ value, onChange }: { value: OutputLanguage; onChange: (value: OutputLanguage) => void }) {
  return <label className="text-xs font-extrabold text-slate-600">Ngôn ngữ đầu ra<select value={value} onChange={(event) => onChange(event.target.value as OutputLanguage)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"><option value="vi">Tiếng Việt (mặc định)</option><option value="en">Giữ nguyên tiếng Anh</option><option value="bilingual">Song ngữ Anh - Việt</option></select></label>;
}

function DocumentMode({ onResult }: { onResult: (result: AiResult, sourceType: "pdf" | "docx", allResults?: AiResult[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<Awaited<ReturnType<typeof extractDrugDocument>> | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<SourceMetadata>(emptyMetadata);
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>("vi");
  const [drugName, setDrugName] = useState("");
  const [kind, setKind] = useState<"drug" | "guideline_table">("guideline_table");
  const [busy, setBusy] = useState(false);

  async function read() {
    if (!file) return;
    setBusy(true);
    try {
      const next = await extractDrugDocument(file);
      setExtracted(next);
      setSelectedItemIds([]);
    } catch (error) { notify(error); }
    finally { setBusy(false); }
  }

  function toggleItem(id: string) {
    setSelectedItemIds((items) => items.includes(id) ? items.filter((item) => item !== id) : items.concat(id));
  }

  async function extractSelected() {
    if (!extracted || !selectedItemIds.length) return;
    setBusy(true);
    try {
      const results: AiResult[] = [];
      for (const item of extracted.items.filter((entry) => selectedItemIds.includes(entry.id))) {
        const pageRange = item.pageStart
          ? `${item.pageStart}${item.pageEnd && item.pageEnd !== item.pageStart ? `-${item.pageEnd}` : ""}`
          : metadata.pages;
        results.push(await extractDrugWithAi({
          text: item.text,
          drugName,
          documentKind: kind,
          documentItemType: item.type,
          outputLanguage,
          rawFileName: extracted.originalFileName,
          sourceMetadata: {
            ...metadata,
            outputLanguage,
            type: extracted.sourceType,
            pages: pageRange,
            itemLabel: item.label,
            itemType: item.type,
            year: Number(metadata.year) || null,
          },
        }));
      }
      if (results[0]) onResult(results[0], extracted.sourceType, results);
    } catch (error) { notify(error); }
    finally { setBusy(false); }
  }

  return <SourceBox title="Tải guideline PDF hoặc DOCX" description="Đọc toàn bộ tài liệu, chọn từng bảng hoặc mục, rồi mới gửi mục đã chọn cho AI.">
    <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-teal-300 bg-teal-50/30 text-center">
      <FileText className="text-teal-700" />
      <strong className="mt-2 text-sm text-slate-700">Chọn PDF hoặc DOCX</strong>
      <span className="mt-1 max-w-full truncate px-4 text-xs text-slate-500">{file?.name || "Tối đa 25 MB"}</span>
      <input type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] || null); setExtracted(null); setSelectedItemIds([]); }} />
    </label>
    <button type="button" disabled={busy || !file} onClick={() => void read()} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-bold text-teal-700 disabled:opacity-50">
      {busy && !extracted ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}Đọc toàn bộ tài liệu
    </button>
    {extracted && <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/50 p-4">
      <p className="text-sm font-bold text-teal-800">Đã đọc {extracted.characterCount.toLocaleString("vi-VN")} ký tự từ {extracted.originalFileName}.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <select value={kind} onChange={(event) => setKind(event.target.value as "drug" | "guideline_table")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm"><option value="guideline_table">Guideline / supplementary table nhiều thuốc</option><option value="drug">Tài liệu của một thuốc</option></select>
        <input value={drugName} onChange={(event) => setDrugName(event.target.value)} placeholder="Tên thuốc, bỏ trống nếu là tài liệu nhiều mục" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
        <LanguageSelect value={outputLanguage} onChange={setOutputLanguage} />
      </div>
      <SourceFields metadata={metadata} onChange={setMetadata} />
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-extrabold text-slate-800">Các mục phát hiện trong tài liệu</p><p className="text-xs font-semibold text-slate-500">Chọn mục cần trích xuất. Mỗi mục sẽ được xử lý độc lập.</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => setSelectedItemIds(extracted.items.map((item) => item.id))} className="text-xs font-extrabold text-teal-700">Chọn tất cả</button><button type="button" onClick={() => setSelectedItemIds([])} className="text-xs font-extrabold text-slate-500">Bỏ chọn</button></div>
        </div>
        <div className="mt-3 grid gap-2">
          {extracted.items.map((item) => <label key={item.id} className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition " + (selectedItemIds.includes(item.id) ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white hover:border-teal-200")}>
            <input type="checkbox" checked={selectedItemIds.includes(item.id)} onChange={() => toggleItem(item.id)} className="mt-1 h-4 w-4 accent-teal-600" />
            <span className="min-w-0"><span className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-slate-800"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{documentItemLabels[item.type]}</span>{item.label}{item.title ? `: ${item.title}` : ""}{item.pageStart ? ` · trang ${item.pageStart}${item.pageEnd && item.pageEnd !== item.pageStart ? `-${item.pageEnd}` : ""}` : ""}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">{item.text.slice(0, 260)}</span></span>
          </label>)}
        </div>
      </div>
      <button type="button" disabled={busy || !selectedItemIds.length || (kind === "drug" && !drugName.trim())} onClick={() => void extractSelected()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}AI trích xuất {selectedItemIds.length ? `${selectedItemIds.length} mục đã chọn` : "mục đã chọn"}
      </button>
    </div>}
  </SourceBox>;
}

function SourceFields({ metadata, onChange }: { metadata: SourceMetadata; onChange: (value: SourceMetadata) => void }) {
  const set = (key: keyof SourceMetadata, value: string) => onChange({ ...metadata, [key]: value });
  return <div className="grid gap-3 md:grid-cols-2"><select value={metadata.type} onChange={(event) => set("type", event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm"><option>Guideline</option><option>Supplementary table</option><option>Dược thư</option><option>SmPC</option><option>Khác</option></select><input value={metadata.title} onChange={(event) => set("title", event.target.value)} placeholder="Tên tài liệu" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input value={metadata.organization} onChange={(event) => set("organization", event.target.value)} placeholder="Tổ chức" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input value={metadata.year} onChange={(event) => set("year", event.target.value)} placeholder="Năm xuất bản" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input value={metadata.url} onChange={(event) => set("url", event.target.value)} placeholder="URL nguồn" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input value={metadata.pages} onChange={(event) => set("pages", event.target.value)} placeholder="Trang / mục" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /></div>;
}

function GuidelineTablePanel({ candidate, scope, onScopeChange, languageMode }: { candidate: GuidelineImportCandidate; scope: GuidelineImportScope; onScopeChange: (scope: GuidelineImportScope) => void; languageMode: LanguageMode }) {
  const fields: Array<[keyof GuidelineImportCandidate["commonGuidance"], string]> = [["why", "Vì sao dùng nhóm thuốc"], ["indications", "Chỉ định chung"], ["contraindications", "Chống chỉ định chung"], ["cautions", "Thận trọng"], ["monitoring", "Theo dõi"], ["initiation", "Khởi trị"], ["titration", "Tăng liều"], ["problemSolving", "Xử lý vấn đề"]];
  return <section className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/35 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-teal-700">A. Hướng dẫn chung của nhóm thuốc</p><h2 className="mt-1 text-xl font-extrabold text-slate-800"><LocalizedTextView value={candidate.localizedContent?.title || { vi: candidate.guideline.titleVi, en: candidate.guideline.title }} mode={languageMode} /></h2><p className="mt-1 text-sm font-semibold text-slate-600">{candidate.table.number ? candidate.table.number + " · " : ""}<LocalizedTextView value={candidate.localizedContent?.tableName || candidate.table.name} mode={languageMode} />{candidate.table.page ? " · " + candidate.table.page : ""}</p></div><label className="min-w-64 text-xs font-extrabold text-slate-600">Phạm vi tạo dữ liệu<select value={scope} onChange={(event) => onScopeChange(event.target.value as GuidelineImportScope)} className="mt-1 h-11 w-full rounded-xl border border-teal-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="guideline">Chỉ tạo Guideline</option><option value="drugs">Chỉ tạo/cập nhật Thuốc</option><option value="both">Tạo cả Guideline và Thuốc</option><option value="link_existing">Chỉ liên kết thuốc đã tồn tại</option></select></label></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{fields.map(([key, label]) => <div key={key} className="rounded-xl border border-teal-100 bg-white/80 p-3"><p className="text-xs font-extrabold text-teal-800">{label}</p><p className="mt-1 text-sm leading-5 text-slate-600"><LocalizedTextView value={candidate.localizedContent?.[key] || candidate.commonGuidance[key]} mode={languageMode} /></p></div>)}</div><div className="mt-4 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3"><span>Section: {candidate.table.section || "Chưa rõ"}</span><span>Provenance: {candidate.provenance.length} mục</span><span>{candidate.drugCandidates.length} hoạt chất riêng</span></div><p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Hướng dẫn chung chỉ lưu ở GuidelineImportCandidate, không sao chép thành dữ liệu riêng của từng thuốc.</p><div className="mt-5"><p className="text-xs font-extrabold uppercase tracking-[.14em] text-violet-700">B. Các hoạt chất được phát hiện</p><div className="mt-2 overflow-x-auto rounded-xl border border-teal-100 bg-white"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-teal-50 text-xs font-extrabold uppercase text-teal-800"><tr><th className="px-3 py-2">Hoạt chất</th><th className="px-3 py-2">Chỉ định riêng</th><th className="px-3 py-2">Liều khởi đầu</th><th className="px-3 py-2">Liều đích</th><th className="px-3 py-2">Tần suất / đường dùng</th><th className="px-3 py-2">Nguồn</th></tr></thead><tbody>{candidate.rows.map((row, index) => <tr key={row.drugName + "-" + index} className="border-t border-slate-100"><td className="px-3 py-3 font-extrabold text-slate-800">{row.drugName}</td><td className="px-3 py-3 text-slate-600"><LocalizedTextView value={row.localizedContent?.indications || row.localizedContent?.clinicalContext || row.indications || row.clinicalContext} mode={languageMode} /></td><td className="px-3 py-3 font-semibold text-slate-600"><LocalizedTextView value={row.localizedContent?.startingDose || row.startingDose} mode={languageMode} /></td><td className="px-3 py-3 font-semibold text-slate-600"><LocalizedTextView value={row.localizedContent?.targetDose || row.targetDose} mode={languageMode} /></td><td className="px-3 py-3 text-slate-600"><LocalizedTextView value={row.localizedContent?.frequency || row.localizedContent?.route || [row.frequency, row.route].filter(Boolean).join(" · ") || row.dose} mode={languageMode} /></td><td className="px-3 py-3 text-xs text-slate-500">{row.page || candidate.table.page || "Chưa rõ"}<br />{row.section || candidate.table.section || ""}</td></tr>)}</tbody></table></div></div></section>;
}

function PreviewPanel({ candidates, selectedIds, duplicateChoices, onToggle, onDuplicateChoice, onEdit, onPrefill, onSave, saving }: { candidates: DrugImportCandidate[]; selectedIds: string[]; duplicateChoices: Record<string, DuplicateChoice>; onToggle: (id: string) => void; onDuplicateChoice: (id: string, choice: DuplicateChoice) => void; onEdit: (id: string, raw: string) => void; onPrefill: (candidate: DrugImportCandidate) => void; onSave: () => void; saving: boolean }) {
  const validCount = useMemo(() => candidates.filter((item) => !item.validationErrors.length).length, [candidates]);
  const existing = getAllThuoc();
  return <section className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/30 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-violet-700">Preview từng thuốc</p><h2 className="mt-1 text-lg font-extrabold text-slate-800">{candidates.length} candidate · {validCount} hợp lệ</h2></div><button type="button" disabled={saving || !selectedIds.length} onClick={onSave} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}Lưu bản hợp lệ thành draft</button></div><div className="mt-4 grid gap-3">{candidates.map((candidate) => <CandidateCard key={candidate.candidateId} candidate={candidate} existing={findExisting(candidate, existing)} selected={selectedIds.includes(candidate.candidateId)} duplicateChoice={duplicateChoices[candidate.candidateId] || "skip"} onToggle={() => onToggle(candidate.candidateId)} onDuplicateChoice={(choice) => onDuplicateChoice(candidate.candidateId, choice)} onEdit={(raw) => onEdit(candidate.candidateId, raw)} onPrefill={() => onPrefill(candidate)} />)}</div></section>;
}

function CandidateCard({ candidate, existing, selected, duplicateChoice, onToggle, onDuplicateChoice, onEdit, onPrefill }: { candidate: DrugImportCandidate; existing?: Drug; selected: boolean; duplicateChoice: DuplicateChoice; onToggle: () => void; onDuplicateChoice: (choice: DuplicateChoice) => void; onEdit: (raw: string) => void; onPrefill: () => void }) {
  const regimen = candidate.parsedDrug.dosingRegimens?.[0];
  return <article className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><input type="checkbox" checked={selected} onChange={onToggle} className="mt-1 h-4 w-4 accent-teal-600" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-extrabold text-slate-800">{String(candidate.parsedDrug.titleVi || candidate.parsedDrug.genericName || "Thuốc chưa đặt tên")}</h3><p className="text-xs font-semibold text-slate-500">{candidate.parsedDrug.id || "Chưa có ID"} · {candidate.parsedDrug.slug || "Chưa có slug"}</p></div><span className={"rounded-full px-2 py-1 text-[11px] font-bold " + (candidate.validationErrors.length ? "bg-rose-50 text-rose-700" : existing ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-teal-700")}>{candidate.validationErrors.length ? "Validation lỗi" : existing ? "Đã tồn tại" : "Validation hợp lệ"}</span></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5"><DataPoint label="Chỉ định" value={candidate.parsedDrug.indications || regimen?.indication} /><DataPoint label="Liều khởi đầu" value={regimen?.startingDose} /><DataPoint label="Liều đích" value={regimen?.targetDose} /><DataPoint label="Tần suất" value={regimen?.interval} /><DataPoint label="Đường dùng" value={regimen?.route} /></div><p className="mt-3 text-xs font-semibold text-slate-500">Nguồn: {String(candidate.sourceMetadata.title || candidate.sourceMetadata.documentTitle || "Chưa có tên tài liệu")} · {String(candidate.sourceMetadata.page || candidate.sourceMetadata.pages || "Chưa rõ trang")} · {String(candidate.sourceMetadata.section || "Chưa rõ section")}</p>{candidate.validationErrors.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs font-semibold text-rose-700">{candidate.validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>}{candidate.validationWarnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs font-semibold text-amber-700">{candidate.validationWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}{existing && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-extrabold text-amber-900">Đã có hồ sơ: {existing.titleVi}</p><a href={"/admin/thuoc/" + existing.id + "/edit"} className="text-xs font-bold text-teal-700">Mở bản ghi hiện có</a></div><label className="mt-2 block text-xs font-bold text-slate-700">Xử lý dữ liệu mới<select value={duplicateChoice} onChange={(event) => onDuplicateChoice(event.target.value as DuplicateChoice)} className="mt-1 h-9 w-full rounded-lg border border-amber-200 bg-white px-2 text-xs font-bold"><option value="skip">Không cập nhật</option><option value="update">Xác nhận cập nhật từ nguồn mới</option><option value="copy">Tạo bản sao mới</option></select></label><details className="mt-2"><summary className="cursor-pointer text-xs font-bold text-amber-800">So sánh dữ liệu mới và dữ liệu cũ</summary><div className="mt-2 grid gap-2 lg:grid-cols-2"><pre className="max-h-48 overflow-auto rounded-lg bg-white p-2 text-[10px] text-slate-600">{JSON.stringify(existing, null, 2)}</pre><pre className="max-h-48 overflow-auto rounded-lg bg-white p-2 text-[10px] text-slate-600">{JSON.stringify(candidate.parsedDrug, null, 2)}</pre></div></details></div>}<details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-violet-700">Sửa candidate</summary><textarea value={JSON.stringify(candidate.parsedDrug, null, 2)} onChange={(event) => onEdit(event.target.value)} className="mt-2 min-h-48 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs" /></details><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onPrefill} className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-bold text-violet-700">Mở form sửa</button><button type="button" onClick={onToggle} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">{selected ? "Bỏ chọn" : "Chọn lưu"}</button></div></div></div></article>;
}

function DataPoint({ label, value, mode = "vi" }: { label: string; value?: unknown; mode?: LanguageMode }) { return <div className="rounded-lg bg-slate-50 p-2"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 line-clamp-3 text-xs font-semibold text-slate-700"><LocalizedTextView value={value} mode={mode} fallback="Chưa nhận diện" /></p></div>; }
function SourceBox({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white/85 p-5"><div className="flex items-start gap-3"><FileInput className="text-violet-600" size={21} /><div><h2 className="font-extrabold text-slate-800">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div></div><div className="mt-4">{children}</div></section>; }
function findExisting(candidate: DrugImportCandidate, existing: Drug[]): Drug | undefined { const id = String(candidate.parsedDrug.id || "").toLowerCase(); const slug = String(candidate.parsedDrug.slug || "").toLowerCase(); const generic = String(candidate.parsedDrug.genericName || "").toLocaleLowerCase("vi"); return existing.find((drug) => (id && drug.id.toLowerCase() === id) || (slug && drug.slug.toLowerCase() === slug) || (generic && drug.genericName.toLocaleLowerCase("vi") === generic)); }
function notify(error: unknown) { if (typeof window !== "undefined") window.alert(error instanceof Error ? error.message : "Không thể xử lý dữ liệu import."); }
