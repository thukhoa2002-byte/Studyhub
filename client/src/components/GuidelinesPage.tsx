import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  createGuidelineDocument,
  createGuidelineEntry,
  createGuidelineEntries,
  deleteGuidelineDocument,
  deleteGuidelineEntry,
  getGuidelineFileUrl,
  listGuidelineDocuments,
  listGuidelineEntries,
  setGuidelineEntryStatus,
  type GuidelineCondition,
  type GuidelineDocument,
  type GuidelineEntry,
} from "../services/guidelines";
import { extractGuidelinePdf, type GuidelineExtractionResponse } from "../services/api";

interface Props {
  user: User | null;
  onAiCallsRemaining?: (remaining: number) => void;
}

const emptyEntry = {
  topic: "",
  drug_name: "",
  clinical_context: "",
  recommendation_summary: "",
  dose: "",
  renal_adjustment: "",
  hepatic_adjustment: "",
  contraindications: "",
  monitoring: "",
  recommendation_class: "",
  evidence_level: "",
  page_reference: "",
  source_order: 0,
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return String(error);
}

function extractionKey(file: File, supplementFile: File | null, focus: string) {
  return `${file.name}:${file.size}:${file.lastModified}|${supplementFile?.name || ""}:${supplementFile?.size || 0}:${supplementFile?.lastModified || 0}|${focus}`;
}

function guidelineCondition(value: string, title: string): GuidelineCondition {
  const text = `${value} ${title}`.toUpperCase();
  if (/\bACS\b|ACUTE CORONARY|HỘI CHỨNG VÀNH/.test(text)) return "ACS";
  if (/\bHF\b|HEART FAILURE|SUY TIM/.test(text)) return "HF";
  if (/\bAF\b|ATRIAL FIBRILLATION|RUNG NHĨ/.test(text)) return "AF";
  return "Khác";
}

export default function GuidelinesPage({ user, onAiCallsRemaining }: Props) {
  const [documents, setDocuments] = useState<GuidelineDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<GuidelineEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryForm, setEntryForm] = useState(emptyEntry);
  const [aiReading, setAiReading] = useState(false);
  const [preparedExtraction, setPreparedExtraction] = useState<{ key: string; response: GuidelineExtractionResponse } | null>(null);
  const documentFormRef = useRef<HTMLFormElement>(null);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedId) ?? null,
    [documents, selectedId]
  );
  const ownsSelected = selectedDocument?.owner_id === user?.id;
  const entryGroups = useMemo(() => {
    const groups = new Map<string, GuidelineEntry[]>();
    for (const entry of entries) {
      const title = entry.topic.trim() || selectedDocument?.condition || "Khuyến cáo";
      const group = groups.get(title) ?? [];
      group.push(entry);
      groups.set(title, group);
    }
    return Array.from(groups, ([title, items]) => ({ title, items }));
  }, [entries, selectedDocument?.condition]);

  const refreshDocuments = useCallback(async () => {
    if (!user) return;
    try {
      const next = await listGuidelineDocuments();
      setDocuments(next);
      setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id ?? null);
      setNotice("");
    } catch (error) {
      const message = errorMessage(error);
      setNotice(/guideline_documents|schema cache/i.test(message)
        ? "Kho guideline chưa được khởi tạo trong Supabase. Hãy chạy file supabase/guidelines_migration.sql một lần."
        : message);
    }
  }, [user]);

  useEffect(() => { void refreshDocuments(); }, [refreshDocuments]);

  useEffect(() => {
    if (!selectedId) { setEntries([]); return; }
    void listGuidelineEntries(selectedId)
      .then(setEntries)
      .catch((error) => setNotice(errorMessage(error)));
  }, [selectedId]);

  async function readDocumentWithAi() {
    const formElement = documentFormRef.current;
    if (!formElement || aiReading || busy) return;
    const form = new FormData(formElement);
    const file = form.get("file") as File | null;
    const supplementFile = form.get("supplementFile") as File | null;
    const focus = String(form.get("focus") || "").trim();
    if (!file?.size) { setNotice("Hãy chọn PDF guideline chính trước."); return; }
    if ((file.size + (supplementFile?.size || 0)) > 40 * 1024 * 1024) { setNotice("Tổng hai PDF không được vượt quá 40 MB khi dùng AI."); return; }
    setAiReading(true);
    setNotice("Gemini đang đọc metadata, đề mục, bảng khuyến cáo và Supplementary Data...");
    try {
      const response = await extractGuidelinePdf(file, supplementFile, focus);
      if (typeof response.aiCallsRemaining === "number") onAiCallsRemaining?.(response.aiCallsRemaining);
      const metadata = response.data;
      const setValue = (name: string, value: string) => {
        const field = formElement.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
        if (field && value) field.value = value;
      };
      setValue("title", metadata.documentTitle);
      setValue("society", metadata.society);
      setValue("condition", guidelineCondition(metadata.condition, metadata.documentTitle));
      if (metadata.publicationYear >= 1900 && metadata.publicationYear <= 2200) setValue("publicationYear", String(metadata.publicationYear));
      setValue("versionLabel", metadata.versionLabel);
      if (/^https?:\/\//i.test(metadata.sourceUrl)) setValue("sourceUrl", metadata.sourceUrl);
      setPreparedExtraction({ key: extractionKey(file, supplementFile, focus), response });
      setNotice(`AI đã tự điền thông tin và chuẩn bị ${metadata.entries.length} khuyến cáo. Bạn kiểm tra các ô rồi bấm Lưu tài liệu.`);
    } catch (error) { setNotice(errorMessage(error)); }
    finally { setAiReading(false); }
  }

  async function submitDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy || aiReading) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("file") as File | null;
    const supplementFile = form.get("supplementFile") as File | null;
    const autoExtract = form.get("autoExtract") === "on";
    const focus = String(form.get("focus") || "").trim();
    if (autoExtract && (!file?.size || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")))) {
      setNotice("Hãy chọn một file PDF để AI tự trích xuất.");
      return;
    }
    if (supplementFile?.size && supplementFile.type !== "application/pdf" && !supplementFile.name.toLowerCase().endsWith(".pdf")) {
      setNotice("Supplementary Data phải là file PDF.");
      return;
    }
    if (autoExtract && ((file?.size || 0) + (supplementFile?.size || 0)) > 40 * 1024 * 1024) {
      setNotice("Tổng dung lượng guideline và Supplementary Data tối đa 40 MB khi dùng AI. Bạn có thể nén PDF hoặc chỉ lưu tài liệu.");
      return;
    }
    setBusy(true);
    try {
      const created = await createGuidelineDocument(user.id, {
        title: String(form.get("title") || ""),
        society: String(form.get("society") || "ESC"),
        condition: String(form.get("condition") || "Khác") as GuidelineCondition,
        publicationYear: Number(form.get("publicationYear")),
        versionLabel: String(form.get("versionLabel") || ""),
        sourceUrl: String(form.get("sourceUrl") || ""),
        visibility: String(form.get("visibility")) === "shared" ? "shared" : "private",
        file: file?.size ? file : null,
        supplementFile: supplementFile?.size ? supplementFile : null,
      });
      setDocuments((items) => [created, ...items]);
      setSelectedId(created.id);
      setShowDocumentForm(false);
      if (autoExtract && file?.size) {
        setNotice("Gemini đang đọc PDF và tạo các bản nháp có trang nguồn. File dài có thể mất vài phút...");
        const key = extractionKey(file, supplementFile, focus);
        const extracted = preparedExtraction?.key === key ? preparedExtraction.response : await extractGuidelinePdf(file, supplementFile, focus);
        if (typeof extracted.aiCallsRemaining === "number") onAiCallsRemaining?.(extracted.aiCallsRemaining);
        const drafts = extracted.data.entries.map((entry, index) => ({
          document_id: created.id,
          topic: entry.topic,
          drug_name: entry.drugName,
          clinical_context: entry.clinicalContext,
          recommendation_summary: entry.recommendationSummary,
          dose: entry.dose,
          renal_adjustment: entry.renalAdjustment,
          hepatic_adjustment: entry.hepaticAdjustment,
          contraindications: entry.contraindications,
          monitoring: entry.monitoring,
          recommendation_class: entry.recommendationClass,
          evidence_level: entry.evidenceLevel,
          page_reference: entry.pageReference,
          source_order: index + 1,
        }));
        const saved = await createGuidelineEntries(user.id, drafts);
        setEntries(saved);
        setPreparedExtraction(null);
        setNotice(saved.length > 0
          ? `AI đã tạo ${saved.length} bản nháp. Hãy mở PDF và đối chiếu từng mục trước khi xác nhận.`
          : "AI chưa tìm thấy khuyến cáo thuốc đủ căn cứ trong PDF. Tài liệu vẫn đã được lưu.");
      } else {
        setNotice("Đã lưu tài liệu. PDF chỉ được lưu trong kho riêng tư.");
      }
    } catch (error) { setNotice(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function submitEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !selectedDocument || busy) return;
    setBusy(true);
    try {
      const created = await createGuidelineEntry(user.id, {
        ...entryForm,
        document_id: selectedDocument.id,
        source_order: Math.max(0, ...entries.map((entry) => entry.source_order || 0)) + 1,
      });
      setEntries((items) => [created, ...items]);
      setEntryForm(emptyEntry);
      setShowEntryForm(false);
      setNotice("Đã lưu bản nháp. Hãy đối chiếu PDF trước khi đánh dấu Đã kiểm duyệt.");
    } catch (error) { setNotice(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function toggleReviewed(entry: GuidelineEntry) {
    if (!ownsSelected) return;
    const status = entry.status === "reviewed" ? "draft" : "reviewed";
    try {
      await setGuidelineEntryStatus(entry.id, status);
      setEntries((items) => items.map((item) => item.id === entry.id ? { ...item, status } : item));
    } catch (error) { setNotice(errorMessage(error)); }
  }

  async function openPdf() {
    if (!selectedDocument?.file_path) return;
    try { window.open(await getGuidelineFileUrl(selectedDocument.file_path), "_blank", "noopener,noreferrer"); }
    catch (error) { setNotice(errorMessage(error)); }
  }

  if (!user) {
    return <section className="mode-panel mx-auto w-full max-w-5xl px-5 py-8">
      <div className="glass-panel border border-rose-100/80 bg-white/70 p-10 text-center">
        <ShieldCheck className="mx-auto text-teal-500" size={42} />
        <h1 className="mt-4 text-2xl font-extrabold text-rose-950">Kho guideline riêng tư</h1>
        <p className="mt-2 text-sm text-slate-500">Đăng nhập để tải PDF và lưu bản tóm tắt có trích nguồn.</p>
      </div>
    </section>;
  }

  return (
    <section className="mode-panel mx-auto w-full max-w-6xl px-5 py-8" aria-labelledby="guidelines-title">
      <div className="glass-panel border border-rose-100/80 bg-white/68 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-teal-100 text-rose-600 shadow-sm"><BookOpenCheck size={32} /></div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-teal-600">Nguồn học đã kiểm chứng</p>
              <h1 id="guidelines-title" className="mt-1 text-3xl font-extrabold tracking-tight text-rose-950">Guidelines</h1>
              <p className="mt-1 text-sm text-slate-500">Lưu PDF riêng tư · tóm tắt có trang nguồn · kiểm duyệt trước khi chia sẻ</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowDocumentForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-500"><UploadCloud size={18} /> Thêm guideline</button>
        </div>

        {notice && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/85 px-4 py-3 text-sm leading-6 text-amber-900">{notice}</div>}

        {showDocumentForm && <form ref={documentFormRef} onSubmit={submitDocument} className="mt-6 grid gap-4 rounded-3xl border border-rose-100 bg-white/75 p-5 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">Tên guideline<input name="title" required placeholder="2024 ESC Guidelines for AF" className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3 font-medium" /></label>
          <label className="text-sm font-bold text-slate-700">Hiệp hội<input name="society" required defaultValue="ESC" className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3 font-medium" /></label>
          <label className="text-sm font-bold text-slate-700">Bệnh<select name="condition" className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3"><option>ACS</option><option>HF</option><option>AF</option><option>Khác</option></select></label>
          <label className="text-sm font-bold text-slate-700">Năm xuất bản<input name="publicationYear" required type="number" min="1900" max="2200" defaultValue={new Date().getFullYear()} className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3" /></label>
          <label className="text-sm font-bold text-slate-700">Phiên bản<input name="versionLabel" placeholder="Full guideline / Focused update" className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3" /></label>
          <label className="text-sm font-bold text-slate-700">Quyền xem<select name="visibility" className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3"><option value="private">Chỉ mình tôi</option><option value="shared">Chia sẻ bản đã kiểm duyệt</option></select></label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">Link nguồn chính thức<input name="sourceUrl" required type="url" placeholder="https://www.escardio.org/..." className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3" /></label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">PDF guideline chính<input name="file" required type="file" accept="application/pdf,.pdf" onChange={() => setPreparedExtraction(null)} className="mt-2 block w-full rounded-xl border border-dashed border-teal-200 bg-teal-50/55 px-4 py-4 text-sm" /></label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">PDF Supplementary Data (không bắt buộc)<input name="supplementFile" type="file" accept="application/pdf,.pdf" onChange={() => setPreparedExtraction(null)} className="mt-2 block w-full rounded-xl border border-dashed border-violet-200 bg-violet-50/55 px-4 py-4 text-sm" /><span className="mt-1.5 block text-xs font-medium text-slate-400">Tổng hai file tối đa 40 MB khi dùng AI · mỗi PDF tối đa 40 MB</span></label>
          <label className="sm:col-span-2 flex items-start gap-3 rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-slate-700"><input name="autoExtract" type="checkbox" defaultChecked className="mt-1 h-4 w-4 accent-teal-500" /><span><strong className="block text-teal-800">AI tự trích xuất tất cả khuyến cáo sau khi upload</strong><span className="mt-1 block text-xs leading-5 text-slate-500">Bao gồm Class/LoE, bản dịch tiếng Việt và dữ liệu thuốc trong Supplementary Data. Mỗi lần xử lý dùng 1 lượt Gemini; kết quả luôn là bản nháp.</span></span></label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">Phạm vi muốn AI tập trung (không bắt buộc)<input name="focus" onChange={() => setPreparedExtraction(null)} placeholder="Ví dụ: kháng đông trong AF; thuốc điều trị HFrEF; liều và điều chỉnh theo thận" className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3 font-medium" /></label>
          <div className="sm:col-span-2 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-teal-50 p-4"><button type="button" disabled={aiReading || busy} onClick={() => void readDocumentWithAi()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-extrabold text-white shadow-sm disabled:opacity-50">{aiReading ? <Loader2 className="animate-spin" size={18} /> : <BookOpenCheck size={18} />} {aiReading ? "AI đang đọc toàn bộ tài liệu..." : preparedExtraction ? "AI đã điền · Đọc lại" : "AI đọc file & tự điền các ô"}</button><p className="mt-2 text-center text-xs font-medium text-slate-500">Sau khi AI điền, bạn chỉ cần kiểm tra/chỉnh lại trước khi lưu.</p></div>
          <div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={() => setShowDocumentForm(false)} className="rounded-xl border border-rose-100 bg-white px-4 py-2.5 text-sm font-bold text-slate-500">Hủy</button><button disabled={busy || aiReading} className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 className="animate-spin" size={17} />} {busy ? "Đang lưu..." : preparedExtraction ? "Lưu tài liệu đã kiểm tra" : "Lưu & để AI đọc"}</button></div>
        </form>}

        <div className="mt-7 grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <aside className="space-y-3">
            {documents.length === 0 ? <div className="rounded-3xl border border-dashed border-teal-200 bg-teal-50/45 p-6 text-center text-sm text-slate-500">Chưa có guideline nào.</div> : documents.map((document) => <button key={document.id} type="button" onClick={() => setSelectedId(document.id)} className={`w-full rounded-2xl border p-4 text-left ${selectedId === document.id ? "border-teal-300 bg-teal-50 shadow-sm" : "border-rose-100 bg-white/75"}`}>
              <div className="flex items-start gap-3"><FileText className="mt-0.5 shrink-0 text-rose-500" size={20} /><div className="min-w-0"><p className="line-clamp-2 font-extrabold text-rose-950">{document.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{document.society} · {document.condition} · {document.publication_year}</p><span className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-bold text-teal-700">{document.visibility === "shared" ? "Đã chia sẻ" : "Riêng tư"}</span></div></div>
            </button>)}
          </aside>

          <div className="min-w-0">
            {!selectedDocument ? <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-rose-200 text-sm text-slate-400">Chọn hoặc thêm một guideline.</div> : <>
              <div className="rounded-3xl border border-rose-100 bg-white/78 p-5">
                <div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-rose-500">{selectedDocument.condition} · {selectedDocument.publication_year}</p><h2 className="mt-1 text-xl font-extrabold text-rose-950">{selectedDocument.title}</h2><p className="mt-1 text-sm text-slate-500">{selectedDocument.version_label || "Bản chính thức"}</p></div><div className="flex flex-wrap items-start gap-2"><a href={selectedDocument.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm font-bold text-rose-600"><ExternalLink size={16} /> Nguồn chính thức</a>{selectedDocument.file_path && <button type="button" onClick={() => void openPdf()} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700"><FileText size={16} /> Guideline PDF</button>}{selectedDocument.supplement_file_path && <button type="button" onClick={() => void getGuidelineFileUrl(selectedDocument.supplement_file_path!).then((url) => window.open(url, "_blank", "noopener,noreferrer")).catch((error) => setNotice(errorMessage(error)))} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700"><FileText size={16} /> Supplement</button>}{ownsSelected && <button type="button" title="Xóa guideline" onClick={() => void deleteGuidelineDocument(selectedDocument).then(refreshDocuments).catch((error) => setNotice(errorMessage(error)))} className="rounded-xl border border-rose-100 bg-white p-2 text-rose-500"><Trash2 size={17} /></button>}</div></div>
                <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">Phục vụ học tập. Luôn kiểm tra tài liệu gốc, đặc điểm người bệnh, chức năng gan–thận và hướng dẫn sử dụng thuốc trước quyết định điều trị.</div>
              </div>

              {ownsSelected && <div className="mt-4 flex justify-end"><button type="button" onClick={() => setShowEntryForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white"><Plus size={17} /> Thêm khuyến cáo thuốc</button></div>}

              {showEntryForm && <form onSubmit={submitEntry} className="mt-4 grid gap-3 rounded-3xl border border-rose-100 bg-white/80 p-5 sm:grid-cols-2">
                <Field label="Thuốc/nhóm thuốc" required value={entryForm.drug_name} onChange={(value) => setEntryForm((form) => ({ ...form, drug_name: value }))} />
                <Field label="Chủ đề" value={entryForm.topic} onChange={(value) => setEntryForm((form) => ({ ...form, topic: value }))} placeholder="Kháng đông, kháng kết tập..." />
                <Field label="Bối cảnh lâm sàng" value={entryForm.clinical_context} onChange={(value) => setEntryForm((form) => ({ ...form, clinical_context: value }))} />
                <Field label="Liều/cách dùng" value={entryForm.dose} onChange={(value) => setEntryForm((form) => ({ ...form, dose: value }))} />
                <label className="text-sm font-bold text-slate-700 sm:col-span-2">Tóm tắt khuyến cáo<textarea required rows={4} value={entryForm.recommendation_summary} onChange={(event) => setEntryForm((form) => ({ ...form, recommendation_summary: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-rose-100 bg-white px-3 py-2.5 font-medium" /></label>
                <Field label="Điều chỉnh theo thận" value={entryForm.renal_adjustment} onChange={(value) => setEntryForm((form) => ({ ...form, renal_adjustment: value }))} />
                <Field label="Điều chỉnh theo gan" value={entryForm.hepatic_adjustment} onChange={(value) => setEntryForm((form) => ({ ...form, hepatic_adjustment: value }))} />
                <Field label="Chống chỉ định/thận trọng" value={entryForm.contraindications} onChange={(value) => setEntryForm((form) => ({ ...form, contraindications: value }))} />
                <Field label="Theo dõi" value={entryForm.monitoring} onChange={(value) => setEntryForm((form) => ({ ...form, monitoring: value }))} />
                <Field label="Class" value={entryForm.recommendation_class} onChange={(value) => setEntryForm((form) => ({ ...form, recommendation_class: value }))} placeholder="I / IIa / IIb / III" />
                <Field label="Level of Evidence" value={entryForm.evidence_level} onChange={(value) => setEntryForm((form) => ({ ...form, evidence_level: value }))} placeholder="A / B / C" />
                <Field label="Trang/bảng/mục nguồn" required value={entryForm.page_reference} onChange={(value) => setEntryForm((form) => ({ ...form, page_reference: value }))} placeholder="Trang 42, Bảng 8" wide />
                <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setShowEntryForm(false)} className="rounded-xl border border-rose-100 px-4 py-2 text-sm font-bold text-slate-500">Hủy</button><button disabled={busy} className="rounded-xl bg-teal-400 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">Lưu bản nháp</button></div>
              </form>}

              <div className="mt-5 space-y-6">{entries.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">Chưa có khuyến cáo được dịch.</div> : entryGroups.map((group, groupIndex) => <section key={group.title} className="overflow-hidden rounded-3xl border border-rose-100 bg-white/85 shadow-sm">
                <header className="border-b border-rose-100 bg-gradient-to-r from-rose-100 via-rose-50 to-teal-50 px-5 py-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-rose-500">Phần {groupIndex + 1}</p>
                  <h3 className="mt-1 text-base font-extrabold leading-6 text-rose-950">{group.title}</h3>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-left">
                    <thead><tr className="bg-slate-50/90 text-[11px] font-extrabold uppercase tracking-[.12em] text-slate-500"><th className="px-5 py-3">Khuyến cáo tiếng Việt</th><th className="w-24 px-3 py-3 text-center">Class</th><th className="w-24 px-3 py-3 text-center">LoE</th><th className="w-20 px-3 py-3 text-center">Duyệt</th></tr></thead>
                    <tbody>{group.items.map((entry) => <tr key={entry.id} className="border-t border-slate-100 align-top hover:bg-rose-50/25">
                      <td className="px-5 py-4">
                        {entry.clinical_context && <p className="mb-1 text-xs font-bold text-teal-700">{entry.clinical_context}</p>}
                        <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800">{entry.recommendation_summary}</p>
                        {entry.drug_name !== "Không áp dụng" && <p className="mt-2 text-xs font-extrabold text-rose-700">Thuốc/nhóm thuốc: {entry.drug_name}</p>}
                        <DrugFacts entry={entry} />
                        <p className="mt-3 text-[11px] font-semibold text-slate-400">{selectedDocument.society} {selectedDocument.publication_year} · {entry.page_reference}</p>
                      </td>
                      <td className={`px-3 py-4 text-center text-sm font-black ${classTone(entry.recommendation_class)}`}>{entry.recommendation_class || "—"}</td>
                      <td className={`px-3 py-4 text-center text-sm font-black ${evidenceTone(entry.evidence_level)}`}>{entry.evidence_level || "—"}</td>
                      <td className="px-3 py-4"><div className="flex flex-col items-center gap-2"><span title={entry.status === "reviewed" ? "Đã kiểm duyệt" : "Bản nháp"} className={`grid h-8 w-8 place-items-center rounded-full ${entry.status === "reviewed" ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"}`}>{entry.status === "reviewed" ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}</span>{ownsSelected && <><button type="button" title={entry.status === "reviewed" ? "Trả về bản nháp" : "Xác nhận đã đối chiếu"} onClick={() => void toggleReviewed(entry)} className="rounded-lg border border-teal-200 px-2 py-1 text-[10px] font-bold text-teal-700">{entry.status === "reviewed" ? "Bản nháp" : "Xác nhận"}</button><button type="button" title="Xóa khuyến cáo" onClick={() => void deleteGuidelineEntry(entry.id).then(() => setEntries((items) => items.filter((item) => item.id !== entry.id))).catch((error) => setNotice(errorMessage(error)))} className="rounded-lg border border-rose-100 p-1.5 text-rose-500"><Trash2 size={14} /></button></>}</div></td>
                    </tr>)}</tbody>
                  </table>
                </div>
              </section>)}</div>
            </>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, required = false, placeholder = "", wide = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string; wide?: boolean }) {
  return <label className={`text-sm font-bold text-slate-700 ${wide ? "sm:col-span-2" : ""}`}>{label}<input required={required} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-rose-100 bg-white px-3 py-2.5 font-medium" /></label>;
}

function hasSourceValue(value: string) {
  return Boolean(value && !/^không (nêu|áp dụng|xác định)/i.test(value.trim()));
}

function DrugFacts({ entry }: { entry: GuidelineEntry }) {
  const facts = [
    ["Liều/cách dùng", entry.dose],
    ["Thận", entry.renal_adjustment],
    ["Gan", entry.hepatic_adjustment],
    ["Chống chỉ định/thận trọng", entry.contraindications],
    ["Theo dõi", entry.monitoring],
  ].filter(([, value]) => hasSourceValue(value));
  if (facts.length === 0) return null;
  return <div className="mt-3 grid gap-2 sm:grid-cols-2">{facts.map(([label, value]) => <div key={label} className="rounded-xl border border-teal-100 bg-teal-50/55 px-3 py-2"><span className="text-[10px] font-extrabold uppercase tracking-[.1em] text-teal-700">{label}</span><p className="mt-0.5 whitespace-pre-wrap text-xs font-medium leading-5 text-slate-600">{value}</p></div>)}</div>;
}

function classTone(value: string) {
  const normalized = value.trim().toUpperCase().replaceAll(" ", "");
  if (normalized === "I") return "bg-emerald-100 text-emerald-800";
  if (normalized === "IIA") return "bg-sky-100 text-sky-800";
  if (normalized === "IIB") return "bg-amber-100 text-amber-800";
  if (normalized === "III") return "bg-rose-100 text-rose-800";
  return "bg-slate-50 text-slate-500";
}

function evidenceTone(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === "A") return "bg-violet-100 text-violet-800";
  if (normalized === "B") return "bg-indigo-100 text-indigo-800";
  if (normalized === "C") return "bg-slate-200 text-slate-700";
  return "bg-slate-50 text-slate-500";
}
