import { Archive, Edit3, FileInput, Plus, Save, Search, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { DataRoute } from "../utils/dataRoutes";
import AdminCalculatorImportPage from "./AdminCalculatorImportPage";
import type { DatabaseCalculator, DatabaseCalculatorStatus, CalculatorGuidelineReferenceRow, CalculatorGuidelineRelationType } from "../modules/calculators/databaseTypes";
import { calculatorGuidelineRelationTypes } from "../modules/calculators/databaseTypes";
import { calculateCalculator, calculatorRegistry, runCalculatorTestCases } from "../modules/calculators/engine";
import { calculatorMethodRegistry } from "../modules/calculators/methodRegistry";
import "../modules/calculators/platformRegistry";
import type { CalculatorImplementation } from "../modules/calculators/platformTypes";
import type { CalculatorDefinition, CalculatorInputField } from "../modules/calculators/types";
import {
  archiveCalculatorRecord,
  createCalculatorDraft,
  createCalculatorGuidelineReference,
  deleteCalculatorPermanently,
  deleteCalculatorGuidelineReference,
  getCalculatorRecord,
  listAdminCalculators,
  listCalculatorGuidelineReferences,
  listGuidelineReferenceTargets,
  publishCalculatorRecord,
  restoreCalculatorToDraft,
  updateCalculatorDraft,
  updateCalculatorGuidelineReference,
  databaseCalculatorToDefinition,
  getCurrentCalculatorActorId,
  type CalculatorDraftInput,
} from "../services/calculatorDatabaseService";
import type { GuidelineDocumentTarget, GuidelineRecommendationTarget, GuidelineSectionTarget } from "../modules/calculators/databaseTypes";
import { listCalculatorRecommendationRelations, recommendationLocationPreview, resolveRecommendationLocations } from "../services/knowledgeRelationService";
import SharedSelect from "./SharedSelect";
import CalculatorEvidencePanel from "./CalculatorEvidencePanel";
import RecommendationLink, { type RecommendationLinkLocation } from "./RecommendationLink";
import { isLegacyCalculatorMode, registryCalculatorType, registryImplementationFor, registryMethodOptions, withLegacyCalculatorMode } from "../services/calculatorConfigurationMode";
import { isEvidencePublishable } from "../modules/calculators/evidenceRegistry";

type AdminRoute = Extract<DataRoute, { tab: "admin" }>;
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
  topicKey: string;
  defaultMethodKey: string;
  enabledMethodKeys: string[];
  comparisonEnabled: boolean;
  version: string;
  status: DatabaseCalculatorStatus;
  legacyMode: boolean;
  sourceVerified: boolean;
  inputFields: string;
  scoringRules: string;
  resultDefinitions: string;
  references: string;
  testCases: string;
};

type Notice = { type: "error" | "success"; text: string } | null;

function emptyForm(): FormState {
  return { slug: "", shortName: "", nameVi: "", nameEn: "", description: "", purpose: "", type: "equation", specialty: "", category: "", handlerKey: "", topicKey: "", defaultMethodKey: "", enabledMethodKeys: [], comparisonEnabled: false, version: "1.0.0", status: "draft", legacyMode: false, sourceVerified: false, inputFields: "[]", scoringRules: "[]", resultDefinitions: "[]", references: "[]", testCases: "[]" };
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
    topicKey: record.calculator_topic_key || "",
    defaultMethodKey: record.default_method_key || record.handler_key || "",
    enabledMethodKeys: Array.isArray(record.enabled_method_keys) ? record.enabled_method_keys : [],
    comparisonEnabled: record.comparison_enabled ?? false,
    version: record.version,
    status: record.status,
    legacyMode: !record.calculator_topic_key && (isLegacyCalculatorMode(record.formula_variables) || Boolean(record.handler_key) || record.input_fields.length > 0 || record.scoring_rules.length > 0),
    sourceVerified: record.source_verified,
    inputFields: JSON.stringify(record.input_fields || [], null, 2),
    scoringRules: JSON.stringify(record.scoring_rules || [], null, 2),
    resultDefinitions: JSON.stringify(record.result_definitions || [], null, 2),
    references: JSON.stringify(record.evidence_references || [], null, 2),
    testCases: JSON.stringify((Array.isArray(record.formula_variables) ? record.formula_variables.find((item) => item && typeof item === "object" && (item as { key?: unknown }).key === "clinical_test_cases") as { cases?: unknown } | undefined : undefined)?.cases || [], null, 2),
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
  const registryImplementation = registryImplementationFor(form.topicKey, form.defaultMethodKey);
  const legacyTestCases = form.legacyMode ? parseJson(form.testCases, "Ca kiểm thử lâm sàng") : [];
  const formulaVariables = withLegacyCalculatorMode(legacyTestCases.length ? [{ key: "clinical_test_cases", cases: legacyTestCases }] : [], form.legacyMode);
  return {
    slug: form.slug,
    short_name: form.shortName,
    name: { vi: form.nameVi, en: form.nameEn },
    description: { vi: form.description, en: form.description },
    purpose: { vi: form.purpose, en: form.purpose },
    calculator_type: registryImplementation ? registryCalculatorType(registryImplementation) : form.type,
    specialty_id: form.specialty || null,
    category_id: form.category || null,
    handler_key: form.topicKey ? null : form.legacyMode ? form.handlerKey || null : null,
    calculator_topic_key: form.topicKey || null,
    default_method_key: form.topicKey ? form.defaultMethodKey || null : null,
    enabled_method_keys: form.topicKey ? form.enabledMethodKeys : [],
    comparison_enabled: form.comparisonEnabled,
    calculation_mode: "automatic",
    input_fields: form.legacyMode ? parseJson(form.inputFields, "Input fields") : [],
    scoring_rules: form.legacyMode ? parseJson(form.scoringRules, "Scoring rules") : [],
    formula_display: { vi: "", en: "" },
    formula_variables: formulaVariables,
    result_definitions: form.legacyMode ? parseJson(form.resultDefinitions, "Result definitions") : [],
    when_to_use: { vi: [], en: [] },
    when_not_to_use: { vi: [], en: [] },
    limitations: { vi: [], en: [] },
    warnings: { vi: [], en: [] },
    evidence_references: form.legacyMode ? parseJson(form.references, "Nguồn tham khảo") : [],
    version: form.version,
    calculation_version: registryImplementation?.implementationVersion || form.version,
    content_revision: 1,
  };
}

function displayName(record: DatabaseCalculator): string {
  return record.name?.vi || record.name?.en || record.short_name || record.slug;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể hoàn tất thao tác.";
}

export default function AdminCalculatorPage({ route, user, onNavigate }: { route: AdminRoute; user?: User | null; onNavigate: (path: string) => void }) {
  if (route.kind === "admin-calculator-import") return <AdminCalculatorImportPage user={user} onNavigate={onNavigate} />;
  if (route.kind === "admin-calculator-new" || route.kind === "admin-calculator-edit") return <CalculatorEditor calculatorId={route.calculatorId} user={user} onNavigate={onNavigate} />;
  return <CalculatorList user={user} onNavigate={onNavigate} />;
}

function CalculatorList({ user, onNavigate }: { user?: User | null; onNavigate: (path: string) => void }) {
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
    {loading ? <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">Đang tải calculator...</p> : items.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">Chưa có calculator phù hợp.</p> : <div className="mt-4 grid gap-3 lg:grid-cols-2">{items.map((item) => <article key={item.id} className="rounded-2xl border border-teal-100 bg-white/85 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-extrabold text-slate-800">{displayName(item)}</h2><p className="mt-1 text-xs font-semibold text-slate-500">{item.slug} · v{item.version}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${item.status === "published" ? "bg-teal-50 text-teal-700" : item.status === "archived" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800"}`}>{statusLabels[item.status]}</span></div><p className="mt-3 line-clamp-2 text-sm text-slate-600">{item.description?.vi || item.description?.en || "Chưa có mô tả."}</p><p className="mt-2 text-xs font-semibold text-slate-400">Handler: {item.handler_key || "Chưa chọn"} · {item.source_verified ? "Đã xác minh nguồn" : "Chưa xác minh nguồn"}</p><div className="mt-4 flex flex-wrap justify-end gap-1"><button type="button" title="Sửa" onClick={() => onNavigate(`/admin/may-tinh-y-khoa/${item.id}/edit`)} className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"><Edit3 size={16} /></button>{item.status === "draft" && <><button type="button" title="Xuất bản" onClick={() => void action(async () => publishCalculatorRecord(item.id, user?.id || await getCurrentCalculatorActorId()), "Đã xuất bản calculator.")} className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"><Upload size={16} /></button><button type="button" title="Xóa bản nháp" onClick={() => { if (window.prompt(`Nhập DELETE để xóa vĩnh viễn “${displayName(item)}”.`) === "DELETE") void action(() => deleteCalculatorPermanently(item.id), "Đã xóa calculator."); }} className="ml-2 rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button></>}{item.status === "published" && <button type="button" title="Lưu trữ" onClick={() => window.confirm(`Lưu trữ “${displayName(item)}”? Nội dung sẽ không còn công khai.`) && void action(async () => archiveCalculatorRecord(item.id, user?.id || await getCurrentCalculatorActorId()), "Đã lưu trữ calculator.")} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Archive size={16} /></button>}{item.status === "archived" && <><button type="button" title="Khôi phục về bản nháp" onClick={() => void action(() => restoreCalculatorToDraft(item.id), "Đã khôi phục calculator về bản nháp.")} className="rounded-lg px-2 py-1 text-xs font-extrabold text-slate-600 hover:bg-slate-100">Khôi phục</button><button type="button" title="Xuất bản lại" onClick={() => void action(async () => publishCalculatorRecord(item.id, user?.id || await getCurrentCalculatorActorId()), "Đã xuất bản lại calculator.")} className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"><Upload size={16} /></button><button type="button" title="Xóa vĩnh viễn" onClick={() => { if (window.prompt(`Nhập DELETE để xóa vĩnh viễn “${displayName(item)}”.`) === "DELETE") void action(() => deleteCalculatorPermanently(item.id), "Đã xóa calculator vĩnh viễn."); }} className="ml-2 rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button></>}</div></article>)}</div>}
  </section>;
}

function CalculatorEditor({ calculatorId, user, onNavigate }: { calculatorId?: string; user?: User | null; onNavigate: (path: string) => void }) {
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
  const recommendations = useMemo(() => targets.recommendations.filter((item) => item.guideline_id === relationDraft.guideline_id && (!relationDraft.section_id || item.section_id === relationDraft.section_id)), [relationDraft.guideline_id, relationDraft.section_id, targets.recommendations]);
  const registryTopics = useMemo(() => calculatorMethodRegistry.listTopics().filter((topic) => topic.topicKey !== "body_size"), []);
  const registryMethods = useMemo(() => {
    if (!form.topicKey) return [];
    return registryMethodOptions(form.topicKey);
  }, [form.topicKey]);
  const selectedRegistryMethod = useMemo(() => {
    if (!form.topicKey || !form.defaultMethodKey) return undefined;
    return registryImplementationFor(form.topicKey, form.defaultMethodKey);
  }, [form.defaultMethodKey, form.topicKey]);
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  function selectTopic(topicKey: string) {
    const topic = calculatorMethodRegistry.getTopic(topicKey);
    const enabledMethodKeys = topic ? topic.enabledMethodKeys.filter((methodKey) => Boolean(registryImplementationFor(topicKey, methodKey))) : [];
    const fallback = topic?.defaultMethodKey && enabledMethodKeys.includes(topic.defaultMethodKey) ? topic.defaultMethodKey : enabledMethodKeys[0] || "";
    const implementation = registryImplementationFor(topicKey, fallback);
    setForm((current) => ({ ...current, topicKey, defaultMethodKey: fallback, handlerKey: "", enabledMethodKeys, comparisonEnabled: Boolean(topic?.comparisonEnabled), legacyMode: false, sourceVerified: false, type: implementation ? registryCalculatorType(implementation) : "equation", version: implementation?.implementationVersion || current.version, inputFields: "[]", scoringRules: "[]", resultDefinitions: "[]", references: "[]", testCases: "[]" }));
  }

  function selectMethod(methodKey: string) {
    const implementation = registryMethods.find((item) => item.methodKey === methodKey);
    setForm((current) => ({ ...current, defaultMethodKey: methodKey, handlerKey: "", enabledMethodKeys: methodKey ? Array.from(new Set([...current.enabledMethodKeys, methodKey])) : [], legacyMode: false, sourceVerified: false, type: implementation ? registryCalculatorType(implementation) : current.type, version: implementation?.implementationVersion || current.version }));
  }

  function toggleMethod(methodKey: string, enabled: boolean) {
    setForm((current) => {
      const enabledMethodKeys = enabled
        ? Array.from(new Set([...current.enabledMethodKeys, methodKey]))
        : current.enabledMethodKeys.filter((key) => key !== methodKey);
      const defaultMethodKey = enabledMethodKeys.includes(current.defaultMethodKey) ? current.defaultMethodKey : (enabledMethodKeys[0] || "");
      return { ...current, enabledMethodKeys, defaultMethodKey, handlerKey: "" };
    });
  }

  async function save(continueEditing: boolean) {
    setSaving(true); setNotice(null);
    try {
      const input = draftInputFromForm(form);
      let saved: DatabaseCalculator;
      if (record) saved = await updateCalculatorDraft(record.id, { ...input, source_verified: form.legacyMode ? form.sourceVerified : false });
      else saved = await createCalculatorDraft(user?.id || await getCurrentCalculatorActorId(), input);
      setRecord(saved); setForm(formFromRecord(saved)); setNotice({ type: "success", text: "Đã lưu calculator vào database." });
      if (!continueEditing) onNavigate("/admin/may-tinh-y-khoa");
      else if (!calculatorId) onNavigate(`/admin/may-tinh-y-khoa/${saved.id}/edit`);
    } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
    finally { setSaving(false); }
  }

  async function publish() {
    if (!record) return;
    try { const saved = await publishCalculatorRecord(record.id, user?.id || await getCurrentCalculatorActorId()); setRecord(saved); setForm(formFromRecord(saved)); setNotice({ type: "success", text: "Đã xuất bản calculator." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
  }
  async function archive() {
    if (!record || !window.confirm("Lưu trữ calculator này? Nội dung sẽ không còn công khai.")) return;
    try { const saved = await archiveCalculatorRecord(record.id, user?.id || await getCurrentCalculatorActorId()); setRecord(saved); setForm(formFromRecord(saved)); setNotice({ type: "success", text: "Đã lưu trữ calculator." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
  }
  async function restore() {
    if (!record) return;
    try { const saved = await restoreCalculatorToDraft(record.id); setRecord(saved); setForm(formFromRecord(saved)); setNotice({ type: "success", text: "Đã khôi phục calculator về bản nháp." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
  }
  async function removePermanently() {
    if (!record || window.prompt(`Nhập DELETE để xóa vĩnh viễn “${displayName(record)}”.`) !== "DELETE") return;
    try { await deleteCalculatorPermanently(record.id); onNavigate("/admin/may-tinh-y-khoa"); } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
  }

  async function addReference() {
    if (!record) { setNotice({ type: "error", text: "Hãy lưu calculator trước khi thêm liên kết." }); return; }
    try {
      const created = await createCalculatorGuidelineReference({ calculator_id: record.id, guideline_id: relationDraft.guideline_id, section_id: relationDraft.section_id || null, recommendation_id: relationDraft.recommendation_id || null, relation_type: relationDraft.relation_type, context: { vi: relationDraft.context, en: relationDraft.context }, required: false, display_order: references.length, owner_id: user?.id || await getCurrentCalculatorActorId() });
      setReferences((current) => [...current, created]); setRelationDraft({ guideline_id: "", section_id: "", recommendation_id: "", relation_type: "related", context: "" }); setNotice({ type: "success", text: "Đã thêm liên kết Guideline." });
    } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
  }

  async function saveReference(reference: CalculatorGuidelineReferenceRow) {
    try { const updated = await updateCalculatorGuidelineReference(reference.id, { relation_type: reference.relation_type, context: reference.context }); setReferences((current) => current.map((item) => item.id === updated.id ? updated : item)); setNotice({ type: "success", text: "Đã cập nhật liên kết." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); }
  }

  function runTests() {
    if (!record) { setNotice({ type: "error", text: "Hãy lưu calculator trước khi chạy ca kiểm thử." }); return; }
    const results = runCalculatorTestCases(databaseCalculatorToDefinition(record, references));
    const failed = results.filter((item) => !item.pass);
    setNotice(failed.length ? { type: "error", text: `${failed.length}/${results.length} ca kiểm thử không đạt.` } : { type: "success", text: `Đã chạy ${results.length} ca kiểm thử, tất cả đều đạt.` });
  }

  if (loading) return <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">Đang tải calculator...</p>;
  return <section aria-labelledby="calculator-editor-title"><div className="flex flex-wrap items-start justify-between gap-4"><div><button type="button" onClick={() => onNavigate("/admin/may-tinh-y-khoa")} className="text-sm font-bold text-teal-700">← Danh sách máy tính</button><p className="mt-5 text-xs font-extrabold uppercase tracking-[.16em] text-teal-700">{record ? "Chỉnh sửa calculator database" : "Thêm calculator database"}</p><h1 id="calculator-editor-title" className="mt-1 text-2xl font-black text-rose-950">{form.nameVi || form.nameEn || "Máy tính y khoa mới"}</h1></div><div className="flex flex-wrap gap-2">{record && <button type="button" onClick={runTests} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700">Chạy ca kiểm thử</button>}<button type="button" disabled={saving} onClick={() => void save(false)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"><Save size={16} />Lưu nháp</button><button type="button" disabled={saving} onClick={() => void save(true)} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white"><Save size={16} />Lưu và tiếp tục</button>{record?.status === "draft" && <><button type="button" onClick={() => void publish()} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700"><Upload size={16} />Xuất bản</button><button type="button" onClick={() => void removePermanently()} className="ml-2 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-bold text-rose-700"><Trash2 size={16} />Xóa</button></>}{record?.status === "published" && <button type="button" onClick={() => void archive()} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-bold text-rose-700"><Archive size={16} />Lưu trữ</button>}{record?.status === "archived" && <><button type="button" onClick={() => void restore()} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">Khôi phục về nháp</button><button type="button" onClick={() => void publish()} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white"><Upload size={16} />Xuất bản lại</button><button type="button" onClick={() => void removePermanently()} className="ml-2 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-bold text-rose-700"><Trash2 size={16} />Xóa vĩnh viễn</button></>}</div></div>{notice && <NoticeView notice={notice} />}
    <div className="mt-6 grid gap-4">
      <Panel title="Thông tin chung">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tên tiếng Việt" value={form.nameVi} onChange={(value) => setField("nameVi", value)} />
          <Field label="Tên tiếng Anh" value={form.nameEn} onChange={(value) => setField("nameEn", value)} />
          <Field label="Slug" value={form.slug} onChange={(value) => setField("slug", value)} />
          <Field label="Tên ngắn" value={form.shortName} onChange={(value) => setField("shortName", value)} />
          <Field label="Chuyên khoa" value={form.specialty} onChange={(value) => setField("specialty", value)} />
          <Field label="Nhóm" value={form.category} onChange={(value) => setField("category", value)} />
        </div>
        <TextArea label="Mô tả" value={form.description} onChange={(value) => setField("description", value)} />
        <TextArea label="Mục đích" value={form.purpose} onChange={(value) => setField("purpose", value)} />
      </Panel>
      <Panel title="Cấu hình tính toán">
        <label className="block text-sm font-bold text-slate-700">Calculator topic
          <SharedSelect value={form.topicKey} onValueChange={selectTopic} ariaLabel="Calculator topic" options={[{ value: "", label: "Không dùng Calculator Registry" }, ...registryTopics.map((topic) => ({ value: topic.topicKey, label: topic.title, description: topic.comparisonEnabled ? "Có so sánh phương thức" : undefined }))]} searchable className="mt-1.5" />
        </label>
        {form.topicKey ? <>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">Method mặc định
              <SharedSelect value={form.defaultMethodKey} onValueChange={selectMethod} ariaLabel="Method calculator" options={[{ value: "", label: "Chọn method" }, ...registryMethods.map((method) => ({ value: method.methodKey, label: `${method.formulaName} · v${method.implementationVersion}`, description: `${method.calculationModelType} · ${method.source.verified ? "Đã xác minh" : "Thiếu nguồn"} · ${method.status}` }))]} searchable className="mt-1.5" />
            </label>
            <div className="block text-sm font-bold text-slate-700">Trạng thái hồ sơ<div className="mt-1.5 flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">{statusLabels[form.status]}</div></div>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.comparisonEnabled} onChange={(event) => setField("comparisonEnabled", event.target.checked)} className="h-4 w-4 accent-teal-600" />Bật so sánh method</label>
          <p className="rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-2 text-xs font-semibold text-teal-800">Cấu hình Registry được khóa theo code. Form chỉ lưu metadata, các method được bật và method mặc định.</p>
          <RegistryImplementationSummary implementation={selectedRegistryMethod} />
          <CalculatorEvidencePanel implementation={selectedRegistryMethod} mode="admin" />
          <fieldset className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"><legend className="px-1 text-sm font-bold text-slate-700">Method được bật</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{registryMethods.map((method) => <label key={method.methodKey} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={form.enabledMethodKeys.includes(method.methodKey)} onChange={(event) => toggleMethod(method.methodKey, event.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-600" /><span>{method.formulaName}<span className="block text-slate-500">v{method.implementationVersion} · {method.source.verified ? "Đã xác minh" : "Thiếu nguồn"} · {method.status}</span></span></label>)}</div></fieldset>
        </> : <>
          <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-bold text-amber-900"><input type="checkbox" checked={form.legacyMode} onChange={(event) => setField("legacyMode", event.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-600" /><span>Đây là calculator legacy<span className="mt-1 block text-xs font-semibold text-amber-800">Chế độ legacy chỉ dùng cho máy tính cũ chưa chuyển sang Calculator Registry.</span></span></label>
          {form.legacyMode ? <><label className="block text-sm font-bold text-slate-700">Handler legacy<SharedSelect value={form.handlerKey} onValueChange={(value) => setField("handlerKey", value)} ariaLabel="Handler calculator legacy" options={[{ value: "", label: "Chưa chọn" }, ...Object.keys(calculatorRegistry).map((key) => ({ value: key, label: key }))]} searchable className="mt-1.5" /></label><TextArea label="Input fields (JSON)" value={form.inputFields} onChange={(value) => setField("inputFields", value)} /><TextArea label="Scoring rules (JSON)" value={form.scoringRules} onChange={(value) => setField("scoringRules", value)} /><TextArea label="Result definitions (JSON)" value={form.resultDefinitions} onChange={(value) => setField("resultDefinitions", value)} /><TextArea label="Ca kiểm thử lâm sàng (JSON)" value={form.testCases} onChange={(value) => setField("testCases", value)} /><TextArea label="Nguồn tham khảo (JSON)" value={form.references} onChange={(value) => setField("references", value)} /><label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.sourceVerified} onChange={(event) => setField("sourceVerified", event.target.checked)} className="h-4 w-4 accent-teal-600" />Đã xác minh nguồn legacy</label></> : <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">Chọn một Calculator Topic hoặc xác nhận đây là calculator legacy trước khi lưu.</p>}
        </>}
      </Panel>
      {record && <CalculatorPreview definition={databaseCalculatorToDefinition(record, references)} />}
      {record && <RecommendationReverseLookup calculatorId={record.id} onNavigate={onNavigate} />}
      {record && <RelationPanel references={references} targets={targets} draft={relationDraft} setDraft={setRelationDraft} sections={sections} recommendations={recommendations} onAdd={() => void addReference()} onDelete={async (id) => { try { await deleteCalculatorGuidelineReference(id); setReferences((current) => current.filter((item) => item.id !== id)); setNotice({ type: "success", text: "Đã xóa liên kết." }); } catch (error) { setNotice({ type: "error", text: errorText(error) }); } }} onChange={(id, patch) => setReferences((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))} onSave={saveReference} />}
    </div>
  </section>;
}

function RegistryImplementationSummary({ implementation }: { implementation?: CalculatorImplementation }) {
  if (!implementation) return <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Chọn method đã đăng ký để xem cấu hình và điều kiện xuất bản.</p>;
  const evidence = calculatorMethodRegistry.evidenceFor(implementation);
  const blockers = isEvidencePublishable(evidence);
  const fixtures = evidence.fixtures.filter((item) => item.fixtureKind === "clinical_reference");
  const sample = fixtures[0];
  let output = "Chưa có fixture output";
  if (sample) {
    try {
      const result = calculatorMethodRegistry.calculate(implementation.topicKey, implementation.methodKey, sample.rawInputs, implementation.variantKey, implementation.implementationVersion);
      output = `${result.primary.metric}${result.primary.unit ? ` · ${result.primary.unit}` : ""}`;
    } catch { output = "Fixture chưa chạy được"; }
  }
  const rows = [
    ["Topic", implementation.topicKey], ["Method", implementation.methodKey], ["Variant", implementation.variantKey || "Mặc định"], ["Implementation", `v${implementation.implementationVersion}`], ["Model", implementation.calculationModelType], ["Input Registry", `${implementation.inputSchema.length} trường`], ["Output", output], ["Lifecycle", implementation.status], ["Xác minh nguồn", implementation.source.verified ? "Đã xác minh" : "Chưa xác minh"], ["Fixture lâm sàng", `${fixtures.length} fixture`], ["Xác minh gần nhất", evidence.verification.lastVerifiedAt || "Chưa có"], ["Xuất bản", blockers.length === 0 && implementation.status === "published" ? "Đủ điều kiện" : blockers.length ? blockers.join(" ") : `Method đang ${implementation.status}`],
  ];
  return <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3" aria-label="Tóm tắt implementation Registry"><h3 className="text-sm font-extrabold text-slate-800">Implementation Registry (chỉ đọc)</h3><div className="mt-2 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="flex gap-2"><span className="shrink-0 font-bold text-slate-500">{label}:</span><span className="font-semibold text-slate-700">{value}</span></div>)}</div></section>;
}

function RelationPanel({ references, targets, draft, setDraft, sections, recommendations, onAdd, onDelete, onChange, onSave }: { references: CalculatorGuidelineReferenceRow[]; targets: { documents: GuidelineDocumentTarget[] }; draft: { guideline_id: string; section_id: string; recommendation_id: string; relation_type: CalculatorGuidelineRelationType; context: string }; setDraft: (value: typeof draft) => void; sections: GuidelineSectionTarget[]; recommendations: GuidelineRecommendationTarget[]; onAdd: () => void; onDelete: (id: string) => Promise<void>; onChange: (id: string, patch: Partial<CalculatorGuidelineReferenceRow>) => void; onSave: (reference: CalculatorGuidelineReferenceRow) => Promise<void> }) {
  const guidelineOptions = [{ value: "", label: "Chọn guideline" }, ...targets.documents.map((item) => ({ value: item.id, label: item.title || item.id, description: item.status || item.visibility || "" }))];
  const sectionOptions = [{ value: "", label: "Không chọn section" }, ...sections.map((item) => ({ value: item.id, label: item.title_vi || item.title || item.slug || item.id }))];
  const recommendationOptions = [{ value: "", label: "Không chọn recommendation" }, ...recommendations.map((item) => ({ value: item.id, label: item.title || item.recommendation_text_vi || item.recommendation_text_original || item.id, description: item.status }))];
  const relationOptions = calculatorGuidelineRelationTypes.map((value) => ({ value, label: value }));
  return <Panel title="Calculator ↔ Guideline"><div className="grid gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3 md:grid-cols-2"><label className="block text-sm font-bold text-slate-700 md:col-span-2">Guideline<SharedSelect value={draft.guideline_id} onValueChange={(guidelineId) => setDraft({ ...draft, guideline_id: guidelineId, section_id: "", recommendation_id: "" })} ariaLabel="Guideline liên kết" options={guidelineOptions} searchable className="mt-1.5" /></label><label className="block text-sm font-bold text-slate-700">Section<SharedSelect value={draft.section_id} onValueChange={(sectionId) => setDraft({ ...draft, section_id: sectionId, recommendation_id: "" })} ariaLabel="Section liên kết" options={sectionOptions} searchable className="mt-1.5" /></label><label className="block text-sm font-bold text-slate-700">Recommendation<SharedSelect value={draft.recommendation_id} onValueChange={(recommendationId) => setDraft({ ...draft, recommendation_id: recommendationId })} ariaLabel="Khuyến cáo liên kết" options={recommendationOptions} searchable className="mt-1.5" /></label><label className="block text-sm font-bold text-slate-700">Loại quan hệ<SharedSelect value={draft.relation_type} onValueChange={(relationType) => setDraft({ ...draft, relation_type: relationType as CalculatorGuidelineRelationType })} ariaLabel="Loại quan hệ" options={relationOptions} className="mt-1.5" /></label><Field label="Bối cảnh" value={draft.context} onChange={(value) => setDraft({ ...draft, context: value })} /><button type="button" onClick={onAdd} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 text-sm font-bold text-white"><Plus size={16} />Thêm liên kết</button></div><div className="mt-4 grid gap-2">{references.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm font-semibold text-slate-500">Chưa có liên kết.</p> : references.map((reference) => <div key={reference.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_180px_auto_auto]"><div><p className="text-sm font-extrabold text-slate-700">Guideline: {reference.guideline_id}</p><p className="text-xs font-semibold text-slate-500">Section: {reference.section_id || "—"} · Recommendation: {reference.recommendation_id || "—"}</p><input value={typeof reference.context?.vi === "string" ? reference.context.vi : ""} onChange={(event) => onChange(reference.id, { context: { vi: event.target.value, en: event.target.value } })} className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs" placeholder="Bối cảnh" /></div><SharedSelect value={reference.relation_type} onValueChange={(relationType) => onChange(reference.id, { relation_type: relationType as CalculatorGuidelineRelationType })} ariaLabel="Loại quan hệ đã lưu" options={relationOptions} triggerClassName="min-h-9 py-1 text-xs" /><button type="button" onClick={() => void onSave(reference)} className="h-9 rounded-lg border border-teal-200 px-2 text-xs font-bold text-teal-700"><Save size={14} /></button><button type="button" onClick={() => void onDelete(reference.id)} className="h-9 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600"><Trash2 size={14} /></button></div>)}</div></Panel>;
}

function RecommendationReverseLookup({ calculatorId, onNavigate }: { calculatorId: string; onNavigate: (path: string) => void }) {
  const [items, setItems] = useState<RecommendationLinkLocation[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; void listCalculatorRecommendationRelations(calculatorId).then(async (relations) => { const locations = await resolveRecommendationLocations(relations.map((item) => item.recommendation_id)); if (active) setItems(locations.map(recommendationLocationPreview)); }).catch((reason) => { if (active) setError(errorText(reason)); }); return () => { active = false; }; }, [calculatorId]);
  return <Panel title="Khuyến cáo liên quan"><p className="text-xs font-semibold text-slate-500">Được suy ra từ Recommendation ↔ Calculator; không tạo liên kết trực tiếp với Guideline.</p>{error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p> : items.length ? <div className="grid gap-2">{items.map((item) => <RecommendationLink key={item.recommendationId} location={item} onNavigate={onNavigate} admin />)}</div> : <p className="text-sm font-semibold text-slate-400">Chưa có liên kết.</p>}</Panel>;
}

function CalculatorPreview({ definition }: { definition: CalculatorDefinition }) {
  const [inputs, setInputs] = useState<Record<string, unknown>>(() => Object.fromEntries(definition.inputFields.filter((field) => field.defaultValue !== undefined && field.defaultValue !== null).map((field) => [field.id, field.defaultValue])));
  const [result, setResult] = useState<ReturnType<typeof calculateCalculator> | null>(null);

  return <Panel title="Xem trước runtime"><p className="text-xs font-semibold text-slate-500">Dùng cùng engine với trang công khai. Lưu thay đổi trước để tải lại cấu hình mới.</p><div className="grid gap-3 md:grid-cols-2">{definition.inputFields.map((field) => <PreviewInput key={field.id} field={field} value={inputs[field.id]} onChange={(value) => setInputs((current) => ({ ...current, [field.id]: value }))} />)}</div><button type="button" onClick={() => setResult(calculateCalculator(definition, inputs))} className="w-fit rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white">Tính thử</button>{result && <div className={`rounded-xl border px-3 py-2 text-sm font-semibold ${result.rawValue === null ? "border-rose-200 bg-rose-50 text-rose-700" : "border-teal-200 bg-teal-50 text-teal-800"}`}>{result.rawValue === null ? result.warnings.join(" ") : <><strong>{result.displayValue} {result.unit || ""}</strong>{result.category ? ` · ${result.category}` : ""}</>}</div>}</Panel>;
}

function PreviewInput({ field, value, onChange }: { field: CalculatorInputField; value: unknown; onChange: (value: unknown) => void }) {
  if (field.type === "number") return <label className="block text-sm font-bold text-slate-700">{field.label}<input type="number" value={typeof value === "string" || typeof value === "number" ? value : ""} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" placeholder={field.unit || "Nhập giá trị"} /></label>;
  const options = field.options || [];
  return <label className="block text-sm font-bold text-slate-700">{field.label}<SharedSelect value={String(value ?? "")} onValueChange={(nextValue) => onChange(field.type === "boolean" ? nextValue === "true" : nextValue)} ariaLabel={field.label} options={[{ value: "", label: "Chọn giá trị" }, ...options.map((option) => ({ value: option.value, label: option.label }))]} className="mt-1.5" /></label>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-teal-100 bg-white/80 p-4 shadow-sm"><h2 className="text-sm font-extrabold text-slate-700">{title}</h2><div className="mt-3 grid gap-3">{children}</div></section>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-bold text-slate-700">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-400" /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-bold text-slate-700">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-teal-400" /></label>; }
function NoticeView({ notice }: { notice: Notice }) { return notice ? <div role="alert" className={`mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${notice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-teal-200 bg-teal-50 text-teal-800"}`}>{notice.text}<button type="button" aria-label="Đóng thông báo" className="ml-auto" title="Đóng" onClick={() => undefined}><X size={15} /></button></div> : null; }
