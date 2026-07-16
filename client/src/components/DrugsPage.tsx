import { Pill, PillBottle, Search } from "lucide-react";

export default function DrugsPage() {
  return (
    <section className="mode-panel mx-auto w-full max-w-5xl px-5 py-8" aria-labelledby="drugs-title">
      <div className="glass-panel overflow-hidden border border-rose-100/80 bg-white/68 p-7 sm:p-10">
        <div className="flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-teal-100 text-rose-600 shadow-sm">
              <Pill size={32} strokeWidth={1.9} />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-teal-600">Góc dược lý</p>
              <h1 id="drugs-title" className="mt-1 text-3xl font-extrabold tracking-tight text-rose-950">Drugs</h1>
              <p className="mt-1 text-sm text-slate-500">Tra cứu và ghi nhớ thuốc trong cùng một không gian học tập.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-white/75 px-4 py-3 text-sm text-slate-400 shadow-sm sm:min-w-72">
            <Search size={18} />
            <span>Tìm kiếm thuốc…</span>
          </div>
        </div>

        <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-teal-200 bg-gradient-to-br from-teal-50/65 via-white/55 to-rose-50/65 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-sm">
            <PillBottle size={28} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-rose-950">Tủ thuốc của bạn</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Tab Drugs đã sẵn sàng. Mình có thể tiếp tục thêm danh mục thuốc, hoạt chất, liều dùng và flashcard dược lý tại đây.</p>
        </div>
      </div>
    </section>
  );
}
