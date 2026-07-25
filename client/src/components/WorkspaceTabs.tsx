import { BookOpen, BookOpenCheck, Calculator, Pill, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import type { User } from "@supabase/supabase-js";
import McqIcon from "./McqIcon";
import SiteAnalytics from "./SiteAnalytics";
import WorkspaceSettings from "./WorkspaceSettings";
import StudyHubIcon from "./branding/StudyHubIcon";
import StudyHubLogo from "./branding/StudyHubLogo";
import type { AppTheme } from "../theme/themeTypes";

export type WorkspaceTab = "flashcards" | "mcq" | "tools" | "guidelines" | "drugs" | "admin";

interface Props {
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  user: User | null;
  onUserChange: (user: User | null) => void;
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  sharedDeckNotificationsEnabled: boolean;
  onSharedDeckNotificationsChange: (enabled: boolean) => void;
  analyticsAdmin: boolean;
  onAnalyticsExpanded: (expanded: boolean) => void;
  onSidebarExpandedChange: (expanded: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onColorThemeEligible: boolean;
}

const baseTabs: Array<{ id: WorkspaceTab; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { id: "flashcards", label: "Thẻ học", icon: BookOpen },
  { id: "mcq", label: "Trắc nghiệm", icon: McqIcon },
  { id: "tools", label: "Công cụ & Bảng tra", icon: Calculator },
  { id: "guidelines", label: "Tài liệu tham khảo", icon: BookOpenCheck },
  { id: "drugs", label: "Thuốc", icon: Pill },
];

export default function WorkspaceTabs({ activeTab, onChange, user, onUserChange, theme, onThemeChange, sharedDeckNotificationsEnabled, onSharedDeckNotificationsChange, analyticsAdmin, onAnalyticsExpanded, onSidebarExpandedChange, mobileOpen, onMobileOpenChange, onColorThemeEligible }: Props) {
  const tabs = analyticsAdmin ? [...baseTabs, { id: "admin" as const, label: "Quản trị", icon: ShieldCheck }] : baseTabs;
  const [hoveredTab, setHoveredTab] = useState<WorkspaceTab | null>(null);
  const [analyticsPanelOpen, setAnalyticsPanelOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const closeMobileDrawer = useCallback(() => {
    onMobileOpenChange(false);
    window.requestAnimationFrame(() => document.getElementById("studyhub-mobile-nav-trigger")?.focus());
  }, [onMobileOpenChange]);

  function closeAnalyticsPanel() {
    setAnalyticsPanelOpen(false);
    onAnalyticsExpanded(false);
  }

  function handleSidebarMouseLeave() {
    setRailExpanded(false);
    setHoveredTab(null);
  }

  function handleTabClick(id: WorkspaceTab) {
    onChange(id);
    closeMobileDrawer();
    closeAnalyticsPanel();
  }

  function handleAnalyticsExpanded(expanded: boolean) {
    setAnalyticsPanelOpen(expanded);
    onAnalyticsExpanded(expanded);
  }

  useEffect(() => {
    if (!analyticsAdmin) {
      setAnalyticsPanelOpen(false);
      onAnalyticsExpanded(false);
    }
  }, [analyticsAdmin, onAnalyticsExpanded]);

  useEffect(() => {
    onSidebarExpandedChange(railExpanded || analyticsPanelOpen);
  }, [analyticsPanelOpen, onSidebarExpandedChange, railExpanded]);

  useEffect(() => () => {
    onSidebarExpandedChange(false);
  }, [onSidebarExpandedChange]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncMobileAccessibility = () => {
      const sidebar = sidebarRef.current;
      if (!sidebar) return;
      const hideFromMobileTabOrder = mediaQuery.matches && !mobileOpen;
      if (hideFromMobileTabOrder) {
        sidebar.setAttribute("inert", "");
        sidebar.setAttribute("aria-hidden", "true");
      } else {
        sidebar.removeAttribute("inert");
        sidebar.removeAttribute("aria-hidden");
      }
    };
    syncMobileAccessibility();
    mediaQuery.addEventListener("change", syncMobileAccessibility);
    return () => mediaQuery.removeEventListener("change", syncMobileAccessibility);
  }, [closeMobileDrawer, mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOrTrapDrawer = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const drawer = sidebarRef.current;
      if (!drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute("inert"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOrTrapDrawer);
    window.requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLElement>("[data-mobile-drawer-close]")?.focus());
    return () => window.removeEventListener("keydown", closeOrTrapDrawer);
  }, [closeMobileDrawer, mobileOpen]);

  const visualTab = hoveredTab || activeTab;

  return (
    <>
      {mobileOpen && <button type="button" aria-label="Đóng điều hướng" className="workspace-sidebar__backdrop lg:hidden" onClick={closeMobileDrawer} />}
      <div id="studyhub-mobile-navigation" ref={sidebarRef} onMouseEnter={() => setRailExpanded(true)} onMouseLeave={handleSidebarMouseLeave} onFocusCapture={() => setRailExpanded(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setRailExpanded(false); }} className={`workspace-sidebar flex w-full flex-col px-5 pt-5 max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-[var(--z-drawer)] max-lg:w-[min(19rem,calc(100vw-3rem))] max-lg:overflow-y-auto max-lg:border-r max-lg:border-slate-200/80 max-lg:bg-white max-lg:shadow-2xl max-lg:transition-transform max-lg:duration-200 ${mobileOpen ? "max-lg:translate-x-0" : "max-lg:pointer-events-none max-lg:-translate-x-full"} lg:fixed lg:bottom-0 lg:left-0 lg:top-0 lg:z-[var(--z-tooltip)] lg:w-20 lg:overflow-x-hidden lg:overflow-y-auto lg:border-r lg:border-slate-200/80 lg:bg-white/80 lg:px-2 lg:py-6 lg:shadow-[8px_0_30px_rgba(15,23,42,.04)]`}>
      <div className="workspace-sidebar__brand flex items-center justify-between lg:justify-center">
        <StudyHubIcon size="md" className="workspace-sidebar__brand-icon" />
        <StudyHubLogo size="md" className="workspace-sidebar__brand-logo" />
        <button type="button" data-mobile-drawer-close onClick={closeMobileDrawer} aria-label="Đóng điều hướng" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] lg:hidden"><X size={20} /></button>
      </div>
      <div className="workspace-sidebar__divider my-6 hidden border-t border-slate-200/80 lg:block" />
      <nav
        className={`workspace-tabs workspace-tabs--sidebar ${analyticsAdmin ? "workspace-tabs--with-admin" : ""} glass-panel grid grid-cols-2 gap-2 border border-white/70 bg-white/58 p-2 sm:grid-cols-5 lg:mt-0 lg:grid-cols-1 lg:border-0 lg:bg-transparent lg:p-0`}
        aria-label="Khu vực học tập"
      >
        <span
          className={`workspace-tabs__glider ${visualTab === "mcq" ? "workspace-tabs__glider--mcq" : visualTab === "tools" ? "workspace-tabs__glider--tools" : visualTab === "guidelines" ? "workspace-tabs__glider--guidelines" : visualTab === "drugs" ? "workspace-tabs__glider--drugs" : visualTab === "admin" ? "workspace-tabs__glider--admin" : ""}`}
          aria-hidden="true"
        />
        {tabs.map(({ id, label, icon: Icon }, tabIndex) => {
          const active = visualTab === id;
          const distance = hoveredTab ? Math.abs(tabs.findIndex((tab) => tab.id === hoveredTab) - tabIndex) : 99;
          const dockClass = hoveredTab === id ? "workspace-tabs__button--dock-hover" : distance === 1 ? "workspace-tabs__button--dock-neighbor" : "";
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleTabClick(id)}
              title={label}
              aria-label={label}
              onMouseEnter={() => setHoveredTab(id)}
              onFocus={() => setHoveredTab(id)}
              className={`workspace-tabs__button ${active ? "workspace-tabs__button--active" : ""} ${dockClass}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="workspace-tabs__icon shrink-0"><Icon size={21} strokeWidth={2.2} /></span>
              <span className="workspace-tabs__label min-w-0 flex-1 text-left">{label}</span>
            </button>
          );
        })}
      </nav>
      {analyticsAdmin && <SiteAnalytics userId={user?.id} visible placement="sidebar" panelOpen={analyticsPanelOpen} onExpandedChange={handleAnalyticsExpanded} />}
      <WorkspaceSettings user={user} onUserChange={onUserChange} canUseColorTheme={onColorThemeEligible} theme={theme} onThemeChange={onThemeChange} sharedDeckNotificationsEnabled={sharedDeckNotificationsEnabled} onSharedDeckNotificationsChange={onSharedDeckNotificationsChange} />
      </div>
    </>
  );
}
