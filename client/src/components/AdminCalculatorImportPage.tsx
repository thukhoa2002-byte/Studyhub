import { FileInput, Save } from "lucide-react";
import { useState } from "react";
import type { CalculatorDefinition } from "../modules/calculators/types";
import { calculatorRegistry } from "../modules/calculators/engine";
import { calculatorHasDuplicate, createCalculator } from "../services/calculatorService";

export default function AdminCalculatorImportPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<Partial<CalculatorDefinition>[]>([]);
  const [message, setMessage] = useState("");

  function validate(items: Partial<CalculatorDefinition>[]) {
    const ids = new Set<string>();
    const slugs = new Set<string>();
    return items.flatMap((item, index) => {
      const errors: string[] = [];
      if (!item || typeof item !== "object" || !item.id || !item.slug || !(item.nameVi || item.name)) errors.push(`Mục ${index + 1} thiếu id, slug hoặc nameVi.`);
      if (item.calculation?.handlerId && !Object.hasOwn(calculatorRegistry, item.calculation.handlerId)) errors.push(`Mục ${index + 1} dùng handler chưa đăng ký.`);
      if (item.id && (ids.has(item.id) || calculatorHasDuplicate(undefined, "id", item.id))) errors.push(`Mục ${index + 1} trùng ID.`);
      if (item.slug && (slugs.has(item.slug) || calculatorHasDuplicate(undefined, "slug", item.slug))) errors.push(`Mục ${index + 1} trùng slug.`);
      if (item.id) ids.add(item.id);
      if (item.slug) slugs.add(item.slug);
      return errors;
    });
  }

  function parse() {
    try {
      const parsed = JSON.parse(raw) as Partial<CalculatorDefinition> | Partial<CalculatorDefinition>[];
      const items = (Array.isArray(parsed) ? parsed : [parsed]) as Partial<CalculatorDefinition>[];
      const errors = validate(items);
      if (errors.length) { setPreview([]); setMessage(errors.join(" ")); return; }
      setPreview(items); setMessage(`Đã đọc ${items.length} calculator. Chưa lưu.`);
    } catch { setPreview([]); setMessage("JSON không hợp lệ."); }
  }

  function save() {
    preview.forEach((item) => createCalculator({ ...item, status: "draft", sourceVerified: false }));
    setPreview([]); setMessage("Đã lưu bản nháp. Chưa xuất bản tự động.");
  }

  return <section><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-violet-700">Nhập Calculator</p><h1 className="mt-1 text-2xl font-black text-rose-950">Nhập JSON</h1><p className="mt-1 text-sm font-semibold text-slate-500">Chỉ nhận schema dữ liệu, không nhận mã JavaScript.</p></div><button type="button" onClick={() => onNavigate("/admin/may-tinh-y-khoa")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">Hủy</button></div><div className="mt-5 rounded-2xl border border-violet-200 bg-white/80 p-4"><textarea value={raw} onChange={(event) => setRaw(event.target.value)} rows={16} className="w-full rounded-xl border border-slate-200 p-3 font-mono text-xs outline-none focus:border-violet-400" placeholder="Dán Calculator JSON hoặc mảng Calculator JSON..." /><div className="mt-3 flex flex-wrap justify-end gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600"><input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setRaw); }} /><FileInput size={16} />Tải JSON</label><button type="button" onClick={parse} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700">Kiểm tra</button></div>{message && <p className="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800">{message}</p>}{preview.length > 0 && <><div className="mt-4 grid gap-2">{preview.map((item) => <div key={String(item.id)} className="rounded-xl border border-slate-200 p-3 text-sm"><strong>{item.nameVi || item.name}</strong><span className="ml-2 text-xs text-slate-500">{item.slug} · {item.calculation?.handlerId || "chưa có handler"}</span></div>)}</div><button type="button" onClick={save} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white"><Save size={16} />Lưu tất cả bản nháp</button></>}</div></section>;
}
