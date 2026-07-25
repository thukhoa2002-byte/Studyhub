# Theme Architecture

## Available themes

StudyHub exposes exactly two runtime themes:

- `default`: the standard neutral, reading-first UI. It is the fallback for everyone.
- `color`: the existing pink/teal visual theme, retained without a palette redesign.

The theme union is defined in `client/src/theme/themeTypes.ts`. Historic theme names are intentionally invalid at runtime.

## Application flow

`App` derives eligibility from the signed-in Supabase user, loads the preference keyed to the normalized user ID/email, sanitizes it, then writes `data-theme` on `<html>`. A guest, a normal user, or an invalid stored value always resolves to `default` before any theme selector is rendered.

Preferences use `studyhub:theme:<normalized-user-id-or-email>`. `color` is the only value persisted; Default removes the per-user preference. This prevents a Color preference leaking to a later signed-in account on the same browser.

## Token model

`client/src/index.css` provides the approved Default semantic token values through `:root` and `html[data-theme="default"]`. `html[data-theme="color"]` maps the existing Color visual values to the same token names. Components can use the semantic tokens without knowing which theme is active.

## Legacy style isolation

The stylesheet still contains historical selectors for experimental theme attributes. They are not accepted by `AppTheme`, are never restored from preferences, and are not exposed in the account UI. They are legacy CSS only and must not be used by new components; the only supported runtime themes are `default` and `color`.
