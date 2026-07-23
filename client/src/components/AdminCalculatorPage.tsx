import { Archive, ChevronDown, ChevronUp, Copy, Edit3, FileInput, Play, Plus, Save, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { DataRoute } from "../utils/dataRoutes";
import AdminCalculatorImportPage from "./AdminCalculatorImportPage";
import { calculateCalculator, calculatorRegistry, hasCalculatorHandler } from "../modules/calculators/engine";
import type { CalculatorDefinition, CalculatorInputField, CalculatorInputType } from "../modules/calculators/types";
import { calculatorHasDuplicate, calculatorStatusLabel, createCalculator, deleteCalculator, getCalculatorById, publishCalculator, searchCalculators, updateCalculator } from "../services/calculatorService";

type AdminRoute = Extract<DataRoute, { tab: "admin" }>;
const statusOptions: CalculatorDefinition["status"][] = ["draft", "in_review", "reviewed", "published", "archived"];

function blank(): Partial<CalculatorDefinition> {
  return {
    id: "", slug: "", name: "", nameVi: "", shortName: "", specialty: "", category: "", description: "", purpose: "",
    whenToUse: [], whenNotToUse: [], limitations: [], inputFields: [], calculation: { handlerId: "" }, resultDefinitions: [],
    interpretations: [], guidelineReferences: [], drugReferences: [], flashcardReferences: [], quizReferences: [], relatedCalculatorReferences: [],
    references: [], status: "draft", version: "1.0.0", sourceVerified: false,
  };
}

function lines(value: string) { return value.split("\n").map((item) => item.trim()).filter(Boolean); }
function join(value?: string[]) { return (value || []).join("\n"); }

export default function AdminCalculatorPage({ route, onNavigate }: { route: AdminRoute; onNavigate: (path: string) => void }) {
  if (route.kind === "admin-calculator-import") return <AdminCalculatorImportPage onNavigate={onNavigate} />;
  if (route.kind === "admin-calculator-new" || route.kind === "admin-calculator-edit") return <CalculatorEditor calculatorId={route.calculatorId} onNavigate={onNavigate} />;
  return <CalculatorList onNavigate={onNavigate} />;
}

function CalculatorList({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const [, setVersion] = useState(0);
  const items = searchCalculators(query);

  function remove(item: CalculatorDefinition) {
    if (window.confirm(`Xóa ${item.nameVi}?`)) {
      deleteCalculator(item.id);
      setVersion((current) => current + 1);
    }
  }

  return <section aria-labelledby="admin-calculator-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-teal-700">Quản trị Máy tính y khoa</p><h1 id="admin-calculator-title" className="mt-1 text-2xl font-black text-rose-950">Danh sách máy tính</h1><p className="mt-1 text-sm font-semibold text-slate-500">Chỉ calculator đã xuất bản mới xuất hiện ở trang công khai.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onNavigate("/admin/may-tinh-y-khoa/import")} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700"><FileInput size={16} />Nhập dữ liệu</button><button type="button" onClick={() => onNavigate("/admin/may-tinh-y-khoa/new")} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white"><Plus size={16} />Thêm máy tính</button></div>
    </div>
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white/80 p-4"><label className="relative block"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-teal-400" placeholder="Tìm theo tên, chuyên khoa, nhóm..." /></label></div>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">{items.map((item) => <article key={item.id} className="rounded-2xl border border-teal-100 bg-white/85 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-extrabold text-slate-800">{item.nameVi}</h2><p className="mt-1 text-xs font-semibold text-slate-500">{item.shortName} · {item.specialty} · v{item.version} · Cập nhật {new Date(item.updatedAt).toLocaleDateString("vi-VN")}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${item.status === "published" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-800"}`}>{calculatorStatusLabel(item.status)}</span></div><p className="mt-3 line-clamp-2 text-sm text-slate-600">{item.description || "Chưa có mô tả."}</p><p className="mt-2 text-xs font-semibold text-slate-400">Handler: {item.calculation.handlerId || "Chưa chọn"} · {item.sourceVerified ? "Đã xác minh nguồn" : "Chưa xác minh nguồn"}</p><div className="mt-4 flex flex-wrap justify-end gap-1"><button type="button" title="Nhân bản" onClick={() => { const copy = createCalculator({ ...item, id: "", slug: `${item.slug}-copy`, nameVi: `${item.nameVi} (bản sao)`, status: "draft", sourceVerified: false }); onNavigate(`/admin/may-tinh-y-khoa/${copy.id}/edit`); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Copy size={16} /></button>{item.status !== "published" && hasCalculatorHandler(item) && <button type="button" title="Xuất bản" onClick={() => { publishCalculator(item.id); setVersion((current) => current + 1); }} className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"><Upload size={16} /></button>}<button type="button" title="Sửa" onClick={() => onNavigate(`/admin/may-tinh-y-khoa/${item.id}/edit`)} className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"><Edit3 size={16} /></button>{item.status !== "archived" && <button type="button" title="Lưu trữ" onClick={() => { updateCalculator(item.id, { status: "archived" }); setVersion((current) => current + 1); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Archive size={16} /></button>}<button type="button" title="Xóa" onClick={() => remove(item)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button></div></article>)}</div>
  </section>;
}

function CalculatorEditor({ calculatorId, onNavigate }: { calculatorId?: string; onNavigate: (path: string) => void }) {
  const existing = calculatorId ? getCalculatorById(calculatorId) : undefined;
  const [values, setValues] = useState<Partial<CalculatorDefinition>>(() => existing ? { ...existing } : blank());
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [testInputs, setTestInputs] = useState<Record<string, unknown>>({});
  const [testResult, setTestResult] = useState<ReturnType<typeof calculateCalculator> | null>(null);
  const fields = values.inputFields || [];
  const results = values.resultDefinitions || [];

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const setField = <K extends keyof CalculatorDefinition>(key: K, value: CalculatorDefinition[K]) => { setValues((current) => ({ ...current, [key]: value })); setDirty(true); };
  const move = <T,>(items: T[], index: number, direction: -1 | 1) => { const next = index + direction; if (next < 0 || next >= items.length) return items; const copy = [...items]; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy; };

  function save(continueEditing: boolean) {
    const id = String(values.id || "").trim();
    const slug = String(values.slug || "").trim();
    const nameVi = String(values.nameVi || values.name || "").trim();
    if (!id || !slug || !nameVi) { setMessage("Cần nhập ID, slug và tên tiếng Việt."); return; }
    if (calculatorHasDuplicate(existing?.id, "id", id) || calculatorHasDuplicate(existing?.id, "slug", slug)) { setMessage("ID hoặc slug đã tồn tại."); return; }
    if (values.status === "published" && (!values.calculation?.handlerId || !Object.hasOwn(calculatorRegistry, values.calculation.handlerId))) { setMessage("Không thể xuất bản khi chưa có handler hợp lệ trong registry."); return; }
    const payload = { ...values, id, slug, nameVi, status: values.status || "draft", sourceVerified: values.sourceVerified ?? false };
    const saved = existing ? updateCalculator(existing.id, payload) : createCalculator(payload);
    if (!saved) { setMessage("Không thể lưu calculator."); return; }
    setMessage("Đã lưu calculator."); setDirty(false);
    if (!continueEditing) onNavigate("/admin/may-tinh-y-khoa"); else if (!existing) onNavigate(`/admin/may-tinh-y-khoa/${saved.id}/edit`);
  }

  function runTest() {
    const definition = { ...blank(), ...values, inputFields: fields, resultDefinitions: results, calculation: values.calculation || { handlerId: "" } } as CalculatorDefinition;
    setTestResult(calculateCalculator(definition, testInputs));
  }

  return <section aria-labelledby="calculator-editor-title">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><button type="button" onClick={() => onNavigate("/admin/may-tinh-y-khoa")} className="text-sm font-bold text-teal-700">← Danh sách máy tính</button><p className="mt-5 text-xs font-extrabold uppercase tracking-[.16em] text-teal-700">{existing ? "Chỉnh sửa calculator" : "Thêm calculator"}</p><h1 id="calculator-editor-title" className="mt-1 text-2xl font-black text-rose-950">{values.nameVi || "Máy tính y khoa mới"}</h1></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => save(false)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"><Save size={16} />Lưu nháp</button><button type="button" onClick={() => save(true)} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white"><Save size={16} />Lưu và tiếp tục chỉnh sửa</button></div></div>
    {message && <p className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-800">{message}</p>}
    <div className="mt-6 grid gap-4">
      <Section title="Thông tin chung"><div className="grid gap-4 md:grid-cols-2"><Field label="ID" value={values.id || ""} onChange={(value) => setField("id", value)} /><Field label="Slug" value={values.slug || ""} onChange={(value) => setField("slug", value)} /><Field label="Tên tiếng Việt" value={values.nameVi || ""} onChange={(value) => setField("nameVi", value)} /><Field label="Tên tiếng Anh" value={values.name || ""} onChange={(value) => setField("name", value)} /><Field label="Tên ngắn" value={values.shortName || ""} onChange={(value) => setField("shortName", value)} /><Field label="Chuyên khoa" value={values.specialty || ""} onChange={(value) => setField("specialty", value)} /><Field label="Nhóm" value={values.category || ""} onChange={(value) => setField("category", value)} /><Field label="Phiên bản" value={values.version || "1.0.0"} onChange={(value) => setField("version", value)} /></div><TextArea label="Mô tả" value={values.description || ""} onChange={(value) => setField("description", value)} /></Section>
      <Section title="Mục đích và an toàn"><TextArea label="Mục đích" value={values.purpose || ""} onChange={(value) => setField("purpose", value)} /><div className="grid gap-4 md:grid-cols-3"><TextArea label="Khi sử dụng" value={join(values.whenToUse)} onChange={(value) => setField("whenToUse", lines(value))} /><TextArea label="Khi không nên sử dụng" value={join(values.whenNotToUse)} onChange={(value) => setField("whenNotToUse", lines(value))} /><TextArea label="Giới hạn" value={join(values.limitations)} onChange={(value) => setField("limitations", lines(value))} /></div></Section>
      <Section title="Input fields"><div className="grid gap-3">{fields.map((field, index) => <div key={`${field.id}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3"><div className="grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]"><Field label="ID" value={field.id} onChange={(value) => setField("inputFields", fields.map((item, itemIndex) => itemIndex === index ? { ...item, id: value } : item))} /><Field label="Nhãn" value={field.label} onChange={(value) => setField("inputFields", fields.map((item, itemIndex) => itemIndex === index ? { ...item, label: value } : item))} /><label className="text-sm font-bold text-slate-700">Loại<select value={field.type} onChange={(event) => setField("inputFields", fields.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as CalculatorInputType } : item))} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-2 text-sm"><option value="number">Số</option><option value="select">Dropdown</option><option value="radio">Lựa chọn</option><option value="checkbox">Checkbox</option><option value="boolean">Có / Không</option></select></label><div className="flex items-end gap-1"><IconButton title="Đưa lên" disabled={index === 0} onClick={() => setField("inputFields", move(fields, index, -1))}><ChevronUp size={16} /></IconButton><IconButton title="Đưa xuống" disabled={index === fields.length - 1} onClick={() => setField("inputFields", move(fields, index, 1))}><ChevronDown size={16} /></IconButton><IconButton title="Xóa input" onClick={() => setField("inputFields", fields.filter((_, itemIndex) => itemIndex !== index))} className="text-rose-600"><Trash2 size={16} /></IconButton></div></div></div>)}</div><button type="button" onClick={() => setField("inputFields", [...fields, { id: `field-${fields.length + 1}`, label: "", type: "number", required: true }])} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-teal-200 px-3 py-2 text-sm font-bold text-teal-700"><Plus size={16} />Thêm input</button></Section>
      <Section title="Calculation handler"><label className="block text-sm font-bold text-slate-700">Handler đã đăng ký<select value={values.calculation?.handlerId || ""} onChange={(event) => setField("calculation", { handlerId: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="">Chưa có handler</option>{Object.keys(calculatorRegistry).map((handler) => <option key={handler} value={handler}>{handler}</option>)}</select></label><p className="mt-2 text-xs font-semibold text-slate-500">Không nhập JavaScript hoặc biểu thức động. Calculator không có handler chỉ được lưu nháp.</p></Section>
      <CalculatorPreview definition={{ ...blank(), ...values, inputFields: fields, resultDefinitions: results, calculation: values.calculation || { handlerId: "" } } as CalculatorDefinition} inputs={testInputs} onInputChange={(id, value) => setTestInputs((current) => ({ ...current, [id]: value }))} onRun={runTest} result={testResult} />
      <Section title="Result definitions"><div className="grid gap-3">{results.map((item, index) => <div key={`${item.key}-${index}`} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_1fr_auto]"><Field label="Key" value={item.key} onChange={(value) => setField("resultDefinitions", results.map((current, itemIndex) => itemIndex === index ? { ...current, key: value } : current))} /><Field label="Nhãn" value={item.label} onChange={(value) => setField("resultDefinitions", results.map((current, itemIndex) => itemIndex === index ? { ...current, label: value } : current))} /><Field label="Mô tả" value={item.description} onChange={(value) => setField("resultDefinitions", results.map((current, itemIndex) => itemIndex === index ? { ...current, description: value } : current))} /><div className="flex items-end gap-1"><IconButton title="Đưa lên" disabled={index === 0} onClick={() => setField("resultDefinitions", move(results, index, -1))}><ChevronUp size={16} /></IconButton><IconButton title="Đưa xuống" disabled={index === results.length - 1} onClick={() => setField("resultDefinitions", move(results, index, 1))}><ChevronDown size={16} /></IconButton><IconButton title="Xóa kết quả" onClick={() => setField("resultDefinitions", results.filter((_, itemIndex) => itemIndex !== index))} className="text-rose-600"><Trash2 size={16} /></IconButton></div></div>)}</div><button type="button" onClick={() => setField("resultDefinitions", [...results, { key: `result-${results.length + 1}`, label: "", description: "" }])} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-teal-200 px-3 py-2 text-sm font-bold text-teal-700"><Plus size={16} />Thêm kết quả</button></Section>
      <Section title="Liên kết và nguồn"><div className="grid gap-4 md:grid-cols-2"><TextArea label="Guideline references (JSON)" value={JSON.stringify(values.guidelineReferences || [], null, 2)} onChange={(value) => { try { setField("guidelineReferences", JSON.parse(value)); } catch { setMessage("Guideline references phải là JSON hợp lệ."); } }} /><TextArea label="Thuốc references (JSON)" value={JSON.stringify(values.drugReferences || [], null, 2)} onChange={(value) => { try { setField("drugReferences", JSON.parse(value)); } catch { setMessage("Drug references phải là JSON hợp lệ."); } }} /><TextArea label="Flashcard references (JSON)" value={JSON.stringify(values.flashcardReferences || [], null, 2)} onChange={(value) => { try { setField("flashcardReferences", JSON.parse(value)); } catch { setMessage("Flashcard references phải là JSON hợp lệ."); } }} /><TextArea label="Quiz references (JSON)" value={JSON.stringify(values.quizReferences || [], null, 2)} onChange={(value) => { try { setField("quizReferences", JSON.parse(value)); } catch { setMessage("Quiz references phải là JSON hợp lệ."); } }} /><TextArea label="Calculator references (JSON)" value={JSON.stringify(values.relatedCalculatorReferences || [], null, 2)} onChange={(value) => { try { setField("relatedCalculatorReferences", JSON.parse(value)); } catch { setMessage("Calculator references phải là JSON hợp lệ."); } }} /></div><TextArea label="Nguồn tham khảo (mỗi dòng một URL)" value={join(values.references)} onChange={(value) => setField("references", lines(value))} /></Section>
      <Section title="Trạng thái"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Trạng thái<select value={values.status || "draft"} onChange={(event) => setField("status", event.target.value as CalculatorDefinition["status"])} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold">{statusOptions.map((status) => <option key={status} value={status}>{calculatorStatusLabel(status)}</option>)}</select></label><label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={Boolean(values.sourceVerified)} onChange={(event) => setField("sourceVerified", event.target.checked)} />Nguồn đã được xác minh</label></div><TextArea label="Ghi chú thay đổi" value={values.changeNotes || ""} onChange={(value) => setField("changeNotes", value)} /></Section>
    </div>
  </section>;
}

function CalculatorPreview({ definition, inputs, onInputChange, onRun, result }: { definition: CalculatorDefinition; inputs: Record<string, unknown>; onInputChange: (id: string, value: unknown) => void; onRun: () => void; result: ReturnType<typeof calculateCalculator> | null }) {
  return <Section title="Preview và test input"><p className="text-sm font-semibold text-slate-500">Chạy thử handler đã đăng ký trước khi lưu hoặc xuất bản.</p><div className="grid gap-3 md:grid-cols-2">{definition.inputFields.map((field) => <PreviewInput key={field.id} field={field} value={inputs[field.id]} onChange={(value) => onInputChange(field.id, value)} />)}</div><button type="button" onClick={onRun} className="inline-flex w-fit items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white"><CalculatorIcon />Chạy thử</button>{result && <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4"><p className="text-xs font-extrabold uppercase tracking-[.12em] text-teal-700">Kết quả test</p><p className="mt-1 text-2xl font-black text-slate-800">{result.displayValue} <span className="text-sm font-extrabold">{result.unit}</span></p>{result.interpretationKey && <p className="mt-1 text-sm font-bold text-teal-800">Mã diễn giải: {result.interpretationKey}</p>}{result.warnings.length > 0 && <p className="mt-2 text-sm font-semibold text-rose-700">{result.warnings.join(" ")}</p>}</div>}</Section>;
}

function PreviewInput({ field, value, onChange }: { field: CalculatorInputField; value: unknown; onChange: (value: unknown) => void }) {
  if (field.options?.length) return <label className="block text-sm font-bold text-slate-700">{field.label}<select value={String(value ?? "")} onChange={(event) => onChange(field.type === "boolean" ? event.target.value === "true" : event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"><option value="">Chọn giá trị</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  return <label className="block text-sm font-bold text-slate-700">{field.label}{field.unit && <span className="ml-1 text-xs text-slate-400">({field.unit})</span>}<input type={field.type === "number" ? "number" : "text"} value={typeof value === "string" || typeof value === "number" ? value : ""} min={field.min} max={field.max} step={field.step || "any"} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-400" /></label>;
}

function CalculatorIcon() { return <Play size={15} aria-hidden="true" />; }
function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 sm:p-5"><h2 className="text-lg font-extrabold text-slate-800">{title}</h2><div className="mt-4 grid gap-4">{children}</div></section>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-bold text-slate-700">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-400" /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-bold text-slate-700">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-teal-400" /></label>; }
function IconButton({ title, disabled, onClick, className = "" , children }: { title: string; disabled?: boolean; onClick: () => void; className?: string; children: ReactNode }) { return <button type="button" title={title} disabled={disabled} onClick={onClick} className={`rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 ${className}`}>{children}</button>; }
