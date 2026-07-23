import { Archive, ExternalLink, Pencil, Pill, Plus, Save, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { DataRoute } from "../utils/dataRoutes";
import type { Drug, DrugStatus } from "../types/drug";
import { archiveThuoc, createThuoc, deleteThuoc, filterThuoc, getThuocById, getThuocFilterOptions, publishThuoc, updateThuoc } from "../services/thuocService";

type AdminRoute = Extract<DataRoute, { tab: "admin" }>;
type EditorValues = Omit<Drug, "id" | "createdAt" | "updatedAt" | "publishedAt" | "isPlaceholder"> & { publishedAt?: string | null; isPlaceholder?: boolean };

interface Props { route: AdminRoute; onNavigate: (path: string) => void }

const statusLabels: Record<DrugStatus, string> = { draft: "Bản nháp", reviewed: "Đã rà soát", published: "Đã xuất bản", archived: "Đã lưu trữ" };

function blankValues(): EditorValues {
  return {
    slug: "", genericName: "", titleVi: "", aliases: [], brandNames: [], drugClass: "", specialties: [], indications: "", contraindications: "", dosing: "", renalAdjustment: "", hepaticAdjustment: "", pregnancy: "", breastfeeding: "", adverseEffects: "", interactions: "", monitoring: "", mechanism: "", references: [], guidelineReferences: [], flashcardReferences: [], quizReferences: [], calculatorReferences: [], flowchartReferences: [], imageReferences: [], notes: "", summary: "", status: "draft", publishedAt: null, isPlaceholder: false,
  };
}

function fromDrug(drug: Drug): EditorValues {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...values } = drug;
  return values;
}

function lines(value: string): string[] { return value.split("\n").map((item) => item.trim()).filter(Boolean); }
function joinLines(value: string[]): string { return value.join("\n"); }

export default function AdminDrugPage({ route, onNavigate }: Props) {
  const isEditor = route.kind === "admin-drug-new" || route.kind === "admin-drug-edit" || route.kind === "admin-drug-detail";
  if (isEditor) return <DrugEditor route={route} onNavigate={onNavigate} />;
  return <DrugList onNavigate={onNavigate} />;
}

function DrugList({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const [drugClass, setDrugClass] = useState("all");
  const [specialty, setSpecialty] = useState("all");
  const [status, setStatus] = useState<DrugStatus | "all">("all");
  const [, setVersion] = useState(0);
  const options = getThuocFilterOptions();
  const items = filterThuoc({ query, drugClass, specialty, status });

  function refresh() { setVersion((value) => value + 1); }
  function handleDelete(drug: Drug) {
    if (typeof window !== "undefined" && !window.confirm(`Xóa hồ sơ ${drug.titleVi}?`)) return;
    deleteThuoc(drug.id);
    refresh();
  }

  return <section aria-labelledby="admin-drug-title">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-teal-700">Quản trị Thuốc</p><h1 id="admin-drug-title" className="mt-1 text-2xl font-extrabold text-rose-950">Danh mục thuốc</h1><p className="mt-1 text-sm font-semibold text-slate-500">Nguồn dữ liệu trung tâm để các module khác liên kết bằng ID.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onNavigate("/thuoc")} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700"><ExternalLink size={16} />Trang công khai</button><button type="button" onClick={() => onNavigate("/admin/thuoc/new")} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white hover:bg-teal-700"><Plus size={16} />Thêm thuốc</button></div></div>
    <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,180px))]"><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, hoạt chất, nhóm..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-teal-300" aria-label="Tìm thuốc trong quản trị" /></label><FilterSelect label="Nhóm thuốc" value={drugClass} options={options.drugClasses} onChange={setDrugClass} /><FilterSelect label="Chuyên khoa" value={specialty} options={options.specialties} onChange={setSpecialty} /><FilterSelect label="Trạng thái" value={status} options={Object.keys(statusLabels)} onChange={(value) => setStatus(value as DrugStatus | "all")} /></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((drug) => <article key={drug.id} className="rounded-2xl border border-teal-100 bg-white/85 p-4 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><Pill size={19} /></span><div className="min-w-0"><h2 className="truncate font-extrabold text-slate-800">{drug.titleVi}</h2><p className="text-xs font-semibold text-slate-500">{drug.genericName}</p><p className="mt-1 text-xs text-slate-400">{drug.drugClass || "Chưa phân nhóm"}</p></div></div><p className="mt-3 line-clamp-2 text-sm leading-5 text-slate-600">{drug.summary || "Chưa có mô tả."}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${drug.status === "published" ? "bg-teal-50 text-teal-700" : drug.status === "archived" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}>{statusLabels[drug.status]}</span><div className="flex items-center gap-1"><button type="button" title="Sửa" aria-label={`Sửa ${drug.titleVi}`} onClick={() => onNavigate(`/admin/thuoc/${drug.id}/edit`)} className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"><Pencil size={16} /></button>{drug.status !== "published" && <button type="button" title="Xuất bản" aria-label={`Xuất bản ${drug.titleVi}`} onClick={() => { publishThuoc(drug.id); refresh(); }} className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"><Upload size={16} /></button>}{drug.status !== "archived" && <button type="button" title="Lưu trữ" aria-label={`Lưu trữ ${drug.titleVi}`} onClick={() => { archiveThuoc(drug.id); refresh(); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Archive size={16} /></button>}<button type="button" title="Xóa" aria-label={`Xóa ${drug.titleVi}`} onClick={() => handleDelete(drug)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button></div></div></article>)}</div>
    {items.length === 0 && <p className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Không tìm thấy thuốc phù hợp.</p>}
  </section>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="text-xs font-bold text-slate-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-teal-300"><option value="all">Tất cả</option>{options.map((option) => <option key={option} value={option}>{option in statusLabels ? statusLabels[option as DrugStatus] : option}</option>)}</select></label>;
}

function DrugEditor({ route, onNavigate }: { route: AdminRoute; onNavigate: (path: string) => void }) {
  const isNew = route.kind === "admin-drug-new";
  const selected = route.drugId ? getThuocById(route.drugId) : undefined;
  const [values, setValues] = useState<EditorValues>(() => selected ? fromDrug(selected) : blankValues());
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => { setValues(selected ? fromDrug(selected) : blankValues()); setMessage(""); }, [route.drugId, isNew, selected, version]);

  function setField<K extends keyof EditorValues>(key: K, value: EditorValues[K]) { setValues((current) => ({ ...current, [key]: value })); }
  function save(status: DrugStatus = values.status) {
    const payload = { ...values, status, isPlaceholder: false };
    const saved = selected && !isNew ? updateThuoc(selected.id, payload) : createThuoc(payload);
    if (!saved) { setMessage("Không thể lưu hồ sơ thuốc."); return; }
    setMessage(status === "published" ? "Đã xuất bản hồ sơ thuốc." : "Đã lưu hồ sơ thuốc.");
    if (isNew) onNavigate(`/admin/thuoc/${saved.id}/edit`);
    else setVersion((current) => current + 1);
  }
  function handleDelete() {
    if (!selected) return;
    if (typeof window !== "undefined" && !window.confirm(`Xóa hồ sơ ${selected.titleVi}?`)) return;
    deleteThuoc(selected.id);
    onNavigate("/admin/thuoc");
  }
  if (!isNew && route.drugId && !selected) return <EmptyEditor onBack={() => onNavigate("/admin/thuoc")} />;

  return <section aria-labelledby="drug-editor-title"><div className="flex flex-wrap items-start justify-between gap-4"><div><button type="button" onClick={() => onNavigate("/admin/thuoc")} className="text-sm font-bold text-teal-700 hover:text-teal-900">← Danh mục thuốc</button><p className="mt-5 text-xs font-extrabold uppercase tracking-[.16em] text-teal-700">{isNew ? "Thêm hồ sơ" : "Chỉnh sửa hồ sơ"}</p><h1 id="drug-editor-title" className="mt-1 text-2xl font-extrabold text-rose-950">{isNew ? "Tạo thuốc mới" : values.titleVi || "Thuốc"}</h1></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => save("draft")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"><Save size={16} />Lưu nháp</button><button type="button" onClick={() => save("published")} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white hover:bg-teal-700"><Upload size={16} />Xuất bản</button>{selected && <button type="button" onClick={handleDelete} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700"><Trash2 size={16} />Xóa</button>}</div></div>{message && <p className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-800" role="status">{message}</p>}<div className="mt-6 grid gap-5"><EditorSection title="Thông tin chung"><div className="grid gap-4 md:grid-cols-2"><TextField label="Tên hiển thị" value={values.titleVi} onChange={(value) => setField("titleVi", value)} required /><TextField label="Tên hoạt chất" value={values.genericName} onChange={(value) => setField("genericName", value)} required /><TextField label="Slug" value={values.slug} onChange={(value) => setField("slug", value)} /><TextField label="Nhóm thuốc" value={values.drugClass} onChange={(value) => setField("drugClass", value)} /><TextAreaField label="Tên thương mại (mỗi dòng một tên)" value={joinLines(values.brandNames)} onChange={(value) => setField("brandNames", lines(value))} /><TextAreaField label="Tên khác (mỗi dòng một tên)" value={joinLines(values.aliases)} onChange={(value) => setField("aliases", lines(value))} /><TextAreaField label="Chuyên khoa (mỗi dòng một mục)" value={joinLines(values.specialties)} onChange={(value) => setField("specialties", lines(value))} /><TextAreaField label="Tóm tắt" value={values.summary} onChange={(value) => setField("summary", value)} /></div></EditorSection><EditorSection title="Thông tin sử dụng"><TextAreaField label="Cơ chế" value={values.mechanism} onChange={(value) => setField("mechanism", value)} /><TextAreaField label="Chỉ định" value={values.indications} onChange={(value) => setField("indications", value)} /><TextAreaField label="Liều dùng" value={values.dosing} onChange={(value) => setField("dosing", value)} /><div className="grid gap-4 md:grid-cols-2"><TextAreaField label="Điều chỉnh suy thận" value={values.renalAdjustment} onChange={(value) => setField("renalAdjustment", value)} /><TextAreaField label="Điều chỉnh suy gan" value={values.hepaticAdjustment} onChange={(value) => setField("hepaticAdjustment", value)} /><TextAreaField label="Chống chỉ định" value={values.contraindications} onChange={(value) => setField("contraindications", value)} /><TextAreaField label="Tác dụng phụ" value={values.adverseEffects} onChange={(value) => setField("adverseEffects", value)} /><TextAreaField label="Tương tác" value={values.interactions} onChange={(value) => setField("interactions", value)} /><TextAreaField label="Theo dõi" value={values.monitoring} onChange={(value) => setField("monitoring", value)} /><TextAreaField label="Thai kỳ" value={values.pregnancy} onChange={(value) => setField("pregnancy", value)} /><TextAreaField label="Cho con bú" value={values.breastfeeding} onChange={(value) => setField("breastfeeding", value)} /></div></EditorSection><EditorSection title="Nguồn và liên kết ID"><TextAreaField label="Nguồn tham khảo (mỗi dòng một nguồn)" value={joinLines(values.references)} onChange={(value) => setField("references", lines(value))} /><LinkFields values={values} setField={setField} /><TextAreaField label="Ghi chú nội bộ" value={values.notes} onChange={(value) => setField("notes", value)} /></EditorSection></div></section>;
}

function LinkFields({ values, setField }: { values: EditorValues; setField: <K extends keyof EditorValues>(key: K, value: EditorValues[K]) => void }) {
  return <div className="grid gap-4 md:grid-cols-2"><TextAreaField label="Liên kết Guideline (ID, mỗi dòng một ID)" value={joinLines(values.guidelineReferences)} onChange={(value) => setField("guidelineReferences", lines(value))} /><TextAreaField label="Liên kết Flashcard (ID, mỗi dòng một ID)" value={joinLines(values.flashcardReferences)} onChange={(value) => setField("flashcardReferences", lines(value))} /><TextAreaField label="Liên kết Quiz (ID, mỗi dòng một ID)" value={joinLines(values.quizReferences)} onChange={(value) => setField("quizReferences", lines(value))} /><TextAreaField label="Liên kết Calculator (ID, mỗi dòng một ID)" value={joinLines(values.calculatorReferences)} onChange={(value) => setField("calculatorReferences", lines(value))} /><TextAreaField label="Liên kết Flowchart (ID, mỗi dòng một ID)" value={joinLines(values.flowchartReferences)} onChange={(value) => setField("flowchartReferences", lines(value))} /><TextAreaField label="Hình ảnh (ID, mỗi dòng một ID)" value={joinLines(values.imageReferences)} onChange={(value) => setField("imageReferences", lines(value))} /></div>;
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white/85 p-5"><h2 className="text-lg font-extrabold text-slate-800">{title}</h2><div className="mt-4 grid gap-4">{children}</div></section>; }
function TextField({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <label className="text-sm font-bold text-slate-700">{label}{required && <span className="ml-1 text-rose-600">*</span>}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-300" /></label>; }
function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-sm font-bold text-slate-700">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-1.5 min-h-20 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-5 outline-none focus:border-teal-300" /></label>; }
function EmptyEditor({ onBack }: { onBack: () => void }) { return <section className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center"><h1 className="text-xl font-extrabold text-slate-800">Không tìm thấy hồ sơ thuốc</h1><button type="button" onClick={onBack} className="mt-4 font-bold text-teal-700">Quay về danh mục</button></section>; }
