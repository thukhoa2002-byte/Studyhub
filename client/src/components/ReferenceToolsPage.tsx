import { Calculator, ClipboardList, FunctionSquare, Table2 } from "lucide-react";

const toolGroups = [
  { title: "Công thức", description: "Công thức y khoa và quy đổi thường dùng.", icon: FunctionSquare, className: "border-violet-200 bg-violet-50/60 text-violet-700" },
  { title: "Bảng dữ liệu", description: "Bảng tra nhanh theo chỉ số, đơn vị và ngưỡng.", icon: Table2, className: "border-teal-200 bg-teal-50/60 text-teal-700" },
  { title: "Thang điểm & đánh giá", description: "Các thang điểm hỗ trợ đánh giá lâm sàng.", icon: ClipboardList, className: "border-amber-200 bg-amber-50/60 text-amber-700" },
  { title: "Máy tính y khoa", description: "Công cụ tính toán theo dữ liệu nhập vào.", icon: Calculator, className: "border-rose-200 bg-rose-50/60 text-rose-700" },
];

export default function ReferenceToolsPage() {
  return <section className="mode-panel mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 xl:px-8" aria-labelledby="reference-tools-title">
    <div className="glass-panel border border-violet-100 bg-white/75 p-5 sm:p-7">
      <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Calculator size={25} /></span><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-violet-600">Tài liệu tham khảo</p><h1 id="reference-tools-title" className="mt-1 text-2xl font-black text-rose-950">Công cụ &amp; Bảng tra</h1><p className="mt-1 text-sm text-slate-500">Công thức, bảng dữ liệu và công cụ hỗ trợ tính toán, đánh giá.</p></div></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {toolGroups.map(({ title, description, icon: Icon, className }) => <button key={title} type="button" className={`flex min-h-28 items-start gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${className}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80"><Icon size={21} /></span>
          <span><strong className="block text-sm font-extrabold text-slate-800">{title}</strong><small className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{description}</small></span>
        </button>)}
      </div>
    </div>
  </section>;
}
