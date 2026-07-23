import { Calculator, Check, ChevronDown, ClipboardList, Edit3, FilePlus2, FileUp, FunctionSquare, Save, Search, Table2, Trash2, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { deleteReferenceFormula, listReferenceFormulas, saveReferenceFormula, type ReferenceFormula } from "../services/referenceTools";

const OWNER_EMAIL = "thukhoa2002@gmail.com";
type FormulaDraft = { title: string; usage: string; formula_html: string; status: "private" | "shared" };
type ToolView = "overview" | "calculator" | "data-table" | "score";
type CalculatorType = "bmi" | "egfr" | "crcl" | "holliday-segar" | "bsa" | "wells-pe" | "cha2ds2-vasc" | "child-pugh" | "timi" | "has-bled" | "centor" | "sirs" | "grace-acs" | "anion-gap" | "psi-port" | "curb-65" | "apache-ii";
type EgfrFormula = "creatinine" | "cystatin" | "combined" | "mdrd";
type CrclFormula = "standard" | "adjusted-weight" | "bsa-normalized";
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
const calculatorOptions: Array<{ id: CalculatorType; label: string; description: string; interactive?: boolean }> = [
  { id: "bmi", label: "BMI · Body Mass Index", description: "Chỉ số khối cơ thể", interactive: true },
  { id: "egfr", label: "eGFR · Estimated Glomerular Filtration Rate", description: "Độ lọc cầu thận ước tính", interactive: true },
  { id: "crcl", label: "CrCl · Creatinine Clearance", description: "Độ thanh thải creatinine", interactive: true },
  { id: "holliday-segar", label: "Holliday-Segar", description: "Dịch duy trì theo cân nặng", interactive: true },
  { id: "bsa", label: "BSA · Body Surface Area", description: "Diện tích da cơ thể", interactive: true },
  { id: "wells-pe", label: "Wells' Score · Pulmonary Embolism", description: "Thang điểm Wells đánh giá khả năng thuyên tắc phổi", interactive: true },
  { id: "cha2ds2-vasc", label: "CHA₂DS₂-VASc Score", description: "Nguy cơ đột quỵ ở rung nhĩ", interactive: true },
  { id: "child-pugh", label: "Child-Pugh Score", description: "Mức độ nặng bệnh gan mạn", interactive: true },
  { id: "timi", label: "TIMI Risk Score", description: "Nguy cơ hội chứng vành cấp", interactive: true },
  { id: "has-bled", label: "HAS-BLED Score", description: "Nguy cơ chảy máu ở rung nhĩ", interactive: true },
  { id: "centor", label: "Centor / McIsaac Score", description: "Khả năng viêm họng do liên cầu", interactive: true },
  { id: "sirs", label: "SIRS Criteria", description: "Tiêu chuẩn đáp ứng viêm hệ thống", interactive: true },
  { id: "grace-acs", label: "GRACE ACS Score", description: "Nguy cơ tử vong/hồi máu cơ tim trong ACS", interactive: true },
  { id: "anion-gap", label: "Anion Gap", description: "Khoảng trống anion", interactive: true },
  { id: "psi-port", label: "PSI / PORT Score", description: "Tiên lượng viêm phổi cộng đồng", interactive: true },
  { id: "curb-65", label: "CURB-65 Score", description: "Đánh giá mức độ nặng viêm phổi", interactive: true },
  { id: "apache-ii", label: "APACHE II Score", description: "Đánh giá mức độ nặng bệnh nhân hồi sức", interactive: true },
];
const interactiveCalculatorTypes: CalculatorType[] = calculatorOptions.filter((option) => option.interactive).map((option) => option.id);

const formulaSources = {
  niddk: "https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/estimating-gfr-equations",
  kdigo: "https://kdigo.org/wp-content/uploads/2017/02/KDIGO_2012_CKD_GL.pdf",
  cockcroftGault: "https://pubmed.ncbi.nlm.nih.gov/4830801/",
  hollidaySegar: "https://pubmed.ncbi.nlm.nih.gov/13431307/",
};

const referenceOnlyFormulaDefinitions: Partial<Record<CalculatorType, { title: string; description: string; formula: string; variables: string; source: string; sourceLabel: string }>> = {
  bsa: {
    title: "BSA · Body Surface Area",
    description: "Diện tích da cơ thể theo công thức Mosteller",
    formula: "BSA (m<sup>2</sup>) = √[(Chiều cao (cm) × Cân nặng (kg)) / 3600]",
    variables: "Dùng chiều cao theo cm và cân nặng theo kg.",
    source: "https://pubmed.ncbi.nlm.nih.gov/?term=Mosteller+body+surface+area+formula",
    sourceLabel: "Mosteller · PubMed",
  },
  "wells-pe": {
    title: "Wells' Score · Pulmonary Embolism",
    description: "Thang điểm Wells đánh giá khả năng thuyên tắc phổi",
    formula: "Dấu hiệu DVT 3 điểm; PE có khả năng nhất 3; nhịp tim >100 1.5; bất động/phẫu thuật 4 tuần 1.5; tiền sử DVT/PE 1.5; ho ra máu 1; ung thư 1.<br />Tổng điểm ≤4: PE unlikely; >4: PE likely.",
    variables: "Đây là phiên bản Wells cho PE; cần kết hợp xác suất trước xét nghiệm và hướng dẫn chẩn đoán.",
    source: "https://pubmed.ncbi.nlm.nih.gov/?term=Wells+clinical+model+pulmonary+embolism",
    sourceLabel: "Wells PE · PubMed",
  },
  "cha2ds2-vasc": {
    title: "CHA₂DS₂-VASc Score",
    description: "Nguy cơ đột quỵ ở bệnh nhân rung nhĩ",
    formula: "C: suy tim 1; H: tăng huyết áp 1; A<sub>2</sub>: tuổi ≥75 là 2; D: đái tháo đường 1; S<sub>2</sub>: đột quỵ/TIA/thuyên tắc 2; V: bệnh mạch máu 1; A: tuổi 65–74 là 1; Sc: nữ 1.",
    variables: "Tổng điểm dùng để phân tầng nguy cơ và quyết định điều trị theo hướng dẫn rung nhĩ.",
    source: "https://pubmed.ncbi.nlm.nih.gov/?term=CHA2DS2-VASc+score+atrial+fibrillation",
    sourceLabel: "CHA₂DS₂-VASc · PubMed",
  },
  "child-pugh": {
    title: "Child-Pugh Score",
    description: "Đánh giá mức độ nặng bệnh gan mạn",
    formula: "5 tiêu chí, mỗi tiêu chí 1–3 điểm: bilirubin, albumin, INR/thời gian prothrombin, cổ trướng và bệnh não gan.<br />A: 5–6; B: 7–9; C: 10–15 điểm.",
    variables: "Ngưỡng bilirubin có thể khác trong bệnh ứ mật; cần dùng bảng tiêu chuẩn của chuyên ngành gan mật.",
    source: "https://pubmed.ncbi.nlm.nih.gov/?term=Child-Pugh+score+cirrhosis",
    sourceLabel: "Child-Pugh · PubMed",
  },
  timi: {
    title: "TIMI Risk Score · UA/NSTEMI",
    description: "Nguy cơ biến cố tim mạch trong hội chứng vành cấp",
    formula: "7 yếu tố, mỗi yếu tố 1 điểm: tuổi ≥65; ≥3 yếu tố nguy cơ CAD; CAD đã biết ≥50%; dùng aspirin trong 7 ngày; ≥2 cơn đau ngực trong 24 giờ; ST chênh ≥0.5 mm; biomarker tim tăng.",
    variables: "Tổng điểm 0–7; đây là phiên bản TIMI cho UA/NSTEMI, không phải TIMI STEMI.",
    source: "https://pubmed.ncbi.nlm.nih.gov/?term=TIMI+risk+score+unstable+angina+non-ST-segment",
    sourceLabel: "TIMI · PubMed",
  },
  "has-bled": {
    title: "HAS-BLED Score",
    description: "Nguy cơ chảy máu ở bệnh nhân rung nhĩ",
    formula: "H: tăng huyết áp 1; A: bất thường thận 1 + gan 1; S: tiền sử đột quỵ 1; B: chảy máu 1; L: INR không ổn định 1; E: tuổi >65 1; D: thuốc 1 + rượu 1.",
    variables: "Điểm tối đa 9; điểm cao là tín hiệu cần rà soát yếu tố nguy cơ, không tự động chống chỉ định chống đông.",
    source: "https://pubmed.ncbi.nlm.nih.gov/?term=HAS-BLED+score+atrial+fibrillation",
    sourceLabel: "HAS-BLED · PubMed",
  },
  centor: {
    title: "Centor / McIsaac Score",
    description: "Khả năng viêm họng do liên cầu nhóm A",
    formula: "Không ho 1; hạch cổ trước đau 1; sốt 1; amidan xuất tiết/sưng 1; tuổi 3–14 cộng 1; tuổi 15–44 cộng 0; tuổi ≥45 trừ 1.",
    variables: "Điểm dùng để hỗ trợ quyết định xét nghiệm liên cầu, không thay thế thăm khám.",
    source: "https://pubmed.ncbi.nlm.nih.gov/?term=McIsaac+modified+Centor+score",
    sourceLabel: "Centor/McIsaac · PubMed",
  },
  sirs: {
    title: "SIRS Criteria",
    description: "Tiêu chuẩn đáp ứng viêm hệ thống",
    formula: "Nhiệt độ >38°C hoặc <36°C; nhịp tim >90/phút; nhịp thở >20/phút hoặc PaCO₂ <32 mmHg; bạch cầu >12.000 hoặc <4.000/mm<sup>3</sup> hoặc band >10%.<br />SIRS ≥2 tiêu chí.",
    variables: "SIRS không đồng nghĩa với sepsis; cần đánh giá theo định nghĩa và hướng dẫn hiện hành.",
    source: "https://pubmed.ncbi.nlm.nih.gov/?term=ACCP+SCCM+SIRS+criteria+1992",
    sourceLabel: "ACCP/SCCM · PubMed",
  },
  "grace-acs": {
    title: "GRACE ACS Score",
    description: "Nguy cơ tử vong hoặc nhồi máu cơ tim trong ACS",
    formula: "Điểm GRACE là mô hình đa biến gồm: tuổi, nhịp tim, huyết áp tâm thu, creatinine, Killip class, ngừng tim lúc nhập viện, ST chênh và biomarker tim.",
    variables: "Cần dùng bảng điểm/ứng dụng GRACE chuẩn; không nên tự cộng điểm tuyến tính vì mỗi biến có trọng số riêng.",
    source: "https://pubmed.ncbi.nlm.nih.gov/?term=GRACE+score+acute+coronary+syndrome",
    sourceLabel: "GRACE · PubMed",
  },
  "anion-gap": {
    title: "Anion Gap",
    description: "Khoảng trống anion trong huyết thanh",
    formula: "AG = Na<sup>+</sup> − (Cl<sup>−</sup> + HCO<sub>3</sub><sup>−</sup>)<br />AG hiệu chỉnh albumin = AG + 2.5 × (4 − Albumin g/dL).",
    variables: "Có thể dùng công thức không gồm kali; cần thống nhất với labo và đơn vị xét nghiệm.",
    source: "https://pubmed.ncbi.nlm.nih.gov/?term=anion+gap+albumin+correction",
    sourceLabel: "Anion gap · PubMed",
  },
  "psi-port": {
    title: "PSI / PORT Score",
    description: "Tiên lượng viêm phổi mắc phải cộng đồng",
    formula: "PSI cộng điểm theo 20 biến: nhân khẩu học, bệnh đồng mắc, triệu chứng khám, xét nghiệm và X-quang; sau đó phân lớp I–V.",
    variables: "PSI là bảng điểm có trọng số, không phải một phương trình ngắn; cần bảng PORT chuẩn để tránh sai điểm.",
    source: "https://pubmed.ncbi.nlm.nih.gov/?term=Fine+PSI+PORT+score+pneumonia",
    sourceLabel: "PSI/PORT · PubMed",
  },
  "curb-65": {
    title: "CURB-65 Score",
    description: "Đánh giá mức độ nặng viêm phổi cộng đồng",
    formula: "C: lú lẫn 1; U: ure >7 mmol/L 1; R: nhịp thở ≥30 1; B: HA tâm thu <90 hoặc tâm trương ≤60 mmHg 1; 65: tuổi ≥65 1.",
    variables: "Tổng điểm 0–5; diễn giải theo hướng dẫn địa phương và tình trạng lâm sàng.",
    source: "https://pubmed.ncbi.nlm.nih.gov/?term=CURB-65+score+pneumonia",
    sourceLabel: "CURB-65 · PubMed",
  },
  "apache-ii": {
    title: "APACHE II Score",
    description: "Đánh giá mức độ nặng bệnh nhân hồi sức",
    formula: "APACHE II = Acute Physiology Score (12 biến sinh lý) + điểm tuổi + điểm bệnh mạn nặng/suy giảm miễn dịch.",
    variables: "12 biến gồm dấu hiệu sinh tồn, oxygenation, pH động mạch, Na, K, creatinine, hematocrit, WBC và GCS; lấy giá trị xấu nhất trong 24 giờ đầu ICU.",
    source: "https://pubmed.ncbi.nlm.nih.gov/?term=APACHE+II+Knaus+1985",
    sourceLabel: "APACHE II · PubMed",
  },
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

function FormulaPreview({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`formula-preview min-h-14 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xl text-slate-800 ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeFormulaHtml(html) || "Chưa có công thức" }} />;
}

function UnitValueField({ label, value, unit, units, onValueChange, onUnitChange }: { label: string; value: string; unit: string; units: UnitOption[]; onValueChange: (value: string) => void; onUnitChange: (unit: string) => void }) {
  return <label className="block min-w-0 text-sm font-bold text-slate-700">
    {label}
    <div className="mt-1.5 flex h-11 min-w-0 overflow-visible rounded-xl border border-slate-200 bg-white focus-within:border-teal-400">
      <input type="number" inputMode="decimal" min="0" step="any" value={value} onChange={(event) => onValueChange(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent px-3 py-0 text-base font-semibold outline-none" placeholder="Nhập giá trị" />
      <AnimatedDropdown compact value={unit} options={units.map((option) => ({ value: option.id, label: option.label }))} onChange={onUnitChange} />
    </div>
  </label>;
}

function AnimatedDropdown({ label, value, options, onChange, compact = false }: { label?: string; value: string; options: Array<{ value: string; label: string; description?: string }>; onChange: (value: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div ref={dropdownRef} className={`relative min-w-0 ${compact ? "h-full w-24 shrink-0" : "w-full"}`}>
    {label && <span className="block text-sm font-bold text-slate-700">{label}</span>}
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`medical-dropdown__trigger medical-select flex items-center justify-between gap-2 text-left text-sm font-bold outline-none ${compact ? "h-full w-full rounded-none border-0 border-l border-slate-200 bg-slate-50 px-2 text-teal-700" : "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-700"} ${open ? "medical-dropdown__trigger--open" : ""}`}>
      <span className="truncate">{selectedOption?.label}</span>
      <ChevronDown size={17} className={`shrink-0 text-teal-700 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div className={`medical-dropdown__menu absolute top-full z-40 mt-2 overflow-hidden rounded-xl border border-teal-100 bg-white p-1.5 shadow-[0_16px_35px_rgba(15,118,110,.18)] ${compact ? "right-0 min-w-44" : "left-0 right-0"}`} role="listbox" aria-label={label || "Chọn đơn vị"}>
      {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }} className={`medical-dropdown__option flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${option.value === value ? "medical-dropdown__option--selected" : "text-slate-600 hover:bg-teal-50 hover:text-teal-800"}`}><span className="min-w-0"><strong className="block truncate">{option.label}</strong>{option.description && <small className="mt-0.5 block truncate text-xs font-semibold text-slate-400">{option.description}</small>}</span>{option.value === value && <Check size={16} className="shrink-0" />}</button>)}
    </div>}
  </div>;
}

function CalculatorSearch({ options, onSelect }: { options: Array<{ id: CalculatorType; label: string; description: string; interactive?: boolean }>; onSelect: (option: { id: CalculatorType; label: string; description: string; interactive?: boolean }) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const filteredOptions = options.filter((option) => `${option.label} ${option.description}`.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (!searchRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [open]);

  return <div ref={searchRef} className="relative mt-4">
    <div className={`medical-search__control flex h-11 items-center gap-2 rounded-xl border bg-white px-3 ${open ? "medical-search__control--open" : "border-slate-200"}`}>
      <Search size={17} className="shrink-0 text-teal-600" />
      <input value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" placeholder="Tìm công cụ: BMI, eGFR, CrCl..." aria-label="Tìm công cụ y khoa" />
      {query && <button type="button" title="Xóa tìm kiếm" onClick={() => { setQuery(""); setOpen(true); }} className="rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><X size={15} /></button>}
    </div>
    {open && <div className="medical-search__menu absolute left-0 right-0 top-full z-40 mt-2 rounded-2xl border border-teal-100 bg-white p-2 shadow-[0_18px_40px_rgba(15,118,110,.16)]" role="listbox" aria-label="Công cụ y khoa">
      {filteredOptions.length > 0 ? filteredOptions.map((option) => <button key={option.id} type="button" role="option" onClick={() => { onSelect(option); setQuery(option.label); setOpen(false); }} className="medical-search__option flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-teal-50"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Calculator size={16} /></span><span><strong className="block text-sm font-extrabold text-slate-700">{option.label}</strong><small className="block text-xs font-semibold text-slate-400">{option.description}</small></span></button>) : <p className="px-3 py-3 text-sm font-semibold text-slate-500">Không tìm thấy công cụ phù hợp.</p>}
    </div>}
  </div>;
}

function ReferenceChoiceField({ field, value, onChange }: { field: ReferenceField; value: string; onChange: (value: string) => void }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3">
    <p className="text-sm font-bold text-slate-700">{field.label}</p>
    <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-1.5" role="group" aria-label={field.label}>
      {field.options?.map((option) => <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)} className={`min-h-10 rounded-lg border px-2 py-2 text-xs font-extrabold transition ${option.value === value ? "border-teal-600 bg-teal-500 text-white shadow-sm" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"}`}>{option.label}</button>)}
    </div>
  </div>;
}

function CalculatorFormulaReference({ calculatorType, egfrFormula, crclFormula }: { calculatorType: CalculatorType; egfrFormula: EgfrFormula; crclFormula: CrclFormula }) {
  let title = "BMI · Body Mass Index";
  let description = "Chỉ số khối cơ thể";
  let formula = "BMI = Cân nặng (kg) / [Chiều cao (m)]<sup>2</sup>";
  let variables = "Cân nặng đổi về kg; chiều cao đổi về mét.";
  let source = formulaSources.niddk;
  let sourceLabel = "NIDDK · công cụ lâm sàng";
  const additionalReference = referenceOnlyFormulaDefinitions[calculatorType];

  if (additionalReference) {
    title = additionalReference.title;
    description = additionalReference.description;
    formula = additionalReference.formula;
    variables = additionalReference.variables;
    source = additionalReference.source;
    sourceLabel = additionalReference.sourceLabel;
  } else if (calculatorType === "egfr") {
    if (egfrFormula === "cystatin") {
      title = "CKD-EPI Cystatin C 2012";
      description = "Độ lọc cầu thận ước tính theo cystatin C";
      formula = "eGFR = 133 × min(Scys/0.8, 1)<sup>-0.499</sup> × max(Scys/0.8, 1)<sup>-1.328</sup> × 0.996<sup>Tuổi</sup> × (0.932 nếu nữ)";
      variables = "Scys: cystatin C (mg/L). Kết quả: mL/min/1,73 m².";
    } else if (egfrFormula === "combined") {
      title = "CKD-EPI Creatinine-Cystatin C 2012";
      description = "Độ lọc cầu thận ước tính theo creatinine và cystatin C";
      formula = "eGFR = 135 × min(Scr/κ, 1)<sup>α</sup> × max(Scr/κ, 1)<sup>-0.601</sup> × min(Scys/0.8, 1)<sup>-0.375</sup> × max(Scys/0.8, 1)<sup>-0.711</sup> × 0.995<sup>Tuổi</sup> × (0.969 nếu nữ)";
      variables = "Scr: creatinine mg/dL; Scys: cystatin C mg/L; κ=0.9 nam/0.7 nữ; α=-0.207 nam/-0.248 nữ.";
    } else if (egfrFormula === "mdrd") {
      title = "MDRD · Modification of Diet in Renal Disease";
      description = "Độ lọc cầu thận ước tính theo MDRD 4 biến";
      formula = "eGFR = 175 × Scr<sup>-1.154</sup> × Tuổi<sup>-0.203</sup> × (0.742 nếu nữ)";
      variables = "Scr: creatinine mg/dL. Kết quả: mL/min/1,73 m².";
    } else {
      title = "CKD-EPI Creatinine 2021";
      description = "Độ lọc cầu thận ước tính theo creatinine";
      formula = "eGFR = 142 × min(Scr/κ, 1)<sup>α</sup> × max(Scr/κ, 1)<sup>-1.200</sup> × 0.9938<sup>Tuổi</sup> × (1.012 nếu nữ)";
      variables = "Scr: creatinine mg/dL; κ=0.9 nam/0.7 nữ; α=-0.302 nam/-0.241 nữ. Kết quả: mL/min/1,73 m².";
    }
    sourceLabel = "NIDDK · CKD-EPI & MDRD";
  } else if (calculatorType === "crcl") {
    if (crclFormula === "adjusted-weight") {
      title = "Cockcroft-Gault · Adjusted Body Weight";
      description = "Độ thanh thải creatinine với cân nặng hiệu chỉnh";
      formula = "CrCl = [(140 − Tuổi) × W / (72 × Scr)] × (0.85 nếu nữ)<br>AdjBW = IBW + 0.4 × (TBW − IBW)";
      variables = "IBW nam=50+2.3×(inch−60); IBW nữ=45.5+2.3×(inch−60); Scr: mg/dL.";
    } else if (crclFormula === "bsa-normalized") {
      title = "Creatinine Clearance · BSA-normalized";
      description = "Độ thanh thải creatinine chuẩn hóa theo diện tích da";
      formula = "CrCl<sub>1.73</sub> = CrCl × 1.73 / BSA<br>BSA = √[(Chiều cao cm × Cân nặng kg) / 3600]";
      variables = "Kết quả: mL/min/1,73 m²; dùng để chuẩn hóa so sánh, không thay thế CrCl dùng chỉnh liều.";
    } else {
      title = "Cockcroft-Gault · Creatinine Clearance";
      description = "Độ thanh thải creatinine";
      formula = "CrCl = [(140 − Tuổi) × Cân nặng / (72 × Scr)] × (0.85 nếu nữ)";
      variables = "Cân nặng kg; Scr: creatinine mg/dL. Kết quả: mL/min.";
    }
    source = formulaSources.cockcroftGault;
    sourceLabel = "Cockcroft-Gault · PubMed";
  } else if (calculatorType === "holliday-segar") {
    title = "Holliday-Segar · Maintenance Fluid";
    description = "Dịch duy trì theo cân nặng";
    formula = "Theo giờ: 4 mL/kg cho 10 kg đầu + 2 mL/kg cho 10 kg tiếp theo + 1 mL/kg cho phần còn lại<br>Theo ngày: 100 mL/kg cho 10 kg đầu + 50 mL/kg cho 10 kg tiếp theo + 20 mL/kg cho phần còn lại";
    variables = "Dùng để ước tính dịch duy trì ban đầu; cần điều chỉnh theo bệnh cảnh.";
    source = formulaSources.hollidaySegar;
    sourceLabel = "Holliday-Segar · PubMed";
  }

  let parameterContent = <p className="formula-evidence__variables"><strong>Biến số:</strong> {variables}</p>;
  if (calculatorType === "egfr" && egfrFormula === "creatinine") {
    parameterContent = <table className="formula-evidence__table"><thead><tr><th></th><th>Nữ</th><th>Nam</th></tr></thead><tbody><tr><th>Scr ≤ κ</th><td>A = 0.7<br />B = −0.241</td><td>A = 0.9<br />B = −0.302</td></tr><tr><th>Scr &gt; κ</th><td>A = 0.7<br />B = −1.2</td><td>A = 0.9<br />B = −1.2</td></tr></tbody></table>;
  } else if (calculatorType === "egfr" && egfrFormula === "combined") {
    parameterContent = <div className="formula-evidence__split"><div><h4>Nữ</h4><p>κ = 0.7<br />α = −0.248<br />C = 0.8<br />D = −0.711</p></div><div><h4>Nam</h4><p>κ = 0.9<br />α = −0.207<br />C = 0.8<br />D = −0.711</p></div></div>;
  }

  return <div className="formula-evidence mt-5 rounded-2xl border border-white bg-white/85 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="formula-evidence__eyebrow">Formula</p><h3 className="mt-1 text-2xl font-black text-slate-700">{title}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{description}</p></div><a href={source} target="_blank" rel="noreferrer" className="text-xs font-extrabold text-teal-700 underline hover:text-teal-900">{sourceLabel}</a></div>
    <div className="mt-5"><FormulaPreview html={formula} className="formula-evidence__equation" /></div>
    <div className="mt-5">{parameterContent}</div>
  </div>;
}

type ReferenceField = { key: string; label: string; placeholder?: string; options?: Array<{ value: string; label: string }> };
type ReferenceInputValues = Record<string, string>;
const binaryScoreOptions = [{ value: "0", label: "Không · 0 điểm" }, { value: "1", label: "Có · 1 điểm" }];
const referenceCalculatorFields: Partial<Record<CalculatorType, ReferenceField[]>> = {
  bsa: [{ key: "heightCm", label: "Chiều cao (cm)" }, { key: "weightKg", label: "Cân nặng (kg)" }],
  "wells-pe": [
    { key: "dvt", label: "Dấu hiệu lâm sàng DVT", options: [{ value: "0", label: "Không · 0" }, { value: "3", label: "Có · 3" }] },
    { key: "peLikely", label: "PE là chẩn đoán có khả năng nhất", options: [{ value: "0", label: "Không · 0" }, { value: "3", label: "Có · 3" }] },
    { key: "heartRate", label: "Nhịp tim >100/phút", options: [{ value: "0", label: "Không · 0" }, { value: "1.5", label: "Có · 1,5" }] },
    { key: "immobilization", label: "Bất động/phẫu thuật trong 4 tuần", options: [{ value: "0", label: "Không · 0" }, { value: "1.5", label: "Có · 1,5" }] },
    { key: "historyVte", label: "Tiền sử DVT/PE", options: [{ value: "0", label: "Không · 0" }, { value: "1.5", label: "Có · 1,5" }] },
    { key: "hemoptysis", label: "Ho ra máu", options: [{ value: "0", label: "Không · 0" }, { value: "1", label: "Có · 1" }] },
    { key: "cancer", label: "Ung thư đang điều trị", options: [{ value: "0", label: "Không · 0" }, { value: "1", label: "Có · 1" }] },
  ],
  "cha2ds2-vasc": [
    { key: "chf", label: "Suy tim", options: binaryScoreOptions }, { key: "hypertension", label: "Tăng huyết áp", options: binaryScoreOptions },
    { key: "age75", label: "Tuổi ≥75", options: [{ value: "0", label: "Không · 0" }, { value: "2", label: "Có · 2" }] }, { key: "diabetes", label: "Đái tháo đường", options: binaryScoreOptions },
    { key: "stroke", label: "Đột quỵ/TIA/thuyên tắc", options: [{ value: "0", label: "Không · 0" }, { value: "2", label: "Có · 2" }] }, { key: "vascular", label: "Bệnh mạch máu", options: binaryScoreOptions },
    { key: "age65", label: "Tuổi 65–74", options: binaryScoreOptions }, { key: "female", label: "Giới nữ", options: binaryScoreOptions },
  ],
  "child-pugh": [
    { key: "bilirubin", label: "Bilirubin", options: [{ value: "1", label: "<2 mg/dL · 1" }, { value: "2", label: "2–3 mg/dL · 2" }, { value: "3", label: ">3 mg/dL · 3" }] },
    { key: "albumin", label: "Albumin", options: [{ value: "1", label: ">3,5 g/dL · 1" }, { value: "2", label: "2,8–3,5 g/dL · 2" }, { value: "3", label: "<2,8 g/dL · 3" }] },
    { key: "inr", label: "INR / thời gian prothrombin", options: [{ value: "1", label: "INR <1,7 · 1" }, { value: "2", label: "INR 1,7–2,3 · 2" }, { value: "3", label: "INR >2,3 · 3" }] },
    { key: "ascites", label: "Cổ trướng", options: [{ value: "1", label: "Không · 1" }, { value: "2", label: "Nhẹ/kiểm soát · 2" }, { value: "3", label: "Vừa-nặng/khó kiểm soát · 3" }] },
    { key: "encephalopathy", label: "Bệnh não gan", options: [{ value: "1", label: "Không · 1" }, { value: "2", label: "Độ I–II · 2" }, { value: "3", label: "Độ III–IV · 3" }] },
  ],
  timi: ["age65", "riskFactors", "knownCad", "aspirin", "angina", "stDeviation", "biomarker"].map((key, index) => ({ key, label: ["Tuổi ≥65", "≥3 yếu tố nguy cơ CAD", "CAD đã biết ≥50%", "Dùng aspirin trong 7 ngày", "≥2 cơn đau ngực trong 24 giờ", "ST chênh ≥0,5 mm", "Biomarker tim tăng"][index], options: binaryScoreOptions })),
  "has-bled": ["hypertension", "renal", "liver", "stroke", "bleeding", "labileInr", "age65", "drugs", "alcohol"].map((key, index) => ({ key, label: ["Tăng huyết áp", "Bất thường thận", "Bất thường gan", "Tiền sử đột quỵ", "Tiền sử chảy máu", "INR không ổn định", "Tuổi >65", "Thuốc làm tăng nguy cơ chảy máu", "Rượu"][index], options: binaryScoreOptions })),
  centor: ["noCough", "tenderNodes", "fever", "exudate"].map((key, index) => ({ key, label: ["Không ho", "Hạch cổ trước đau", "Sốt", "Amidan xuất tiết/sưng"][index], options: binaryScoreOptions })).concat([{ key: "ageAdjustment", label: "Điều chỉnh theo tuổi", options: [{ value: "-1", label: "≥45 tuổi · −1" }, { value: "0", label: "15–44 tuổi · 0" }, { value: "1", label: "3–14 tuổi · +1" }] }]),
  sirs: ["temperature", "heartRate", "respiratoryRate", "whiteBloodCell"].map((key, index) => ({ key, label: ["Nhiệt độ bất thường", "Nhịp tim >90/phút", "Nhịp thở/PaCO₂ bất thường", "Bạch cầu/band bất thường"][index], options: binaryScoreOptions })),
  "anion-gap": [{ key: "sodium", label: "Na⁺ (mmol/L)" }, { key: "chloride", label: "Cl⁻ (mmol/L)" }, { key: "bicarbonate", label: "HCO₃⁻ (mmol/L)" }, { key: "albumin", label: "Albumin (g/dL)", placeholder: "Không bắt buộc" }],
  "curb-65": ["confusion", "urea", "respiratoryRate", "bloodPressure", "age65"].map((key, index) => ({ key, label: ["Lú lẫn mới xuất hiện", "Ure >7 mmol/L", "Nhịp thở ≥30/phút", "HA tâm thu <90 hoặc tâm trương ≤60", "Tuổi ≥65"][index], options: binaryScoreOptions })),
  "grace-acs": [
    { key: "age", label: "Tuổi (năm)" }, { key: "heartRate", label: "Nhịp tim (lần/phút)" }, { key: "systolicBp", label: "Huyết áp tâm thu (mmHg)" }, { key: "creatinine", label: "Creatinine (mg/dL)" },
    { key: "killip", label: "Killip", options: [{ value: "0", label: "I · 0" }, { value: "20", label: "II · 20" }, { value: "39", label: "III · 39" }, { value: "59", label: "IV · 59" }] },
    { key: "cardiacArrest", label: "Ngừng tim lúc nhập viện", options: [{ value: "0", label: "Không · 0" }, { value: "39", label: "Có · 39" }] }, { key: "stDeviation", label: "ST chênh lệch", options: [{ value: "0", label: "Không · 0" }, { value: "28", label: "Có · 28" }] }, { key: "enzymes", label: "Biomarker tim tăng", options: [{ value: "0", label: "Không · 0" }, { value: "14", label: "Có · 14" }] },
  ],
  "psi-port": [
    { key: "age", label: "Tuổi (nam) / tuổi −10 (nữ)" }, { key: "nursingHome", label: "Sống tại viện dưỡng lão", options: [{ value: "0", label: "Không · 0" }, { value: "10", label: "Có · 10" }] },
    { key: "neoplastic", label: "Bệnh tân sinh", options: [{ value: "0", label: "Không · 0" }, { value: "30", label: "Có · 30" }] }, { key: "liver", label: "Bệnh gan", options: [{ value: "0", label: "Không · 0" }, { value: "20", label: "Có · 20" }] }, { key: "chf", label: "Suy tim", options: [{ value: "0", label: "Không · 0" }, { value: "10", label: "Có · 10" }] }, { key: "cerebrovascular", label: "Bệnh mạch máu não", options: [{ value: "0", label: "Không · 0" }, { value: "10", label: "Có · 10" }] }, { key: "renal", label: "Bệnh thận", options: [{ value: "0", label: "Không · 0" }, { value: "10", label: "Có · 10" }] },
    { key: "confusion", label: "Lú lẫn", options: [{ value: "0", label: "Không · 0" }, { value: "20", label: "Có · 20" }] }, { key: "respiratoryRate", label: "Nhịp thở ≥30/phút", options: [{ value: "0", label: "Không · 0" }, { value: "20", label: "Có · 20" }] }, { key: "systolicBp", label: "HA tâm thu <90 mmHg", options: [{ value: "0", label: "Không · 0" }, { value: "20", label: "Có · 20" }] }, { key: "temperature", label: "Nhiệt độ <35 hoặc ≥40°C", options: [{ value: "0", label: "Không · 0" }, { value: "15", label: "Có · 15" }] }, { key: "pulse", label: "Mạch ≥125/phút", options: [{ value: "0", label: "Không · 0" }, { value: "10", label: "Có · 10" }] },
    { key: "ph", label: "pH động mạch <7,35", options: [{ value: "0", label: "Không · 0" }, { value: "30", label: "Có · 30" }] }, { key: "bun", label: "BUN ≥30 mg/dL", options: [{ value: "0", label: "Không · 0" }, { value: "20", label: "Có · 20" }] }, { key: "sodium", label: "Na⁺ <130 mmol/L", options: [{ value: "0", label: "Không · 0" }, { value: "20", label: "Có · 20" }] }, { key: "glucose", label: "Glucose ≥250 mg/dL", options: [{ value: "0", label: "Không · 0" }, { value: "10", label: "Có · 10" }] }, { key: "hematocrit", label: "Hematocrit <30%", options: [{ value: "0", label: "Không · 0" }, { value: "10", label: "Có · 10" }] }, { key: "oxygenation", label: "PaO₂ <60 hoặc SpO₂ <90%", options: [{ value: "0", label: "Không · 0" }, { value: "10", label: "Có · 10" }] }, { key: "pleuralEffusion", label: "Tràn dịch màng phổi", options: [{ value: "0", label: "Không · 0" }, { value: "10", label: "Có · 10" }] },
  ],
  "apache-ii": [
    { key: "temperature", label: "Nhiệt độ (°C)" }, { key: "meanArterialPressure", label: "MAP (mmHg)" }, { key: "heartRate", label: "Nhịp tim (lần/phút)" }, { key: "respiratoryRate", label: "Nhịp thở (lần/phút)" }, { key: "oxygenation", label: "PaO₂ (mmHg; FiO₂ <0,5)" }, { key: "arterialPh", label: "pH động mạch" }, { key: "sodium", label: "Na⁺ (mmol/L)" }, { key: "potassium", label: "K⁺ (mmol/L)" }, { key: "creatinine", label: "Creatinine (mg/dL)" }, { key: "hematocrit", label: "Hematocrit (%)" }, { key: "whiteBloodCell", label: "Bạch cầu (×10³/mm³)" }, { key: "gcs", label: "GCS (3–15)" }, { key: "age", label: "Tuổi (năm)" }, { key: "chronicHealth", label: "Bệnh mạn nặng/suy giảm miễn dịch", options: [{ value: "0", label: "Không · 0" }, { value: "2", label: "Mổ chương trình · 2" }, { value: "5", label: "Mổ cấp cứu/không mổ · 5" }] },
  ],
};

function ReferenceCalculatorPanel({ calculatorType, values, onChange }: { calculatorType: CalculatorType; values: ReferenceInputValues; onChange: (key: string, value: string) => void }) {
  const fields = referenceCalculatorFields[calculatorType] || [];
  const read = (key: string) => values[key] === undefined || values[key] === "" ? null : Number(values[key]);
  const allFilled = fields.every((field) => read(field.key) !== null && Number.isFinite(read(field.key)));
  const rangeScore = (value: number, rules: Array<{ min?: number; max?: number; score: number }>) => rules.find((rule) => value >= (rule.min ?? -Infinity) && value <= (rule.max ?? Infinity))?.score ?? 0;
  let result: number | null = null;
  let resultLabel = "Kết quả";
  let resultUnit = "";
  let interpretation = "Nhập đủ dữ liệu để tính.";
  if (calculatorType === "bsa" && allFilled) {
    result = Math.sqrt((read("heightCm")! * read("weightKg")!) / 3600);
    resultLabel = "BSA · Body Surface Area";
    resultUnit = "m²";
  } else if (["wells-pe", "cha2ds2-vasc", "child-pugh", "timi", "has-bled", "centor", "sirs", "curb-65"].includes(calculatorType) && allFilled) {
    result = fields.reduce((total, field) => total + (read(field.key) || 0), 0);
    resultLabel = calculatorType === "child-pugh" ? "Child-Pugh Score" : calculatorOptions.find((option) => option.id === calculatorType)?.label || "Tổng điểm";
    if (calculatorType === "child-pugh") interpretation = result <= 6 ? "Child-Pugh A · 5–6 điểm" : result <= 9 ? "Child-Pugh B · 7–9 điểm" : "Child-Pugh C · 10–15 điểm";
    else if (calculatorType === "sirs") interpretation = result >= 2 ? "Đạt ≥2 tiêu chí SIRS" : "Chưa đạt 2 tiêu chí SIRS";
    else interpretation = "Cần đối chiếu ngưỡng diễn giải theo hướng dẫn tương ứng.";
  } else if (calculatorType === "anion-gap" && read("sodium") !== null && read("chloride") !== null && read("bicarbonate") !== null) {
    result = read("sodium")! - read("chloride")! - read("bicarbonate")!;
    resultLabel = "Anion Gap";
    resultUnit = "mmol/L";
    const albumin = read("albumin");
    interpretation = albumin !== null ? `AG hiệu chỉnh albumin: ${(result + 2.5 * (4 - albumin)).toFixed(1)} mmol/L` : "AG không gồm kali; có thể nhập albumin để hiệu chỉnh.";
  } else if (calculatorType === "grace-acs" && allFilled) {
    const ageScore = rangeScore(read("age")!, [{ max: 29, score: 0 }, { min: 30, max: 39, score: 8 }, { min: 40, max: 49, score: 25 }, { min: 50, max: 59, score: 41 }, { min: 60, max: 69, score: 58 }, { min: 70, max: 79, score: 75 }, { min: 80, score: 91 }]);
    const heartRateScore = rangeScore(read("heartRate")!, [{ max: 69, score: 0 }, { min: 70, max: 89, score: 3 }, { min: 90, max: 109, score: 9 }, { min: 110, max: 149, score: 15 }, { min: 150, max: 199, score: 24 }, { min: 200, score: 38 }]);
    const bloodPressureScore = rangeScore(read("systolicBp")!, [{ max: 79, score: 63 }, { min: 80, max: 99, score: 58 }, { min: 100, max: 119, score: 47 }, { min: 120, max: 139, score: 37 }, { min: 140, max: 159, score: 26 }, { min: 160, max: 199, score: 11 }, { min: 200, score: 0 }]);
    const creatinineScore = rangeScore(read("creatinine")!, [{ max: 0.39, score: 1 }, { min: 0.4, max: 0.79, score: 4 }, { min: 0.8, max: 1.19, score: 7 }, { min: 1.2, max: 1.59, score: 10 }, { min: 1.6, max: 1.99, score: 13 }, { min: 2, max: 3.99, score: 21 }, { min: 4, score: 28 }]);
    result = ageScore + heartRateScore + bloodPressureScore + creatinineScore + (read("killip") || 0) + (read("cardiacArrest") || 0) + (read("stDeviation") || 0) + (read("enzymes") || 0);
    resultLabel = "GRACE ACS Score";
    interpretation = "Đối chiếu phân tầng nguy cơ GRACE và bối cảnh lâm sàng; đây là bản tính điểm GRACE gốc.";
  } else if (calculatorType === "psi-port" && allFilled) {
    result = fields.reduce((total, field) => total + (read(field.key) || 0), 0);
    resultLabel = "PSI / PORT Score";
    interpretation = result <= 70 ? "Class II · nguy cơ thấp" : result <= 90 ? "Class III · nguy cơ thấp–trung bình" : result <= 130 ? "Class IV · nguy cơ trung bình–cao" : "Class V · nguy cơ cao";
  } else if (calculatorType === "apache-ii" && allFilled) {
    const temperatureScore = rangeScore(read("temperature")!, [{ min: 41, score: 4 }, { min: 39, max: 40.9, score: 3 }, { min: 38.5, max: 38.9, score: 1 }, { min: 36, max: 38.4, score: 0 }, { min: 34, max: 35.9, score: 1 }, { min: 32, max: 33.9, score: 2 }, { min: 30, max: 31.9, score: 3 }, { max: 29.9, score: 4 }]);
    const mapScore = rangeScore(read("meanArterialPressure")!, [{ min: 160, score: 4 }, { min: 130, max: 159, score: 3 }, { min: 110, max: 129, score: 2 }, { min: 70, max: 109, score: 0 }, { min: 50, max: 69, score: 2 }, { max: 49, score: 4 }]);
    const heartRateScore = rangeScore(read("heartRate")!, [{ min: 180, score: 4 }, { min: 140, max: 179, score: 3 }, { min: 110, max: 139, score: 2 }, { min: 70, max: 109, score: 0 }, { min: 55, max: 69, score: 2 }, { min: 40, max: 54, score: 3 }, { max: 39, score: 4 }]);
    const respiratoryScore = rangeScore(read("respiratoryRate")!, [{ min: 50, score: 3 }, { min: 35, max: 49, score: 1 }, { min: 25, max: 34, score: 0 }, { min: 12, max: 24, score: 0 }, { min: 10, max: 11, score: 1 }, { min: 6, max: 9, score: 2 }, { max: 5, score: 4 }]);
    const oxygenationScore = rangeScore(read("oxygenation")!, [{ min: 70, score: 0 }, { min: 61, max: 69, score: 1 }, { min: 55, max: 60, score: 3 }, { max: 54, score: 3 }]);
    const phScore = rangeScore(read("arterialPh")!, [{ min: 7.7, score: 4 }, { min: 7.6, max: 7.69, score: 3 }, { min: 7.5, max: 7.59, score: 1 }, { min: 7.33, max: 7.49, score: 0 }, { min: 7.25, max: 7.32, score: 2 }, { min: 7.15, max: 7.24, score: 3 }, { max: 7.14, score: 4 }]);
    const sodiumScore = rangeScore(read("sodium")!, [{ min: 180, score: 4 }, { min: 160, max: 179, score: 3 }, { min: 155, max: 159, score: 1 }, { min: 130, max: 154, score: 0 }, { min: 120, max: 129, score: 2 }, { min: 111, max: 119, score: 3 }, { max: 110, score: 4 }]);
    const potassiumScore = rangeScore(read("potassium")!, [{ min: 7, score: 4 }, { min: 6, max: 6.9, score: 3 }, { min: 5.5, max: 5.9, score: 1 }, { min: 3.5, max: 5.4, score: 0 }, { min: 3, max: 3.4, score: 1 }, { min: 2.5, max: 2.9, score: 2 }, { max: 2.49, score: 4 }]);
    const creatinineScore = rangeScore(read("creatinine")!, [{ min: 3.5, score: 4 }, { min: 2, max: 3.49, score: 3 }, { min: 1.5, max: 1.99, score: 2 }, { min: 0.6, max: 1.49, score: 0 }, { max: 0.59, score: 2 }]);
    const hematocritScore = rangeScore(read("hematocrit")!, [{ min: 60, score: 4 }, { min: 50, max: 59.9, score: 2 }, { min: 46, max: 49.9, score: 1 }, { min: 30, max: 45.9, score: 0 }, { min: 20, max: 29.9, score: 2 }, { max: 19.9, score: 4 }]);
    const whiteCellScore = rangeScore(read("whiteBloodCell")!, [{ min: 40, score: 4 }, { min: 20, max: 39.9, score: 1 }, { min: 15, max: 19.9, score: 1 }, { min: 3, max: 14.9, score: 0 }, { min: 1, max: 2.9, score: 2 }, { max: 0.99, score: 4 }]);
    result = temperatureScore + mapScore + heartRateScore + respiratoryScore + oxygenationScore + phScore + sodiumScore + potassiumScore + creatinineScore + hematocritScore + whiteCellScore + (15 - read("gcs")!) + rangeScore(read("age")!, [{ min: 75, score: 6 }, { min: 65, max: 74, score: 5 }, { min: 55, max: 64, score: 3 }, { min: 45, max: 54, score: 2 }, { max: 44, score: 0 }]) + (read("chronicHealth") || 0);
    resultLabel = "APACHE II Score";
    interpretation = "Lấy giá trị xấu nhất trong 24 giờ đầu ICU; cần bác sĩ hồi sức đối chiếu bảng chuẩn.";
  }

  return <div className="mt-5 rounded-2xl border border-white bg-white/85 p-4 sm:p-5">
    <div><p className="text-sm font-extrabold text-slate-700">Nhập dữ liệu</p><p className="mt-1 text-xs font-semibold text-slate-500">Không có giá trị mặc định. Chọn hoặc nhập từng tiêu chí để xem kết quả.</p></div>
    {fields.length > 0 ? <div className="mt-4 grid gap-3">{fields.map((field) => field.options ? <ReferenceChoiceField key={field.key} field={field} value={values[field.key] || ""} onChange={(value) => onChange(field.key, value)} /> : <label key={field.key} className="block min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700">{field.label}<input type="number" inputMode="decimal" step="any" value={values[field.key] || ""} onChange={(event) => onChange(field.key, event.target.value)} placeholder={field.placeholder || "Nhập giá trị"} className="medical-value-input mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-teal-400" /></label>)}</div> : <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-3 text-sm font-semibold text-amber-800">Công thức này cần bảng điểm chuẩn để tính chính xác. Bạn có thể tra cứu công thức ở tab bên cạnh.</p>}
    <div className="mt-5 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-teal-100 bg-teal-50/60 p-4"><div><p className="text-sm font-bold text-slate-500">{resultLabel}</p><p className="mt-1 text-4xl font-black text-teal-800">{result === null ? "—" : result.toFixed(1)} {resultUnit && <span className="text-base font-extrabold">{resultUnit}</span>}</p></div><p className="max-w-xl text-sm font-semibold leading-6 text-slate-600">{interpretation}</p></div>
  </div>;
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
  const [calculatorPanelTab, setCalculatorPanelTab] = useState<"calculator" | "formula">("calculator");
  const [referenceInputs, setReferenceInputs] = useState<ReferenceInputValues>({});
  const [egfrFormula, setEgfrFormula] = useState<EgfrFormula>("creatinine");
  const [crclFormula, setCrclFormula] = useState<CrclFormula>("standard");
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
  const heightInches = heightM > 0 && Number.isFinite(heightM) ? heightM / 0.0254 : null;
  const idealWeightKg = heightInches !== null ? (sex === "female" ? 45.5 : 50) + 2.3 * (heightInches - 60) : null;
  const adjustedWeightKg = idealWeightKg !== null && idealWeightKg > 0 && weightKg > 0
    ? weightKg < idealWeightKg ? weightKg : weightKg <= idealWeightKg * 1.2 ? idealWeightKg : idealWeightKg + 0.4 * (weightKg - idealWeightKg)
    : null;
  const crclWeightKg = crclFormula === "adjusted-weight" ? adjustedWeightKg : weightKg;
  const crclRaw = ageYears > 0 && ageYears < 140 && Number.isFinite(ageYears) && crclWeightKg !== null && crclWeightKg > 0 && creatinineMgDl > 0 && Number.isFinite(creatinineMgDl)
    ? ((140 - ageYears) * crclWeightKg) / (72 * creatinineMgDl) * (sex === "female" ? 0.85 : 1)
    : null;
  const bodySurfaceArea = heightM > 0 && Number.isFinite(heightM) && weightKg > 0 ? Math.sqrt((heightM * 100 * weightKg) / 3600) : null;
  const crcl = crclRaw !== null && crclFormula === "bsa-normalized" && bodySurfaceArea !== null && bodySurfaceArea > 0 ? crclRaw * (1.73 / bodySurfaceArea) : crclRaw;
  const crclLabel = crclFormula === "adjusted-weight" ? "CrCl · Cockcroft-Gault + AdjBW" : crclFormula === "bsa-normalized" ? "CrCl · chuẩn hóa BSA" : "CrCl · Cockcroft-Gault";
  const crclUnitLabel = crclFormula === "bsa-normalized" ? "mL/min/1,73 m²" : "mL/min";
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
    <div className="glass-panel reference-tools-panel border border-violet-100 bg-white/75 p-5 sm:p-7">
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

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{toolGroups.map(({ id, title, description, icon: Icon, className }) => <div key={id} role="button" tabIndex={0} onClick={() => openToolCreator(id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openToolCreator(id); } }} className={`relative flex min-h-0 cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${className} ${((id === "calculator" && activeTool === "calculator") || (id === "data-table" && activeTool === "data-table") || (id === "scores" && activeTool === "score")) ? "ring-2 ring-teal-300" : ""}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80"><Icon size={19} /></span><span className="min-w-0"><strong className="block text-sm font-extrabold leading-5 text-slate-800">{title}</strong><small className="mt-0.5 block text-xs font-semibold leading-4 text-slate-500">{description}</small></span></div>)}</div>
      <CalculatorSearch options={calculatorOptions} onSelect={(option) => { setCalculatorType(option.id); setCalculatorPanelTab(option.interactive === false ? "formula" : "calculator"); setActiveTool("calculator"); }} />

      {activeTool === "calculator" && <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/35 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-teal-700">Máy tính y khoa</p></div>
        </div>
        <div className="medical-panel-tabs mt-4 flex w-full gap-1 rounded-xl border border-teal-100 bg-white/70 p-1" role="tablist" aria-label="Nội dung công cụ"><button type="button" role="tab" aria-selected={calculatorPanelTab === "calculator"} onClick={() => setCalculatorPanelTab("calculator")} className={`medical-panel-tab flex-1 rounded-lg px-3 py-2 text-sm font-extrabold transition ${calculatorPanelTab === "calculator" ? "medical-panel-tab--active" : "text-slate-500 hover:bg-teal-50 hover:text-teal-700"}`}>Máy tính</button><button type="button" role="tab" aria-selected={calculatorPanelTab === "formula"} onClick={() => setCalculatorPanelTab("formula")} className={`medical-panel-tab flex-1 rounded-lg px-3 py-2 text-sm font-extrabold transition ${calculatorPanelTab === "formula" ? "medical-panel-tab--active" : "text-slate-500 hover:bg-teal-50 hover:text-teal-700"}`}>Công thức</button></div>
        {calculatorPanelTab === "calculator" && <div>
        {!interactiveCalculatorTypes.includes(calculatorType) && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm font-semibold text-amber-800">Công thức này hiện đang ở chế độ tra cứu. Mở tab <strong>Công thức</strong> để xem phương trình và các biến số.</div>}
        {calculatorType === "bmi" && <div className="mt-5"><div className="grid gap-4 md:grid-cols-2"><UnitValueField label="Cân nặng" value={weight} unit={weightUnit} units={weightUnits} onValueChange={setWeight} onUnitChange={(nextUnit) => changeUnit(weight, weightUnit, nextUnit, weightUnits, setWeight, setWeightUnit)} /><UnitValueField label="Chiều cao" value={height} unit={heightUnit} units={heightUnits} onValueChange={setHeight} onUnitChange={(nextUnit) => changeUnit(height, heightUnit, nextUnit, heightUnits, setHeight, setHeightUnit)} /></div><div className="mt-5 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white bg-white/85 p-4"><div><p className="text-sm font-bold text-slate-500">Kết quả BMI</p><p className="mt-1 text-4xl font-black text-teal-800">{bmi === null ? "—" : bmi.toFixed(1)}</p></div><p className="max-w-sm text-sm font-semibold leading-6 text-slate-500">{bmi === null ? "Nhập cân nặng và chiều cao để tính." : bmi < 18.5 ? "Thiếu cân" : bmi < 25 ? "Bình thường" : bmi < 30 ? "Thừa cân" : "Béo phì"}</p></div></div>}
        {calculatorType === "holliday-segar" && <div className="mt-5"><UnitValueField label="Cân nặng" value={weight} unit={weightUnit} units={weightUnits} onValueChange={setWeight} onUnitChange={(nextUnit) => changeUnit(weight, weightUnit, nextUnit, weightUnits, setWeight, setWeightUnit)} /><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-white bg-white/85 p-4"><p className="text-sm font-bold text-slate-500">Dịch duy trì mỗi giờ · 4-2-1</p><p className="mt-1 text-3xl font-black text-teal-800">{hollidayHourly === null ? "—" : hollidayHourly.toFixed(1)} <span className="text-base font-extrabold">mL/giờ</span></p></div><div className="rounded-2xl border border-white bg-white/85 p-4"><p className="text-sm font-bold text-slate-500">Dịch duy trì mỗi ngày · 100-50-20</p><p className="mt-1 text-3xl font-black text-teal-800">{hollidayDaily === null ? "—" : hollidayDaily.toFixed(1)} <span className="text-base font-extrabold">mL/ngày</span></p></div></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500"><span>Nguồn:</span><a href={formulaSources.hollidaySegar} target="_blank" rel="noreferrer" className="text-teal-700 underline hover:text-teal-900">Holliday-Segar · PubMed</a></div><p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Chỉ là ước tính dịch duy trì ban đầu; cần điều chỉnh theo tuổi, bệnh cảnh, điện giải và đánh giá lâm sàng.</p></div>}
        {(calculatorType === "egfr" || calculatorType === "crcl") && <div className="mt-5">{calculatorType === "egfr" && <AnimatedDropdown label="Công thức eGFR" value={egfrFormula} onChange={(value) => setEgfrFormula(value as EgfrFormula)} options={[{ value: "creatinine", label: "CKD-EPI Creatinine 2021" }, { value: "cystatin", label: "CKD-EPI Cystatin C 2012" }, { value: "combined", label: "CKD-EPI Creatinine-Cystatin C 2012" }, { value: "mdrd", label: "MDRD 4 biến chuẩn hóa" }]} />}{calculatorType === "crcl" && <AnimatedDropdown label="Công thức CrCl" value={crclFormula} onChange={(value) => setCrclFormula(value as CrclFormula)} options={[{ value: "standard", label: "Cockcroft-Gault chuẩn" }, { value: "adjusted-weight", label: "Cockcroft-Gault + cân nặng hiệu chỉnh (IBW/AdjBW)" }, { value: "bsa-normalized", label: "CrCl chuẩn hóa theo BSA" }]} />}<div className="mt-4 grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]"><label className="block min-w-0 text-sm font-bold text-slate-700">Tuổi (năm)<input type="number" min="1" max="120" step="1" value={age} onChange={(event) => setAge(event.target.value)} className="medical-value-input mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-teal-400" /></label><AnimatedDropdown label="Giới tính sinh học" value={sex} onChange={(value) => setSex(value as "male" | "female")} options={[{ value: "male", label: "Nam" }, { value: "female", label: "Nữ" }]} />{(calculatorType !== "egfr" || egfrFormula !== "cystatin") && <UnitValueField label="Creatinine huyết thanh" value={creatinine} unit={creatinineUnit} units={creatinineUnits} onValueChange={setCreatinine} onUnitChange={(nextUnit) => changeUnit(creatinine, creatinineUnit, nextUnit, creatinineUnits, setCreatinine, setCreatinineUnit)} />}{calculatorType === "egfr" && (egfrFormula === "cystatin" || egfrFormula === "combined") && <UnitValueField label="Cystatin C" value={cystatinC} unit={cystatinCUnit} units={cystatinCUnits} onValueChange={setCystatinC} onUnitChange={(nextUnit) => changeUnit(cystatinC, cystatinCUnit, nextUnit, cystatinCUnits, setCystatinC, setCystatinCUnit)} />}{calculatorType === "crcl" && <UnitValueField label="Cân nặng" value={weight} unit={weightUnit} units={weightUnits} onValueChange={setWeight} onUnitChange={(nextUnit) => changeUnit(weight, weightUnit, nextUnit, weightUnits, setWeight, setWeightUnit)} />}{calculatorType === "crcl" && crclFormula !== "standard" && <UnitValueField label="Chiều cao" value={height} unit={heightUnit} units={heightUnits} onValueChange={setHeight} onUnitChange={(nextUnit) => changeUnit(height, heightUnit, nextUnit, heightUnits, setHeight, setHeightUnit)} />}</div><div className="mt-5 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white bg-white/85 p-4"><div><p className="text-sm font-bold text-slate-500">{calculatorType === "egfr" ? egfrFormula === "creatinine" ? "eGFR · CKD-EPI Creatinine 2021" : egfrFormula === "cystatin" ? "eGFR · CKD-EPI Cystatin C 2012" : egfrFormula === "combined" ? "eGFR · CKD-EPI Creatinine-Cystatin C 2012" : "eGFR · MDRD 4 biến" : crclLabel}</p><p className="mt-1 text-4xl font-black text-teal-800">{calculatorType === "egfr" ? (selectedEgfr === null ? "—" : selectedEgfr.toFixed(1)) : (crcl === null ? "—" : crcl.toFixed(1))}</p></div><p className="text-sm font-semibold text-slate-500">{calculatorType === "egfr" ? "mL/min/1,73 m²" : crclUnitLabel}</p></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500"><span>Nguồn:</span><a href={formulaSources.niddk} target="_blank" rel="noreferrer" className="text-teal-700 underline hover:text-teal-900">NIDDK · CKD-EPI &amp; MDRD</a><a href={formulaSources.kdigo} target="_blank" rel="noreferrer" className="text-teal-700 underline hover:text-teal-900">KDIGO · CKD guideline</a>{calculatorType === "crcl" && <a href={formulaSources.cockcroftGault} target="_blank" rel="noreferrer" className="text-teal-700 underline hover:text-teal-900">Cockcroft-Gault · PubMed</a>}</div><p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Kết quả chỉ mang tính tham khảo lâm sàng; cần đối chiếu tình trạng người bệnh và hướng dẫn chuyên môn.</p></div>}
        {!(["bmi", "egfr", "crcl", "holliday-segar"] as CalculatorType[]).includes(calculatorType) && <ReferenceCalculatorPanel calculatorType={calculatorType} values={referenceInputs} onChange={(key, value) => setReferenceInputs((current) => ({ ...current, [key]: value }))} />}
        </div>}
        {calculatorPanelTab === "formula" && <CalculatorFormulaReference calculatorType={calculatorType} egfrFormula={egfrFormula} crclFormula={crclFormula} />}
      </div>}
      {activeTool === "data-table" && <form onSubmit={createDataTable} className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/35 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-teal-700">Tạo bảng dữ liệu</p><h2 className="mt-1 text-xl font-black text-slate-800">Nhập tài liệu để làm bảng tra</h2></div></div>
        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"><label className="block text-sm font-bold text-slate-700">Tên bảng<input required value={dataTableName} onChange={(event) => { setDataTableName(event.target.value); setDataTableCreated(false); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-teal-400" placeholder="Ví dụ: Bảng quy đổi eGFR" /></label><label className="block text-sm font-bold text-slate-700">File PDF<input required type="file" accept="application/pdf,.pdf" onChange={(event) => { setDataTableFile(event.target.files?.[0] || null); setDataTableCreated(false); }} className="sr-only" /><span className="mt-1.5 flex min-h-[49px] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-teal-300 bg-white px-3 text-sm font-semibold text-slate-500 hover:bg-teal-50"><UploadCloud size={18} className="shrink-0 text-teal-600" />{dataTableFile ? <span className="truncate text-teal-700">{dataTableFile.name}</span> : "Chọn PDF để nhập bảng dữ liệu"}</span></label></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-500">PDF sẽ được dùng làm nguồn cho bước trích xuất bảng dữ liệu.</p><button type="submit" disabled={!dataTableName.trim() || !dataTableFile} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><FileUp size={17} />Tạo bảng</button></div>
        {dataTableCreated && <p className="mt-3 rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm font-semibold text-teal-700">Bản nháp “{dataTableName.trim()}” đã sẵn sàng với file {dataTableFile?.name}.</p>}
      </form>}
      {activeTool === "score" && <form onSubmit={createScore} className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/35 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-amber-700">Tạo thang điểm</p><h2 className="mt-1 text-xl font-black text-slate-800">Thang điểm &amp; đánh giá</h2></div></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="block text-sm font-bold text-slate-700">Tên thang điểm<input required value={scoreName} onChange={(event) => { setScoreName(event.target.value); setScoreCreated(false); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-amber-400" placeholder="Ví dụ: CURB-65" /></label><label className="block text-sm font-bold text-slate-700">Mô tả cách dùng<textarea value={scoreDescription} onChange={(event) => { setScoreDescription(event.target.value); setScoreCreated(false); }} rows={1} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-amber-400" placeholder="Nhập mục đích và cách đọc kết quả..." /></label></div>
        <div className="mt-4 flex justify-end"><button type="submit" disabled={!scoreName.trim()} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><FilePlus2 size={17} />Tạo thang điểm</button></div>
        {scoreCreated && <p className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800">Bản nháp “{scoreName.trim()}” đã sẵn sàng để bổ sung các tiêu chí đánh giá.</p>}
      </form>}
      {!isOwner && formulas.length > 0 && <div className="mt-6 grid gap-3 lg:grid-cols-2">{formulas.map((formula) => <article key={formula.id} className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-base font-extrabold text-slate-800">{formula.title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{formula.usage}</p><div className="mt-3"><FormulaPreview html={formula.formula_html} /></div></article>)}</div>}
    </div>
  </section>;
}
