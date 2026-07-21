import { BookOpenCheck, LibraryBig } from "lucide-react";

export type ReferenceSection = "guidelines" | "books";

interface Props {
  section: ReferenceSection;
  onChange: (section: ReferenceSection) => void;
  open: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function ReferenceSectionsPanel({ section, onChange, open, onMouseEnter, onMouseLeave }: Props) {
  return (
    <aside className={`reference-sections-popover sidebar-hover-panel fixed z-[70] ${open ? "sidebar-hover-panel--open" : "pointer-events-none invisible opacity-0"}`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} aria-label="Tài liệu tham khảo">
      <div className="sidebar-hover-panel__surface rounded-3xl border border-violet-200/80 bg-white/90 p-4 shadow-[0_18px_50px_rgba(109,40,217,.13)] backdrop-blur-xl">
        <p className="px-1 text-xs font-black uppercase tracking-[.14em] text-violet-700">Tài liệu tham khảo</p>
        <div className="mt-3 grid gap-2">
          <button type="button" onClick={() => onChange("guidelines")} className={`sidebar-hover-panel__item flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${section === "guidelines" ? "border-teal-200 bg-teal-50 text-teal-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50/60"}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><BookOpenCheck size={20} /></span>
            <span><strong className="block text-sm font-extrabold">Guideline</strong><small className="mt-0.5 block text-xs font-semibold text-slate-400">Khuyến cáo điều trị</small></span>
          </button>
          <button type="button" onClick={() => onChange("books")} className={`sidebar-hover-panel__item flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${section === "books" ? "border-rose-200 bg-rose-50 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50/60"}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><LibraryBig size={20} /></span>
            <span><strong className="block text-sm font-extrabold">Sách</strong><small className="mt-0.5 block text-xs font-semibold text-slate-400">Kho sách tham khảo</small></span>
          </button>
        </div>
      </div>
    </aside>
  );
}
