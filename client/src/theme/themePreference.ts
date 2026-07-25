import { defaultTheme, isAppTheme, type AppTheme } from "./themeTypes.ts";

const themeKeyPrefix = "studyhub:theme:";

function identityKey(identity?: string | null) {
  return identity?.trim().toLowerCase() || null;
}

export function themePreferenceKey(identity?: string | null) {
  const normalized = identityKey(identity);
  return normalized ? `${themeKeyPrefix}${normalized}` : null;
}

export function sanitizeThemePreference(value: unknown, canUseColor: boolean): AppTheme {
  return canUseColor && value === "color" ? "color" : defaultTheme;
}

export function readThemePreference(identity: string | null | undefined, canUseColor: boolean): AppTheme {
  const key = themePreferenceKey(identity);
  if (!key || typeof window === "undefined" || !canUseColor) return defaultTheme;
  const saved = window.localStorage.getItem(key);
  if (isAppTheme(saved)) return sanitizeThemePreference(saved, canUseColor);
  if (saved) window.localStorage.removeItem(key);
  return defaultTheme;
}

export function writeThemePreference(identity: string | null | undefined, theme: AppTheme, canUseColor: boolean) {
  const key = themePreferenceKey(identity);
  if (!key || typeof window === "undefined") return;
  if (!canUseColor || theme !== "color") {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, theme);
}
