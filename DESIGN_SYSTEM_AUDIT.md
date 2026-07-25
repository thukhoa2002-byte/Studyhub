# Design System Audit

## Scope

This audit covers the StudyHub client UI only. No domain service, publication rule, RLS policy, database schema, calculator engine, or medical content was changed.

## Current implementation

- Theme runtime: `client/src/App.tsx`
- Theme types and persistence: `client/src/theme/`
- Global tokens and shared visual primitives: `client/src/index.css`
- Branding primitives: `client/src/components/branding/`
- Public shell: `Header`, `WorkspaceTabs`, `WorkspaceSettings`, `AuthPanel`
- Admin shell: `AdminLayout`

## Findings addressed

| Area | Previous state | Current state |
| --- | --- | --- |
| Themes | Five selectable runtime theme values and global storage | Two runtime values, per-user preference, Default fallback |
| Branding | Recreated title text and legacy raster icon | Official static logo/icon assets and shared components |
| Default surfaces | Pink gradient/glass applied broadly | Neutral reading background, white surfaces, restrained elevation |
| Focus | Page-specific focus colors | Shared `--focus-ring` with visible keyboard outline |
| Typography | Be Vietnam Pro used for all content | Inter for UI, Poppins headings, JetBrains Mono for technical content |

## Remaining incremental work

- Most legacy component classes still contain historical Tailwind color utilities. New shared shell/panel styles consume semantic variables, while component-by-component token conversion should be performed only when those components are changed for a feature.
- Deprecated CSS for historic `basic`, `test`, `test-light`, and `green` themes remains inert for compatibility with cached styles; no runtime code can select those values.
- No common role/profile table exists. Current administrator eligibility remains the established normalized email policy.
# Final Coherence Update

The final coherence pass consolidates the visual layer without changing routes, authentication, content access, medical content, services, APIs or persistence.

- Default uses neutral reading surfaces, navy titles and blue primary actions.
- Module colors remain limited to compact icon bubbles, small metadata and status context.
- Color remains the established alternative palette and is not flattened.
- User navigation retains its existing auto-collapse behavior: 80px desktop rail, expanded full logo on hover/focus, and an off-canvas mobile drawer.
- `SharedSelect` is the shared controlled dropdown for active structured forms. It portals its menu to `document.body`, flips when needed and preserves invalid/archived values rather than silently replacing them.
- Existing native selects in legacy/AI import surfaces remain a known incremental-consolidation item; they are not a new source of truth or a business-flow change.
