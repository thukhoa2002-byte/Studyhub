# Component Library

StudyHub keeps its existing component library and incrementally normalizes it rather than introducing a second UI library.

| Component or primitive | Location | Current variants / use |
| --- | --- | --- |
| Branding | `components/branding/StudyHubLogo.tsx`, `StudyHubIcon.tsx` | `sm`, `md`, `lg`; meaningful or decorative alt text |
| App header / topbar | `components/Header.tsx`, `components/AdminLayout.tsx` | Shared surface, token borders and responsive account/action areas |
| Workspace navigation | `components/WorkspaceTabs.tsx` | 80px auto-collapsed desktop rail, expanded hover/focus state, keyboard tooltips and focus-managed mobile drawer |
| Account/theme menu | `components/WorkspaceSettings.tsx`, `AuthPanel.tsx` | Account menu, eligible two-theme selector, notification switch |
| Admin shell | `components/AdminLayout.tsx` | Sidebar, breadcrumb, responsive compact navigation |
| Page, card and feedback primitives | `components/UiPrimitives.tsx` | `PageContainer`, `PageHeader`, `Card`, `Alert`, `EmptyState`, `StatusBadge`, `IconButton` |
| Select / combobox | `components/SharedSelect.tsx` | Controlled values, portal rendering, viewport collision handling, search, keyboard navigation, unavailable-value state |
| Dialog | `components/ConfirmDialog.tsx` | Semantic modal layer, focus trap, Escape close and focus return |
| Surface primitives | `.glass-panel`, `.glass-card`, `.glass-dialog`, `.ui-card` in `index.css` | Default uses neutral tokenized reading surfaces; Color retains established appearance |
| Inputs and rich text | `.rich-editor`, `.shared-select__*` in `index.css` | Single token-based focus treatment and contextual options |

Existing feature-level cards, tables, alerts, dialogs, tabs, dropdowns, and forms remain in their modules. They should be consolidated only when a feature change makes that safe.
