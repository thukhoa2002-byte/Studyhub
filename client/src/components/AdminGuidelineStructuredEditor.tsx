import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { DataRoute } from "../utils/dataRoutes";
import {
  createGuidelineCoreDocument,
  getGuidelineCoreDocument,
  listGuidelineCoreDocuments,
  updateGuidelineCoreDocument,
} from "../services/guidelineRepository";
import {
  createGuidelineSection,
  deleteDraftGuidelineSection,
  listGuidelineSections,
  setGuidelineSectionStatus,
  updateGuidelineSection,
} from "../services/guidelineSectionRepository";
import {
  createGuidelineRecommendation,
  deleteDraftGuidelineRecommendation,
  listGuidelineRecommendations,
  setGuidelineRecommendationStatus,
  updateGuidelineRecommendation,
} from "../services/guidelineRecommendationRepository";
import {
  createGuidelineSourceDocument,
  deleteGuidelineSourceDocument,
  listGuidelineSourceDocuments,
  updateGuidelineSourceDocument,
} from "../services/guidelineSourceDocumentRepository";
import {
  archiveGuideline,
  publishGuideline,
  publishGuidelineRecommendation,
  publishGuidelineSection,
  setGuidelineStatus,
} from "../services/guidelinePublicationService";
import { validateSectionParentChange } from "../services/guidelineSectionValidation";
import { validateGuidelineForPublication, validateRecommendationForPublication, GuidelineValidationError } from "../services/guidelineValidation";
import type {
  GuidelineCoreDocument,
  GuidelineCoreStatus,
  GuidelineRecommendationRecord,
  GuidelineRecommendationStatus,
  GuidelineSectionRecord,
  GuidelineSourceDocumentRecord,
  GuidelineSourceKind,
  NewGuidelineRecommendation,
} from "../services/guidelineCoreTypes";

type AdminRoute = Extract<DataRoute, { tab: "admin" }>;
type Tab = "overview" | "sections" | "recommendations" | "sources";
type Notice = { type: "error" | "success" | "info"; text: string; details?: string[] } | null;
type DocumentFormState = {
  title: string;
  society: string;
  condition: string;
  summary: string;
  topics: string;
  publication_year: string;
  version_label: string;
  source_url: string;
  doi: string;
  citation: string;
  review_note: string;
  visibility: "private" | "shared";
};

const statusLabels: Record<GuidelineCoreStatus | GuidelineRecommendationStatus, string> = {
  draft: "Bản nháp",
  in_review: "Đang rà soát",
  reviewed: "Đã rà soát",
  published: "Đã xuất bản",
  archived: "Đã lưu trữ",
};

const sourceKinds: GuidelineSourceKind[] = ["manual", "primary", "supplement", "supporting", "html", "xml"];

function errorText(error: unknown): string {
  if (error instanceof GuidelineValidationError) return error.errors[0] || error.message;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Không thể hoàn tất thao tác.";
}

function validationDetails(error: unknown): string[] | undefined {
  return error instanceof GuidelineValidationError ? error.errors : undefined;
}

function emptyDocument(): DocumentFormState {
  return {
    title: "",
    society: "",
    condition: "",
    summary: "",
    topics: "",
    publication_year: "",
    version_label: "",
    source_url: "",
    doi: "",
    citation: "",
    review_note: "",
    visibility: "private" as const,
  };
}

function documentForm(record: GuidelineCoreDocument | null): DocumentFormState {
  if (!record) return emptyDocument();
  return {
    title: record.title,
    society: record.society,
    condition: record.condition,
    summary: record.summary || "",
    topics: Array.isArray(record.topics) ? record.topics.map(String).join(", ") : "",
    publication_year: record.publication_year == null ? "" : String(record.publication_year),
    version_label: record.version_label,
    source_url: record.source_url || "",
    doi: record.doi || "",
    citation: record.citation || "",
    review_note: record.review_note || "",
    visibility: record.visibility,
  };
}

function emptyRecommendation(guidelineId: string, sectionId: string | null): NewGuidelineRecommendation {
  return {
    guideline_id: guidelineId,
    section_id: sectionId,
    title: "",
    recommendation_text_original: "",
    recommendation_text_vi: "",
    rationale_vi: "",
    recommendation_class: "",
    evidence_level: "",
    evidence_system: "",
    population: "",
    intervention: "",
    comparator: "",
    outcome: "",
    conditions: "",
    contraindications: "",
    source_page: null,
    source_quote: "",
    source_anchor: "",
    verification_status: "unverified",
    review_note: "",
    sort_order: 0,
  };
}

function recommendationForm(record: GuidelineRecommendationRecord | null, guidelineId: string, sectionId: string | null): NewGuidelineRecommendation {
  if (!record) return emptyRecommendation(guidelineId, sectionId);
  return { ...record };
}

function statusClass(status: string) {
  if (status === "published") return "bg-teal-50 text-teal-700";
  if (status === "archived") return "bg-slate-100 text-slate-600";
  if (status === "reviewed" || status === "in_review") return "bg-amber-50 text-amber-800";
  return "bg-violet-50 text-violet-700";
}

function topicsFromForm(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function AdminGuidelineStructuredEditor({ user, route, onNavigate }: { user: User; route: AdminRoute; onNavigate: (path: string) => void }) {
  if (route.kind === "admin-guideline-list") return <GuidelineList onNavigate={onNavigate} />;
  if (route.kind === "admin-guideline-new") return <GuidelineDocumentEditor user={user} onNavigate={onNavigate} />;
  return <GuidelineWorkspace user={user} guidelineId={route.guidelineId || ""} initialTab={route.kind === "admin-guideline-sections" ? "sections" : route.kind === "admin-guideline-recommendations" ? "recommendations" : "overview"} onNavigate={onNavigate} />;
}

function GuidelineList({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [items, setItems] = useState<GuidelineCoreDocument[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listGuidelineCoreDocuments()); setNotice(null); }
    catch (error) { setNotice({ type: "error", text: errorText(error) }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => items.filter((item) => `${item.title} ${item.society} ${item.condition}`.toLowerCase().includes(query.toLowerCase())), [items, query]);

  return <section aria-labelledby="admin-guideline-title">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-violet-600">Quản trị Guideline</p><h1 id="admin-guideline-title" className="mt-1 text-2xl font-extrabold text-rose-950">Guideline Core</h1><p className="mt-1 text-sm font-semibold text-slate-500">Biên tập Guideline, section và khuyến cáo có cấu trúc.</p></div><button type="button" onClick={() => onNavigate("/admin/guidelines/new")} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-extrabold text-white"><Plus size={17} />Thêm guideline</button></div>
    {notice && <Notice notice={notice} />}
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white/80 p-4"><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-violet-400" placeholder="Tìm guideline theo tên, hiệp hội hoặc bệnh..." /></div>
    {loading ? <Loading /> : filtered.length === 0 ? <Empty text="Chưa có guideline phù hợp." /> : <div className="mt-4 grid gap-3 md:grid-cols-2">{filtered.map((item) => <button key={item.id} type="button" onClick={() => onNavigate(`/admin/guidelines/${item.id}/edit`)} className="rounded-2xl border border-violet-100 bg-white/85 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-extrabold text-slate-800">{item.title || "Chưa đặt tên"}</h2><p className="mt-1 text-xs font-semibold text-slate-500">{item.society || "Chưa có hiệp hội"} · {item.condition || "Chưa phân loại"}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(item.status)}`}>{statusLabels[item.status]}</span></div><p className="mt-3 text-xs font-semibold text-slate-400">{item.publication_year || item.version_label || "Chưa có năm/phiên bản"} · {item.visibility === "shared" ? "Có thể chia sẻ" : "Riêng tư"}</p></button>)}</div>}
  </section>;
}

function GuidelineDocumentEditor({ user, onNavigate }: { user: User; onNavigate: (path: string) => void }) {
  const [form, setForm] = useState(emptyDocument);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  async function save() {
    if (!form.title.trim()) { setNotice({ type: "error", text: "Tên Guideline là trường bắt buộc." }); return; }
    setSaving(true);
    try {
      const created = await createGuidelineCoreDocument(user.id, { ...form, topics: topicsFromForm(form.topics), publication_year: form.publication_year ? Number(form.publication_year) : null, version_label: form.version_label.trim() });
      onNavigate(`/admin/guidelines/${created.id}/edit`);
    } catch (error) { setNotice({ type: "error", text: errorText(error), details: validationDetails(error) }); }
    finally { setSaving(false); }
  }
  return <section><EditorHeader title="Thêm Guideline" onBack={() => onNavigate("/admin/guidelines")} /><DocumentForm form={form} setForm={setForm} /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => onNavigate("/admin/guidelines")} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600">Hủy</button><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"><Save size={16} />Lưu bản nháp</button></div>{notice && <Notice notice={notice} />}</section>;
}

function GuidelineWorkspace({ user, guidelineId, initialTab, onNavigate }: { user: User; guidelineId: string; initialTab: Tab; onNavigate: (path: string) => void }) {
  const [document, setDocument] = useState<GuidelineCoreDocument | null>(null);
  const [sections, setSections] = useState<GuidelineSectionRecord[]>([]);
  const [recommendations, setRecommendations] = useState<GuidelineRecommendationRecord[]>([]);
  const [sources, setSources] = useState<GuidelineSourceDocumentRecord[]>([]);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [dirty, setDirty] = useState(false);
  const [baseline, setBaseline] = useState("");

  const load = useCallback(async () => {
    if (!guidelineId) { setNotice({ type: "error", text: "Thiếu ID Guideline." }); setLoading(false); return; }
    setLoading(true);
    try {
      const [nextDocument, nextSections, nextRecommendations, nextSources] = await Promise.all([getGuidelineCoreDocument(guidelineId), listGuidelineSections(guidelineId), listGuidelineRecommendations(guidelineId), listGuidelineSourceDocuments(guidelineId)]);
      if (!nextDocument) { setNotice({ type: "error", text: "Không tìm thấy Guideline hoặc bạn không có quyền truy cập." }); return; }
      setDocument(nextDocument); setSections(nextSections); setRecommendations(nextRecommendations); setSources(nextSources); setNotice(null);
      setBaseline(JSON.stringify({ nextDocument, nextSections, nextRecommendations, nextSources })); setDirty(false);
    } catch (error) { setNotice({ type: "error", text: errorText(error), details: validationDetails(error) }); }
    finally { setLoading(false); }
  }, [guidelineId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const onBeforeUnload = (event: BeforeUnloadEvent) => { if (!dirty) return; event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", onBeforeUnload); return () => window.removeEventListener("beforeunload", onBeforeUnload); }, [dirty]);
  useEffect(() => { if (document && baseline) setDirty(JSON.stringify({ nextDocument: document, nextSections: sections, nextRecommendations: recommendations, nextSources: sources }) !== baseline); }, [document, sections, recommendations, sources, baseline]);
  useEffect(() => {
    if (notice?.type !== "success" || !document) return;
    const snapshot = JSON.stringify({ nextDocument: document, nextSections: sections, nextRecommendations: recommendations, nextSources: sources });
    setBaseline(snapshot);
    setDirty(false);
  }, [notice, document, sections, recommendations, sources]);

  if (loading) return <Loading />;
  if (!document) return <><Notice notice={notice} /><button type="button" onClick={() => onNavigate("/admin/guidelines")} className="mt-4 font-bold text-violet-700">Quay về danh sách</button></>;

  async function updateDocument(patch: Partial<GuidelineCoreDocument>) {
    const currentDocument = document as GuidelineCoreDocument;
    try { const next = await updateGuidelineCoreDocument(currentDocument.id, patch); setDocument(next); setNotice({ type: "success", text: "Đã lưu Guideline." }); }
    catch (error) { setNotice({ type: "error", text: errorText(error), details: validationDetails(error) }); }
  }
  async function changeStatus(status: GuidelineCoreStatus) {
    const currentDocument = document as GuidelineCoreDocument;
    try {
      const next = status === "published" ? await publishGuideline(currentDocument.id, user.id) : status === "archived" ? await archiveGuideline(currentDocument.id, user.id) : await setGuidelineStatus(currentDocument.id, status, user.id);
      setDocument(next); setNotice({ type: "success", text: `Đã chuyển Guideline sang ${statusLabels[status]}.` });
    } catch (error) { setNotice({ type: "error", text: errorText(error), details: validationDetails(error) }); }
  }
  const blockers = validateGuidelineForPublication(document, sections, recommendations, sources);
  return <section>
    <EditorHeader title={document.title || "Guideline chưa đặt tên"} onBack={() => onNavigate("/admin/guidelines")} />
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-white/80 p-3"><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${statusClass(document.status)}`}>{statusLabels[document.status]}</span><span className="text-xs font-semibold text-slate-400">UUID giữ nguyên: {document.id}</span></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void changeStatus("in_review")} disabled={document.status === "published" || document.status === "archived"} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-800 disabled:opacity-40">Gửi rà soát</button><button type="button" onClick={() => window.confirm("Xuất bản Guideline theo chính sách hiện tại?") && void changeStatus("published")} disabled={document.status === "published" || document.status === "archived"} className="rounded-xl bg-teal-600 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-40">Xuất bản</button><button type="button" onClick={() => window.confirm("Lưu trữ Guideline này? Nội dung sẽ không còn công khai.") && void changeStatus("archived")} disabled={document.status === "archived"} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-extrabold text-rose-700 disabled:opacity-40"><Archive size={14} />Lưu trữ</button></div></div>
    {dirty && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">Có thay đổi chưa lưu. Hãy lưu từng section hoặc khuyến cáo trước khi rời trang.</div>}
    {notice && <Notice notice={notice} />}
    <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2 md:grid-cols-4">{(["overview", "sections", "recommendations", "sources"] as Tab[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-xl px-3 py-2.5 text-sm font-extrabold ${tab === item ? "bg-violet-100 text-violet-800" : "text-slate-600 hover:bg-violet-50"}`}>{item === "overview" ? "Thông tin chung" : item === "sections" ? `Sections (${sections.length})` : item === "recommendations" ? `Khuyến cáo (${recommendations.length})` : `Nguồn (${sources.length})`}</button>)}</div>
    {tab === "overview" && <OverviewPanel document={document} onSave={updateDocument} blockers={blockers} />}
    {tab === "sections" && <SectionsPanel guidelineId={document.id} sections={sections} setSections={setSections} setNotice={setNotice} user={user} />}
    {tab === "recommendations" && <RecommendationsPanel document={document} sections={sections} recommendations={recommendations} setRecommendations={setRecommendations} setNotice={setNotice} user={user} />}
    {tab === "sources" && <SourcesPanel guidelineId={document.id} sources={sources} setSources={setSources} setNotice={setNotice} user={user} />}
  </section>;
}

function OverviewPanel({ document, onSave, blockers }: { document: GuidelineCoreDocument; onSave: (patch: Partial<GuidelineCoreDocument>) => Promise<void>; blockers: string[] }) {
  const [form, setForm] = useState(() => documentForm(document));
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(documentForm(document)), [document]);
  async function save() { setSaving(true); try { await onSave({ ...form, topics: topicsFromForm(form.topics), publication_year: form.publication_year ? Number(form.publication_year) : null }); } finally { setSaving(false); } }
  return <div className="mt-4"><DocumentForm form={form} setForm={setForm} /><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="text-xs font-semibold text-slate-500">Để xuất bản, hệ thống sẽ kiểm tra các điều kiện bên dưới.</div><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"><Save size={16} />{saving ? "Đang lưu..." : "Lưu thông tin"}</button></div><div className={`mt-4 rounded-2xl border p-4 ${blockers.length ? "border-amber-200 bg-amber-50" : "border-teal-200 bg-teal-50"}`}><p className="text-sm font-extrabold">{blockers.length ? "Điều kiện xuất bản còn thiếu" : "Guideline đủ điều kiện kiểm tra xuất bản"}</p>{blockers.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-amber-800">{blockers.map((item) => <li key={item}>{item}</li>)}</ul>}</div></div>;
}

function DocumentForm({ form, setForm }: { form: DocumentFormState; setForm: (value: DocumentFormState) => void }) {
  const field = (key: keyof ReturnType<typeof emptyDocument>, label: string, placeholder = "", wide = false) => <label className={wide ? "md:col-span-2" : ""}><span className="mb-1.5 block text-sm font-extrabold text-slate-700">{label}</span><input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder={placeholder} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-violet-400" /></label>;
  return <div className="rounded-2xl border border-violet-100 bg-white/80 p-4"><div className="grid gap-4 md:grid-cols-2">{field("title", "Tên Guideline", "Có thể tạo mà không cần PDF hoặc URL", true)}{field("society", "Hiệp hội / tổ chức")}{field("condition", "Bệnh / chuyên khoa")}{field("topics", "Chuyên khoa / danh mục", "Nhập nhiều mục, ngăn cách bằng dấu phẩy", true)}{field("version_label", "Phiên bản")}{field("publication_year", "Năm xuất bản")}{field("source_url", "URL nguồn (tùy chọn)")}{field("doi", "DOI (tùy chọn)")}{field("summary", "Tóm tắt", "Tóm tắt Guideline (tùy chọn)", true)}{field("citation", "Trích dẫn (tùy chọn)", "Nguồn traceability nếu không có file", true)}{field("review_note", "Ghi chú rà soát", "Ghi chú nội bộ", true)}<label><span className="mb-1.5 block text-sm font-extrabold text-slate-700">Phạm vi hiển thị</span><select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as "private" | "shared" })} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="private">Riêng tư</option><option value="shared">Chia sẻ</option></select></label></div></div>;
}

function SectionsPanel({ guidelineId, sections, setSections, setNotice, user }: { guidelineId: string; sections: GuidelineSectionRecord[]; setSections: (items: GuidelineSectionRecord[]) => void; setNotice: (notice: Notice) => void; user: User }) {
  const [title, setTitle] = useState(""); const [titleVi, setTitleVi] = useState(""); const [summary, setSummary] = useState(""); const [parentId, setParentId] = useState<string>(""); const [saving, setSaving] = useState(false);
  const ordered = [...sections].sort((a, b) => a.display_order - b.display_order);
  async function add() {
    if (!title.trim()) { setNotice({ type: "error", text: "Tên section là trường bắt buộc." }); return; }
    const errors = validateSectionParentChange(null, guidelineId, parentId || null, sections);
    if (errors.length) { setNotice({ type: "error", text: errors[0], details: errors }); return; }
    setSaving(true);
    try { const created = await createGuidelineSection(user.id, { guideline_id: guidelineId, slug: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), title: title.trim(), title_vi: titleVi.trim() || title.trim(), summary: summary.trim(), display_order: sections.length, parent_section_id: parentId || null }); setSections([...sections, created]); setTitle(""); setTitleVi(""); setSummary(""); setParentId(""); setNotice({ type: "success", text: "Đã tạo section." }); }
    catch (error) { setNotice({ type: "error", text: errorText(error), details: validationDetails(error) }); }
    finally { setSaving(false); }
  }
  async function move(section: GuidelineSectionRecord, direction: -1 | 1) {
    const index = ordered.findIndex((item) => item.id === section.id); const target = ordered[index + direction]; if (!target) return;
    try { const [current, next] = await Promise.all([updateGuidelineSection(section.id, { display_order: target.display_order }), updateGuidelineSection(target.id, { display_order: section.display_order })]); setSections(sections.map((item) => item.id === current.id ? current : item.id === next.id ? next : item)); }
    catch (error) { setNotice({ type: "error", text: errorText(error) }); }
  }
  return <div className="mt-4 space-y-4"><div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4"><h2 className="text-base font-extrabold text-teal-900">Tạo section</h2><div className="mt-3 grid gap-3 md:grid-cols-2"><input value={title} onChange={(event) => setTitle(event.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" placeholder="Tên section" /><input value={titleVi} onChange={(event) => setTitleVi(event.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" placeholder="Tên tiếng Việt (tùy chọn)" /><select value={parentId} onChange={(event) => setParentId(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold md:col-span-2"><option value="">Section gốc</option>{ordered.filter((item) => item.status !== "archived").map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><textarea value={summary} onChange={(event) => setSummary(event.target.value)} className="min-h-20 rounded-xl border border-slate-200 p-3 text-sm font-semibold md:col-span-2" placeholder="Tóm tắt section" /></div><button type="button" disabled={saving} onClick={() => void add()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"><Plus size={16} />Thêm section</button></div><div className="rounded-2xl border border-slate-200 bg-white/80 p-4"><h2 className="text-base font-extrabold text-slate-800">Cấu trúc section</h2>{ordered.length === 0 ? <Empty text="Chưa có section." /> : <div className="mt-3 space-y-2">{ordered.map((section, index) => <SectionRow key={section.id} section={section} sections={sections} setSections={setSections} setNotice={setNotice} onMoveUp={() => void move(section, -1)} onMoveDown={() => void move(section, 1)} isFirst={index === 0} isLast={index === ordered.length - 1} />)}</div>}</div></div>;
}

function SectionRow({ section, sections, setSections, setNotice, onMoveUp, onMoveDown, isFirst, isLast }: { section: GuidelineSectionRecord; sections: GuidelineSectionRecord[]; setSections: (items: GuidelineSectionRecord[]) => void; setNotice: (notice: Notice) => void; onMoveUp: () => void; onMoveDown: () => void; isFirst: boolean; isLast: boolean }) {
  const [editing, setEditing] = useState(false); const [title, setTitle] = useState(section.title); const [titleVi, setTitleVi] = useState(section.title_vi); const [summary, setSummary] = useState(section.summary); const [parent, setParent] = useState(section.parent_section_id || "");
  async function save() {
    const errors = validateSectionParentChange(section.id, section.guideline_id, parent || null, sections); if (errors.length) { setNotice({ type: "error", text: errors[0], details: errors }); return; }
    try { const updated = await updateGuidelineSection(section.id, { title: title.trim(), title_vi: titleVi.trim() || title.trim(), summary: summary.trim(), parent_section_id: parent || null }); setSections(sections.map((item) => item.id === updated.id ? updated : item)); setEditing(false); setNotice({ type: "success", text: "Đã lưu section." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
  }
  async function publish() { try { const updated = await publishGuidelineSection(section.id); setSections(sections.map((item) => item.id === updated.id ? updated : item)); setNotice({ type: "success", text: "Đã xuất bản section." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); } }
  async function archive() { if (!window.confirm(`Lưu trữ section “${section.title}”?`)) return; try { const updated = await setGuidelineSectionStatus(section.id, "archived"); setSections(sections.map((item) => item.id === updated.id ? updated : item)); } catch (error) { setNotice({ type: "error", text: errorText(error) }); } }
  async function remove() { if (!window.confirm(`Xóa section nháp “${section.title}”?`)) return; try { await deleteDraftGuidelineSection(section.id); setSections(sections.filter((item) => item.id !== section.id)); } catch (error) { setNotice({ type: "error", text: errorText(error) }); } }
  const depth = getDepth(section, sections);
  return <div className={`rounded-xl border p-3 ${section.status === "archived" ? "border-slate-200 bg-slate-50 opacity-70" : "border-slate-200 bg-white"}`} style={{ marginLeft: `${Math.min(depth, 4) * 18}px` }}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-slate-800">{section.title_vi || section.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{section.title} · {statusLabels[section.status]}</p></div><div className="flex items-center gap-1"><button type="button" title="Đưa lên" onClick={onMoveUp} disabled={isFirst} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp size={15} /></button><button type="button" title="Đưa xuống" onClick={onMoveDown} disabled={isLast} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown size={15} /></button><button type="button" title="Sửa" onClick={() => setEditing(!editing)} className="rounded-lg p-2 text-violet-600 hover:bg-violet-50">{editing ? <X size={15} /> : <ChevronRight size={15} />}</button>{section.status !== "archived" && section.status !== "published" && <button type="button" title="Xuất bản" onClick={() => void publish()} className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"><Check size={15} /></button>}{section.status !== "archived" && <button type="button" title="Lưu trữ" onClick={() => void archive()} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Archive size={15} /></button>}{section.status === "draft" && <button type="button" title="Xóa" onClick={() => void remove()} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button>}</div></div>{editing && <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 md:grid-cols-2"><input value={title} onChange={(event) => setTitle(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold" placeholder="Tên" /><input value={titleVi} onChange={(event) => setTitleVi(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold" placeholder="Tên tiếng Việt" /><select value={parent} onChange={(event) => setParent(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold md:col-span-2"><option value="">Section gốc</option>{sections.filter((item) => item.id !== section.id && item.status !== "archived").map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><textarea value={summary} onChange={(event) => setSummary(event.target.value)} className="min-h-16 rounded-lg border border-slate-200 p-3 text-sm font-semibold md:col-span-2" placeholder="Tóm tắt" /><button type="button" onClick={() => void save()} className="inline-flex w-fit items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-extrabold text-white"><Save size={14} />Lưu section</button></div>}</div>;
}

function getDepth(section: GuidelineSectionRecord, sections: GuidelineSectionRecord[]) { let depth = 0; const ids = new Set<string>(); let parent = section.parent_section_id; while (parent && !ids.has(parent)) { ids.add(parent); depth += 1; parent = sections.find((item) => item.id === parent)?.parent_section_id || null; } return depth; }

function RecommendationsPanel({ document, sections, recommendations, setRecommendations, setNotice, user }: { document: GuidelineCoreDocument; sections: GuidelineSectionRecord[]; recommendations: GuidelineRecommendationRecord[]; setRecommendations: (items: GuidelineRecommendationRecord[]) => void; setNotice: (notice: Notice) => void; user: User }) {
  const [selectedId, setSelectedId] = useState<string | null>(null); const selected = recommendations.find((item) => item.id === selectedId) || null; const [form, setForm] = useState<NewGuidelineRecommendation>(() => emptyRecommendation(document.id, sections[0]?.id || null));
  useEffect(() => setForm(recommendationForm(selected, document.id, sections[0]?.id || null)), [selected, document.id, sections]);
  async function save() {
    if (!form.title.trim() && !form.recommendation_text_original.trim() && !form.recommendation_text_vi.trim()) { setNotice({ type: "error", text: "Khuyến cáo cần có tiêu đề hoặc nội dung." }); return; }
    try {
      if (selected) { const { guideline_id: _guidelineId, ...patch } = form; const updated = await updateGuidelineRecommendation(selected.id, patch); setRecommendations(recommendations.map((item) => item.id === updated.id ? updated : item)); }
      else { const created = await createGuidelineRecommendation(user.id, form); setRecommendations([...recommendations, created]); setSelectedId(created.id); }
      setNotice({ type: "success", text: "Đã lưu khuyến cáo." });
    } catch (error) { setNotice({ type: "error", text: errorText(error), details: validationDetails(error) }); }
  }
  async function setStatus(status: GuidelineRecommendationStatus) { if (!selected) return; try { const updated = status === "published" ? await publishGuidelineRecommendation(selected.id, user.id) : await setGuidelineRecommendationStatus(selected.id, status, user.id); setRecommendations(recommendations.map((item) => item.id === updated.id ? updated : item)); setForm(recommendationForm(updated, document.id, updated.section_id)); setNotice({ type: "success", text: `Đã chuyển khuyến cáo sang ${statusLabels[status]}.` }); } catch (error) { setNotice({ type: "error", text: errorText(error), details: validationDetails(error) }); } }
  async function remove() { if (!selected || !window.confirm("Xóa khuyến cáo bản nháp này?")) return; try { await deleteDraftGuidelineRecommendation(selected.id); setRecommendations(recommendations.filter((item) => item.id !== selected.id)); setSelectedId(null); setNotice({ type: "success", text: "Đã xóa khuyến cáo nháp." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); } }
  const publicationErrors = selected ? validateRecommendationForPublication(selected, document, sections.find((section) => section.id === selected.section_id) || null, []) : [];
  return <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.7fr)]"><div className="rounded-2xl border border-slate-200 bg-white/80 p-3"><div className="flex items-center justify-between"><h2 className="text-sm font-extrabold text-slate-800">Khuyến cáo</h2><button type="button" onClick={() => { setSelectedId(null); setForm(emptyRecommendation(document.id, sections[0]?.id || null)); }} className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"><Plus size={16} /></button></div><div className="mt-3 space-y-2">{recommendations.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-3 text-left ${item.id === selectedId ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-extrabold text-slate-800">{item.title || "Chưa có tiêu đề"}</span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${statusClass(item.status)}`}>{statusLabels[item.status]}</span></div><p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{item.recommendation_text_vi || item.recommendation_text_original || "Chưa có nội dung"}</p></button>)}{recommendations.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs font-semibold text-slate-500">Chưa có khuyến cáo.</p>}</div></div><div className="rounded-2xl border border-slate-200 bg-white/80 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-base font-extrabold text-slate-800">{selected ? "Sửa khuyến cáo" : "Tạo khuyến cáo"}</h2><p className="mt-1 text-xs font-semibold text-slate-500">Độc lập với legacy guideline_entries.</p></div>{selected && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(selected.status)}`}>{statusLabels[selected.status]}</span>}</div><RecommendationForm form={form} setForm={setForm} sections={sections} /><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-extrabold text-white"><Save size={16} />Lưu khuyến cáo</button>{selected && <><button type="button" disabled={selected.status === "published" || selected.status === "archived"} onClick={() => void setStatus("in_review")} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-800 disabled:opacity-40">Gửi rà soát</button><button type="button" disabled={selected.status === "published" || selected.status === "archived"} onClick={() => void setStatus("reviewed")} className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-extrabold text-teal-800 disabled:opacity-40">Đánh dấu đã rà soát</button><button type="button" disabled={selected.status === "published" || selected.status === "archived"} onClick={() => void setStatus("published")} className="rounded-xl bg-teal-600 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-40">Xuất bản</button><button type="button" disabled={selected.status === "archived"} onClick={() => void setStatus("archived")} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-extrabold text-rose-700 disabled:opacity-40">Lưu trữ</button><button type="button" disabled={selected.status !== "draft"} onClick={() => void remove()} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-extrabold text-rose-700 disabled:opacity-40"><Trash2 size={14} />Xóa nháp</button></>}</div>{selected && publicationErrors.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-extrabold text-amber-900">Điều kiện xuất bản khuyến cáo</p><ul className="mt-1 list-disc pl-5 text-xs font-semibold text-amber-800">{publicationErrors.map((item) => <li key={item}>{item}</li>)}</ul></div>}</div></div>;
}

function RecommendationForm({ form, setForm, sections }: { form: NewGuidelineRecommendation; setForm: (value: NewGuidelineRecommendation) => void; sections: GuidelineSectionRecord[] }) {
  const input = (key: keyof NewGuidelineRecommendation, label: string, wide = false) => <label className={wide ? "md:col-span-2" : ""}><span className="mb-1.5 block text-xs font-extrabold text-slate-700">{label}</span><input type={key === "source_page" ? "number" : "text"} value={String(form[key] ?? "")} onChange={(event) => setForm({ ...form, [key]: key === "source_page" ? (event.target.value ? Number(event.target.value) : null) : event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold" /></label>;
  const area = (key: keyof NewGuidelineRecommendation, label: string, wide = true) => <label className={wide ? "md:col-span-2" : ""}><span className="mb-1.5 block text-xs font-extrabold text-slate-700">{label}</span><textarea value={String(form[key] ?? "")} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="min-h-20 w-full rounded-lg border border-slate-200 p-3 text-sm font-semibold" /></label>;
  return <div className="mt-4 grid gap-3 md:grid-cols-2">{input("title", "Tiêu đề")}{input("recommendation_class", "Phân loại / strength")}{area("recommendation_text_vi", "Nội dung tiếng Việt")}{area("recommendation_text_original", "Nội dung nguyên bản")}{area("rationale_vi", "Lý do / rationale")}{input("evidence_level", "Mức chứng cứ")}{input("evidence_system", "Hệ thống chứng cứ")}{input("population", "Quần thể")}{input("intervention", "Can thiệp")}{input("comparator", "So sánh")}{input("outcome", "Kết cục")}{input("conditions", "Điều kiện")}{input("contraindications", "Chống chỉ định")}{input("source_page", "Trang nguồn")}{input("source_anchor", "Mốc nguồn")}{input("source_quote", "Trích dẫn nguồn", true)}<label className="md:col-span-2"><span className="mb-1.5 block text-xs font-extrabold text-slate-700">Section</span><select value={form.section_id || ""} onChange={(event) => setForm({ ...form, section_id: event.target.value || null })} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="">Chưa gắn section</option>{sections.filter((section) => section.status !== "archived").map((section) => <option key={section.id} value={section.id}>{section.title_vi || section.title}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-extrabold text-slate-700">Xác minh</span><select value={form.verification_status} onChange={(event) => setForm({ ...form, verification_status: event.target.value as NewGuidelineRecommendation["verification_status"] })} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="unverified">Chưa xác minh</option><option value="needs_review">Cần rà soát</option><option value="verified">Đã xác minh</option><option value="rejected">Từ chối</option></select></label>{area("review_note", "Ghi chú rà soát")}</div>;
}

function SourcesPanel({ guidelineId, sources, setSources, setNotice, user }: { guidelineId: string; sources: GuidelineSourceDocumentRecord[]; setSources: (items: GuidelineSourceDocumentRecord[]) => void; setNotice: (notice: Notice) => void; user: User }) {
  const [form, setForm] = useState({ original_filename: "", storage_path: "", mime_type: "application/pdf", source_kind: "supporting" as GuidelineSourceKind, checksum: "", page_count: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState({ original_filename: "", mime_type: "", source_kind: "supporting" as GuidelineSourceKind, checksum: "", page_count: "", extraction_status: "not_started" as GuidelineSourceDocumentRecord["extraction_status"] });
  const [saving, setSaving] = useState(false);
  async function add() {
    if (!form.original_filename.trim() || !form.storage_path.trim()) { setNotice({ type: "error", text: "Tên file và đường dẫn lưu trữ là bắt buộc khi thêm source document." }); return; }
    setSaving(true);
    try { const created = await createGuidelineSourceDocument(user.id, { guideline_id: guidelineId, original_filename: form.original_filename.trim(), storage_path: form.storage_path.trim(), mime_type: form.mime_type.trim() || "application/octet-stream", source_kind: form.source_kind, checksum: form.checksum.trim(), page_count: form.page_count ? Number(form.page_count) : null, extraction_status: "not_started" }); setSources([...sources, created]); setForm({ ...form, original_filename: "", storage_path: "", checksum: "", page_count: "" }); setNotice({ type: "success", text: "Đã thêm source document." }); }
    catch (error) { setNotice({ type: "error", text: errorText(error) }); }
    finally { setSaving(false); }
  }
  async function remove(source: GuidelineSourceDocumentRecord) { if (!window.confirm(`Xóa source “${source.original_filename}”?`)) return; try { await deleteGuidelineSourceDocument(source.id); setSources(sources.filter((item) => item.id !== source.id)); setNotice({ type: "success", text: "Đã xóa source document." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); } }
  async function saveEdit(source: GuidelineSourceDocumentRecord) { try { const updated = await updateGuidelineSourceDocument(source.id, { original_filename: editingForm.original_filename.trim(), mime_type: editingForm.mime_type.trim(), source_kind: editingForm.source_kind, checksum: editingForm.checksum.trim(), page_count: editingForm.page_count ? Number(editingForm.page_count) : null, extraction_status: editingForm.extraction_status }); setSources(sources.map((item) => item.id === updated.id ? updated : item)); setEditingId(null); setNotice({ type: "success", text: "Đã cập nhật source document." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); } }
  return <div className="mt-4 space-y-4"><div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4"><h2 className="text-base font-extrabold text-sky-900">Thêm nguồn hỗ trợ</h2><p className="mt-1 text-xs font-semibold text-slate-500">Source document là tùy chọn và không quyết định việc tạo Guideline.</p><div className="mt-3 grid gap-3 md:grid-cols-2"><input value={form.original_filename} onChange={(event) => setForm({ ...form, original_filename: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold" placeholder="Tên file" /><input value={form.storage_path} onChange={(event) => setForm({ ...form, storage_path: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold" placeholder="Đường dẫn lưu trữ" /><select value={form.source_kind} onChange={(event) => setForm({ ...form, source_kind: event.target.value as GuidelineSourceKind })} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">{sourceKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select><input value={form.mime_type} onChange={(event) => setForm({ ...form, mime_type: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold" placeholder="MIME type" /><input value={form.checksum} onChange={(event) => setForm({ ...form, checksum: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold" placeholder="Checksum (tùy chọn)" /><input value={form.page_count} onChange={(event) => setForm({ ...form, page_count: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold" placeholder="Số trang" /></div><button type="button" disabled={saving} onClick={() => void add()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"><Plus size={16} />{saving ? "Đang thêm..." : "Thêm nguồn"}</button></div><div className="rounded-2xl border border-slate-200 bg-white/80 p-4"><h2 className="text-base font-extrabold text-slate-800">Nguồn đã gắn</h2>{sources.length === 0 ? <Empty text="Chưa có source document. Đây là trạng thái hợp lệ." /> : <div className="mt-3 space-y-2">{sources.map((source) => <div key={source.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-lg bg-sky-50 p-2 text-sky-700"><FileText size={16} /></span><div><p className="text-sm font-extrabold text-slate-800">{source.original_filename}</p><p className="text-xs font-semibold text-slate-500">{source.source_kind} · {source.extraction_status} · {source.storage_path}</p></div></div><div className="flex gap-1"><button type="button" onClick={() => { setEditingId(source.id); setEditingForm({ original_filename: source.original_filename, mime_type: source.mime_type, source_kind: source.source_kind, checksum: source.checksum, page_count: source.page_count == null ? "" : String(source.page_count), extraction_status: source.extraction_status }); }} className="rounded-lg px-2 py-1 text-xs font-extrabold text-violet-700 hover:bg-violet-50">Sửa</button><button type="button" onClick={() => void remove(source)} className="inline-flex items-center gap-1 rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={15} />Xóa</button></div></div>{editingId === source.id && <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 md:grid-cols-2"><input value={editingForm.original_filename} onChange={(event) => setEditingForm({ ...editingForm, original_filename: event.target.value })} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold" placeholder="Tên file" /><input value={editingForm.mime_type} onChange={(event) => setEditingForm({ ...editingForm, mime_type: event.target.value })} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold" placeholder="MIME type" /><select value={editingForm.source_kind} onChange={(event) => setEditingForm({ ...editingForm, source_kind: event.target.value as GuidelineSourceKind })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold">{sourceKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select><select value={editingForm.extraction_status} onChange={(event) => setEditingForm({ ...editingForm, extraction_status: event.target.value as GuidelineSourceDocumentRecord["extraction_status"] })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold"><option value="not_started">Chưa bắt đầu</option><option value="queued">Đang chờ</option><option value="processing">Đang xử lý</option><option value="completed">Hoàn tất</option><option value="failed">Thất bại</option></select><input value={editingForm.checksum} onChange={(event) => setEditingForm({ ...editingForm, checksum: event.target.value })} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold" placeholder="Checksum" /><input value={editingForm.page_count} onChange={(event) => setEditingForm({ ...editingForm, page_count: event.target.value })} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold" placeholder="Số trang" /><button type="button" onClick={() => void saveEdit(source)} className="w-fit rounded-lg bg-violet-600 px-3 py-2 text-xs font-extrabold text-white">Lưu thay đổi</button></div>}</div>)}</div>}</div></div>;
}

function EditorHeader({ title, onBack }: { title: string; onBack: () => void }) { return <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-extrabold text-violet-700 hover:text-violet-900"><ArrowLeft size={15} />Danh sách Guideline</button><p className="mt-4 text-xs font-extrabold uppercase tracking-[.16em] text-violet-600">Guideline Structured Editor</p><h1 className="mt-1 text-2xl font-extrabold text-rose-950">{title}</h1></div></div>; }
function Notice({ notice }: { notice: Notice }) { if (!notice) return null; return <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-bold ${notice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : notice.type === "success" ? "border-teal-200 bg-teal-50 text-teal-800" : "border-sky-200 bg-sky-50 text-sky-800"}`} role="alert"><div className="flex items-start gap-2">{notice.type === "success" ? <Check size={17} /> : <ChevronDown size={17} />}{notice.text}</div>{notice.details && notice.details.length > 1 && <ul className="mt-2 list-disc pl-6 text-xs font-semibold">{notice.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}</div>; }
function Loading() { return <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-semibold text-slate-500">Đang tải Guideline Core...</div>; }
function Empty({ text }: { text: string }) { return <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500">{text}</div>; }
