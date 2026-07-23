import { Archive, ExternalLink, Pencil, Pill, Plus, Search, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import type { DataRoute } from "../utils/dataRoutes";
import type { Drug, DrugStatus } from "../types/drug";
import { archiveThuoc, deleteThuoc, filterThuoc, getThuocFilterOptions, publishThuoc } from "../services/thuocService";
import AdminDrugEditor from "./AdminDrugEditor";

type AdminRoute = Extract<DataRoute, { tab: "admin" }>;
interface Props { route: AdminRoute; onNavigate: (path: string) => void }

const statusLabels: Record<DrugStatus, string> = { draft: "Bản nháp", in_review: "Đang rà soát", reviewed: "Đã rà soát", published: "Đã xuất bản", archived: "Đã lưu trữ" };

export default function AdminDrugPage({ route, onNavigate }: Props) {
  const isEditor = route.kind === "admin-drug-new" || route.kind === "admin-drug-edit" || route.kind === "admin-drug-detail";
  if (isEditor) return <AdminDrugEditor route={route} onNavigate={onNavigate} />;
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
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-teal-700">Quản trị Thuốc</p><h1 id="admin-drug-title" className="mt-1 text-2xl font-extrabold text-rose-950">Danh mục thuốc</h1><p className="mt-1 text-sm font-semibold text-slate-500">Nguồn dữ liệu trung tâm để các module khác liên kết bằng ID.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onNavigate("/thuoc")} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700"><ExternalLink size={16} />Trang công khai</button><button type="button" onClick={() => onNavigate("/admin/thuoc/import")} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700"><Plus size={16} />Nhập dữ liệu</button><button type="button" onClick={() => onNavigate("/admin/thuoc/new")} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white hover:bg-teal-700"><Plus size={16} />Thêm thuốc</button></div></div>
    <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,180px))]"><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, hoạt chất, nhóm..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-teal-300" aria-label="Tìm thuốc trong quản trị" /></label><FilterSelect label="Nhóm thuốc" value={drugClass} options={options.drugClasses} onChange={setDrugClass} /><FilterSelect label="Chuyên khoa" value={specialty} options={options.specialties} onChange={setSpecialty} /><FilterSelect label="Trạng thái" value={status} options={Object.keys(statusLabels)} onChange={(value) => setStatus(value as DrugStatus | "all")} /></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((drug) => <article key={drug.id} className="rounded-2xl border border-teal-100 bg-white/85 p-4 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><Pill size={19} /></span><div className="min-w-0"><h2 className="truncate font-extrabold text-slate-800">{drug.titleVi}</h2><p className="text-xs font-semibold text-slate-500">{drug.genericName}</p><p className="mt-1 text-xs text-slate-400">{drug.drugClass || "Chưa phân nhóm"}</p></div></div><p className="mt-3 line-clamp-2 text-sm leading-5 text-slate-600">{drug.summary || "Chưa có mô tả."}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${drug.status === "published" ? "bg-teal-50 text-teal-700" : drug.status === "archived" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}>{statusLabels[drug.status]}</span><div className="flex items-center gap-1"><button type="button" title="Sửa" aria-label={`Sửa ${drug.titleVi}`} onClick={() => onNavigate(`/admin/thuoc/${drug.id}/edit`)} className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"><Pencil size={16} /></button>{drug.status !== "published" && <button type="button" title="Xuất bản" aria-label={`Xuất bản ${drug.titleVi}`} onClick={() => { publishThuoc(drug.id); refresh(); }} className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"><Upload size={16} /></button>}{drug.status !== "archived" && <button type="button" title="Lưu trữ" aria-label={`Lưu trữ ${drug.titleVi}`} onClick={() => { archiveThuoc(drug.id); refresh(); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Archive size={16} /></button>}<button type="button" title="Xóa" aria-label={`Xóa ${drug.titleVi}`} onClick={() => handleDelete(drug)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button></div></div></article>)}</div>
    {items.length === 0 && <p className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Không tìm thấy thuốc phù hợp.</p>}
  </section>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="text-xs font-bold text-slate-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-teal-300"><option value="all">Tất cả</option>{options.map((option) => <option key={option} value={option}>{option in statusLabels ? statusLabels[option as DrugStatus] : option}</option>)}</select></label>;
}
