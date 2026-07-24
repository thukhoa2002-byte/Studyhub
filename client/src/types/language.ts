export type LanguageMode = "vi" | "en" | "bilingual";

export interface LocalizedText {
  vi?: string;
  en?: string;
}

export type LocalizedContent = Record<string, LocalizedText | LocalizedText[] | string | string[] | undefined>;

export interface TranslationMetadata {
  sourceLanguage?: string;
  translationLanguage?: string;
  translationStatus?: "completed" | "failed" | "pending";
  translationModel?: string;
  translationPromptVersion?: string;
  translatedAt?: string;
}
