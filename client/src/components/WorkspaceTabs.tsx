import { BookOpen, BookOpenCheck, Pill } from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";
import type { User } from "@supabase/supabase-js";
import McqIcon from "./McqIcon";
import WorkspaceSettings from "./WorkspaceSettings";

export type WorkspaceTab = "flashcards" | "mcq" | "guidelines" | "drugs";

interface Props {
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  user: User | null;
  onUserChange: (user: User | null) => void;
  theme: "color" | "basic" | "test" | "test-light";
  onThemeChange: (theme: "color" | "basic" | "test" | "test-light") => void;
  sharedDeckNotificationsEnabled: boolean;
  onSharedDeckNotificationsChange: (enabled: boolean) => void;
}

const tabs: Array<{ id: WorkspaceTab; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { id: "flashcards", label: "Flashcard", icon: BookOpen },
  { id: "mcq", label: "MCQ", icon: McqIcon },
  { id: "guidelines", label: "Tài liệu tham khảo", icon: BookOpenCheck },
  { id: "drugs", label: "Drugs", icon: Pill },
];

export default function WorkspaceTabs({ activeTab, onChange, user, onUserChange, theme, onThemeChange, sharedDeckNotificationsEnabled, onSharedDeckNotificationsChange }: Props) {
  const [hoveredTab, setHoveredTab] = useState<WorkspaceTab | null>(null);

  return (
    <div className="workspace-sidebar w-full px-5 pt-5 lg:fixed lg:bottom-0 lg:left-0 lg:top-16 lg:z-40 lg:w-16 lg:overflow-x-hidden lg:overflow-y-auto lg:border-r lg:border-white/70 lg:bg-white/30 lg:px-2 lg:pt-5">
      <nav
        className="workspace-tabs glass-panel grid grid-cols-2 gap-2 border border-white/70 bg-white/58 p-2 sm:grid-cols-4 lg:grid-cols-1"
        aria-label="Khu vực học tập"
      >
        <span
          className={`workspace-tabs__glider ${activeTab === "mcq" ? "workspace-tabs__glider--mcq" : activeTab === "guidelines" ? "workspace-tabs__glider--guidelines" : activeTab === "drugs" ? "workspace-tabs__glider--drugs" : ""}`}
          aria-hidden="true"
        />
        {tabs.map(({ id, label, icon: Icon }, tabIndex) => {
          const active = activeTab === id;
          const distance = hoveredTab ? Math.abs(tabs.findIndex((tab) => tab.id === hoveredTab) - tabIndex) : 99;
          const dockClass = hoveredTab === id ? "workspace-tabs__button--dock-hover" : distance === 1 ? "workspace-tabs__button--dock-neighbor" : "";
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              onMouseEnter={() => setHoveredTab(id)}
              onMouseLeave={() => setHoveredTab(null)}
              onFocus={() => setHoveredTab(id)}
              onBlur={() => setHoveredTab(null)}
              className={`workspace-tabs__button ${active ? "workspace-tabs__button--active" : ""} ${dockClass}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={21} strokeWidth={2.2} />
              <span className="workspace-tabs__label">{label}</span>
            </button>
          );
        })}
      </nav>
      <WorkspaceSettings user={user} onUserChange={onUserChange} theme={theme} onThemeChange={onThemeChange} sharedDeckNotificationsEnabled={sharedDeckNotificationsEnabled} onSharedDeckNotificationsChange={onSharedDeckNotificationsChange} />
    </div>
  );
}
