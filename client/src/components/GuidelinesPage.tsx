import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BookOpenCheck,
  BookOpenText,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  ExternalLink,
  FileDown,
  FileText,
  Files,
  Globe2,
  Lock,
  Loader2,
  Plus,
  RefreshCw,
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
  deleteGuidelineEntries,
  downloadGuidelineFile,
  getGuidelineFileUrl,
  listGuidelineDocuments,
  listGuidelineEntries,
  setGuidelineEntriesStatus,
  setGuidelineEntryStatus,
  setGuidelineDocumentVisibility,
  type GuidelineCondition,
  type GuidelineDocument,
  type GuidelineEntry,
} from "../services/guidelines";
import { extractGuidelinePdf, extractGuidelinePdfStream, type ExtractedGuidelineEntry, type GuidelineExtractionProgress, type GuidelineExtractionResponse } from "../services/api";
import { isGuidelineAdmin } from "../config/access";

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
  table_kind: "recommendation" as const,
  table_row_role: "body" as const,
  table_cells: [],
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
  const [streamProgress, setStreamProgress] = useState<GuidelineExtractionProgress | null>(null);
  const [streamedEntryCount, setStreamedEntryCount] = useState(0);
  const [streamPreviewEntries, setStreamPreviewEntries] = useState<ExtractedGuidelineEntry[]>([]);
  const [showGuidelineContent, setShowGuidelineContent] = useState(false);
  const documentFormRef = useRef<HTMLFormElement>(null);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedId) ?? null,
    [documents, selectedId]
  );
  const canManage = isGuidelineAdmin(user?.email);
  const ownsSelected = canManage && selectedDocument?.owner_id === user?.id;
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
    if (!canManage || !formElement || aiReading || busy) return;
    const form = new FormData(formElement);
    const file = form.get("file") as File | null;
    const supplementFile = form.get("supplementFile") as File | null;
    const focus = String(form.get("focus") || "").trim();
    if (!file?.size) { setNotice("Hãy chọn PDF guideline chính trước."); return; }
    if ((file.size + (supplementFile?.size || 0)) > 40 * 1024 * 1024) { setNotice("Tổng hai PDF không được vượt quá 40 MB khi dùng AI."); return; }
    setAiReading(true);
    setStreamProgress(null);
    setStreamedEntryCount(0);
    setStreamPreviewEntries([]);
    setNotice("Gemini đang chia PDF theo từng cụm trang và dịch tuần tự toàn bộ nội dung, bảng và chú thích. Các phần đã xong sẽ hiện ngay bên dưới...");
    try {
      const response = await extractGuidelinePdfStream(file, supplementFile, focus, (progress) => {
        setStreamProgress(progress);
        setStreamedEntryCount((count) => count + progress.entries.length);
        setStreamPreviewEntries((items) => [...items, ...progress.entries].slice(-12));
      });
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
      setNotice(`AI đã dịch ${metadata.entries.length} khối nội dung theo thứ tự tài liệu. Hãy kiểm tra độ phủ từng trang rồi bấm Lưu tài liệu.`);
    } catch (error) { setNotice(errorMessage(error)); }
    finally { setAiReading(false); }
  }

  async function submitDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !canManage || busy || aiReading) return;
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
        visibility: "private",
        file: file?.size ? file : null,
        supplementFile: supplementFile?.size ? supplementFile : null,
      });
      setDocuments((items) => [created, ...items]);
      setSelectedId(created.id);
      setShowDocumentForm(false);
      if (autoExtract && file?.size) {
        setNotice("Gemini đang quét tuần tự các cụm trang nhỏ, tự chẻ tiếp khi đầu ra quá dài, rồi tạo bản nháp có trang nguồn. File dài có thể mất vài phút...");
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
          table_kind: entry.tableKind,
          table_row_role: entry.tableRowRole,
          table_cells: entry.tableCells,
        }));
        const saved = await createGuidelineEntries(user.id, drafts);
        setEntries(saved);
        setPreparedExtraction(null);
        setNotice(saved.length > 0
          ? `AI đã tạo ${saved.length} bản nháp. Hãy mở PDF và đối chiếu từng mục trước khi xác nhận.`
          : "AI chưa tìm thấy nội dung đủ căn cứ trong PDF. Tài liệu vẫn đã được lưu.");
      } else {
        setNotice("Đã lưu tài liệu. PDF chỉ được lưu trong kho riêng tư.");
      }
    } catch (error) { setNotice(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function submitEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !ownsSelected || !selectedDocument || busy) return;
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
      if (selectedDocument.visibility === "shared") {
        await setGuidelineDocumentVisibility(selectedDocument.id, "private");
        setDocuments((items) => items.map((item) => item.id === selectedDocument.id ? { ...item, visibility: "private" } : item));
        setNotice("Đã lưu bản nháp mới và tự động gỡ công khai. Hãy kiểm chứng toàn bộ trước khi đăng lại.");
      } else {
        setNotice("Đã lưu bản nháp. Hãy đối chiếu PDF trước khi đánh dấu Đã kiểm duyệt.");
      }
    } catch (error) { setNotice(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function reExtractSelectedDocument() {
    if (!user || !ownsSelected || !selectedDocument?.file_path || aiReading || busy) return;
    setAiReading(true);
    setNotice("Gemini đang đọc lại lần lượt toàn bộ các cụm trang đến bảng khuyến cáo cuối cùng...");
    try {
      if (selectedDocument.visibility === "shared") {
        await setGuidelineDocumentVisibility(selectedDocument.id, "private");
        setDocuments((items) => items.map((item) => item.id === selectedDocument.id ? { ...item, visibility: "private" } : item));
      }
      const [file, supplementFile] = await Promise.all([
        downloadGuidelineFile(selectedDocument.file_path, "guideline.pdf"),
        selectedDocument.supplement_file_path
          ? downloadGuidelineFile(selectedDocument.supplement_file_path, "supplement.pdf")
          : Promise.resolve(null),
      ]);
      const extracted = await extractGuidelinePdf(file, supplementFile, "");
      if (typeof extracted.aiCallsRemaining === "number") onAiCallsRemaining?.(extracted.aiCallsRemaining);
      const replacements = extracted.data.entries.map((entry, index) => ({
        document_id: selectedDocument.id,
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
        table_kind: entry.tableKind,
        table_row_role: entry.tableRowRole,
        table_cells: entry.tableCells,
      }));
      if (replacements.length === 0) throw new Error("AI chưa tìm thấy bảng khuyến cáo trong PDF; dữ liệu cũ được giữ nguyên.");
      const previousIds = entries.map((entry) => entry.id);
      const saved = await createGuidelineEntries(user.id, replacements);
      await deleteGuidelineEntries(previousIds);
      setEntries(saved);
      setNotice(`Đã trích xuất lại ${saved.length} dòng từ toàn bộ các bảng. Guideline đang ở chế độ Riêng tư để bạn kiểm chứng lại.`);
    } catch (error) { setNotice(errorMessage(error)); }
    finally { setAiReading(false); }
  }

  async function toggleReviewed(entry: GuidelineEntry) {
    if (!ownsSelected) return;
    const status = entry.status === "reviewed" ? "draft" : "reviewed";
    try {
      await setGuidelineEntryStatus(entry.id, status);
      setEntries((items) => items.map((item) => item.id === entry.id ? { ...item, status } : item));
      if (status === "draft" && selectedDocument?.visibility === "shared") {
        await setGuidelineDocumentVisibility(selectedDocument.id, "private");
        setDocuments((items) => items.map((item) => item.id === selectedDocument.id ? { ...item, visibility: "private" } : item));
        setNotice("Khuyến cáo đã trở về bản nháp nên guideline được chuyển về Riêng tư.");
      }
    } catch (error) { setNotice(errorMessage(error)); }
  }

  async function confirmAllEntries() {
    if (!ownsSelected || !selectedDocument || busy) return;
    const draftCount = entries.filter((entry) => entry.status !== "reviewed").length;
    if (draftCount === 0) {
      setNotice("Tất cả khuyến cáo trong guideline này đã được xác nhận.");
      return;
    }
    setBusy(true);
    try {
      await setGuidelineEntriesStatus(selectedDocument.id, "reviewed");
      setEntries((items) => items.map((item) => ({ ...item, status: "reviewed" })));
      setNotice(`Đã xác nhận toàn bộ ${entries.length} khuyến cáo. Bạn có thể đăng công khai guideline sau khi đã đối chiếu với PDF gốc.`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished() {
    if (!ownsSelected || !selectedDocument) return;
    const nextVisibility = selectedDocument.visibility === "shared" ? "private" : "shared";
    if (nextVisibility === "shared" && (entries.length === 0 || entries.some((entry) => entry.status !== "reviewed"))) {
      setNotice("Chỉ có thể đăng công khai sau khi bạn đã xác nhận tất cả khuyến cáo trong tài liệu.");
      return;
    }
    try {
      await setGuidelineDocumentVisibility(selectedDocument.id, nextVisibility);
      setDocuments((items) => items.map((item) => item.id === selectedDocument.id ? { ...item, visibility: nextVisibility } : item));
      setNotice(nextVisibility === "shared" ? "Đã đăng công khai. Các tài khoản khác hiện có thể xem bản đã kiểm chứng." : "Đã gỡ công khai và chuyển guideline về Riêng tư.");
    } catch (error) { setNotice(errorMessage(error)); }
  }

  async function openPdf() {
    if (!selectedDocument?.file_path) return;
    try { window.open(await getGuidelineFileUrl(selectedDocument.file_path), "_blank", "noopener,noreferrer"); }
    catch (error) { setNotice(errorMessage(error)); }
  }

  function printSelectedGuideline(mode: GuidelinePdfMode) {
    if (!selectedDocument || entries.length === 0) {
      setNotice("Chưa có nội dung đã dịch để xuất PDF.");
      return;
    }
    if (!printGuidelinePdf(selectedDocument, entries, mode)) {
      setNotice("Trình duyệt đã chặn cửa sổ xuất PDF. Hãy cho phép mở cửa sổ bật lên rồi thử lại.");
    }
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
    <section className="mode-panel mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 xl:px-8" aria-labelledby="guidelines-title">
      <div className="glass-panel border border-rose-100/80 bg-white/68 p-4 sm:p-6 xl:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-teal-100 text-rose-600 shadow-sm"><BookOpenCheck size={32} /></div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-teal-600">Nguồn học đã kiểm chứng</p>
              <h1 id="guidelines-title" className="mt-1 text-3xl font-extrabold tracking-tight text-rose-950">Guidelines</h1>
              <p className="mt-1 text-sm text-slate-500">Chỉ quản trị viên kiểm chứng và đăng · thành viên chỉ xem bản đã công khai</p>
            </div>
          </div>
          {canManage && <button type="button" onClick={() => setShowDocumentForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-500"><UploadCloud size={18} /> Thêm guideline</button>}
        </div>

        {notice && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/85 px-4 py-3 text-sm leading-6 text-amber-900">{notice}</div>}

        {canManage && showDocumentForm && <form ref={documentFormRef} onSubmit={submitDocument} className="mt-6 grid gap-4 rounded-3xl border border-rose-100 bg-white/75 p-5 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">Tên guideline<input name="title" required placeholder="2024 ESC Guidelines for AF" className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3 font-medium" /></label>
          <label className="text-sm font-bold text-slate-700">Hiệp hội<input name="society" required defaultValue="ESC" className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3 font-medium" /></label>
          <label className="text-sm font-bold text-slate-700">Bệnh<select name="condition" className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3"><option>ACS</option><option>HF</option><option>AF</option><option>Khác</option></select></label>
          <label className="text-sm font-bold text-slate-700">Năm xuất bản<input name="publicationYear" required type="number" min="1900" max="2200" defaultValue={new Date().getFullYear()} className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3" /></label>
          <label className="text-sm font-bold text-slate-700">Phiên bản<input name="versionLabel" placeholder="Full guideline / Focused update" className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3" /></label>
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-5 text-amber-800">Tài liệu mới luôn ở chế độ Riêng tư. Sau khi xác nhận toàn bộ khuyến cáo, bạn mới có thể đăng công khai.</div>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">Link nguồn chính thức<input name="sourceUrl" required type="url" placeholder="https://www.escardio.org/..." className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3" /></label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">PDF guideline chính<input name="file" required type="file" accept="application/pdf,.pdf" onChange={() => setPreparedExtraction(null)} className="mt-2 block w-full rounded-xl border border-dashed border-teal-200 bg-teal-50/55 px-4 py-4 text-sm" /></label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">PDF Supplementary Data (không bắt buộc)<input name="supplementFile" type="file" accept="application/pdf,.pdf" onChange={() => setPreparedExtraction(null)} className="mt-2 block w-full rounded-xl border border-dashed border-violet-200 bg-violet-50/55 px-4 py-4 text-sm" /><span className="mt-1.5 block text-xs font-medium text-slate-400">Tổng hai file tối đa 40 MB khi dùng AI · mỗi PDF tối đa 40 MB</span></label>
          <label className="sm:col-span-2 flex items-start gap-3 rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-slate-700"><input name="autoExtract" type="checkbox" defaultChecked className="mt-1 h-4 w-4 accent-teal-500" /><span><strong className="block text-teal-800">AI tự dịch toàn bộ nội dung sau khi upload</strong><span className="mt-1 block text-xs leading-5 text-slate-500">Bao gồm từng trang, đoạn văn, chú thích, toàn bộ bảng, Class/LoE và dữ liệu thuốc trong Supplementary Data. Tài liệu dài sẽ được chia thành nhiều cụm trang; kết quả luôn là bản nháp.</span></span></label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">Ghi chú để AI chú ý thêm (không bắt buộc)<input name="focus" onChange={() => setPreparedExtraction(null)} placeholder="Ví dụ: chú ý liều và điều chỉnh theo thận; AI vẫn phải dịch toàn bộ bảng khuyến cáo" className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-4 py-3 font-medium" /></label>
          <div className="sm:col-span-2 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-teal-50 p-4"><button type="button" disabled={aiReading || busy} onClick={() => void readDocumentWithAi()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-extrabold text-white shadow-sm disabled:opacity-50">{aiReading ? <Loader2 className="animate-spin" size={18} /> : <BookOpenCheck size={18} />} {aiReading ? "AI đang dịch toàn bộ tài liệu..." : preparedExtraction ? "AI đã điền · Đọc lại toàn bộ" : "AI đọc & dịch toàn bộ tài liệu"}</button><p className="mt-2 text-center text-xs font-medium text-slate-500">Bao gồm từng trang, đoạn văn, chú thích, Supplementary Data, mọi bảng Recommendation, Class/LoE và dữ liệu thuốc; tất cả luôn là bản nháp chờ bạn kiểm tra.</p>{aiReading && streamProgress && <div className="mt-4 rounded-xl border border-violet-200 bg-white/80 p-3"><div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-violet-700"><span>Đã xong cụm {streamProgress.completedChunks}/{streamProgress.totalChunks} · {streamProgress.sourceLabel}, trang {streamProgress.startPage}-{streamProgress.endPage}</span><span>{streamedEntryCount} khối đã hiện</span></div>{streamPreviewEntries.length > 0 && <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">{streamPreviewEntries.map((entry, index) => <div key={`${entry.topic}-${entry.pageReference}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"><p className="text-xs font-extrabold text-slate-700">{entry.topic}</p><p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{streamPreviewText(entry)}</p></div>)}</div>}</div>}</div>
          <div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={() => setShowDocumentForm(false)} className="rounded-xl border border-rose-100 bg-white px-4 py-2.5 text-sm font-bold text-slate-500">Hủy</button><button disabled={busy || aiReading} className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 className="animate-spin" size={17} />} {busy ? "Đang lưu..." : preparedExtraction ? "Lưu tài liệu đã kiểm tra" : "Lưu & để AI đọc"}</button></div>
        </form>}

        <div className="mt-7 grid gap-6 xl:grid-cols-[17rem_minmax(0,1fr)] 2xl:grid-cols-[19rem_minmax(0,1fr)]">
          <aside className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-col">
            {documents.length === 0 ? <div className="rounded-3xl border border-dashed border-teal-200 bg-teal-50/45 p-6 text-center text-sm text-slate-500">{canManage ? "Chưa có guideline nào." : "Chưa có guideline đã kiểm chứng được đăng công khai."}</div> : documents.map((document) => <button key={document.id} type="button" onClick={() => { setSelectedId(document.id); setShowGuidelineContent(false); setShowEntryForm(false); }} className={`w-full rounded-2xl border p-4 text-left ${selectedId === document.id ? "border-teal-300 bg-teal-50 shadow-sm" : "border-rose-100 bg-white/75"}`}>
              <div className="flex items-start gap-3"><FileText className="mt-0.5 shrink-0 text-rose-500" size={20} /><div className="min-w-0"><p className="line-clamp-2 font-extrabold text-rose-950">{document.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{document.society} · {document.condition} · {document.publication_year}</p><span className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-bold text-teal-700">{document.visibility === "shared" ? "Đã chia sẻ" : "Riêng tư"}</span></div></div>
            </button>)}
          </aside>

          <div className="min-w-0">
            {!selectedDocument ? <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-rose-200 text-sm text-slate-400">Chọn hoặc thêm một guideline.</div> : <>
              <div className={`rounded-3xl border border-rose-100 bg-white/78 ${showGuidelineContent ? "p-4" : "p-5"}`}>
                <div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-rose-500">{selectedDocument.condition} · {selectedDocument.publication_year}</p><h2 className={`mt-1 font-extrabold text-rose-950 ${showGuidelineContent ? "text-base sm:text-lg" : "text-xl"}`}>{selectedDocument.title}</h2>{!showGuidelineContent && <p className="mt-1 text-sm text-slate-500">{selectedDocument.version_label || "Bản chính thức"}</p>}</div><div className="flex flex-wrap items-start gap-2"><button type="button" disabled={entries.length === 0} onClick={() => setShowGuidelineContent((current) => !current)} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-45">{showGuidelineContent ? <EyeOff size={16} /> : <Eye size={16} />}{showGuidelineContent ? "Ẩn" : "Xem"}</button><button type="button" disabled={entries.length === 0} onClick={() => printSelectedGuideline("practice")} title="Xuất PDF thực hành" className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 disabled:opacity-45"><FileDown size={16} /> Thực hành</button><button type="button" disabled={entries.length === 0} onClick={() => printSelectedGuideline("full")} title="Xuất PDF tiếng Việt đầy đủ" className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700 disabled:opacity-45"><BookOpenText size={16} /> Đầy đủ</button><a href={selectedDocument.source_url} target="_blank" rel="noreferrer" title="Nguồn chính thức" className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm font-bold text-rose-600"><ExternalLink size={16} /> Nguồn</a>{selectedDocument.file_path && <button type="button" onClick={() => void openPdf()} title="Mở PDF guideline gốc" className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700"><FileText size={16} /> PDF gốc</button>}{selectedDocument.supplement_file_path && <button type="button" onClick={() => void getGuidelineFileUrl(selectedDocument.supplement_file_path!).then((url) => window.open(url, "_blank", "noopener,noreferrer")).catch((error) => setNotice(errorMessage(error)))} title="Mở Supplementary Data" className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700"><Files size={16} /> Bổ sung</button>}{ownsSelected && selectedDocument.file_path && <button type="button" disabled={aiReading || busy} onClick={() => void reExtractSelectedDocument()} title="Trích xuất lại toàn bộ" className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 disabled:opacity-50">{aiReading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} Trích xuất</button>}{ownsSelected && <button type="button" onClick={() => void togglePublished()} title={selectedDocument.visibility === "shared" ? "Gỡ công khai" : "Đăng công khai"} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${selectedDocument.visibility === "shared" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-teal-200 bg-teal-50 text-teal-700"}`}>{selectedDocument.visibility === "shared" ? <Lock size={16} /> : <Globe2 size={16} />}{selectedDocument.visibility === "shared" ? "Gỡ" : "Công khai"}</button>}{ownsSelected && <button type="button" title="Xóa guideline" onClick={() => void deleteGuidelineDocument(selectedDocument).then(refreshDocuments).catch((error) => setNotice(errorMessage(error)))} className="rounded-xl border border-rose-100 bg-white p-2 text-rose-500"><Trash2 size={17} /></button>}</div></div>
                {!showGuidelineContent && <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">Phục vụ học tập. Luôn kiểm tra tài liệu gốc, đặc điểm người bệnh, chức năng gan–thận và hướng dẫn sử dụng thuốc trước quyết định điều trị.</div>}
              </div>

              {showGuidelineContent && <>
              {ownsSelected && <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" disabled={busy || entries.length === 0 || entries.every((entry) => entry.status === "reviewed")} onClick={() => void confirmAllEntries()} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-700 disabled:cursor-not-allowed disabled:opacity-45"><CheckCircle2 size={17} /> {busy ? "Đang xác nhận..." : "Xác nhận toàn bộ"}</button>
                <button type="button" onClick={() => setShowEntryForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white"><Plus size={17} /> Thêm khuyến cáo</button>
              </div>}

              {showEntryForm && <form onSubmit={submitEntry} className="mt-4 grid gap-3 rounded-3xl border border-rose-100 bg-white/80 p-5 sm:grid-cols-2">
                <Field label="Thuốc/nhóm thuốc (nếu có)" value={entryForm.drug_name} onChange={(value) => setEntryForm((form) => ({ ...form, drug_name: value }))} />
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

              <div className="mt-5 space-y-6">{entries.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">Chưa có nội dung được dịch.</div> : entryGroups.map((group, groupIndex) => <section key={group.title} className="overflow-hidden rounded-3xl border border-rose-100 bg-white/85 shadow-sm">
                <header className="border-b border-rose-100 bg-gradient-to-r from-rose-100 via-rose-50 to-teal-50 px-5 py-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-rose-500">Phần {groupIndex + 1}</p>
                  <h3 className="mt-1 text-base font-extrabold leading-6 text-rose-950">{group.title}</h3>
                </header>
                {group.items.some((entry) => entry.table_kind === "data") ? <StructuredGuidelineTable entries={group.items} society={selectedDocument.society} year={selectedDocument.publication_year} /> : <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse text-left">
                    <thead><tr className="bg-[#d0d0d2] text-xs font-extrabold text-slate-900"><th className="px-5 py-3">Khuyến cáo</th><th className="w-24 border-l border-white px-3 py-3 text-center">Nhóm</th><th className="w-28 border-l border-white px-3 py-3 text-center">Mức độ chứng cứ</th></tr></thead>
                    <tbody>{group.items.map((entry, entryIndex) => <Fragment key={entry.id}>
                      {entry.clinical_context && entry.clinical_context !== group.items[entryIndex - 1]?.clinical_context && <tr className="border-t border-white bg-[#d0d0d2]"><th colSpan={3} className="px-5 py-2.5 text-left text-sm font-extrabold text-slate-900">{entry.clinical_context}</th></tr>}
                      <tr className="border-t border-white align-top hover:brightness-[.99]">
                      <td className="bg-[#f1f1f2] px-5 py-4">
                        <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800">{entry.recommendation_summary}</p>
                        {hasSourceValue(entry.drug_name) && <p className="mt-2 text-xs font-extrabold text-rose-700">Thuốc/nhóm thuốc: {entry.drug_name}</p>}
                        <DrugFacts entry={entry} />
                        <p className="mt-3 text-[11px] font-semibold text-slate-400">{selectedDocument.society} {selectedDocument.publication_year} · {entry.page_reference}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span title={entry.status === "reviewed" ? "Đã kiểm duyệt" : "Bản nháp"} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${entry.status === "reviewed" ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"}`}>{entry.status === "reviewed" ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{entry.status === "reviewed" ? "Đã kiểm duyệt" : "Bản nháp"}</span>
                          {ownsSelected && <><button type="button" title={entry.status === "reviewed" ? "Trả về bản nháp" : "Xác nhận đã đối chiếu"} onClick={() => void toggleReviewed(entry)} className="rounded-lg border border-teal-200 px-2 py-1 text-[10px] font-bold text-teal-700">{entry.status === "reviewed" ? "Trả về bản nháp" : "Xác nhận"}</button><button type="button" title="Xóa khuyến cáo" onClick={() => void deleteGuidelineEntry(entry.id).then(() => setEntries((items) => items.filter((item) => item.id !== entry.id))).catch((error) => setNotice(errorMessage(error)))} className="rounded-lg border border-rose-100 p-1.5 text-rose-500"><Trash2 size={14} /></button></>}
                        </div>
                      </td>
                      <td className={`border-l border-white/90 px-3 py-4 text-center text-sm font-black ${classTone(entry.recommendation_class)}`}>{formatRecommendationClass(entry.recommendation_class)}</td>
                      <td className={`border-l border-white/90 px-3 py-4 text-center text-sm font-black ${evidenceTone(entry.evidence_level)}`}>{formatEvidenceLevel(entry.evidence_level)}</td>
                    </tr></Fragment>)}</tbody>
                  </table>
                </div>}
              </section>)}</div>
              </>}
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

function StructuredGuidelineTable({ entries, society, year }: { entries: GuidelineEntry[]; society: string; year: number }) {
  const rows = entries.filter((entry) => entry.table_kind === "data" && entry.table_cells.length > 0);
  const headers = rows.filter((entry) => entry.table_row_role === "header");
  const body = rows.filter((entry) => entry.table_row_role !== "header");
  const renderRow = (entry: GuidelineEntry) => (
    <tr key={entry.id} className={entry.table_row_role === "section" ? "bg-[#d0d0d2]" : "border-t border-white bg-[#f1f1f2] align-top"}>
      {entry.table_cells.map((cell, index) => {
        const Tag = entry.table_row_role === "header" || entry.table_row_role === "section" ? "th" : "td";
        const colSpan = Math.max(1, Math.min(20, Number(cell.colSpan) || 1));
        const rowSpan = Math.max(1, Math.min(20, Number(cell.rowSpan) || 1));
        const backgroundColor = safeTableColor(cell.backgroundColor);
        const color = safeTableColor(cell.textColor);
        return <Tag key={`${entry.id}-${index}`} colSpan={colSpan} rowSpan={rowSpan} style={{ backgroundColor, color, textAlign: cell.textAlign || "left", fontWeight: cell.fontWeight === "bold" ? 800 : 500 }} className={`border border-white px-4 py-3 text-sm leading-6 ${!backgroundColor && entry.table_row_role === "header" ? "bg-[#d0d0d2]" : !backgroundColor && entry.table_row_role === "section" ? "bg-[#d0d0d2]" : !backgroundColor ? "bg-[#f1f1f2]" : ""} ${!color ? "text-slate-900" : ""}`}>{cell.text}</Tag>;
      })}
    </tr>
  );
  if (rows.length === 0) return null;
  const reviewed = rows.filter((entry) => entry.status === "reviewed").length;
  return <>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] border-collapse">
        {headers.length > 0 && <thead>{headers.map(renderRow)}</thead>}
        <tbody>{body.map(renderRow)}</tbody>
      </table>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rose-100 bg-white px-5 py-3 text-[11px] font-semibold text-slate-400">
      <span>{society} {year} · {rows[0]?.page_reference}</span>
      <span>{reviewed}/{rows.length} hàng đã kiểm duyệt</span>
    </div>
  </>;
}

function safeTableColor(value: string | undefined) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : undefined;
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
  const normalized = normalizeRecommendationClass(value);
  if (normalized === "I") return "bg-[#55c58f] text-slate-950";
  if (normalized === "IIA") return "bg-[#ffd000] text-slate-950";
  if (normalized === "IIB") return "bg-[#f2a43a] text-slate-950";
  if (normalized === "III") return "bg-[#cf3f58] text-white";
  return "bg-slate-50 text-slate-500";
}

function evidenceTone(value: string) {
  const normalized = normalizeEvidenceLevel(value);
  if (normalized === "A") return "bg-[#2f91a6] text-white";
  if (normalized === "B") return "bg-[#6eb6c4] text-slate-950";
  if (normalized === "C") return "bg-[#b9dce3] text-slate-950";
  return "bg-slate-50 text-slate-500";
}

function normalizeRecommendationClass(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.match(/(IIA|IIB|III|I)$/)?.[1] || "";
}

function normalizeEvidenceLevel(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.match(/([ABC])$/)?.[1] || "";
}

function formatRecommendationClass(value: string) {
  const normalized = normalizeRecommendationClass(value);
  if (!normalized) return value || "—";
  return `Class ${normalized === "IIA" ? "IIa" : normalized === "IIB" ? "IIb" : normalized}`;
}

function formatEvidenceLevel(value: string) {
  const normalized = normalizeEvidenceLevel(value);
  return normalized ? `Level ${normalized}` : value || "—";
}

function streamPreviewText(entry: ExtractedGuidelineEntry) {
  return entry.recommendationSummary || entry.tableCells.map((cell) => cell.text).filter(Boolean).join(" | ") || "Đã dịch một khối nội dung.";
}

type GuidelinePdfMode = "practice" | "full";

type GuidelinePdfGroup = {
  title: string;
  entries: GuidelineEntry[];
};

function printGuidelinePdf(document: GuidelineDocument, sourceEntries: GuidelineEntry[], mode: GuidelinePdfMode) {
  const groups = groupEntriesForPdf(document, sourceEntries);
  const selectedGroups = mode === "full" ? groups : groups.filter(isPracticePdfGroup);
  if (selectedGroups.length === 0) return false;

  // Open synchronously from the button click so browsers do not classify it as a popup.
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  const edition = mode === "full" ? "Bản tiếng Việt đầy đủ" : "Bản thực hành: khuyến cáo, liều và sơ đồ";
  const fileName = `${document.title} - ${edition}`.replace(/[\\/:*?"<>|]/g, "-");
  printWindow.document.title = fileName;
  printWindow.document.write(`<!doctype html>
<html lang="vi"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapePdfHtml(fileName)}</title><style>${guidelinePdfCss()}</style></head>
<body><main>
  <header class="document-header">
    <p class="eyebrow">${escapePdfHtml(edition)}</p>
    <h1>${escapePdfHtml(document.title)}</h1>
    <p class="metadata">${escapePdfHtml(`${document.society} · ${document.condition} · ${document.publication_year}${document.version_label ? ` · ${document.version_label}` : ""}`)}</p>
    <p class="source">Bản dịch được sắp theo thứ tự tài liệu gốc. Đối chiếu PDF nguồn trước khi áp dụng lâm sàng.</p>
  </header>
  ${selectedGroups.map((group, index) => renderPdfGroup(group, index)).join("")}
</main><script>window.onload = function () { window.setTimeout(function () { window.print(); }, 250); };</script></body></html>`);
  printWindow.document.close();
  return true;
}

function groupEntriesForPdf(document: GuidelineDocument, entries: GuidelineEntry[]): GuidelinePdfGroup[] {
  const groups = new Map<string, GuidelineEntry[]>();
  for (const entry of [...entries].sort((left, right) => left.source_order - right.source_order)) {
    const title = entry.topic.trim() || document.condition || "Nội dung guideline";
    const group = groups.get(title) ?? [];
    group.push(entry);
    groups.set(title, group);
  }
  return Array.from(groups, ([title, groupEntries]) => ({ title, entries: groupEntries }));
}

function isPracticePdfGroup(group: GuidelinePdfGroup) {
  if (group.entries.some((entry) => entry.table_kind === "recommendation")) return true;
  const searchable = [group.title, ...group.entries.flatMap((entry) => [entry.clinical_context, entry.recommendation_summary, entry.dose, ...entry.table_cells.map((cell) => cell.text)])].join(" ");
  return /\b(dose|dosing|titration|drug|drugs|algorithm|flowchart|pathway|recommendation|recommendations)\b|liều|thuốc|khuyến cáo|sơ đồ|lưu đồ|quy trình|phác đồ/i.test(searchable);
}

function renderPdfGroup(group: GuidelinePdfGroup, index: number) {
  const hasStructuredTable = group.entries.some((entry) => entry.table_kind === "data" && entry.table_cells.length > 0);
  const pageReferences = [...new Set(group.entries.map((entry) => entry.page_reference.trim()).filter(Boolean))];
  return `<section class="chapter">
    <header class="chapter-header"><span>Phần ${index + 1}</span><h2>${escapePdfHtml(group.title)}</h2></header>
    ${hasStructuredTable ? renderStructuredPdfTable(group.entries) : renderRecommendationPdfTable(group.entries)}
    ${pageReferences.length ? `<p class="page-reference">Nguồn: ${escapePdfHtml(pageReferences.join(" · "))}</p>` : ""}
  </section>`;
}

function renderStructuredPdfTable(entries: GuidelineEntry[]) {
  const rows = entries.filter((entry) => entry.table_kind === "data" && entry.table_cells.length > 0);
  if (rows.length === 0) return renderRecommendationPdfTable(entries);
  return `<table class="structured-table"><tbody>${rows.map((entry) => {
    const header = entry.table_row_role === "header" || entry.table_row_role === "section";
    const cells = entry.table_cells.map((cell) => {
      const tag = header ? "th" : "td";
      const colSpan = Math.max(1, Math.min(20, Number(cell.colSpan) || 1));
      const rowSpan = Math.max(1, Math.min(20, Number(cell.rowSpan) || 1));
      const styles = [
        safeTableColor(cell.backgroundColor) ? `background:${safeTableColor(cell.backgroundColor)}` : "",
        safeTableColor(cell.textColor) ? `color:${safeTableColor(cell.textColor)}` : "",
        `text-align:${cell.textAlign || "left"}`,
        `font-weight:${cell.fontWeight === "bold" || header ? "700" : "500"}`,
      ].filter(Boolean).join(";");
      return `<${tag} colspan="${colSpan}" rowspan="${rowSpan}" style="${styles}">${formatPdfText(cell.text)}</${tag}>`;
    }).join("");
    return `<tr class="${header ? "table-header" : ""}">${cells}</tr>`;
  }).join("")}</tbody></table>`;
}

function renderRecommendationPdfTable(entries: GuidelineEntry[]) {
  const recommendations = entries.filter((entry) => entry.table_kind === "recommendation");
  if (recommendations.length === 0) return "";
  let previousContext = "";
  const rows = recommendations.map((entry) => {
    const context = entry.clinical_context.trim();
    const contextRow = context && context !== previousContext
      ? `<tr class="table-header"><th colspan="3">${formatPdfText(context)}</th></tr>`
      : "";
    previousContext = context;
    const details = [
      entry.drug_name && `Thuốc/nhóm thuốc: ${entry.drug_name}`,
      entry.dose && `Liều/cách dùng: ${entry.dose}`,
      entry.renal_adjustment && `Thận: ${entry.renal_adjustment}`,
      entry.hepatic_adjustment && `Gan: ${entry.hepatic_adjustment}`,
      entry.contraindications && `Chống chỉ định/thận trọng: ${entry.contraindications}`,
      entry.monitoring && `Theo dõi: ${entry.monitoring}`,
    ].filter((value): value is string => Boolean(value) && hasSourceValue(value.replace(/^[^:]+:\s*/, "")));
    return `${contextRow}<tr><td><div class="recommendation">${formatPdfText(entry.recommendation_summary)}</div>${details.length ? `<ul class="details">${details.map((detail) => `<li>${formatPdfText(detail)}</li>`).join("")}</ul>` : ""}</td><td class="grade">${escapePdfHtml(formatRecommendationClass(entry.recommendation_class))}</td><td class="grade">${escapePdfHtml(formatEvidenceLevel(entry.evidence_level))}</td></tr>`;
  }).join("");
  return `<table class="recommendation-table"><thead><tr class="table-header"><th>Khuyến cáo</th><th>Nhóm</th><th>Mức độ chứng cứ</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function formatPdfText(value: string) {
  return escapePdfHtml(value).replace(/\n/g, "<br />");
}

function escapePdfHtml(value: string) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

function guidelinePdfCss() {
  return `@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; } body { margin: 0; color: #172033; font: 11pt/1.5 Arial, Helvetica, sans-serif; } main { max-width: 182mm; margin: 0 auto; }
.document-header { border-bottom: 2px solid #0f9d95; margin-bottom: 10mm; padding-bottom: 5mm; } .eyebrow { color: #008c85; font-size: 9pt; font-weight: 700; letter-spacing: .08em; margin: 0 0 2mm; text-transform: uppercase; } h1 { color: #4a1020; font-size: 21pt; line-height: 1.2; margin: 0; } .metadata { color: #546176; font-weight: 700; margin: 2mm 0 0; } .source { color: #6b7280; font-size: 9pt; margin: 3mm 0 0; }
.chapter { break-inside: avoid; margin: 0 0 8mm; } .chapter-header { background: #fff0f3; border-left: 4px solid #eb5975; padding: 3mm 4mm; } .chapter-header span { color: #c73855; font-size: 8pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; } h2 { color: #451323; font-size: 14pt; line-height: 1.3; margin: 1mm 0 0; }
table { border-collapse: collapse; margin-top: 3mm; table-layout: fixed; width: 100%; } th, td { border: 1px solid #ffffff; padding: 3mm; vertical-align: top; overflow-wrap: anywhere; } .structured-table td { background: #f1f1f2; } .structured-table .table-header th, .recommendation-table .table-header th { background: #d0d0d2; color: #111827; font-weight: 700; text-align: left; } .recommendation-table th:nth-child(2), .recommendation-table th:nth-child(3), .recommendation-table td:nth-child(2), .recommendation-table td:nth-child(3) { text-align: center; width: 19mm; } .recommendation-table td { background: #f1f1f2; } .recommendation { font-weight: 600; } .details { color: #374151; font-size: 9.5pt; margin: 2mm 0 0; padding-left: 4mm; } .details li { margin: 1mm 0; } .grade { font-size: 9pt; font-weight: 700; } .page-reference { color: #6b7280; font-size: 8.5pt; margin: 2mm 0 0; }
@media print { .chapter { break-inside: avoid-page; } tr, td, th { break-inside: avoid-page; } }`;
}
