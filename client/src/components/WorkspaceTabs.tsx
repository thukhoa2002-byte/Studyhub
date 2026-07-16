import { BookOpen, BookOpenCheck, Pill } from "lucide-react";

export type WorkspaceTab = "flashcards" | "guidelines" | "drugs";

interface Props {
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
}

const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof BookOpen }> = [
  { id: "flashcards", label: "Flashcard", icon: BookOpen },
  { id: "guidelines", label: "Guidelines", icon: BookOpenCheck },
  { id: "drugs", label: "Drugs", icon: Pill },
];

export default function WorkspaceTabs({ activeTab, onChange }: Props) {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-5">
      <nav
        className="workspace-tabs glass-panel grid grid-cols-3 gap-2 border border-white/70 bg-white/58 p-2"
        aria-label="Khu vực học tập"
      >
        <span
          className={`workspace-tabs__glider ${activeTab === "guidelines" ? "workspace-tabs__glider--guidelines" : activeTab === "drugs" ? "workspace-tabs__glider--drugs" : ""}`}
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
