const SPECIAL_EMAILS = new Set(["totentu162@gmail.com", "thukhoa2002@gmail.com"]);

export function isSpecialUser(email?: string | null) {
  return email ? SPECIAL_EMAILS.has(email.trim().toLowerCase()) : false;
}
