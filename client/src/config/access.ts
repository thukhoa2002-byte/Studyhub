const SPECIAL_EMAILS = new Set(["totentu162@gmail.com", "thukhoa2002@gmail.com"]);
const ANALYTICS_ADMIN_EMAIL = "thukhoa2002@gmail.com";

export function isSpecialUser(email?: string | null) {
  return email ? SPECIAL_EMAILS.has(email.trim().toLowerCase()) : false;
}

export function isAnalyticsAdmin(email?: string | null) {
  return email?.trim().toLowerCase() === ANALYTICS_ADMIN_EMAIL;
}
