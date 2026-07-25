# StudyHub UI Audit: Screenshot Index

Screenshots are stored under `screenshots/desktop`, `screenshots/responsive` and `screenshots/states`. The available computer-use session did not produce a valid StudyHub capture; true browser full-page capture was not available in this workspace.

## Captured

No valid StudyHub screenshot is included as evidence. The files currently present in `screenshots/desktop/` are unverified intermediate captures from unrelated browser tabs and must not be used for UI review.

## Requested coverage matrix

| Screen/state | Status | Evidence or reason |
|---|---|---|
| Login | BLOCKED | No stable logged-out staging state available in the active session |
| Dashboard | BLOCKED | No stable route/session capture completed |
| Sidebar | BLOCKED | Source-audited; active staging capture unavailable after Safari tab changed |
| Header | BLOCKED | Source-audited; no stable capture |
| Guideline List | BLOCKED | No valid StudyHub capture |
| Create Guideline | BLOCKED | Route exists; active session capture unavailable |
| Guideline Editor | BLOCKED | Route exists; no valid StudyHub capture |
| Section Editor | BLOCKED | Route exists; no stable capture |
| Recommendation Editor | BLOCKED | No valid StudyHub capture |
| Calculator List | BLOCKED | Route exists; no stable capture |
| Calculator Detail | BLOCKED | Route exists; no stable capture |
| Calculator Admin | BLOCKED | Route exists; no stable capture |
| Search | BLOCKED | Feature-specific search controls exist, no stable capture |
| Profile | BLOCKED | `WorkspaceSettings` source-audited, no stable capture |
| Settings | BLOCKED | `WorkspaceSettings` source-audited, no stable capture |
| Dialog | BLOCKED | `ConfirmDialog` and other dialogs exist, no stable capture |
| Drawer/panel | BLOCKED | Sidebar panels exist, no stable capture |
| Empty state | BLOCKED | Implemented in multiple components, no stable capture |
| Error state | BLOCKED | Implemented in notices/alerts, no stable capture |
| Loading state/skeleton | BLOCKED | Loading overlays/inline states exist, no stable capture |
| Table | BLOCKED | Formula/reference table styles exist, no stable capture |
| Card layout | BLOCKED | Source-audited; no valid StudyHub capture |
| Dark mode | BLOCKED | `data-theme=test` exists, no stable capture |
| Responsive tablet/mobile | BLOCKED | CSS branches exist; no stable responsive browser capture |

## Capture limitation

The browser session landed on unrelated active tabs and could not reliably select the staging tab. This package therefore distinguishes source-derived coverage from screenshot evidence rather than including unrelated images.
