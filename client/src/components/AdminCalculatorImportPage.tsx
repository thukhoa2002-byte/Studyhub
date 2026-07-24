import { FileInput, Save } from "lucide-react";
import { useState } from "react";
import { createCalculatorDraft, calculatorDefinitionToDraftInput } from "../services/calculatorDatabaseService";
import type { CalculatorDefinition } from "../modules/calculators/types";
import { supabase } from "../services/supabase";

export default function AdminCalculatorImportPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [raw, setRaw] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true); setMessage("");
    try {
      if (!supabase) throw new Error("Supabase chưa được cấu hình.");
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Phiên đăng nhập không hợp lệ.");
      const parsed = JSON.parse(raw) as CalculatorDefinition | CalculatorDefinition[];
      const items = Array.isArray(parsed) ? parsed : [parsed];
      if (items.length === 0) throw new Error("JSON không có calculator.");
      for (const item of items) await createCalculatorDraft(data.user.id, calculatorDefinitionToDraftInput(item));
      setMessage(`Đã lưu ${items.length} calculator vào database ở trạng thái bản nháp.`);
      setRaw("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể nhập JSON."); }
    finally { setSaving(false); }
  }

  return <section aria-labelledby="calculator-import-title"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-violet-700">Nhập Calculator</p><h1 id="calculator-import-title" className="mt-1 text-2xl font-black text-rose-950">Nhập JSON vào database</h1><p className="mt-1 text-sm font-semibold text-slate-500">Không dùng localStorage và không tự xuất bản.</p></div><button type="button" onClick={() => onNavigate("/admin/may-tinh-y-khoa")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">Hủy</button></div><div className="mt-5 rounded-2xl border border-violet-200 bg-white/80 p-4"><textarea value={raw} onChange={(event) => setRaw(event.target.value)} rows={18} className="w-full rounded-xl border border-slate-200 p-3 font-mono text-xs outline-none focus:border-violet-400" placeholder="Dán một Calculator JSON hoặc một mảng Calculator JSON..." /><div className="mt-3 flex flex-wrap justify-end gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600"><input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setRaw); }} /><FileInput size={16} />Tải JSON</label><button type="button" disabled={saving || !raw.trim()} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16} />Lưu bản nháp</button></div>{message && <p role="alert" className="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800">{message}</p>}</div></section>;
}
