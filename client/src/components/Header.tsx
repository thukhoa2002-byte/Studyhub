import AuthPanel from "./AuthPanel";
import StudyHubIcon from "./branding/StudyHubIcon";
import type { AppTheme } from "../theme/themeTypes";
import { Menu } from "lucide-react";

interface Props {
  onHome?: () => void;
  onUserChange?: (user: import("@supabase/supabase-js").User | null) => void;
  specialUser?: boolean;
  canUseColorTheme: boolean;
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  sharedDeckNotificationsEnabled: boolean;
  onSharedDeckNotificationsChange: (enabled: boolean) => void;
  onOpenNavigation?: () => void;
  navigationOpen?: boolean;
}

export default function Header({ onHome, onUserChange, specialUser = false, canUseColorTheme, theme, onThemeChange, sharedDeckNotificationsEnabled, onSharedDeckNotificationsChange, onOpenNavigation, navigationOpen = false }: Props) {
  return (
    <header className="app-header sticky top-0 z-[var(--z-sticky)] border-b">

      <div className="mx-auto flex h-16 max-w-[1900px] items-center justify-between px-5 sm:px-6 xl:px-8 lg:pl-72">

        {/* Logo */}

        <div className="flex items-center gap-2 lg:hidden">
          {onOpenNavigation && <button id="studyhub-mobile-nav-trigger" type="button" onClick={onOpenNavigation} aria-label="Mở điều hướng" aria-controls="studyhub-mobile-navigation" aria-expanded={navigationOpen} title="Mở điều hướng" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Menu size={21} /></button>}
          <button type="button" onClick={onHome} title="StudyHub" aria-label="Về trang chủ StudyHub" className="flex cursor-pointer items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><StudyHubIcon size="md" /></button>
        </div>

        {/* Right */}

        <div className="flex shrink-0 items-center gap-3">
          <AuthPanel onUserChange={onUserChange ?? (() => undefined)} specialUser={specialUser} canUseColorTheme={canUseColorTheme} theme={theme} onThemeChange={onThemeChange} sharedDeckNotificationsEnabled={sharedDeckNotificationsEnabled} onSharedDeckNotificationsChange={onSharedDeckNotificationsChange} showMenu={false} showAuthenticatedControl={false} />
        </div>

      </div>

    </header>
  );
}
