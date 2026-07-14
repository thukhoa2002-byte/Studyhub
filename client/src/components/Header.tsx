import AuthPanel from "./AuthPanel";
import ReminderSettings from "./ReminderSettings";

interface Props {
  onUserChange?: (user: import("@supabase/supabase-js").User | null) => void;
}

export default function Header({ onUserChange }: Props) {
  return (
    <header className="sticky top-0 z-50 border-b border-rose-100 bg-white/85 backdrop-blur-xl">

      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">

        {/* Logo */}

        <div className="flex items-center gap-5">

          <img src="/hoc-bai-icon.png" alt="Cây viết, cuốn vở và ống nghe" className="h-16 w-16 rounded-xl object-contain" />

          <div>

            <h1 className="text-lg font-bold tracking-tight text-rose-950">

              Học bài thoiii

            </h1>

            <p className="text-xs font-medium text-rose-400">Học đều, nhớ lâu</p>

          </div>

        </div>

        {/* Right */}

        <div className="flex items-center gap-3">
          <ReminderSettings />
          <AuthPanel onUserChange={onUserChange ?? (() => undefined)} />
        </div>

      </div>

    </header>
  );
}
