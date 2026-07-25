# StudyHub UI Audit Report

## Scope

This is a documentation-only audit of the current StudyHub UI. No source files, database schema, migrations or Git history were changed for the audit. The report combines source inventory with the available staging screenshots.

## Current strengths

- Clear top-level learning domains and a dedicated admin shell.
- Newer Guideline Core editor has distinct overview, section, recommendation and source-document areas.
- Strong visual identity based on Be Vietnam Pro, rose/teal accents and glass surfaces.
- Reusable navigation and domain icon components exist.
- Public calculators and Guideline Core services have explicit loading/not-found/related-content patterns.
- Theme support includes Color, Basic, Test, Test Light and Green.

## Current weaknesses

- Public Guideline experiences are split between legacy/source-document UI and Guideline Core UI.
- Visual tokens are distributed across Tailwind classes, CSS literals, inline SVG and feature components.
- Form controls, action bars, notices, cards and empty states are locally implemented many times.
- Sidebar hover/click panels and fixed widths are tightly coupled to CSS geometry.
- Public, admin and reference layouts use different max-widths, radii, shadows and density without a documented system.
- English technical labels and Vietnamese labels are mixed in authoring and administration surfaces.
- Screenshot evidence is incomplete for the requested full coverage because the active browser session could not remain on staging.

## Priority plan

### High

- Establish semantic design tokens and shared primitives.
- Consolidate public Guideline onto one information architecture.
- Redesign the workspace shell/sidebar/panel state machine.
- Standardize admin authoring layout, validation, notices and save actions.
- Define responsive rules for long medical forms and dense data.

### Medium

- Standardize Calculator, Drug and MCQ cards/forms.
- Unify list/detail/related-content layouts.
- Define empty, error, loading and confirmation patterns.
- Audit color contrast and keyboard/focus behavior across themes.

### Low

- Polish assistant, welcome animation, icon set and motion consistency.
- Reduce duplicate inline icon/color declarations after the token layer exists.

## Estimated effort

Approximately 12–20 engineering days for a first standardization/redesign pass, excluding new domain features. This assumes the existing service and route architecture remains in place.

## Recommended redesign sequence

1. Tokens and primitives.
2. Main shell/sidebar/navigation.
3. Guideline public list/detail and editor.
4. Calculator and Drug authoring surfaces.
5. MCQ and reference tools.
6. Responsive/accessibility regression and screenshot refresh.

## Audit deliverables

- [Application map](application-map.md)
- [Component inventory](component-inventory.md)
- [Color system](color-system.md)
- [Typography](typography.md)
- [Layout system](layout-system.md)
- [UX review](ux-review.md)
- [Screenshot index](SCREENSHOT_INDEX.md)
- Screenshots under `screenshots/`

## Evidence and limitations

- Route and component findings are based on `client/src/App.tsx`, `client/src/utils/dataRoutes.ts`, feature components and services.
- CSS findings are based on `client/src/index.css`, `client/src/App.css` and component utility classes.
- No valid staging screenshot was retained after visual inspection; all screenshot coverage is explicitly marked `BLOCKED` in `SCREENSHOT_INDEX.md` rather than using unrelated captures.
- No redesign, refactor, migration, commit, push, merge or deployment was performed for this audit.
