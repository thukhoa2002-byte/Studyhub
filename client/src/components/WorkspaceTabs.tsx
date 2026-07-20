import { BookOpen, BookOpenCheck, FlaskConical, Pill } from "lucide-react";
import type { ComponentType } from "react";
import McqIcon from "./McqIcon";

export type WorkspaceTab = "flashcards" | "mcq" | "guidelines" | "drugs" | "test";

interface Props {
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
}

const tabs: Array<{ id: WorkspaceTab; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { id: "flashcards", label: "Flashcard", icon: BookOpen },
  { id: "mcq", label: "MCQ", icon: McqIcon },
  { id: "guidelines", label: "Tài liệu tham khảo", icon: BookOpenCheck },
  { id: "drugs", label: "Drugs", icon: Pill },
  { id: "test", label: "Test", icon: FlaskConical },
];

export default function WorkspaceTabs({ activeTab, onChange }: Props) {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-5">
      <nav
        className="workspace-tabs glass-panel grid grid-cols-2 gap-2 border border-white/70 bg-white/58 p-2 sm:grid-cols-5"
        aria-label="Khu vực học tập"
      >
        <span
          className={`workspace-tabs__glider ${activeTab === "mcq" ? "workspace-tabs__glider--mcq" : activeTab === "guidelines" ? "workspace-tabs__glider--guidelines" : activeTab === "drugs" ? "workspace-tabs__glider--drugs" : activeTab === "test" ? "workspace-tabs__glider--test" : ""}`}
          aria-hidden="true"
        />
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`workspace-tabs__button ${active ? "workspace-tabs__button--active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={21} strokeWidth={2.2} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
