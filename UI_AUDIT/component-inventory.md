# StudyHub UI Audit: Component Inventory

Location root: `client/src/components`. Variants are inferred from props, route branches and visible class names.

## Navigation, shell and account

| Component | Location | Variants | Current usage |
|---|---|---|---|
| `Header` | `components/Header.tsx` | public header, auth state, theme-aware | Top-level app header |
| `Navbar` | `components/Navbar.tsx` | desktop/mobile navigation | Legacy/main navigation surface |
| `WorkspaceTabs` | `components/WorkspaceTabs.tsx` | rail, expanded sidebar, active glider, admin tab | Primary workspace navigation |
| `WorkspaceSettings` | `components/WorkspaceSettings.tsx` | closed/open menu, theme/profile/help views | Account footer in sidebar |
| `AdminLayout` | `components/AdminLayout.tsx` | admin sidebar, breadcrumb, content shell | All `/admin/*` routes |
| `Footer` | `components/Footer.tsx` | daily quote, shiny quote animation | Main app footer/quote |
| `PandaAssistant` | `components/PandaAssistant.tsx` | study, sleep, exercise and floating states | Floating assistant |
| `SiteAnalytics` | `components/SiteAnalytics.tsx` | sidebar panel, dashboard panel | Admin analytics |

## Guideline and reference surfaces

| Component | Location | Variants | Current usage |
|---|---|---|---|
| `GuidelineDataPage` | `components/GuidelineDataPage.tsx` | list, detail, language mode, deep-link target | Public Guideline Core reader |
| `GuidelinesPage` | `components/GuidelinesPage.tsx` | translated/original tabs, extraction, owner controls | Legacy/reference Guideline reader and importer |
| `AdminGuidelinePage` | `components/AdminGuidelinePage.tsx` | list, editor route dispatch | Admin Guideline entry point |
| `AdminGuidelineStructuredEditor` | `components/AdminGuidelineStructuredEditor.tsx` | overview, sections, recommendations, sources | Sprint C structured editor |
| `ReferenceLibraryPage` | `components/ReferenceLibraryPage.tsx` | Guideline, books, tools, folders | Reference library shell |
| `ReferenceSectionsPanel` | `components/ReferenceSectionsPanel.tsx` | Guideline, books, tools | Sidebar child panel |
| `ReferenceToolsPage` | `components/ReferenceToolsPage.tsx` | calculator, formula, data table, score, medical calculator | Public reference tools and formula editor |

## Calculator and Drug surfaces

| Component | Location | Variants | Current usage |
|---|---|---|---|
| `CalculatorPublicPage` | `modules/calculators/CalculatorPublicPage.tsx` | list, detail, loading, not-found, filters, relation blocks | Public database calculators |
| `AdminCalculatorPage` | `components/AdminCalculatorPage.tsx` | list, editor, relation panel, notices | Admin calculator CRUD and Guideline relations |
| `AdminCalculatorImportPage` | `components/AdminCalculatorImportPage.tsx` | import/drop, parse and save | Admin calculator import |
| `DrugsPage` | `components/DrugsPage.tsx` | list/detail route dispatch | Public Drug shell |
| `DrugDataPage` | `components/DrugDataPage.tsx` | list, detail, localized fields, empty related data | Public Drug data |
| `AdminDrugPage` | `components/AdminDrugPage.tsx` | list, new, edit, detail, import dispatch | Admin Drug shell |
| `AdminDrugEditor` | `components/AdminDrugEditor.tsx` | new/edit, structured lists, links, advanced settings | Manual Drug editor |
| `AdminDrugImportPage` | `components/AdminDrugImportPage.tsx` | PDF/DOCX/JSON/AI import | Admin Drug import |

## Flashcard, MCQ and study components

| Component | Location | Variants | Current usage |
|---|---|---|---|
| `DeckSetup` | `components/DeckSetup.tsx` | import/create/AI, deck tree, saved deck list | Flashcard setup and library |
| `Study` | `components/Study.tsx` | review card, navigation, rate/add-to-deck | Study mode |
| `Review` | `components/Review.tsx` | review summary and bookmark | Review mode |
| `DeckEditor` | `components/DeckEditor.tsx` | edit card content and image | Flashcard editing |
| `QuestionList` | `components/QuestionList.tsx` | list/grouped questions | Question editing |
| `QuestionCard` | `components/QuestionCard.tsx` | answer states, image, explanation | MCQ/flashcard question card |
| `McqPage` | `components/McqPage.tsx` | bank list, folder tree, editor and study | MCQ workspace |
| `McqAdminStudio` | `components/McqAdminStudio.tsx` | bank management and import | MCQ admin studio |
| `McqSectionsPanel` | `components/McqSectionsPanel.tsx` | create/manage banks | Sidebar MCQ panel |
| `McqAccessPanel` | `components/McqAccessPanel.tsx` | permission list/add/remove | MCQ permissions |
| `ShareDeckDialog` | `components/ShareDeckDialog.tsx` | sharing, member role/access | Flashcard sharing |
| `SharedDeckNotification` | `components/SharedDeckNotification.tsx` | toast/list, dismiss, disable | Shared deck notifications |

## Forms, overlays and primitives

| Component | Location | Variants | Current usage |
|---|---|---|---|
| `AuthPanel` | `components/AuthPanel.tsx` | signed-out/signed-in, OAuth, profile | Authentication/profile |
| `ConfirmDialog` | `components/ConfirmDialog.tsx` | danger/default, confirm/cancel | Destructive action confirmation |
| `ImageCropDialog` | `components/ImageCropDialog.tsx` | crop/zoom/rotate/confirm | Image crop workflow |
| `LoadingOverlay` | `components/LoadingOverlay.tsx` | title/description/image | Full-screen async operations |
| `AnimatedDropdown` | `components/AnimatedDropdown.tsx` | selected/open/keyboard style | Custom select replacement |
| `FileDropZone` | `components/FileDropZone.tsx` | single/multiple/active/disabled | File imports |
| `UploadImage` | `components/UploadImage.tsx` | upload/preview/error | Image input |
| `RichTextEditor` | `components/RichTextEditor.tsx` | rich text/image/format toolbar | Explanations and content |
| `RippleButton` | `components/RippleButton.tsx` | disabled, ripple palette | Command buttons |
| `MenuCard` | `components/MenuCard.tsx` | icon/title/description/click | Feature menu cards |
| `ScoreCard` | `components/ScoreCard.tsx` | stat card variants | Calculator/analytics stats |
| `LungIcon` | `components/LungIcon.tsx` | size/stroke | MCQ icon library |
| `KidneyIcon` | `components/KidneyIcon.tsx` | size/stroke | MCQ icon library |
| `McqIcon` | `components/McqIcon.tsx` | size/stroke | MCQ navigation/cards |

## Patterns without a shared primitive

Inputs, textareas, buttons, alert boxes, cards, tabs, badges, empty states and list rows are often inline Tailwind markup inside feature components. `ReferenceToolsPage`, `AdminCalculatorPage`, `AdminDrugEditor`, `GuidelinesPage` and `AdminGuidelineStructuredEditor` each define local field/panel patterns. This is the main duplication target for a later design-system pass.
