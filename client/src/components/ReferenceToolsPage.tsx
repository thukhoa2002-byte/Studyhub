import { ArrowLeft, Calculator, ClipboardList, Edit3, FilePlus2, FileUp, FunctionSquare, Plus, Save, Table2, Trash2, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { deleteReferenceFormula, listReferenceFormulas, saveReferenceFormula, type ReferenceFormula } from "../services/referenceTools";

const OWNER_EMAIL = "thukhoa2002@gmail.com";
type FormulaDraft = { title: string; usage: string; formula_html: string; status: "private" | "shared" };
type ToolView = "overview" | "calculator" | "data-table" | "score";
type CalculatorType = "bmi" | "egfr" | "crcl" | "holliday-segar";
type EgfrFormula = "creatinine" | "cystatin" | "combined" | "mdrd";
type UnitOption = { id: string; label: string; factor: number };
const emptyFormula: FormulaDraft = { title: "", usage: "", formula_html: "", status: "shared" };

const weightUnits: UnitOption[] = [
  { id: "kg", label: "kg", factor: 1 },
  { id: "lb", label: "lb", factor: 0.45359237 },
];
const heightUnits: UnitOption[] = [
  { id: "cm", label: "cm", factor: 0.01 },
  { id: "m", label: "m", factor: 1 },
  { id: "in", label: "in", factor: 0.0254 },
];
const creatinineUnits: UnitOption[] = [
  { id: "mg-dl", label: "mg/dL", factor: 1 },
  { id: "umol-l", label: "µmol/L", factor: 1 / 88.4 },
];
const cystatinCUnits: UnitOption[] = [
  { id: "mg-l", label: "mg/L", factor: 1 },
  { id: "mg-dl", label: "mg/dL", factor: 10 },
];

const toolGroups = [
  { id: "formulas", title: "Công thức", description: "Công thức y khoa và quy đổi thường dùng.", icon: FunctionSquare, className: "border-violet-200 bg-violet-50/60 text-violet-700" },
  { id: "data-table", title: "Bảng dữ liệu", description: "Bảng tra nhanh theo chỉ số, đơn vị và ngưỡng.", icon: Table2, className: "border-teal-200 bg-teal-50/60 text-teal-700" },
  { id: "scores", title: "Thang điểm & đánh giá", description: "Các thang điểm hỗ trợ đánh giá lâm sàng.", icon: ClipboardList, className: "border-amber-200 bg-amber-50/60 text-amber-700" },
  { id: "calculator", title: "Máy tính y khoa", description: "Công cụ tính toán theo dữ liệu nhập vào.", icon: Calculator, className: "border-rose-200 bg-rose-50/60 text-rose-700" },
];
const calculatorOptions: Array<{ id: CalculatorType; label: string; description: string }> = [
  { id: "bmi", label: "BMI", description: "Khối cơ thể" },
  { id: "egfr", label: "eGFR", description: "CKD-EPI 2021" },
  { id: "crcl", label: "CrCl", description: "Cockcroft-Gault" },
  { id: "holliday-segar", label: "Holliday-Segar", description: "Dịch duy trì" },
];

const formulaSources = {
  niddk: "https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/estimating-gfr-equations",
  kdigo: "https://kdigo.org/wp-content/uploads/2017/02/KDIGO_2012_CKD_GL.pdf",
  cockcroftGault: "https://pubmed.ncbi.nlm.nih.gov/4830801/",
  hollidaySegar: "https://pubmed.ncbi.nlm.nih.gov/13431307/",
};

function sanitizeFormulaHtml(value: string) {
  if (typeof document === "undefined") return value;
  const template = document.createElement("template");
  template.innerHTML = value;
  const allowed = new Set(["BR", "EM", "I", "STRONG", "B", "SUB", "SUP", "SPAN", "TABLE", "TBODY", "TR", "TH", "TD"]);
  template.content.querySelectorAll("*").forEach((element) => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ""));
      return;
    }
    [...element.attributes].forEach((attribute) => {
      if (attribute.name !== "class" || !/^formula-(fraction|numerator|denominator|root|root-value|table|table-cell|table-header)$/.test(attribute.value)) element.removeAttribute(attribute.name);
    });
  });
  return template.innerHTML;
}

function FormulaPreview({ html }: { html: string }) {
  return <div className="formula-preview min-h-14 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xl text-slate-800" dangerouslySetInnerHTML={{ __html: sanitizeFormulaHtml(html) || "Chưa có công thức" }} />;
}

function UnitValueField({ label, value, unit, units, onValueChange, onUnitChange }: { label: string; value: string; unit: string; units: UnitOption[]; onValueChange: (value: string) => void; onUnitChange: (unit: string) => void }) {
  return <label className="block text-sm font-bold text-slate-700">
    {label}
    <span className="mt-1.5 flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-teal-400">
      <input type="number" inputMode="decimal" min="0" step="any" value={value} onChange={(event) => onValueChange(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base font-semibold outline-none" placeholder="Nhập giá trị" />
      <select value={unit} onChange={(event) => onUnitChange(event.target.value)} className="medical-select border-l border-slate-200 bg-slate-50 px-3 text-sm font-extrabold text-teal-700 outline-none">
        {units.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </span>
  </label>;
}

export default function ReferenceToolsPage({ user }: { user: User | null }) {
  const [formulas, setFormulas] = useState<ReferenceFormula[]>([]);
  const [form, setForm] = useState(emptyFormula);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeTool, setActiveTool] = useState<ToolView>("overview");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState("cm");
  const [calculatorType, setCalculatorType] = useState<CalculatorType>("bmi");
  const [egfrFormula, setEgfrFormula] = useState<EgfrFormula>("creatinine");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [creatinine, setCreatinine] = useState("");
  const [creatinineUnit, setCreatinineUnit] = useState("mg-dl");
  const [cystatinC, setCystatinC] = useState("");
  const [cystatinCUnit, setCystatinCUnit] = useState("mg-l");
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableColumns, setTableColumns] = useState(3);
  const [dataTableName, setDataTableName] = useState("");
  const [dataTableFile, setDataTableFile] = useState<File | null>(null);
  const [dataTableCreated, setDataTableCreated] = useState(false);
  const [scoreName, setScoreName] = useState("");
  const [scoreDescription, setScoreDescription] = useState("");
  const [scoreCreated, setScoreCreated] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const isOwner = user?.email?.trim().toLowerCase() === OWNER_EMAIL;

  const selectedWeightUnit = weightUnits.find((option) => option.id === weightUnit) || weightUnits[0];
  const selectedHeightUnit = heightUnits.find((option) => option.id === heightUnit) || heightUnits[0];
  const weightKg = Number(weight) * selectedWeightUnit.factor;
  const heightM = Number(height) * selectedHeightUnit.factor;
  const bmi = Number.isFinite(weightKg) && Number.isFinite(heightM) && weightKg > 0 && heightM > 0 ? weightKg / (heightM * heightM) : null;
  const selectedCreatinineUnit = creatinineUnits.find((option) => option.id === creatinineUnit) || creatinineUnits[0];
  const ageYears = Number(age);
  const creatinineMgDl = Number(creatinine) * selectedCreatinineUnit.factor;
  const egfrK = sex === "female" ? 0.7 : 0.9;
  const egfrAlpha = sex === "female" ? -0.241 : -0.302;
  const egfr = ageYears > 0 && Number.isFinite(ageYears) && creatinineMgDl > 0 && Number.isFinite(creatinineMgDl)
    ? 142 * Math.pow(Math.min(creatinineMgDl / egfrK, 1), egfrAlpha) * Math.pow(Math.max(creatinineMgDl / egfrK, 1), -1.2) * Math.pow(0.9938, ageYears) * (sex === "female" ? 1.012 : 1)
    : null;
  const selectedCystatinCUnit = cystatinCUnits.find((option) => option.id === cystatinCUnit) || cystatinCUnits[0];
  const cystatinCMgL = Number(cystatinC) * selectedCystatinCUnit.factor;
  const egfrCystatin = ageYears > 0 && Number.isFinite(ageYears) && cystatinCMgL > 0 && Number.isFinite(cystatinCMgL)
    ? 133 * Math.pow(Math.min(cystatinCMgL / 0.8, 1), -0.499) * Math.pow(Math.max(cystatinCMgL / 0.8, 1), -1.328) * Math.pow(0.996, ageYears) * (sex === "female" ? 0.932 : 1)
    : null;
  const egfrCombined = ageYears > 0 && Number.isFinite(ageYears) && creatinineMgDl > 0 && Number.isFinite(creatinineMgDl) && cystatinCMgL > 0 && Number.isFinite(cystatinCMgL)
    ? 135 * Math.pow(Math.min(creatinineMgDl / egfrK, 1), egfrAlpha) * Math.pow(Math.max(creatinineMgDl / egfrK, 1), -0.601) * Math.pow(Math.min(cystatinCMgL / 0.8, 1), -0.375) * Math.pow(Math.max(cystatinCMgL / 0.8, 1), -0.711) * Math.pow(0.995, ageYears) * (sex === "female" ? 0.969 : 1)
    : null;
  const mdrd = ageYears > 0 && Number.isFinite(ageYears) && creatinineMgDl > 0 && Number.isFinite(creatinineMgDl)
    ? 175 * Math.pow(creatinineMgDl, -1.154) * Math.pow(ageYears, -0.203) * (sex === "female" ? 0.742 : 1)
    : null;
  const selectedEgfr = egfrFormula === "creatinine" ? egfr : egfrFormula === "cystatin" ? egfrCystatin : egfrFormula === "combined" ? egfrCombined : mdrd;
  const crcl = ageYears > 0 && ageYears < 140 && Number.isFinite(ageYears) && weightKg > 0 && creatinineMgDl > 0 && Number.isFinite(creatinineMgDl)
    ? ((140 - ageYears) * weightKg) / (72 * creatinineMgDl) * (sex === "female" ? 0.85 : 1)
    : null;
  const hollidayHourly = weightKg > 0 && Number.isFinite(weightKg) ? weightKg <= 10 ? weightKg * 4 : weightKg <= 20 ? 40 + (weightKg - 10) * 2 : 60 + (weightKg - 20) : null;
  const hollidayDaily = weightKg > 0 && Number.isFinite(weightKg) ? weightKg <= 10 ? weightKg * 100 : weightKg <= 20 ? 1000 + (weightKg - 10) * 50 : 1500 + (weightKg - 20) * 20 : null;

  function changeUnit(value: string, currentUnit: string, nextUnit: string, units: UnitOption[], onChange: (value: string) => void, setUnit: (unit: string) => void) {
    const numericValue = Number(value);
    const current = units.find((option) => option.id === currentUnit);
    const next = units.find((option) => option.id === nextUnit);
    if (value.trim() && Number.isFinite(numericValue) && current && next) {
      const converted = (numericValue * current.factor) / next.factor;
      onChange(String(Number(converted.toFixed(4))));
    }
    setUnit(nextUnit);
  }

  useEffect(() => {
    let active = true;
    void listReferenceFormulas().then((items) => { if (active) setFormulas(items); }).catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách công thức."); });
    return () => { active = false; };
  }, []);

  function syncFormula() {
    setForm((current) => ({ ...current, formula_html: sanitizeFormulaHtml(editorRef.current?.innerHTML || "") }));
  }

  function openNewFormula() {
    setEditingId(null);
    setForm(emptyFormula);
    setFormOpen(true);
  }

  function openEditFormula(formula: ReferenceFormula) {
    setEditingId(formula.id);
    setForm({ title: formula.title, usage: formula.usage, formula_html: formula.formula_html, status: formula.status });
    setFormOpen(true);
  }

  function useEditorCommand(command: "superscript" | "subscript") {
    editorRef.current?.focus();
    document.execCommand(command);
    syncFormula();
  }

  function insertFormulaPart(kind: "fraction" | "root") {
    editorRef.current?.focus();
    const html = kind === "fraction"
      ? "<span class=\"formula-fraction\"><span class=\"formula-numerator\" contenteditable=\"true\">a</span><span class=\"formula-denominator\" contenteditable=\"true\">b</span></span>"
      : "<span class=\"formula-root\">√<span class=\"formula-root-value\" contenteditable=\"true\">x</span></span>";
    document.execCommand("insertHTML", false, html);
    syncFormula();
  }

  function insertFormulaTable() {
    const rows = Math.min(8, Math.max(1, tableRows));
    const columns = Math.min(8, Math.max(1, tableColumns));
    const html = `<table class="formula-table"><tbody>${Array.from({ length: rows }, (_, rowIndex) => `<tr>${Array.from({ length: columns }, (_, columnIndex) => rowIndex === 0 ? `<th class="formula-table-header">${columnIndex === 0 ? "Tên / chỉ số" : `Cột ${columnIndex + 1}`}</th>` : `<td class="formula-table-cell">Ô ${rowIndex + 1}.${columnIndex + 1}</td>`).join("")}</tr>`).join("")}</tbody></table><br>`;
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    syncFormula();
    setTablePickerOpen(false);
  }

  function openToolCreator(toolId: string) {
    if (toolId === "formulas") {
      if (isOwner) openNewFormula();
      else setError("Chỉ chủ web mới có thể tạo công thức.");
      return;
    }
    if (toolId === "data-table") {
      setActiveTool("data-table");
      setDataTableCreated(false);
      setError("");
      return;
    }
    if (toolId === "scores") {
      setActiveTool("score");
      setScoreCreated(false);
      setError("");
      return;
    }
    if (toolId === "calculator") setActiveTool("calculator");
  }

  function createDataTable(event: React.FormEvent) {
    event.preventDefault();
    if (!dataTableName.trim() || !dataTableFile) return;
    setDataTableCreated(true);
  }

  function createScore(event: React.FormEvent) {
    event.preventDefault();
    if (!scoreName.trim()) return;
    setScoreCreated(true);
  }

  async function saveFormula(event: React.FormEvent) {
    event.preventDefault();
    if (!isOwner || !user || !form.title.trim()) return;
    syncFormula();
    const formulaHtml = sanitizeFormulaHtml(editorRef.current?.innerHTML || form.formula_html);
    setBusy(true);
    setError("");
    try {
      const saved = await saveReferenceFormula(user.id, { ...form, formula_html: formulaHtml }, editingId || undefined);
      setFormulas((items) => editingId ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items]);
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyFormula);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu công thức.");
    } finally { setBusy(false); }
  }

  async function removeFormula(formula: ReferenceFormula) {
    if (!isOwner || !confirm(`Xóa công thức “${formula.title}”?`)) return;
    try {
      await deleteReferenceFormula(formula.id);
      setFormulas((items) => items.filter((item) => item.id !== formula.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa công thức.");
    }
  }

  return <section className="mode-panel mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 xl:px-8" aria-labelledby="reference-tools-title">
    <div className="glass-panel border border-violet-100 bg-white/75 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Calculator size={25} /></span><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-violet-600">Tài liệu tham khảo</p><h1 id="reference-tools-title" className="mt-1 text-2xl font-black text-rose-950">Công cụ &amp; Bảng tra</h1><p className="mt-1 text-sm text-slate-500">Công thức, bảng dữ liệu và công cụ hỗ trợ tính toán, đánh giá.</p></div></div>{isOwner && <button type="button" onClick={openNewFormula} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700"><FilePlus2 size={17} />Thêm công thức</button>}</div>

      {isOwner && <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/35 p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-violet-600">Khu vực chủ web</p><h2 className="mt-1 text-lg font-black text-slate-800">Quản lý công thức</h2></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-violet-700">{formulas.length}</span></div>
        {formOpen && <form onSubmit={(event) => void saveFormula(event)} className="mt-4 space-y-3 rounded-2xl border border-white bg-white/80 p-4">
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">Tên công thức<input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400" placeholder="Ví dụ: Độ lọc cầu thận eGFR" /></label><label className="text-sm font-bold text-slate-700">Cách dùng<textarea value={form.usage} onChange={(event) => setForm((current) => ({ ...current, usage: event.target.value }))} rows={2} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400" placeholder="Nhập dữ liệu nào, đọc kết quả ra sao..." /></label></div>
          <div><div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-bold text-slate-700">Công thức</span><div className="flex flex-wrap gap-1"><button type="button" title="Số mũ" onClick={() => useEditorCommand("superscript")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-700 hover:bg-violet-50">x<sup>2</sup></button><button type="button" title="Chỉ số dưới" onClick={() => useEditorCommand("subscript")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-700 hover:bg-violet-50">x<sub>i</sub></button><button type="button" title="Chèn phân số" onClick={() => insertFormulaPart("fraction")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-700 hover:bg-violet-50">a⁄b</button><button type="button" title="Chèn dấu căn" onClick={() => insertFormulaPart("root")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-700 hover:bg-violet-50">√x</button><span className="relative"><button type="button" title="Chèn bảng" onClick={() => setTablePickerOpen((open) => !open)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-700 hover:bg-violet-50"><Table2 size={15} />Bảng</button>{tablePickerOpen && <span className="absolute right-0 top-full z-20 mt-2 flex items-end gap-2 rounded-xl border border-violet-100 bg-white p-3 text-xs font-bold text-slate-600 shadow-lg"><label>Hàng<input type="number" min="1" max="8" value={tableRows} onChange={(event) => setTableRows(Number(event.target.value) || 1)} className="mt-1 block w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-center outline-none focus:border-violet-400" /></label><label>Cột<input type="number" min="1" max="8" value={tableColumns} onChange={(event) => setTableColumns(Number(event.target.value) || 1)} className="mt-1 block w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-center outline-none focus:border-violet-400" /></label><button type="button" onClick={insertFormulaTable} className="rounded-lg bg-violet-600 px-2.5 py-2 text-white hover:bg-violet-700">Chèn</button></span>}</span></div></div><div ref={editorRef} contentEditable suppressContentEditableWarning onInput={syncFormula} className="formula-editor min-h-16 rounded-xl border border-violet-200 bg-white px-4 py-3 text-xl text-slate-800 outline-none focus:border-violet-400" dangerouslySetInnerHTML={{ __html: sanitizeFormulaHtml(form.formula_html) }} /></div>
          <div><p className="mb-1.5 text-xs font-bold text-slate-500">Xem trước</p><FormulaPreview html={form.formula_html} /></div>
          <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setFormOpen(false); setEditingId(null); }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600"><X size={16} />Hủy</button><button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16} />{busy ? "Đang lưu..." : "Lưu công thức"}</button></div>
        </form>}
        {error && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
        {formulas.length > 0 && <div className="mt-4 grid gap-3 lg:grid-cols-2">{formulas.map((formula) => <article key={formula.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-base font-extrabold text-slate-800">{formula.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{formula.usage}</p></div><div className="flex shrink-0 items-center gap-1"><button type="button" title="Sửa công thức" onClick={() => openEditFormula(formula)} className="rounded-lg p-2 text-violet-700 hover:bg-violet-50"><Edit3 size={16} /></button><button type="button" title="Xóa công thức" onClick={() => void removeFormula(formula)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button></div></div><div className="mt-3"><FormulaPreview html={formula.formula_html} /></div></article>)}</div>}
      </div>}

      {activeTool === "calculator" && <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/35 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-teal-700">Máy tính y khoa</p><h2 className="mt-1 text-xl font-black text-slate-800">Tính chỉ số theo công thức</h2></div>
          <button type="button" onClick={() => setActiveTool("overview")} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"><ArrowLeft size={16} /> Danh sách công cụ</button>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{calculatorOptions.map((option) => <button key={option.id} type="button" onClick={() => setCalculatorType(option.id)} className={`rounded-xl border px-3 py-2.5 text-left transition ${calculatorType === option.id ? "border-teal-300 bg-white text-teal-800 shadow-sm" : "border-white bg-white/55 text-slate-600 hover:border-teal-200"}`}><strong className="block text-sm font-extrabold">{option.label}</strong><small className="mt-0.5 block text-xs font-semibold text-slate-400">{option.description}</small></button>)}</div>
        {calculatorType === "bmi" && <div className="mt-5"><div className="grid gap-4 md:grid-cols-2"><UnitValueField label="Cân nặng" value={weight} unit={weightUnit} units={weightUnits} onValueChange={setWeight} onUnitChange={(nextUnit) => changeUnit(weight, weightUnit, nextUnit, weightUnits, setWeight, setWeightUnit)} /><UnitValueField label="Chiều cao" value={height} unit={heightUnit} units={heightUnits} onValueChange={setHeight} onUnitChange={(nextUnit) => changeUnit(height, heightUnit, nextUnit, heightUnits, setHeight, setHeightUnit)} /></div><div className="mt-5 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white bg-white/85 p-4"><div><p className="text-sm font-bold text-slate-500">Kết quả BMI</p><p className="mt-1 text-4xl font-black text-teal-800">{bmi === null ? "—" : bmi.toFixed(1)}</p></div><p className="max-w-sm text-sm font-semibold leading-6 text-slate-500">{bmi === null ? "Nhập cân nặng và chiều cao để tính." : bmi < 18.5 ? "Thiếu cân" : bmi < 25 ? "Bình thường" : bmi < 30 ? "Thừa cân" : "Béo phì"}</p></div></div>}
        {calculatorType === "holliday-segar" && <div className="mt-5"><UnitValueField label="Cân nặng" value={weight} unit={weightUnit} units={weightUnits} onValueChange={setWeight} onUnitChange={(nextUnit) => changeUnit(weight, weightUnit, nextUnit, weightUnits, setWeight, setWeightUnit)} /><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-white bg-white/85 p-4"><p className="text-sm font-bold text-slate-500">Dịch duy trì mỗi giờ · 4-2-1</p><p className="mt-1 text-3xl font-black text-teal-800">{hollidayHourly === null ? "—" : hollidayHourly.toFixed(1)} <span className="text-base">mL/giờ</span></p></div><div className="rounded-2xl border border-white bg-white/85 p-4"><p className="text-sm font-bold text-slate-500">Dịch duy trì mỗi ngày · 100-50-20</p><p className="mt-1 text-3xl font-black text-teal-800">{hollidayDaily === null ? "—" : hollidayDaily.toFixed(1)} <span className="text-base">mL/ngày</span></p></div></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500"><span>Nguồn:</span><a href={formulaSources.hollidaySegar} target="_blank" rel="noreferrer" className="text-teal-700 underline hover:text-teal-900">Holliday-Segar · PubMed</a></div><p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Chỉ là ước tính dịch duy trì ban đầu; cần điều chỉnh theo tuổi, bệnh cảnh, điện giải và đánh giá lâm sàng.</p></div>}
        {(calculatorType === "egfr" || calculatorType === "crcl") && <div className="mt-5">{calculatorType === "egfr" && <label className="block text-sm font-bold text-slate-700">Công thức eGFR<select value={egfrFormula} onChange={(event) => setEgfrFormula(event.target.value as EgfrFormula)} className="medical-select mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none"><option value="creatinine">CKD-EPI Creatinine 2021</option><option value="cystatin">CKD-EPI Cystatin C 2012</option><option value="combined">CKD-EPI Creatinine-Cystatin C 2012</option><option value="mdrd">MDRD 4 biến chuẩn hóa</option></select></label>}<div className="mt-4 grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]"><label className="block min-w-0 text-sm font-bold text-slate-700">Tuổi (năm)<input type="number" min="1" max="120" step="1" value={age} onChange={(event) => setAge(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-teal-400" /></label><label className="block min-w-0 text-sm font-bold text-slate-700">Giới tính sinh học<select value={sex} onChange={(event) => setSex(event.target.value as "male" | "female")} className="medical-select mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none"><option value="male">Nam</option><option value="female">Nữ</option></select></label>{(calculatorType !== "egfr" || egfrFormula !== "cystatin") && <UnitValueField label="Creatinine huyết thanh" value={creatinine} unit={creatinineUnit} units={creatinineUnits} onValueChange={setCreatinine} onUnitChange={(nextUnit) => changeUnit(creatinine, creatinineUnit, nextUnit, creatinineUnits, setCreatinine, setCreatinineUnit)} />}{calculatorType === "egfr" && (egfrFormula === "cystatin" || egfrFormula === "combined") && <UnitValueField label="Cystatin C" value={cystatinC} unit={cystatinCUnit} units={cystatinCUnits} onValueChange={setCystatinC} onUnitChange={(nextUnit) => changeUnit(cystatinC, cystatinCUnit, nextUnit, cystatinCUnits, setCystatinC, setCystatinCUnit)} />}{calculatorType === "crcl" && <UnitValueField label="Cân nặng" value={weight} unit={weightUnit} units={weightUnits} onValueChange={setWeight} onUnitChange={(nextUnit) => changeUnit(weight, weightUnit, nextUnit, weightUnits, setWeight, setWeightUnit)} />}</div><div className="mt-5 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white bg-white/85 p-4"><div><p className="text-sm font-bold text-slate-500">{calculatorType === "egfr" ? egfrFormula === "creatinine" ? "eGFR · CKD-EPI Creatinine 2021" : egfrFormula === "cystatin" ? "eGFR · CKD-EPI Cystatin C 2012" : egfrFormula === "combined" ? "eGFR · CKD-EPI Creatinine-Cystatin C 2012" : "eGFR · MDRD 4 biến" : "CrCl · Cockcroft-Gault"}</p><p className="mt-1 text-4xl font-black text-teal-800">{calculatorType === "egfr" ? (selectedEgfr === null ? "—" : selectedEgfr.toFixed(1)) : (crcl === null ? "—" : crcl.toFixed(1))}</p></div><p className="text-sm font-semibold text-slate-500">mL/min{calculatorType === "crcl" ? "" : "/1,73 m²"}</p></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500"><span>Nguồn:</span><a href={formulaSources.niddk} target="_blank" rel="noreferrer" className="text-teal-700 underline hover:text-teal-900">NIDDK · CKD-EPI &amp; MDRD</a><a href={formulaSources.kdigo} target="_blank" rel="noreferrer" className="text-teal-700 underline hover:text-teal-900">KDIGO · CKD guideline</a>{calculatorType === "crcl" && <a href={formulaSources.cockcroftGault} target="_blank" rel="noreferrer" className="text-teal-700 underline hover:text-teal-900">Cockcroft-Gault · PubMed</a>}</div><p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Kết quả chỉ mang tính tham khảo lâm sàng; cần đối chiếu tình trạng người bệnh và hướng dẫn chuyên môn.</p></div>}
      </div>}
      {activeTool === "data-table" && <form onSubmit={createDataTable} className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/35 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-teal-700">Tạo bảng dữ liệu</p><h2 className="mt-1 text-xl font-black text-slate-800">Nhập tài liệu để làm bảng tra</h2></div><button type="button" onClick={() => setActiveTool("overview")} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"><ArrowLeft size={16} /> Danh sách công cụ</button></div>
        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"><label className="block text-sm font-bold text-slate-700">Tên bảng<input required value={dataTableName} onChange={(event) => { setDataTableName(event.target.value); setDataTableCreated(false); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-teal-400" placeholder="Ví dụ: Bảng quy đổi eGFR" /></label><label className="block text-sm font-bold text-slate-700">File PDF<input required type="file" accept="application/pdf,.pdf" onChange={(event) => { setDataTableFile(event.target.files?.[0] || null); setDataTableCreated(false); }} className="sr-only" /><span className="mt-1.5 flex min-h-[49px] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-teal-300 bg-white px-3 text-sm font-semibold text-slate-500 hover:bg-teal-50"><UploadCloud size={18} className="shrink-0 text-teal-600" />{dataTableFile ? <span className="truncate text-teal-700">{dataTableFile.name}</span> : "Chọn PDF để nhập bảng dữ liệu"}</span></label></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-500">PDF sẽ được dùng làm nguồn cho bước trích xuất bảng dữ liệu.</p><button type="submit" disabled={!dataTableName.trim() || !dataTableFile} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><FileUp size={17} />Tạo bảng</button></div>
        {dataTableCreated && <p className="mt-3 rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm font-semibold text-teal-700">Bản nháp “{dataTableName.trim()}” đã sẵn sàng với file {dataTableFile?.name}.</p>}
      </form>}
      {activeTool === "score" && <form onSubmit={createScore} className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/35 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-amber-700">Tạo thang điểm</p><h2 className="mt-1 text-xl font-black text-slate-800">Thang điểm &amp; đánh giá</h2></div><button type="button" onClick={() => setActiveTool("overview")} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:border-amber-300 hover:text-amber-700"><ArrowLeft size={16} /> Danh sách công cụ</button></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="block text-sm font-bold text-slate-700">Tên thang điểm<input required value={scoreName} onChange={(event) => { setScoreName(event.target.value); setScoreCreated(false); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-amber-400" placeholder="Ví dụ: CURB-65" /></label><label className="block text-sm font-bold text-slate-700">Mô tả cách dùng<textarea value={scoreDescription} onChange={(event) => { setScoreDescription(event.target.value); setScoreCreated(false); }} rows={1} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-amber-400" placeholder="Nhập mục đích và cách đọc kết quả..." /></label></div>
        <div className="mt-4 flex justify-end"><button type="submit" disabled={!scoreName.trim()} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><FilePlus2 size={17} />Tạo thang điểm</button></div>
        {scoreCreated && <p className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800">Bản nháp “{scoreName.trim()}” đã sẵn sàng để bổ sung các tiêu chí đánh giá.</p>}
      </form>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">{toolGroups.map(({ id, title, description, icon: Icon, className }) => <div key={id} className={`relative flex min-h-28 items-start gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${className} ${((id === "calculator" && activeTool === "calculator") || (id === "data-table" && activeTool === "data-table") || (id === "scores" && activeTool === "score")) ? "ring-2 ring-teal-300" : ""}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80"><Icon size={21} /></span><span className="min-w-0 pr-8"><strong className="block text-sm font-extrabold text-slate-800">{title}</strong><small className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{description}</small></span><button type="button" title={`Tạo ${title.toLowerCase()}`} aria-label={`Tạo ${title.toLowerCase()}`} onClick={() => openToolCreator(id)} className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/85 text-slate-600 shadow-sm transition hover:bg-white hover:text-teal-700"><Plus size={17} /></button></div>)}</div>
      {!isOwner && formulas.length > 0 && <div className="mt-6 grid gap-3 lg:grid-cols-2">{formulas.map((formula) => <article key={formula.id} className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-base font-extrabold text-slate-800">{formula.title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{formula.usage}</p><div className="mt-3"><FormulaPreview html={formula.formula_html} /></div></article>)}</div>}
    </div>
  </section>;
}
