import { ArrowLeft, BookOpenCheck, ChevronRight, FileInput, LayoutDashboard, Pill, ShieldCheck } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import type { DataRoute } from "../utils/dataRoutes";

type AdminRoute = Extract<DataRoute, { tab: "admin" }>;

interface Props {
  user: User | null;
  route: AdminRoute;
  onNavigate: (path: string) => void;
  children: ReactNode;
}

function breadcrumb(route: AdminRoute) {
  if (route.kind.startsWith("admin-drug")) return ["Thuốc", route.kind === "admin-drug-new" ? "Thêm thuốc" : route.kind === "admin-drug-import" ? "Nhập dữ liệu" : route.drugId || "Danh sách"];
  if (route.kind.startsWith("admin-guideline")) return ["Guideline", route.kind === "admin-guideline-new" ? "Thêm guideline" : route.guidelineId || "Danh sách"];
  return [];
}

export default function AdminLayout({ user, route, onNavigate, children }: Props) {
  const crumbs = breadcrumb(route);
  return <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f3e8ff_0,#fff7fb_38%,#ecfdf5_100%)] text-slate-800">
    <div className="mx-auto flex min-h-screen w-full max-w-[1800px]">
      <aside className="hidden w-64 shrink-0 border-r border-violet-100/80 bg-white/75 p-5 lg:flex lg:flex-col">
        <button type="button" onClick={() => onNavigate("/")} className="flex items-center gap-3 text-left">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><ShieldCheck size={23} /></span>
          <span><strong className="block text-lg font-extrabold text-rose-950">StudyHub</strong><small className="font-semibold text-violet-600">Khu vực quản trị</small></span>
        </button>
        <div className="my-7 border-t border-slate-200/80" />
        <nav className="grid gap-2" aria-label="Điều hướng quản trị">
          <AdminNavItem active={route.kind === "admin-dashboard"} icon={<LayoutDashboard size={18} />} label="Tổng quan" onClick={() => onNavigate("/admin")} />
          <AdminNavItem active={route.kind.startsWith("admin-drug")} icon={<Pill size={18} />} label="Thuốc" onClick={() => onNavigate("/admin/thuoc")} />
          <AdminSubNavItem active={route.kind === "admin-drug-list"} label="Danh sách thuốc" onClick={() => onNavigate("/admin/thuoc")} />
          <AdminSubNavItem active={route.kind === "admin-drug-new"} label="Thêm thuốc" onClick={() => onNavigate("/admin/thuoc/new")} />
          <AdminSubNavItem active={route.kind === "admin-drug-import"} icon={<FileInput size={15} />} label="Nhập dữ liệu" onClick={() => onNavigate("/admin/thuoc/import")} />
          <AdminNavItem active={route.kind.startsWith("admin-guideline")} icon={<BookOpenCheck size={18} />} label="Guideline" onClick={() => onNavigate("/admin/guidelines")} />
        </nav>
        <div className="mt-auto grid gap-2 border-t border-slate-200/80 pt-5">
          <button type="button" onClick={() => onNavigate("/guidelines")} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-violet-50 hover:text-violet-700"><ArrowLeft size={16} />Trang công khai</button>
          <p className="truncate px-3 text-xs font-semibold text-slate-400">{user?.email || "Tài khoản quản trị"}</p>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="border-b border-violet-100/80 bg-white/70 px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-violet-600">Admin</p><div className="mt-1 flex items-center gap-1 text-sm font-bold text-slate-500"><button type="button" onClick={() => onNavigate("/admin")} className="hover:text-violet-700">Tổng quan</button>{crumbs.map((crumb) => <span key={crumb} className="inline-flex items-center gap-1"><ChevronRight size={14} />{crumb}</span>)}</div></div>
            <button type="button" onClick={() => onNavigate("/")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:border-violet-200 hover:bg-violet-50"><ArrowLeft size={16} />Rời quản trị</button>
          </div>
        </header>
        <nav className="grid grid-cols-3 gap-2 border-b border-violet-100/80 bg-white/60 p-3 lg:hidden" aria-label="Điều hướng quản trị trên thiết bị nhỏ">
          <AdminNavItem active={route.kind === "admin-dashboard"} icon={<LayoutDashboard size={16} />} label="Tổng quan" onClick={() => onNavigate("/admin")} />
          <AdminNavItem active={route.kind.startsWith("admin-drug")} icon={<Pill size={16} />} label="Thuốc" onClick={() => onNavigate("/admin/thuoc")} />
          <AdminSubNavItem active={route.kind === "admin-drug-import"} icon={<FileInput size={14} />} label="Nhập dữ liệu" onClick={() => onNavigate("/admin/thuoc/import")} />
          <AdminNavItem active={route.kind.startsWith("admin-guideline")} icon={<BookOpenCheck size={16} />} label="Guideline" onClick={() => onNavigate("/admin/guidelines")} />
        </nav>
        <div className="p-4 sm:p-6 xl:p-8">{children}</div>
      </main>
    </div>
  </div>;
}

function AdminNavItem({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-extrabold transition ${active ? "bg-violet-100 text-violet-800" : "text-slate-600 hover:bg-violet-50 hover:text-violet-700"}`} aria-current={active ? "page" : undefined}>{icon}<span>{label}</span></button>;
}

function AdminSubNavItem({ active, icon, label, onClick }: { active: boolean; icon?: ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`ml-8 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-extrabold transition ${active ? "bg-teal-50 text-teal-700" : "text-slate-500 hover:bg-violet-50 hover:text-violet-700"}`} aria-current={active ? "page" : undefined}>{icon || <span className="h-1.5 w-1.5 rounded-full bg-current" />}{label}</button>;
}
