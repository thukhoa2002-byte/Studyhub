import AuthPanel from "./AuthPanel";

interface Props {
  onHome?: () => void;
  onUserChange?: (user: import("@supabase/supabase-js").User | null) => void;
  specialUser?: boolean;
  theme: "color" | "basic" | "test" | "test-light";
  onThemeChange: (theme: "color" | "basic" | "test" | "test-light") => void;
  sharedDeckNotificationsEnabled: boolean;
  onSharedDeckNotificationsChange: (enabled: boolean) => void;
}

export default function Header({ onHome, onUserChange, specialUser = false, theme, onThemeChange, sharedDeckNotificationsEnabled, onSharedDeckNotificationsChange }: Props) {
  return (
    <header className="glass-header sticky top-0 z-50 border-b border-rose-100 bg-white/65 backdrop-blur-xl">

      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">

        {/* Logo */}

        <button type="button" onClick={onHome} title="Về màn hình chính" aria-label="Về màn hình chính" className="flex cursor-pointer items-center gap-5 rounded-xl text-left outline-none transition hover:bg-rose-50/70 focus-visible:ring-2 focus-visible:ring-rose-300">

          <img src="/hoc-bai-icon.png" alt="Cây viết, cuốn vở và ống nghe" className="h-16 w-16 rounded-xl object-contain" />

          <div>

            <h1 className="text-lg font-bold tracking-tight text-rose-950">

              StudyHub

            </h1>

            <p className="text-xs font-medium text-rose-400">Học đều, nhớ lâu</p>

          </div>

        </button>

        {/* Right */}

        <div className="flex shrink-0 items-center gap-3">
          <AuthPanel onUserChange={onUserChange ?? (() => undefined)} specialUser={specialUser} theme={theme} onThemeChange={onThemeChange} sharedDeckNotificationsEnabled={sharedDeckNotificationsEnabled} onSharedDeckNotificationsChange={onSharedDeckNotificationsChange} />
        </div>

      </div>

    </header>
  );
}
