import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LanguageMode, LocalizedText } from "../types/language";

const defaultStorageKey = "studyhub:language-mode";
const missingTranslation = "Chưa có bản dịch tiếng Việt.";
const missingOriginal = "Chưa có bản tiếng Anh gốc.";

function isLocalizedText(value: unknown): value is LocalizedText {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function getLanguageMode(value: unknown): LanguageMode {
  return value === "en" || value === "bilingual" ? value : "vi";
}

export function resolveLocalizedText(value: unknown, mode: LanguageMode, fallback = "Chưa có dữ liệu"): string {
  if (typeof value === "string") return value.trim() || fallback;
  if (Array.isArray(value)) {
    const items = value.map((item) => resolveLocalizedText(item, mode, "")).filter(Boolean);
    return items.length ? items.join("\n") : fallback;
  }
  if (!isLocalizedText(value)) return fallback;
  const vi = String(value.vi || "").trim();
  const en = String(value.en || "").trim();
  if (mode === "vi") return vi || (en ? missingTranslation : fallback);
  if (mode === "en") return en || (vi ? missingOriginal : fallback);
  if (vi && en) return `${vi}\n\nEnglish original\n${en}`;
  if (vi) return `${vi}\n\nEnglish original\n${missingOriginal}`;
  if (en) return `${missingTranslation}\n\nEnglish original\n${en}`;
  return fallback;
}

export function useLanguageMode(storageKey = defaultStorageKey): [LanguageMode, (mode: LanguageMode) => void] {
  const [mode, setMode] = useState<LanguageMode>(() => {
    if (typeof window === "undefined") return "vi";
    return getLanguageMode(window.localStorage.getItem(storageKey));
  });
  useEffect(() => { window.localStorage.setItem(storageKey, mode); }, [mode, storageKey]);
  return [mode, setMode];
}

export function LanguageToggle({ value, onChange, className = "" }: { value: LanguageMode; onChange: (mode: LanguageMode) => void; className?: string }) {
  const options: Array<[LanguageMode, string]> = [["vi", "Tiếng Việt"], ["en", "English"], ["bilingual", "Song ngữ"]];
  return <div className={`inline-flex max-w-full flex-wrap rounded-xl border border-slate-200 bg-white/85 p-1 shadow-sm ${className}`} role="radiogroup" aria-label="Ngôn ngữ hiển thị">
    {options.map(([mode, label]) => <button key={mode} type="button" role="radio" aria-checked={value === mode} aria-label={`Hiển thị ${label}`} onClick={() => onChange(mode)} className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${value === mode ? "bg-teal-500 text-white shadow-sm" : "text-slate-600 hover:bg-teal-50"}`}>{label}</button>)}
  </div>;
}

export function LocalizedTextView({ value, mode, fallback = "Chưa có dữ liệu", className = "" }: { value: unknown; mode: LanguageMode; fallback?: string; className?: string }): ReactNode {
  return <span className={`whitespace-pre-line ${className}`}>{resolveLocalizedText(value, mode, fallback)}</span>;
}
