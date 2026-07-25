# StudyHub UI Audit: Application Map

Audit basis: route parser in `client/src/utils/dataRoutes.ts`, composition in `client/src/App.tsx`, and the current staging session. Status is a code/status assessment, not a claim that every route has been manually exercised.

## Route map

| Route | Purpose | Main components | Surface | Current status |
|---|---|---|---|---|
| `/` | Flashcard workspace, calculator landing fallback and study entry | `App`, `Header`, `WorkspaceTabs`, `DeckSetup`, `Study`, `Review`, `DeckEditor`, `Footer`, `PandaAssistant` | Public/authenticated | Implemented; session-dependent |
| `/guidelines` | Public Guideline Core list | `ReferenceLibraryPage`, `GuidelineDataPage` | Public | Implemented; Core reader path |
| `/guidelines/:slug` | Public Guideline detail, section and recommendation anchors | `GuidelineDataPage` | Public | Implemented; not-found state exists |
| `/guidelines/:slug/:sectionSlug/:recommendationId` | Deep link to a recommendation | `GuidelineDataPage` | Public | Implemented by route parser |
| `/thuoc` | Drug catalog | `DrugsPage`, `DrugDataPage` | Public | Implemented |
| `/thuoc/:slug` | Drug detail | `DrugDataPage` | Public | Implemented |
| `/may-tinh-y-khoa` | Public calculator catalog and filters | `CalculatorPublicPage`, `ReferenceToolsPage` | Public | Implemented; database-backed list |
| `/may-tinh-y-khoa/:slug` | Calculator detail and related Guideline links | `CalculatorPublicPage` | Public | Implemented; published-only query |
| `/admin` | Admin hub | `AdminLayout`, `AdminPage` | Admin | Implemented |
| `/admin/guidelines` | Guideline Core list and entry point | `AdminLayout`, `AdminGuidelinePage`, `AdminGuidelineStructuredEditor` | Admin | Implemented |
| `/admin/guidelines/new` | Create Guideline without a source file | `AdminGuidelineStructuredEditor`, `GuidelineDocumentEditor` | Admin | Implemented |
| `/admin/guidelines/:id` | Guideline workspace overview | `AdminGuidelineStructuredEditor`, `GuidelineWorkspace` | Admin | Implemented |
| `/admin/guidelines/:id/edit` | Edit core Guideline metadata | `OverviewPanel`, `DocumentForm` | Admin | Implemented |
| `/admin/guidelines/:id/sections` | Section hierarchy editor | `SectionsPanel`, `SectionRow` | Admin | Implemented |
| `/admin/guidelines/:id/recommendations` | Recommendation editor | `RecommendationsPanel`, `RecommendationForm` | Admin | Implemented |
| `/admin/thuoc` | Drug admin list | `AdminDrugPage` | Admin | Implemented |
| `/admin/thuoc/new` | Manual Drug editor | `AdminDrugEditor` | Admin | Implemented; separate future module |
| `/admin/thuoc/:id/edit` | Edit Drug | `AdminDrugEditor` | Admin | Implemented |
| `/admin/thuoc/import` | Drug import workflow | `AdminDrugImportPage` | Admin | Implemented |
| `/admin/may-tinh-y-khoa` | Calculator admin list | `AdminCalculatorPage`, `CalculatorList` | Admin | Implemented |
| `/admin/may-tinh-y-khoa/new` | Create calculator | `CalculatorEditor` | Admin | Implemented |
| `/admin/may-tinh-y-khoa/:id/edit` | Edit calculator and Guideline relations | `CalculatorEditor`, `RelationPanel` | Admin | Implemented |
| `/admin/may-tinh-y-khoa/import` | Import calculator data | `AdminCalculatorImportPage` | Admin | Implemented |

## Not currently represented as a route

| Surface | Current status |
|---|---|
| Disease entity/page | Not found in the audited route map |
| Standalone Settings route | Settings are exposed inside `WorkspaceSettings` |
| Standalone Profile route | Profile is exposed inside `WorkspaceSettings` |
| Standalone Login route | Authentication is exposed through `AuthPanel`/header modal behavior |

## Cross-cutting UI surfaces

| Surface | Components | Current status |
|---|---|---|
| Authentication | `AuthPanel`, `Header`, `WorkspaceSettings` | OAuth/profile menu; login is modal/session dependent |
| Main navigation | `Header`, `Navbar`, `WorkspaceTabs`, `ReferenceSectionsPanel`, `McqSectionsPanel` | Implemented; rail expands on desktop and panels are hover/click driven |
| Account/settings | `WorkspaceSettings` | Theme, profile, avatar, notifications and sign-out |
| Flashcards | `DeckSetup`, `Study`, `Review`, `DeckEditor`, `QuestionList`, `QuestionCard`, `ShareDeckDialog` | Implemented, broad legacy surface |
| MCQ | `McqPage`, `McqAdminStudio`, `McqSectionsPanel`, `McqAccessPanel`, `QuestionCard` | Implemented, broad interaction surface |
| Reference library | `ReferenceLibraryPage`, `GuidelinesPage`, `GuidelineDataPage`, `ReferenceToolsPage` | Implemented; legacy and Core Guideline paths coexist |
| Assistant/notifications | `PandaAssistant`, `SharedDeckNotification`, `SiteAnalytics` | Implemented; floating and sidebar overlays |

## Route observations

- The route system is a custom `history.pushState` parser rather than a dedicated router.
- Canonical aliases exist for `/drugs`, `/calculators`, `/guideline/manage` and related legacy paths.
- Admin navigation is guarded in the application, but direct-route behavior should remain part of acceptance testing.
- The same “reference” area contains Guidelines, books and calculators, which creates a cross-module information architecture boundary.
