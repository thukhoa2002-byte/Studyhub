import { BookOpen, BookOpenCheck, Calculator, ChevronDown, ChevronRight, Pill, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import type { User } from "@supabase/supabase-js";
import McqIcon from "./McqIcon";
import McqSectionsPanel, { type McqSection } from "./McqSectionsPanel";
import ReferenceSectionsPanel, { type ReferenceSection } from "./ReferenceSectionsPanel";
import SiteAnalytics from "./SiteAnalytics";
import WorkspaceSettings from "./WorkspaceSettings";

export type WorkspaceTab = "flashcards" | "mcq" | "tools" | "guidelines" | "drugs" | "admin";

interface Props {
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  user: User | null;
  onUserChange: (user: User | null) => void;
  theme: "color" | "basic" | "test" | "test-light" | "green";
  onThemeChange: (theme: "color" | "basic" | "test" | "test-light" | "green") => void;
  sharedDeckNotificationsEnabled: boolean;
  onSharedDeckNotificationsChange: (enabled: boolean) => void;
  analyticsAdmin: boolean;
  onAnalyticsExpanded: (expanded: boolean) => void;
  referenceSection: ReferenceSection;
  onReferenceSectionChange: (section: ReferenceSection) => void;
  mcqSection: McqSection;
  onMcqSectionChange: (section: McqSection) => void;
}

const baseTabs: Array<{ id: WorkspaceTab; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { id: "flashcards", label: "Thẻ học", icon: BookOpen },
  { id: "mcq", label: "Trắc nghiệm", icon: McqIcon },
  { id: "tools", label: "Công cụ & Bảng tra", icon: Calculator },
  { id: "guidelines", label: "Tài liệu tham khảo", icon: BookOpenCheck },
  { id: "drugs", label: "Thuốc", icon: Pill },
];

export default function WorkspaceTabs({ activeTab, onChange, user, onUserChange, theme, onThemeChange, sharedDeckNotificationsEnabled, onSharedDeckNotificationsChange, analyticsAdmin, onAnalyticsExpanded, referenceSection, onReferenceSectionChange, mcqSection, onMcqSectionChange }: Props) {
  const tabs = analyticsAdmin ? [...baseTabs, { id: "admin" as const, label: "Quản trị", icon: ShieldCheck }] : baseTabs;
  const [hoveredTab, setHoveredTab] = useState<WorkspaceTab | null>(null);
  const [mcqPanelOpen, setMcqPanelOpen] = useState(false);
  const [mcqPanelTimer, setMcqPanelTimer] = useState<number | null>(null);
  const [referencePanelOpen, setReferencePanelOpen] = useState(false);
  const [referencePanelTimer, setReferencePanelTimer] = useState<number | null>(null);
  const [analyticsPanelOpen, setAnalyticsPanelOpen] = useState(false);

  function keepMcqPanelOpen() {
    if (mcqPanelTimer !== null) window.clearTimeout(mcqPanelTimer);
    setMcqPanelOpen(true);
  }

  function scheduleMcqPanelClose() {
    if (mcqPanelTimer !== null) window.clearTimeout(mcqPanelTimer);
    const timer = window.setTimeout(() => { setMcqPanelOpen(false); setMcqPanelTimer(null); }, 700);
    setMcqPanelTimer(timer);
  }

  function keepReferencePanelOpen() {
    if (referencePanelTimer !== null) window.clearTimeout(referencePanelTimer);
    setReferencePanelOpen(true);
  }

  function scheduleReferencePanelClose() {
    if (referencePanelTimer !== null) window.clearTimeout(referencePanelTimer);
    const timer = window.setTimeout(() => { setReferencePanelOpen(false); setReferencePanelTimer(null); }, 700);
    setReferencePanelTimer(timer);
  }

  function handleSidebarMouseLeave() {
    setHoveredTab(null);
    if (mcqPanelOpen) scheduleMcqPanelClose();
    if (referencePanelOpen) scheduleReferencePanelClose();
  }

  function handleTabClick(id: WorkspaceTab) {
    onChange(id);
    if (id === "mcq") {
      setMcqPanelOpen(true);
      setReferencePanelOpen(false);
    } else if (id === "guidelines") {
      setReferencePanelOpen(true);
      setMcqPanelOpen(false);
    } else {
      setMcqPanelOpen(false);
      setReferencePanelOpen(false);
    }
  }

  function handleMcqSectionChange(section: McqSection) {
    onChange("mcq");
    onMcqSectionChange(section);
  }

  function handleReferenceSectionChange(section: ReferenceSection) {
    onChange("guidelines");
    onReferenceSectionChange(section);
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

  const visualTab = hoveredTab || (mcqPanelOpen ? "mcq" : referencePanelOpen ? "guidelines" : activeTab);

  return (
    <div onMouseLeave={handleSidebarMouseLeave} className={`workspace-sidebar flex w-full flex-col px-5 pt-5 lg:fixed lg:bottom-0 lg:left-0 lg:top-0 lg:z-[60] lg:w-20 lg:overflow-x-hidden lg:overflow-y-auto lg:border-r lg:border-slate-200/80 lg:bg-white/80 lg:px-2 lg:py-6 lg:shadow-[8px_0_30px_rgba(15,23,42,.04)] ${mcqPanelOpen || referencePanelOpen ? "workspace-sidebar--panel-open" : ""}`}>
      <div className="workspace-sidebar__brand hidden items-center gap-3 lg:flex">
        <img src="/hoc-bai-icon.png" alt="StudyHub" className="h-11 w-11 rounded-xl object-contain" />
        <div className="workspace-sidebar__brand-copy min-w-0"><p className="truncate text-lg font-extrabold tracking-tight text-rose-950">StudyHub</p><p className="text-xs font-medium text-rose-400">Học đều, nhớ lâu</p></div>
      </div>
      <div className="workspace-sidebar__divider my-6 hidden border-t border-slate-200/80 lg:block" />
      <nav
        className={`workspace-tabs workspace-tabs--sidebar ${analyticsAdmin ? "workspace-tabs--with-admin" : ""} glass-panel grid grid-cols-2 gap-2 border border-white/70 bg-white/58 p-2 sm:grid-cols-5 lg:mt-0 lg:grid-cols-1 lg:border-0 lg:bg-transparent lg:p-0`}
        aria-label="Khu vực học tập"
      >
        <span
          className={`workspace-tabs__glider ${analyticsPanelOpen ? "workspace-tabs__glider--hidden" : visualTab === "mcq" ? "workspace-tabs__glider--mcq" : visualTab === "tools" ? "workspace-tabs__glider--tools" : visualTab === "guidelines" ? "workspace-tabs__glider--guidelines" : visualTab === "drugs" ? "workspace-tabs__glider--drugs" : visualTab === "admin" ? "workspace-tabs__glider--admin" : ""}`}
          aria-hidden="true"
        />
        {tabs.map(({ id, label, icon: Icon }, tabIndex) => {
          const active = !analyticsPanelOpen && visualTab === id;
          const distance = hoveredTab ? Math.abs(tabs.findIndex((tab) => tab.id === hoveredTab) - tabIndex) : 99;
          const dockClass = hoveredTab === id ? "workspace-tabs__button--dock-hover" : distance === 1 ? "workspace-tabs__button--dock-neighbor" : "";
          const hasHoverPanel = id === "mcq" || id === "guidelines";
          const panelOpen = id === "mcq" ? mcqPanelOpen : id === "guidelines" ? referencePanelOpen : false;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleTabClick(id)}
              onMouseLeave={() => { setHoveredTab(null); if (id === "mcq") scheduleMcqPanelClose(); if (id === "guidelines") scheduleReferencePanelClose(); }}
              onMouseEnter={() => { setHoveredTab(id); if (id === "mcq") { setReferencePanelOpen(false); keepMcqPanelOpen(); } if (id === "guidelines") { setMcqPanelOpen(false); keepReferencePanelOpen(); } }}
              onFocus={() => { setHoveredTab(id); if (id === "mcq") { setReferencePanelOpen(false); keepMcqPanelOpen(); } if (id === "guidelines") { setMcqPanelOpen(false); keepReferencePanelOpen(); } }}
              onBlur={() => { setHoveredTab(null); if (id === "mcq") scheduleMcqPanelClose(); if (id === "guidelines") scheduleReferencePanelClose(); }}
              className={`workspace-tabs__button ${active ? "workspace-tabs__button--active" : ""} ${dockClass}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="workspace-tabs__icon shrink-0"><Icon size={21} strokeWidth={2.2} /></span>
              <span className="workspace-tabs__label">{label}</span>
              {hasHoverPanel && (panelOpen ? <ChevronRight size={15} aria-hidden="true" className="workspace-tabs__panel-arrow shrink-0 text-slate-400" /> : <ChevronDown size={15} aria-hidden="true" className="workspace-tabs__panel-arrow shrink-0 text-slate-400" />)}
            </button>
          );
        })}
      </nav>
      <McqSectionsPanel section={mcqSection} onChange={handleMcqSectionChange} open={mcqPanelOpen} onMouseEnter={keepMcqPanelOpen} onMouseLeave={scheduleMcqPanelClose} />
      <ReferenceSectionsPanel section={referenceSection} onChange={handleReferenceSectionChange} open={referencePanelOpen} onMouseEnter={keepReferencePanelOpen} onMouseLeave={scheduleReferencePanelClose} />
      {analyticsAdmin && activeTab !== "admin" && <SiteAnalytics userId={user?.id} visible placement="sidebar" onExpandedChange={handleAnalyticsExpanded} />}
      <WorkspaceSettings user={user} onUserChange={onUserChange} theme={theme} onThemeChange={onThemeChange} sharedDeckNotificationsEnabled={sharedDeckNotificationsEnabled} onSharedDeckNotificationsChange={onSharedDeckNotificationsChange} />
    </div>
  );
}
