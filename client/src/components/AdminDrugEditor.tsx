import { AlertTriangle, ChevronDown, GripVertical, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Guideline } from "../types/guideline";
import type { DataRoute } from "../utils/dataRoutes";
import type { Drug, DrugDosingRegimen, DrugGuidelineLink, DrugIndication, DrugSourceReference, DrugStatus } from "../types/drug";
import { deleteThuoc, createThuoc, getAllThuoc, getThuocById, updateThuoc } from "../services/thuocService";
import { findDrugDuplicate, validateDrugImport } from "../utils/drugImport";
import { loadGuidelines } from "../services/guidelineService";

type AdminRoute = Extract<DataRoute, { tab: "admin" }>;
type EditorValues = Omit<Drug, "id" | "createdAt" | "updatedAt" | "publishedAt" | "isPlaceholder"> & { id?: string; publishedAt?: string | null; isPlaceholder?: boolean };

interface Props { route: AdminRoute; onNavigate: (path: string) => void }

const statusLabels: Record<DrugStatus, string> = { draft: "Bản nháp", in_review: "Đang rà soát", reviewed: "Đã rà soát", published: "Đã xuất bản", archived: "Đã lưu trữ" };
const relationTypes = ["recommended", "preferred", "alternative", "contraindicated", "avoid", "consider", "dose-adjustment", "interaction", "monitoring"];

function makeId(prefix: string): string { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function lines(value: string): string[] { return value.split("\n").map((item) => item.trim()).filter(Boolean); }
function joinLines(value: string[]): string { return value.join("\n"); }

function blankValues(): EditorValues {
  return { id: "", slug: "", genericName: "", titleVi: "", aliases: [], brandNames: [], dosageForms: [], routes: [], drugClass: "", specialties: [], indications: "", indicationsDetailed: [], contraindications: "", dosing: "", dosingRegimens: [], renalAdjustment: "", hepaticAdjustment: "", elderlyAdjustment: "", pediatricAdjustment: "", specialPopulationAdjustments: "", pregnancy: "", breastfeeding: "", precautions: "", adverseEffects: "", interactions: "", monitoring: "", mechanism: "", pharmacodynamics: "", references: [], sourceReferences: [], guidelineReferences: [], guidelineLinks: [], flashcardReferences: [], quizReferences: [], calculatorReferences: [], flowchartReferences: [], imageReferences: [], notes: "", summary: "", status: "draft", publishedAt: null, isPlaceholder: false, sourceVerified: false, provenance: [] };
}

function fromDrug(drug: Drug): EditorValues {
  const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...values } = drug;
  return { ...blankValues(), ...values, id };
}

function initialValues(selected: Drug | undefined, routeKey: string): EditorValues {
  if (typeof window !== "undefined") {
    const prefill = window.localStorage.getItem("studyhub:thuoc:prefill");
    if (prefill) {
      window.localStorage.removeItem("studyhub:thuoc:prefill");
      try { return { ...blankValues(), ...(JSON.parse(prefill) as Partial<EditorValues>), status: "draft" }; } catch { /* ignore malformed import prefill */ }
    }
    const autosave = window.localStorage.getItem(`studyhub:thuoc:autosave:${routeKey}`);
    if (autosave) {
      try { return { ...blankValues(), ...(JSON.parse(autosave) as Partial<EditorValues>) }; } catch { /* ignore stale autosave */ }
    }
  }
  return selected ? fromDrug(selected) : blankValues();
}

export default function AdminDrugEditor({ route, onNavigate }: Props) {
  const isNew = route.kind === "admin-drug-new";
  const selected = route.drugId ? getThuocById(route.drugId) : undefined;
  const routeKey = isNew ? "new" : route.drugId || "unknown";
  const [values, setValues] = useState<EditorValues>(() => initialValues(selected, routeKey));
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);

  useEffect(() => {
    setValues(initialValues(selected, routeKey));
    setMessage("");
    setFieldErrors({});
    setDirty(false);
  }, [routeKey, selected]);

  useEffect(() => {
    let active = true;
    void loadGuidelines().then((items) => { if (active) setGuidelines(items); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !dirty) return undefined;
    const timer = window.setTimeout(() => window.localStorage.setItem(`studyhub:thuoc:autosave:${routeKey}`, JSON.stringify(values)), 700);
    return () => window.clearTimeout(timer);
  }, [dirty, routeKey, values]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  function setField<K extends keyof EditorValues>(key: K, value: EditorValues[K]) { setValues((current) => ({ ...current, [key]: value })); setDirty(true); }
  function navigate(path: string) {
    if (dirty && typeof window !== "undefined" && !window.confirm("Bạn có thay đổi chưa lưu. Rời trang sẽ giữ bản autosave, nhưng có thể mất thay đổi chưa kịp autosave. Tiếp tục?")) return;
    onNavigate(path);
  }

  function save(targetStatus: DrugStatus, continueEditing: boolean) {
    const validation = validateDrugImport({ ...values, status: targetStatus });
    const duplicate = findDrugDuplicate(values, getAllThuoc().filter((drug) => drug.id !== selected?.id));
    const errors = validation.errors.reduce<Record<string, string>>((result, error) => { const key = error.split(":")[0]; result[key] = error; return result; }, {});
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) { setMessage("Hãy sửa các trường bắt buộc trước khi lưu."); return; }
    if (duplicate === "exact_duplicate") { setMessage("Đã có hồ sơ trùng ID hoặc slug. Hãy mở hồ sơ đó để chỉnh sửa hoặc đổi ID/slug."); return; }
    const payload = preparePayload(values, targetStatus);
    const saved = selected && !isNew ? updateThuoc(selected.id, payload) : createThuoc(payload);
    if (!saved) { setMessage("Không thể lưu hồ sơ thuốc."); return; }
    if (typeof window !== "undefined") window.localStorage.removeItem(`studyhub:thuoc:autosave:${routeKey}`);
    setDirty(false);
    setFieldErrors({});
    setMessage(targetStatus === "published" ? "Đã lưu trạng thái đã xuất bản theo lựa chọn của bạn." : "Đã lưu hồ sơ thuốc.");
    if (isNew) onNavigate(`/admin/thuoc/${saved.id}/edit`);
    else if (!continueEditing) onNavigate("/admin/thuoc");
  }

  function remove() {
    if (!selected) return;
    if (typeof window !== "undefined" && !window.confirm(`Xóa hồ sơ ${selected.titleVi}?`)) return;
    deleteThuoc(selected.id);
    onNavigate("/admin/thuoc");
  }

  if (!isNew && route.drugId && !selected) return <EmptyEditor onBack={() => onNavigate("/admin/thuoc")} />;
  const validation = validateDrugImport(values);
  const duplicateWarning = findDrugDuplicate(values, getAllThuoc().filter((drug) => drug.id !== selected?.id)) === "possible_duplicate";

  return <section aria-labelledby="drug-editor-title"><div className="flex flex-wrap items-start justify-between gap-4"><div><button type="button" onClick={() => navigate("/admin/thuoc")} className="text-sm font-bold text-teal-700 hover:text-teal-900">← Danh mục thuốc</button><p className="mt-5 text-xs font-extrabold uppercase tracking-[.16em] text-teal-700">{isNew ? "Nhập thủ công" : "Chỉnh sửa thuốc"}</p><h1 id="drug-editor-title" className="mt-1 text-2xl font-extrabold text-rose-950">{isNew ? "Tạo thuốc mới" : values.titleVi || values.genericName || "Thuốc"}</h1><p className="mt-1 text-sm font-semibold text-slate-500">Dữ liệu dùng chung với Import Engine. Chỉ lưu bản nháp khi bạn chưa chọn trạng thái khác.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => save("draft", false)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"><Save size={16} />Lưu nháp</button><button type="button" onClick={() => save(values.status, true)} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white"><Save size={16} />Lưu và tiếp tục chỉnh sửa</button>{selected && <button type="button" onClick={remove} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700"><Trash2 size={16} />Xóa</button>}</div></div>{message && <p className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-800" role="status">{message}</p>}{duplicateWarning && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800"><AlertTriangle className="mr-2 inline" size={16} />Có thể trùng tên hoạt chất với hồ sơ hiện có. Hãy kiểm tra trước khi lưu.</p>}<div className="mt-6 grid gap-4"><Section title="Thông tin chung"><div className="grid gap-4 md:grid-cols-2"><TextField label="Tên hoạt chất" value={values.genericName} error={fieldErrors.genericName} required onChange={(value) => setField("genericName", value)} /><TextField label="Tên hiển thị" value={values.titleVi} onChange={(value) => setField("titleVi", value)} /><TextField label="ID nội bộ" value={values.id || ""} error={fieldErrors.id} onChange={(value) => setField("id", value)} /><TextField label="Slug" value={values.slug} error={fieldErrors.slug} onChange={(value) => setField("slug", value)} /><TextField label="Nhóm thuốc" value={values.drugClass} onChange={(value) => setField("drugClass", value)} /><TextAreaField label="Tên thương mại" hint="Mỗi dòng một tên" value={joinLines(values.brandNames)} onChange={(value) => setField("brandNames", lines(value))} /><TextAreaField label="Dạng bào chế" hint="Mỗi dòng một dạng" value={joinLines(values.dosageForms)} onChange={(value) => setField("dosageForms", lines(value))} /><TextAreaField label="Đường dùng" hint="Mỗi dòng một đường dùng" value={joinLines(values.routes)} onChange={(value) => setField("routes", lines(value))} /><TextAreaField label="Chuyên khoa" hint="Mỗi dòng một chuyên khoa" value={joinLines(values.specialties)} onChange={(value) => setField("specialties", lines(value))} /><TextAreaField label="Tên khác" hint="Mỗi dòng một tên" value={joinLines(values.aliases)} onChange={(value) => setField("aliases", lines(value))} /><TextAreaField label="Tóm tắt" value={values.summary} onChange={(value) => setField("summary", value)} /></div></Section><Section title="Cơ chế tác dụng"><TextAreaField label="Cơ chế" value={values.mechanism} onChange={(value) => setField("mechanism", value)} /><TextAreaField label="Dược lực học" value={values.pharmacodynamics} onChange={(value) => setField("pharmacodynamics", value)} /></Section><Section title="Chỉ định"><StructuredList title="Chỉ định chi tiết" items={values.indicationsDetailed} onAdd={() => setField("indicationsDetailed", [...values.indicationsDetailed, { id: makeId("indication"), name: "", population: "", clinicalContext: "", notes: "" }])} onMove={(from, to) => setField("indicationsDetailed", moveItem(values.indicationsDetailed, from, to))} onRemove={(index) => setField("indicationsDetailed", values.indicationsDetailed.filter((_, itemIndex) => itemIndex !== index))} renderItem={(item, index) => <div className="grid gap-3 md:grid-cols-2"><TextField label="Tên chỉ định" value={item.name} onChange={(value) => updateIndication(index, { name: value })} /><TextField label="Quần thể" value={item.population} onChange={(value) => updateIndication(index, { population: value })} /><TextAreaField label="Bối cảnh lâm sàng" value={item.clinicalContext} onChange={(value) => updateIndication(index, { clinicalContext: value })} /><TextAreaField label="Ghi chú" value={item.notes} onChange={(value) => updateIndication(index, { notes: value })} /></div>} /><TextAreaField label="Chỉ định dạng văn bản" hint="Dùng cho nội dung tóm tắt cũ hoặc ghi nhanh" value={values.indications} onChange={(value) => setField("indications", value)} /></Section><Section title="Liều dùng"><StructuredList title="Chế độ liều" items={values.dosingRegimens} onAdd={() => setField("dosingRegimens", [...values.dosingRegimens, { id: makeId("dosing"), indication: "", population: "", route: "", startingDose: "", loadingDose: "", maintenanceDose: "", targetDose: "", interval: "", duration: "", notes: "" }])} onMove={(from, to) => setField("dosingRegimens", moveItem(values.dosingRegimens, from, to))} onRemove={(index) => setField("dosingRegimens", values.dosingRegimens.filter((_, itemIndex) => itemIndex !== index))} renderItem={(item, index) => <div className="grid gap-3 md:grid-cols-2"><TextField label="Chỉ định" value={item.indication} onChange={(value) => updateRegimen(index, { indication: value })} /><TextField label="Quần thể" value={item.population} onChange={(value) => updateRegimen(index, { population: value })} /><TextField label="Đường dùng" value={item.route} onChange={(value) => updateRegimen(index, { route: value })} /><TextField label="Khoảng cách liều" value={item.interval} onChange={(value) => updateRegimen(index, { interval: value })} /><TextField label="Liều khởi đầu" value={item.startingDose} onChange={(value) => updateRegimen(index, { startingDose: value })} /><TextField label="Liều nạp" value={item.loadingDose} onChange={(value) => updateRegimen(index, { loadingDose: value })} /><TextField label="Liều duy trì" value={item.maintenanceDose} onChange={(value) => updateRegimen(index, { maintenanceDose: value })} /><TextField label="Liều đích" value={item.targetDose} onChange={(value) => updateRegimen(index, { targetDose: value })} /><TextField label="Thời gian điều trị" value={item.duration} onChange={(value) => updateRegimen(index, { duration: value })} /><TextAreaField label="Ghi chú" value={item.notes} onChange={(value) => updateRegimen(index, { notes: value })} /></div>} /><TextAreaField label="Liều dùng dạng văn bản" value={values.dosing} onChange={(value) => setField("dosing", value)} /></Section><Section title="Điều chỉnh liều"><div className="grid gap-4 md:grid-cols-2"><TextAreaField label="Suy thận" value={values.renalAdjustment} onChange={(value) => setField("renalAdjustment", value)} /><TextAreaField label="Suy gan" value={values.hepaticAdjustment} onChange={(value) => setField("hepaticAdjustment", value)} /><TextAreaField label="Người cao tuổi" value={values.elderlyAdjustment} onChange={(value) => setField("elderlyAdjustment", value)} /><TextAreaField label="Trẻ em" value={values.pediatricAdjustment} onChange={(value) => setField("pediatricAdjustment", value)} /><TextAreaField label="Tình huống đặc biệt khác" value={values.specialPopulationAdjustments} onChange={(value) => setField("specialPopulationAdjustments", value)} /></div></Section><Section title="An toàn và theo dõi"><div className="grid gap-4 md:grid-cols-2"><TextAreaField label="Chống chỉ định" value={values.contraindications} onChange={(value) => setField("contraindications", value)} /><TextAreaField label="Thận trọng và cảnh báo" value={values.precautions} onChange={(value) => setField("precautions", value)} /><TextAreaField label="Tác dụng phụ" value={values.adverseEffects} onChange={(value) => setField("adverseEffects", value)} /><TextAreaField label="Tương tác thuốc" value={values.interactions} onChange={(value) => setField("interactions", value)} /><TextAreaField label="Theo dõi" value={values.monitoring} onChange={(value) => setField("monitoring", value)} /><TextAreaField label="Thai kỳ" value={values.pregnancy} onChange={(value) => setField("pregnancy", value)} /><TextAreaField label="Cho con bú" value={values.breastfeeding} onChange={(value) => setField("breastfeeding", value)} /></div></Section><Section title="Nguồn tham khảo"><StructuredList title="Nguồn chi tiết" items={values.sourceReferences} onAdd={() => setField("sourceReferences", [...values.sourceReferences, { id: makeId("source"), title: "", organization: "", year: null, url: "", pages: "", table: "", section: "", notes: "" }])} onMove={(from, to) => setField("sourceReferences", moveItem(values.sourceReferences, from, to))} onRemove={(index) => setField("sourceReferences", values.sourceReferences.filter((_, itemIndex) => itemIndex !== index))} renderItem={(item, index) => <div className="grid gap-3 md:grid-cols-2"><TextField label="Tiêu đề tài liệu" value={item.title} onChange={(value) => updateSource(index, { title: value })} /><TextField label="Tổ chức" value={item.organization} onChange={(value) => updateSource(index, { organization: value })} /><TextField label="Năm" type="number" value={item.year?.toString() || ""} onChange={(value) => updateSource(index, { year: Number(value) || null })} /><TextField label="URL" value={item.url} onChange={(value) => updateSource(index, { url: value })} /><TextField label="Trang" value={item.pages} onChange={(value) => updateSource(index, { pages: value })} /><TextField label="Bảng" value={item.table} onChange={(value) => updateSource(index, { table: value })} /><TextField label="Mục / section" value={item.section} onChange={(value) => updateSource(index, { section: value })} /><TextAreaField label="Ghi chú nguồn" value={item.notes} onChange={(value) => updateSource(index, { notes: value })} /></div>} /><TextAreaField label="Nguồn dạng văn bản" hint="Mỗi dòng một nguồn" value={joinLines(values.references)} onChange={(value) => setField("references", lines(value))} /></Section><Section title="Liên kết dữ liệu"><GuidelineLinksEditor values={values.guidelineLinks} guidelines={guidelines} onAdd={() => updateGuidelineLinks([...values.guidelineLinks, { guidelineId: "", sectionId: "", recommendationId: "", relationType: "recommended", context: "" }])} onChange={updateGuidelineLinks} /><div className="grid gap-4 md:grid-cols-2"><TextAreaField label="Guideline IDs cũ" hint="Tự đồng bộ từ liên kết chi tiết nếu có" value={joinLines(values.guidelineReferences)} onChange={(value) => setField("guidelineReferences", lines(value))} /><TextAreaField label="Flashcard IDs" value={joinLines(values.flashcardReferences)} onChange={(value) => setField("flashcardReferences", lines(value))} /><TextAreaField label="Quiz IDs" value={joinLines(values.quizReferences)} onChange={(value) => setField("quizReferences", lines(value))} /><TextAreaField label="Calculator IDs" value={joinLines(values.calculatorReferences)} onChange={(value) => setField("calculatorReferences", lines(value))} /><TextAreaField label="Flowchart IDs" value={joinLines(values.flowchartReferences)} onChange={(value) => setField("flowchartReferences", lines(value))} /></div></Section><Section title="Trạng thái và ghi chú"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Trạng thái<select value={values.status} onChange={(event) => setField("status", event.target.value as DrugStatus)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"><option value="draft">{statusLabels.draft}</option><option value="in_review">{statusLabels.in_review}</option><option value="reviewed">{statusLabels.reviewed}</option><option value="published">{statusLabels.published}</option><option value="archived">{statusLabels.archived}</option></select></label><TextAreaField label="Ghi chú nội bộ" value={values.notes} onChange={(value) => setField("notes", value)} /></div><p className="text-xs font-semibold text-slate-500">sourceVerified luôn giữ ở false. Chọn trạng thái đã xuất bản là thao tác chủ động của quản trị viên, không phải tự động.</p></Section></div>{validation.warnings.length > 0 && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">{validation.warnings.join(" ")}</p>}</section>;

  function updateIndication(index: number, patch: Partial<DrugIndication>) { setField("indicationsDetailed", values.indicationsDetailed.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  function updateRegimen(index: number, patch: Partial<DrugDosingRegimen>) { setField("dosingRegimens", values.dosingRegimens.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  function updateSource(index: number, patch: Partial<DrugSourceReference>) { setField("sourceReferences", values.sourceReferences.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  function updateGuidelineLinks(next: DrugGuidelineLink[]) { setValues((current) => ({ ...current, guidelineLinks: next, guidelineReferences: next.map((link) => link.guidelineId).filter(Boolean) })); setDirty(true); }
}

function preparePayload(values: EditorValues, status: DrugStatus): Partial<Drug> {
  const indications = values.indicationsDetailed.length ? values.indicationsDetailed.map((item) => item.name).filter(Boolean).join("\n") : values.indications;
  const dosing = values.dosingRegimens.length ? values.dosingRegimens.map((item) => [item.indication, item.route, item.maintenanceDose || item.startingDose, item.interval].filter(Boolean).join(" · ")).filter(Boolean).join("\n") : values.dosing;
  const references = values.sourceReferences.length ? values.sourceReferences.map((item) => item.title).filter(Boolean) : values.references;
  return { ...values, status, id: values.id || undefined, indications, dosing, references, guidelineReferences: values.guidelineLinks.length ? values.guidelineLinks.map((link) => link.guidelineId).filter(Boolean) : values.guidelineReferences, sourceVerified: false, isPlaceholder: false, publishedAt: status === "published" ? values.publishedAt || new Date().toISOString() : null, importMetadata: values.importMetadata || { importMethod: "manual", importedAt: new Date().toISOString(), aiGenerated: false } };
}

function moveItem<T>(items: T[], from: number, to: number): T[] { if (to < 0 || to >= items.length) return items; const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return <section className="rounded-2xl border border-slate-200 bg-white/85 p-5"><button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={open}><span className="text-lg font-extrabold text-slate-800">{title}</span><ChevronDown size={19} className={`transition-transform ${open ? "rotate-180" : ""}`} /></button>{open && <div className="mt-4 grid gap-4">{children}</div>}</section>;
}

function TextField({ label, value, onChange, error, required, type = "text" }: { label: string; value: string; onChange: (value: string) => void; error?: string; required?: boolean; type?: "text" | "number" }) {
  return <label className="text-sm font-bold text-slate-700">{label}{required && <span className="ml-1 text-rose-600">*</span>}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={`mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold outline-none focus:border-teal-300 ${error ? "border-rose-300" : "border-slate-200"}`} />{error && <span className="mt-1 block text-xs font-bold text-rose-600">{error}</span>}</label>;
}

function TextAreaField({ label, value, onChange, hint }: { label: string; value: string; onChange: (value: string) => void; hint?: string }) {
  return <label className="text-sm font-bold text-slate-700">{label}{hint && <span className="ml-2 text-xs font-semibold text-slate-400">{hint}</span>}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-1.5 min-h-20 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-5 outline-none focus:border-teal-300" /></label>;
}

function StructuredList<T>({ title, items, onAdd, onMove, onRemove, renderItem }: { title: string; items: T[]; onAdd: () => void; onMove: (from: number, to: number) => void; onRemove: (index: number) => void; renderItem: (item: T, index: number) => ReactNode }) {
  return <div><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-extrabold text-slate-700">{title}</h3><button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-extrabold text-teal-700"><Plus size={14} />Thêm</button></div>{items.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs font-semibold text-slate-400">Chưa có mục. Có thể để trống khi lưu nháp.</p>}<div className="grid gap-3">{items.map((item, index) => <article key={index} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><div className="mb-3 flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-500"><GripVertical size={15} />Mục {index + 1}</span><div className="flex items-center gap-1"><button type="button" title="Đưa lên" disabled={index === 0} onClick={() => onMove(index, index - 1)} className="rounded-md px-2 py-1 text-xs font-bold text-slate-500 disabled:opacity-30">↑</button><button type="button" title="Đưa xuống" disabled={index === items.length - 1} onClick={() => onMove(index, index + 1)} className="rounded-md px-2 py-1 text-xs font-bold text-slate-500 disabled:opacity-30">↓</button><button type="button" title="Xóa mục" onClick={() => onRemove(index)} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button></div></div>{renderItem(item, index)}</article>)}</div></div>;
}

function GuidelineLinksEditor({ values, guidelines, onAdd, onChange }: { values: DrugGuidelineLink[]; guidelines: Guideline[]; onAdd: () => void; onChange: (values: DrugGuidelineLink[]) => void }) {
  function update(index: number, patch: Partial<DrugGuidelineLink>) { onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  return <div><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-extrabold text-slate-700">Guideline / section / recommendation</h3><p className="mt-1 text-xs font-semibold text-slate-400">Liên kết bằng ID, không sao chép nội dung Guideline.</p></div><button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-extrabold text-violet-700"><Plus size={14} />Thêm liên kết</button></div>{values.map((item, index) => { const guideline = guidelines.find((entry) => entry.id === item.guidelineId); const sections = guideline?.sections || []; const recommendations = sections.flatMap((section) => section.recommendations); return <article key={index} className="mb-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3"><div className="grid gap-3 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Guideline<select value={item.guidelineId} onChange={(event) => update(index, { guidelineId: event.target.value, sectionId: "", recommendationId: "" })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="">Chọn Guideline</option>{item.guidelineId && !guidelines.some((entry) => entry.id === item.guidelineId) && <option value={item.guidelineId}>{item.guidelineId}</option>}{guidelines.map((entry) => <option key={entry.id} value={entry.id}>{entry.titleVi || entry.title}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Section<select value={item.sectionId} onChange={(event) => update(index, { sectionId: event.target.value, recommendationId: "" })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="">Chọn section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.titleVi || section.title}</option>)}</select></label><label className="text-sm font-bold text-slate-700 md:col-span-2">Recommendation<select value={item.recommendationId} onChange={(event) => update(index, { recommendationId: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="">Chọn recommendation</option>{item.recommendationId && !recommendations.some((entry) => entry.id === item.recommendationId) && <option value={item.recommendationId}>{item.recommendationId}</option>}{recommendations.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Quan hệ<select value={item.relationType} onChange={(event) => update(index, { relationType: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold">{relationTypes.map((relation) => <option key={relation} value={relation}>{relation}</option>)}</select></label><TextAreaField label="Bối cảnh liên kết" value={item.context} onChange={(value) => update(index, { context: value })} /><button type="button" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} className="inline-flex h-10 items-center justify-center gap-1 self-end rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-extrabold text-rose-700"><Trash2 size={14} />Xóa liên kết</button></div></article>; })}</div>;
}

function EmptyEditor({ onBack }: { onBack: () => void }) { return <section className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center"><h1 className="text-xl font-extrabold text-slate-800">Không tìm thấy hồ sơ thuốc</h1><button type="button" onClick={onBack} className="mt-4 font-bold text-teal-700">Quay về danh mục</button></section>; }
