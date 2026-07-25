# Theme Permission Specification

## Eligibility

`canUseColorTheme(email)` normalizes email by trimming and lowercasing it. It returns true for:

1. Existing configured StudyHub administrator email(s).
2. `totentu162@gmail.com`, which is always eligible.

At present the project has no shared role/profile claim accessible to the client, so “administrator” uses the current configured email policy. A future common role system should replace the administrator-email set without changing the theme API.

## Enforcement

- Guests and normal users receive `default` and have no Color selector.
- Theme setters sanitize a non-eligible Color request to Default.
- Preference reads return Default before reading Color for a non-eligible identity.
- Invalid or historical preference values are removed when read.
- Each preference is scoped to a normalized authenticated identity; no global `hocbai-theme` preference is used.

Theme permission is UI preference access only. It does not change authentication, routes, APIs, RLS, or publication access.
