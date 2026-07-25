export const appThemes = ["default", "color"] as const;

export type AppTheme = (typeof appThemes)[number];

export const defaultTheme: AppTheme = "default";

export function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === "string" && (appThemes as readonly string[]).includes(value);
}
