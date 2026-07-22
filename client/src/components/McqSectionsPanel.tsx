import { FilePlus2, LibraryBig } from "lucide-react";

export type McqSection = "create" | "banks";

interface Props {
  section: McqSection;
  onChange: (section: McqSection) => void;
  open: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function McqSectionsPanel({ section, onChange, open, onMouseEnter, onMouseLeave }: Props) {
  return (
    <aside className={`mcq-sections-popover sidebar-hover-panel fixed z-[70] ${open ? "sidebar-hover-panel--open" : "pointer-events-none invisible opacity-0"}`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} aria-label="Khu vực MCQ">
      <div className="sidebar-hover-panel__surface rounded-3xl border border-violet-200/80 bg-white/90 p-4 shadow-[0_18px_50px_rgba(109,40,217,.13)] backdrop-blur-xl">
        <div className="grid gap-2">
          <button type="button" onClick={() => onChange("create")} className={`sidebar-hover-panel__item flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${section === "create" ? "border-violet-200 bg-violet-50 text-violet-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50/60"}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><FilePlus2 size={20} /></span>
            <span><strong className="block text-sm font-extrabold">Quản lý</strong></span>
          </button>
          <button type="button" onClick={() => onChange("banks")} className={`sidebar-hover-panel__item flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${section === "banks" ? "border-teal-200 bg-teal-50 text-teal-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50/60"}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><LibraryBig size={20} /></span>
            <span><strong className="block text-sm font-extrabold">Bộ trắc nghiệm</strong></span>
          </button>
        </div>
      </div>
    </aside>
  );
}
