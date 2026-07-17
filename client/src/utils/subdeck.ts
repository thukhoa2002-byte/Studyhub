export const DEFAULT_SUBDECK = "Tự tạo";

export function normalizeSubdeck(value: string, fallback = "") {
  const normalized = value
    .split("::")
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("::");

  return normalized || fallback;
}

export function listSubdeckSuggestions(values: Array<string | null | undefined>) {
  return Array.from(new Set(
    values
      .map((value) => normalizeSubdeck(value || ""))
      .filter((value): value is string => Boolean(value))
  )).sort((a, b) => a.localeCompare(b, "vi"));
}
