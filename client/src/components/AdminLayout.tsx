import { ArrowLeft, BookOpenCheck, Calculator, ChevronRight, FileInput, LayoutDashboard, Pill } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import type { DataRoute } from "../utils/dataRoutes";
import StudyHubLogo from "./branding/StudyHubLogo";

type AdminRoute = Extract<DataRoute, { tab: "admin" }>;

interface Props {
  user: User | null;
  route: AdminRoute;
  onNavigate: (path: string) => void;
  children: ReactNode;
}

function breadcrumb(route: AdminRoute) {
  if (route.kind.startsWith("admin-drug")) return ["Thuốc", route.kind === "admin-drug-new" ? "Thêm thuốc" : route.kind === "admin-drug-import" ? "Nhập dữ liệu" : route.drugId || "Danh sách"];
  if (route.kind.startsWith("admin-guideline")) return ["Guideline", route.kind === "admin-guideline-new" ? "Thêm guideline" : route.kind === "admin-guideline-import" ? "Nhập bằng AI" : route.guidelineId || "Danh sách"];
  if (route.kind.startsWith("admin-calculator")) return ["Máy tính y khoa", route.kind === "admin-calculator-new" ? "Thêm máy tính" : route.kind === "admin-calculator-import" ? "Nhập dữ liệu" : route.calculatorId || "Danh sách"];
  return [];
}

export default function AdminLayout({ user, route, onNavigate, children }: Props) {
  const crumbs = breadcrumb(route);
  return <div className="admin-shell min-h-screen text-slate-800">
    <div className="mx-auto flex min-h-screen w-full max-w-[1800px]">
      <aside className="admin-sidebar hidden shrink-0 lg:flex lg:flex-col">
        <button type="button" onClick={() => onNavigate("/")} className="flex items-center gap-3 text-left">
          <StudyHubLogo size="md" />
          <span className="sr-only">StudyHub</span>
        </button>
        <div className="my-7 border-t border-[var(--divider)]" />
        <nav className="grid gap-2" aria-label="Điều hướng quản trị">
          <AdminNavItem active={route.kind === "admin-dashboard"} icon={<LayoutDashboard size={18} />} label="Tổng quan" onClick={() => onNavigate("/admin")} />
          <AdminNavItem active={route.kind.startsWith("admin-drug")} icon={<Pill size={18} />} label="Thuốc" onClick={() => onNavigate("/admin/thuoc")} />
          <AdminSubNavItem active={route.kind === "admin-drug-list"} label="Danh sách thuốc" onClick={() => onNavigate("/admin/thuoc")} />
          <AdminSubNavItem active={route.kind === "admin-drug-new"} label="Thêm thuốc" onClick={() => onNavigate("/admin/thuoc/new")} />
          <AdminSubNavItem active={route.kind === "admin-drug-import"} icon={<FileInput size={15} />} label="Nhập dữ liệu" onClick={() => onNavigate("/admin/thuoc/import")} />
          <AdminNavItem active={route.kind.startsWith("admin-guideline")} icon={<BookOpenCheck size={18} />} label="Guideline" onClick={() => onNavigate("/admin/guidelines")} />
          <AdminSubNavItem active={route.kind === "admin-guideline-import"} icon={<FileInput size={15} />} label="Nhập bằng AI" onClick={() => onNavigate("/admin/guidelines/import")} />
          <AdminNavItem active={route.kind.startsWith("admin-calculator")} icon={<Calculator size={18} />} label="Máy tính y khoa" onClick={() => onNavigate("/admin/may-tinh-y-khoa")} />
          <AdminSubNavItem active={route.kind === "admin-calculator-list"} label="Danh sách máy tính" onClick={() => onNavigate("/admin/may-tinh-y-khoa")} />
          <AdminSubNavItem active={route.kind === "admin-calculator-new"} label="Thêm máy tính" onClick={() => onNavigate("/admin/may-tinh-y-khoa/new")} />
          <AdminSubNavItem active={route.kind === "admin-calculator-import"} icon={<FileInput size={15} />} label="Nhập dữ liệu" onClick={() => onNavigate("/admin/may-tinh-y-khoa/import")} />
        </nav>
        <div className="mt-auto grid gap-2 border-t border-[var(--divider)] pt-5">
          <button type="button" onClick={() => onNavigate("/guidelines")} className="admin-nav-item inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold"><ArrowLeft size={16} />Trang công khai</button>
          <p className="truncate px-3 text-xs font-semibold text-[var(--text-muted)]">{user?.email || "Tài khoản quản trị"}</p>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="admin-topbar px-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="ui-eyebrow">Admin</p><div className="admin-breadcrumb mt-1 flex items-center gap-1 text-sm font-bold"><button type="button" onClick={() => onNavigate("/admin")}>Tổng quan</button>{crumbs.map((crumb) => <span key={crumb} className="inline-flex items-center gap-1"><ChevronRight size={14} />{crumb}</span>)}</div></div>
            <button type="button" onClick={() => onNavigate("/")} className="ui-button-secondary inline-flex items-center gap-2"><ArrowLeft size={16} />Rời quản trị</button>
          </div>
        </header>
        <nav className="admin-mobile-nav grid grid-cols-4 gap-2 p-3 lg:hidden" aria-label="Điều hướng quản trị trên thiết bị nhỏ">
          <AdminNavItem active={route.kind === "admin-dashboard"} icon={<LayoutDashboard size={16} />} label="Tổng quan" onClick={() => onNavigate("/admin")} />
          <AdminNavItem active={route.kind.startsWith("admin-drug")} icon={<Pill size={16} />} label="Thuốc" onClick={() => onNavigate("/admin/thuoc")} />
          <AdminSubNavItem active={route.kind === "admin-drug-import"} icon={<FileInput size={14} />} label="Nhập dữ liệu" onClick={() => onNavigate("/admin/thuoc/import")} />
          <AdminNavItem active={route.kind.startsWith("admin-guideline")} icon={<BookOpenCheck size={16} />} label="Guideline" onClick={() => onNavigate("/admin/guidelines")} />
          <AdminSubNavItem active={route.kind === "admin-guideline-import"} icon={<FileInput size={14} />} label="Nhập AI" onClick={() => onNavigate("/admin/guidelines/import")} />
          <AdminNavItem active={route.kind.startsWith("admin-calculator")} icon={<Calculator size={16} />} label="Máy tính" onClick={() => onNavigate("/admin/may-tinh-y-khoa")} />
        </nav>
        <div className="p-4 sm:p-6 xl:p-8">{children}</div>
      </main>
    </div>
  </div>;
}

function AdminNavItem({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`admin-nav-item flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-extrabold transition ${active ? "admin-nav-item--active" : ""}`} aria-current={active ? "page" : undefined}>{icon}<span>{label}</span></button>;
}

function AdminSubNavItem({ active, icon, label, onClick }: { active: boolean; icon?: ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`admin-subnav-item ml-8 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-extrabold transition ${active ? "admin-subnav-item--active" : ""}`} aria-current={active ? "page" : undefined}>{icon || <span className="h-1.5 w-1.5 rounded-full bg-current" />}{label}</button>;
}
