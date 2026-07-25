# Design Token Specification

## Semantic colors

The canonical Default values are defined in `client/src/index.css` and include:

- Surfaces: `--background`, `--background-subtle`, `--surface`, `--surface-elevated`, `--surface-hover`, `--surface-active`, `--surface-selected`
- Brand/actions: `--primary`, `--secondary`, `--accent` and their hover/subtle variants
- Text: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-disabled`, `--text-link`
- Boundaries: `--border`, `--border-strong`, `--divider`, `--focus-ring`
- Status: Success, Warning, Danger, and Info groups with base, hover, subtle, border, and foreground values

## Neutral scale

`--neutral-50` through `--neutral-950` use the approved slate scale. New shared UI should consume semantic tokens first and the neutral scale only for structural composition.

## Elevation and radius

- `--shadow-sm`: controls ordinary cards and controls.
- `--shadow-md`: hover and raised menus.
- `--shadow-lg`: dialogs only.
- `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`: 8px, 12px, 16px, and 20px equivalents.

## Interaction layers

- `--z-sticky`: header and ordinary sticky content.
- `--z-dropdown`: portalled select content.
- `--z-tooltip`: side panels and tooltips.
- `--z-drawer`: mobile navigation drawer.
- `--z-modal`: dialogs, above the chatbot.
- `--z-toast`: transient notices.
- `--z-chatbot`: fixed panda assistant, below dialogs and above ordinary content.

## Typography

- UI/body: Inter with system fallback.
- Headings: Poppins with Inter fallback.
- Formula/code: JetBrains Mono with monospace fallback.
