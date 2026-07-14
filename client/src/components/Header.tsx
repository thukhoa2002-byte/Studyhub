import AuthPanel from "./AuthPanel";

interface Props {
  onUserChange?: (user: import("@supabase/supabase-js").User | null) => void;
  specialUser?: boolean;
  theme: "color" | "basic";
  onThemeChange: (theme: "color" | "basic") => void;
}

export default function Header({ onUserChange, specialUser = false, theme, onThemeChange }: Props) {
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

        <div className="flex shrink-0 items-center gap-3">
          <AuthPanel onUserChange={onUserChange ?? (() => undefined)} specialUser={specialUser} theme={theme} onThemeChange={onThemeChange} />
        </div>

      </div>

    </header>
  );
}
