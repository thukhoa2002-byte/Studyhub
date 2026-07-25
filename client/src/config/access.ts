const SPECIAL_EMAILS = new Set(["totentu162@gmail.com"]);
const ANALYTICS_ADMIN_EMAIL = "thukhoa2002@gmail.com";
const GUIDELINE_ADMIN_EMAIL = "thukhoa2002@gmail.com";
const DRUG_ADMIN_EMAIL = "thukhoa2002@gmail.com";
const CALCULATOR_ADMIN_EMAIL = "thukhoa2002@gmail.com";
const ADMIN_EMAILS = new Set([ANALYTICS_ADMIN_EMAIL, GUIDELINE_ADMIN_EMAIL, DRUG_ADMIN_EMAIL, CALCULATOR_ADMIN_EMAIL]);

function normalizedEmail(email?: string | null) {
  return email?.trim().toLowerCase() || "";
}

export function isSpecialUser(email?: string | null) {
  return SPECIAL_EMAILS.has(normalizedEmail(email));
}

export function canUseColorTheme(email?: string | null) {
  const normalized = normalizedEmail(email);
  return SPECIAL_EMAILS.has(normalized) || ADMIN_EMAILS.has(normalized);
}

export function isAnalyticsAdmin(email?: string | null) {
  return normalizedEmail(email) === ANALYTICS_ADMIN_EMAIL;
}

export function isGuidelineAdmin(email?: string | null) {
  return normalizedEmail(email) === GUIDELINE_ADMIN_EMAIL;
}

export function isDrugAdmin(email?: string | null) {
  return normalizedEmail(email) === DRUG_ADMIN_EMAIL;
}

export function isCalculatorAdmin(email?: string | null) {
  return normalizedEmail(email) === CALCULATOR_ADMIN_EMAIL;
}
