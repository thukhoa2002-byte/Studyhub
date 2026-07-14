const SPECIAL_EMAIL = "totentu162@gmail.com";

export function isSpecialUser(email?: string | null) {
  return email?.trim().toLowerCase() === SPECIAL_EMAIL;
}
