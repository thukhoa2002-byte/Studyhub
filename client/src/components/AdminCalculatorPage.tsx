import { Archive, Edit3, FileInput, Plus, Save, Search, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { DataRoute } from "../utils/dataRoutes";
import AdminCalculatorImportPage from "./AdminCalculatorImportPage";
import type { DatabaseCalculator, DatabaseCalculatorStatus, CalculatorGuidelineReferenceRow, CalculatorGuidelineRelationType } from "../modules/calculators/databaseTypes";
import { calculatorGuidelineRelationTypes } from "../modules/calculators/databaseTypes";
import { calculatorRegistry } from "../modules/calculators/engine";
import { supabase } from "../services/supabase";
import {
  archiveCalculatorRecord,
  createCalculatorDraft,
  createCalculatorGuidelineReference,
  deleteCalculatorDraft,
  deleteCalculatorGuidelineReference,
  getCalculatorRecord,
  listAdminCalculators,
  listCalculatorGuidelineReferences,
  listGuidelineReferenceTargets,
  publishCalculatorRecord,
  updateCalculatorDraft,
  updateCalculatorGuidelineReference,
  type CalculatorDraftInput,
} from "../services/calculatorDatabaseService";
import type { GuidelineDocumentTarget, GuidelineRecommendationTarget, GuidelineSectionTarget } from "../modules/calculators/databaseTypes";

type AdminRoute = Extract<DataRoute, { tab: "admin" }>;
const statuses: DatabaseCalculatorStatus[] = ["draft", "in_review", "reviewed", "published", "archived"];
const statusLabels: Record<DatabaseCalculatorStatus, string> = { draft: "Bản nháp", in_review: "Đang rà soát", reviewed: "Đã rà soát", published: "Đã xuất bản", archived: "Đã lưu trữ" };

type FormState = {
  slug: string;
  shortName: string;
  nameVi: string;
  nameEn: string;
  description: string;
  purpose: string;
  type: DatabaseCalculator["calculator_type"];
  specialty: string;
  category: string;
  handlerKey: string;
  version: string;
  status: DatabaseCalculatorStatus;
  sourceVerified: boolean;
  inputFields: string;
  scoringRules: string;
  resultDefinitions: string;
  references: string;
};

type Notice = { type: "error" | "success"; text: string } | null;

function emptyForm(): FormState {
  return { slug: "", shortName: "", nameVi: "", nameEn: "", description: "", purpose: "", type: "equation", specialty: "", category: "", handlerKey: "", version: "1.0.0", status: "draft", sourceVerified: false, inputFields: "[]", scoringRules: "[]", resultDefinitions: "[]", references: "[]" };
}

function formFromRecord(record: DatabaseCalculator): FormState {
  return {
    slug: record.slug,
    shortName: record.short_name,
    nameVi: record.name?.vi || "",
    nameEn: record.name?.en || "",
    description: record.description?.vi || record.description?.en || "",
    purpose: record.purpose?.vi || record.purpose?.en || "",
    type: record.calculator_type,
    specialty: record.specialty_id || "",
    category: record.category_id || "",
    handlerKey: record.handler_key || "",
    version: record.version,
    status: record.status,
    sourceVerified: record.source_verified,
    inputFields: JSON.stringify(record.input_fields || [], null, 2),
    scoringRules: JSON.stringify(record.scoring_rules || [], null, 2),
    resultDefinitions: JSON.stringify(record.result_definitions || [], null, 2),
    references: JSON.stringify(record.evidence_references || [], null, 2),
  };
}

function parseJson(value: string, label: string): unknown[] {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw new Error(`${label} phải là JSON hợp lệ và phải là một mảng.`); }
}

function draftInputFromForm(form: FormState): CalculatorDraftInput {
  return {
    slug: form.slug,
    short_name: form.shortName,
    name: { vi: form.nameVi, en: form.nameEn },
    description: { vi: form.description, en: form.description },
    purpose: { vi: form.purpose, en: form.purpose },
    calculator_type: form.type,
    specialty_id: form.specialty || null,
    category_id: form.category || null,
    handler_key: form.handlerKey || null,
    calculation_mode: "automatic",
    input_fields: parseJson(form.inputFields, "Input fields"),
    scoring_rules: parseJson(form.scoringRules, "Scoring rules"),
    formula_display: { vi: "", en: "" },
    formula_variables: [],
    result_definitions: parseJson(form.resultDefinitions, "Result definitions"),
    when_to_use: { vi: [], en: [] },
    when_not_to_use: { vi: [], en: [] },
    limitations: { vi: [], en: [] },
    warnings: { vi: [], en: [] },
    evidence_references: parseJson(form.references, "Nguồn tham khảo"),
    version: form.version,
    calculation_version: form.version,
    content_revision: 1,
  };
}

function displayName(record: DatabaseCalculator): string {
  return record.name?.vi || record.name?.en || record.short_name || record.slug;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể hoàn tất thao tác.";
}

export default function AdminCalculatorPage({ route, onNavigate }: { route: AdminRoute; onNavigate: (path: string) => void }) {
  if (route.kind === "admin-calculator-import") return <AdminCalculatorImportPage onNavigate={onNavigate} />;
  if (route.kind === "admin-calculator-new" || route.kind === "admin-calculator-edit") return <CalculatorEditor calculatorId={route.calculatorId} onNavigate={onNavigate} />;
  return <CalculatorList onNavigate={onNavigate} />;
}

function CalculatorList({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<DatabaseCalculator[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listAdminCalculators(query)); setNotice(null); } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
    finally { setLoading(false); }
  }, [query]);
  useEffect(() => { void load(); }, [load]);

  async function action(task: () => Promise<unknown>, success: string) {
    try { await task(); setNotice({ type: "success", text: success }); await load(); } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
  }

  return <section aria-labelledby="admin-calculator-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-teal-700">Quản trị Máy tính y khoa</p><h1 id="admin-calculator-title" className="mt-1 text-2xl font-black text-rose-950">Danh sách máy tính</h1><p className="mt-1 text-sm font-semibold text-slate-500">Dữ liệu được đọc trực tiếp từ bảng calculators.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onNavigate("/admin/may-tinh-y-khoa/import")} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700"><FileInput size={16} />Nhập dữ liệu</button><button type="button" onClick={() => onNavigate("/admin/may-tinh-y-khoa/new")} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white"><Plus size={16} />Thêm máy tính</button></div>
    </div>
    {notice && <NoticeView notice={notice} />}
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white/80 p-4"><label className="relative block"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-teal-400" placeholder="Tìm theo tên hoặc slug..." /></label></div>
    {loading ? <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">Đang tải calculator...</p> : items.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">Chưa có calculator phù hợp.</p> : <div className="mt-4 grid gap-3 lg:grid-cols-2">{items.map((item) => <article key={item.id} className="rounded-2xl border border-teal-100 bg-white/85 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-extrabold text-slate-800">{displayName(item)}</h2><p className="mt-1 text-xs font-semibold text-slate-500">{item.slug} · v{item.version}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${item.status === "published" ? "bg-teal-50 text-teal-700" : item.status === "archived" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800"}`}>{statusLabels[item.status]}</span></div><p className="mt-3 line-clamp-2 text-sm text-slate-600">{item.description?.vi || item.description?.en || "Chưa có mô tả."}</p><p className="mt-2 text-xs font-semibold text-slate-400">Handler: {item.handler_key || "Chưa chọn"} · {item.source_verified ? "Đã xác minh nguồn" : "Chưa xác minh nguồn"}</p><div className="mt-4 flex flex-wrap justify-end gap-1"><button type="button" title="Sửa" onClick={() => onNavigate(`/admin/may-tinh-y-khoa/${item.id}/edit`)} className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"><Edit3 size={16} /></button>{item.status !== "published" && <button type="button" title="Xuất bản" onClick={() => void action(async () => { const user = await currentUser(); if (!user) throw new Error("Phiên đăng nhập không hợp lệ."); await publishCalculatorRecord(item.id, user.id); }, "Đã xuất bản calculator.")} className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"><Upload size={16} /></button>}{item.status !== "archived" && <button type="button" title="Lưu trữ" onClick={() => void action(async () => { const user = await currentUser(); if (!user) throw new Error("Phiên đăng nhập không hợp lệ."); await archiveCalculatorRecord(item.id, user.id); }, "Đã lưu trữ calculator.")} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Archive size={16} /></button>}{item.status === "draft" && !item.published_at && <button type="button" title="Xóa bản nháp" onClick={() => window.confirm(`Xóa ${displayName(item)}?`) && void action(() => deleteCalculatorDraft(item.id), "Đã xóa bản nháp.")} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button>}</div></article>)}</div>}
  </section>;
}

async function currentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

function CalculatorEditor({ calculatorId, onNavigate }: { calculatorId?: string; onNavigate: (path: string) => void }) {
  const [record, setRecord] = useState<DatabaseCalculator | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [references, setReferences] = useState<CalculatorGuidelineReferenceRow[]>([]);
  const [targets, setTargets] = useState<{ documents: GuidelineDocumentTarget[]; sections: GuidelineSectionTarget[]; recommendations: GuidelineRecommendationTarget[] }>({ documents: [], sections: [], recommendations: [] });
  const [relationDraft, setRelationDraft] = useState({ guideline_id: "", section_id: "", recommendation_id: "", relation_type: "related" as CalculatorGuidelineRelationType, context: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedRecord, loadedTargets] = await Promise.all([calculatorId ? getCalculatorRecord(calculatorId) : Promise.resolve(null), listGuidelineReferenceTargets()]);
      setRecord(loadedRecord);
      setForm(loadedRecord ? formFromRecord(loadedRecord) : emptyForm());
      setTargets(loadedTargets);
      setReferences(loadedRecord ? await listCalculatorGuidelineReferences(loadedRecord.id) : []);
      setNotice(null);
    } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
    finally { setLoading(false); }
  }, [calculatorId]);
  useEffect(() => { void load(); }, [load]);

  const sections = useMemo(() => targets.sections.filter((item) => item.guideline_id === relationDraft.guideline_id), [relationDraft.guideline_id, targets.sections]);
  const recommendations = useMemo(() => targets.recommendations.filter((item) => item.document_id === relationDraft.guideline_id && (!relationDraft.section_id || item.section_id === relationDraft.section_id)), [relationDraft.guideline_id, relationDraft.section_id, targets.recommendations]);
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function save(continueEditing: boolean) {
    setSaving(true); setNotice(null);
    try {
      const user = await currentUser();
      if (!user) throw new Error("Phiên đăng nhập không hợp lệ.");
      const input = draftInputFromForm(form);
      let saved: DatabaseCalculator;
      if (record) saved = await updateCalculatorDraft(record.id, { ...input, status: form.status, source_verified: form.sourceVerified });
      else saved = await createCalculatorDraft(user.id, input);
      setRecord(saved); setForm(formFromRecord(saved)); setNotice({ type: "success", text: "Đã lưu calculator vào database." });
      if (!continueEditing) onNavigate("/admin/may-tinh-y-khoa");
      else if (!calculatorId) onNavigate(`/admin/may-tinh-y-khoa/${saved.id}/edit`);
    } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
    finally { setSaving(false); }
  }

  async function publish() {
    if (!record) return;
    try { const user = await currentUser(); if (!user) throw new Error("Phiên đăng nhập không hợp lệ."); const saved = await publishCalculatorRecord(record.id, user.id); setRecord(saved); setForm(formFromRecord(saved)); setNotice({ type: "success", text: "Đã xuất bản calculator." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
  }

  async function addReference() {
    if (!record) { setNotice({ type: "error", text: "Hãy lưu calculator trước khi thêm liên kết." }); return; }
    try {
      const user = await currentUser(); if (!user) throw new Error("Phiên đăng nhập không hợp lệ.");
      const created = await createCalculatorGuidelineReference({ calculator_id: record.id, guideline_id: relationDraft.guideline_id, section_id: relationDraft.section_id || null, recommendation_id: relationDraft.recommendation_id || null, relation_type: relationDraft.relation_type, context: { vi: relationDraft.context, en: relationDraft.context }, required: false, display_order: references.length, owner_id: user.id });
      setReferences((current) => [...current, created]); setRelationDraft({ guideline_id: "", section_id: "", recommendation_id: "", relation_type: "related", context: "" }); setNotice({ type: "success", text: "Đã thêm liên kết Guideline." });
    } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
  }

  async function saveReference(reference: CalculatorGuidelineReferenceRow) {
    try { const updated = await updateCalculatorGuidelineReference(reference.id, { relation_type: reference.relation_type, context: reference.context }); setReferences((current) => current.map((item) => item.id === updated.id ? updated : item)); setNotice({ type: "success", text: "Đã cập nhật liên kết." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
  }

  if (loading) return <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">Đang tải calculator...</p>;
  return <section aria-labelledby="calculator-editor-title"><div className="flex flex-wrap items-start justify-between gap-4"><div><button type="button" onClick={() => onNavigate("/admin/may-tinh-y-khoa")} className="text-sm font-bold text-teal-700">← Danh sách máy tính</button><p className="mt-5 text-xs font-extrabold uppercase tracking-[.16em] text-teal-700">{record ? "Chỉnh sửa calculator database" : "Thêm calculator database"}</p><h1 id="calculator-editor-title" className="mt-1 text-2xl font-black text-rose-950">{form.nameVi || form.nameEn || "Máy tính y khoa mới"}</h1></div><div className="flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => void save(false)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"><Save size={16} />Lưu nháp</button><button type="button" disabled={saving} onClick={() => void save(true)} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white"><Save size={16} />Lưu và tiếp tục</button>{record && record.status !== "published" && <button type="button" onClick={() => void publish()} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700"><Upload size={16} />Xuất bản</button>}</div></div>{notice && <NoticeView notice={notice} />}
    <div className="mt-6 grid gap-4"><Panel title="Thông tin chung"><div className="grid gap-4 md:grid-cols-2"><Field label="Tên tiếng Việt" value={form.nameVi} onChange={(value) => setField("nameVi", value)} /><Field label="Tên tiếng Anh" value={form.nameEn} onChange={(value) => setField("nameEn", value)} /><Field label="Slug" value={form.slug} onChange={(value) => setField("slug", value)} /><Field label="Tên ngắn" value={form.shortName} onChange={(value) => setField("shortName", value)} /><Field label="Chuyên khoa" value={form.specialty} onChange={(value) => setField("specialty", value)} /><Field label="Nhóm" value={form.category} onChange={(value) => setField("category", value)} /><Field label="Version" value={form.version} onChange={(value) => setField("version", value)} /><label className="block text-sm font-bold text-slate-700">Loại<select value={form.type} onChange={(event) => setField("type", event.target.value as FormState["type"])} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="equation">Equation</option><option value="score">Score</option><option value="criteria">Criteria</option><option value="algorithm">Algorithm</option></select></label></div><TextArea label="Mô tả" value={form.description} onChange={(value) => setField("description", value)} /><TextArea label="Mục đích" value={form.purpose} onChange={(value) => setField("purpose", value)} /></Panel><Panel title="Cấu hình tính toán"><div className="grid gap-4 md:grid-cols-2"><label className="block text-sm font-bold text-slate-700">Handler<select value={form.handlerKey} onChange={(event) => setField("handlerKey", event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Chưa chọn</option>{Object.keys(calculatorRegistry).map((key) => <option key={key} value={key}>{key}</option>)}</select></label><label className="block text-sm font-bold text-slate-700">Trạng thái<select value={form.status} onChange={(event) => setField("status", event.target.value as DatabaseCalculatorStatus)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label></div><TextArea label="Input fields (JSON)" value={form.inputFields} onChange={(value) => setField("inputFields", value)} /><TextArea label="Scoring rules (JSON)" value={form.scoringRules} onChange={(value) => setField("scoringRules", value)} /><TextArea label="Result definitions (JSON)" value={form.resultDefinitions} onChange={(value) => setField("resultDefinitions", value)} /><TextArea label="Nguồn tham khảo (JSON)" value={form.references} onChange={(value) => setField("references", value)} /><label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.sourceVerified} onChange={(event) => setField("sourceVerified", event.target.checked)} className="h-4 w-4 accent-teal-600" />Đã xác minh nguồn</label><p className="text-xs font-semibold text-slate-500">Xuất bản sẽ dùng validation domain: handler, input, version và source verification phải hợp lệ.</p></Panel>{record && <RelationPanel references={references} targets={targets} draft={relationDraft} setDraft={setRelationDraft} sections={sections} recommendations={recommendations} onAdd={() => void addReference()} onDelete={async (id) => { try { await deleteCalculatorGuidelineReference(id); setReferences((current) => current.filter((item) => item.id !== id)); setNotice({ type: "success", text: "Đã xóa liên kết." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); } }} onChange={(id, patch) => setReferences((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))} onSave={saveReference} />}</div>
  </section>;
}

function RelationPanel({ references, targets, draft, setDraft, sections, recommendations, onAdd, onDelete, onChange, onSave }: { references: CalculatorGuidelineReferenceRow[]; targets: { documents: GuidelineDocumentTarget[] }; draft: { guideline_id: string; section_id: string; recommendation_id: string; relation_type: CalculatorGuidelineRelationType; context: string }; setDraft: (value: typeof draft) => void; sections: GuidelineSectionTarget[]; recommendations: GuidelineRecommendationTarget[]; onAdd: () => void; onDelete: (id: string) => Promise<void>; onChange: (id: string, patch: Partial<CalculatorGuidelineReferenceRow>) => void; onSave: (reference: CalculatorGuidelineReferenceRow) => Promise<void> }) {
  return <Panel title="Calculator ↔ Guideline"><div className="grid gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3 md:grid-cols-2"><label className="block text-sm font-bold text-slate-700 md:col-span-2">Guideline<select value={draft.guideline_id} onChange={(event) => setDraft({ ...draft, guideline_id: event.target.value, section_id: "", recommendation_id: "" })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Chọn guideline</option>{targets.documents.map((item) => <option key={item.id} value={item.id}>{item.title || item.id} · {item.visibility}</option>)}</select></label><label className="block text-sm font-bold text-slate-700">Section<select value={draft.section_id} onChange={(event) => setDraft({ ...draft, section_id: event.target.value, recommendation_id: "" })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Không chọn section</option>{sections.map((item) => <option key={item.id} value={item.id}>{item.title_vi || item.title || item.slug || item.id}</option>)}</select></label><label className="block text-sm font-bold text-slate-700">Recommendation<select value={draft.recommendation_id} onChange={(event) => setDraft({ ...draft, recommendation_id: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Không chọn recommendation</option>{recommendations.map((item) => <option key={item.id} value={item.id}>{item.drug_name || item.recommendation_summary || item.id} · {item.status}</option>)}</select></label><label className="block text-sm font-bold text-slate-700">Loại quan hệ<select value={draft.relation_type} onChange={(event) => setDraft({ ...draft, relation_type: event.target.value as CalculatorGuidelineRelationType })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{calculatorGuidelineRelationTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><Field label="Bối cảnh" value={draft.context} onChange={(value) => setDraft({ ...draft, context: value })} /><button type="button" onClick={onAdd} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 text-sm font-bold text-white"><Plus size={16} />Thêm liên kết</button></div><div className="mt-4 grid gap-2">{references.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm font-semibold text-slate-500">Chưa có liên kết.</p> : references.map((reference) => <div key={reference.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_180px_auto_auto]"><div><p className="text-sm font-extrabold text-slate-700">Guideline: {reference.guideline_id}</p><p className="text-xs font-semibold text-slate-500">Section: {reference.section_id || "—"} · Recommendation: {reference.recommendation_id || "—"}</p><input value={typeof reference.context?.vi === "string" ? reference.context.vi : ""} onChange={(event) => onChange(reference.id, { context: { vi: event.target.value, en: event.target.value } })} className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs" placeholder="Bối cảnh" /></div><select value={reference.relation_type} onChange={(event) => onChange(reference.id, { relation_type: event.target.value as CalculatorGuidelineRelationType })} className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-semibold">{calculatorGuidelineRelationTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select><button type="button" onClick={() => void onSave(reference)} className="h-9 rounded-lg border border-teal-200 px-2 text-xs font-bold text-teal-700"><Save size={14} /></button><button type="button" onClick={() => void onDelete(reference.id)} className="h-9 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600"><Trash2 size={14} /></button></div>)}</div></Panel>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-teal-100 bg-white/80 p-4 shadow-sm"><h2 className="text-sm font-extrabold text-slate-700">{title}</h2><div className="mt-3 grid gap-3">{children}</div></section>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-bold text-slate-700">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-400" /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-bold text-slate-700">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-teal-400" /></label>; }
function NoticeView({ notice }: { notice: Notice }) { return notice ? <div role="alert" className={`mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${notice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-teal-200 bg-teal-50 text-teal-800"}`}>{notice.text}<button type="button" aria-label="Đóng thông báo" className="ml-auto" title="Đóng" onClick={() => undefined}><X size={15} /></button></div> : null; }
