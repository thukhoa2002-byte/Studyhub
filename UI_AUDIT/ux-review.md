# StudyHub UI Audit: UX Review

## Strengths

- Strong domain grouping: Thẻ học, Trắc nghiệm, Công cụ & Bảng tra, Tài liệu tham khảo and Thuốc are visible at the primary navigation level.
- Admin has a dedicated shell and breadcrumb context, separate from the public workspace.
- Guideline Core editor exposes lifecycle, nested sections, recommendations and optional sources as separate tabs.
- Loading, empty, notice and not-found states exist in several newer services/pages.
- The active navigation glider, panel pop animation and reduced-motion rules create a recognizable interaction language.
- The application supports multiple themes and a focused medical-calculator workflow.

## High priority inconsistencies

1. **Two Guideline read models**: `GuidelinesPage` still represents the legacy/source-document experience while `GuidelineDataPage` represents Guideline Core. Users can encounter different terminology, publication controls and content structures.
2. **No shared form system**: field labels, input heights, helper text, error presentation and action bars are repeated across Guideline, Drug and Calculator forms.
3. **Color semantics drift**: rose, teal, violet, amber and blue each act as brand, status, action or domain colors in different screens. The same action does not always look the same.
4. **Sidebar/panel coupling**: hover panels, active glider, fixed positioning and expanded width are interdependent. Small pointer gaps can cause panel flicker or active-state jumps.
5. **Public/admin route distinction is mostly visual**: direct route authorization and empty/not-found behavior need to be predictable and consistently communicated.

## Medium priority inconsistencies

- Card radius varies between `rounded-xl`, `rounded-2xl`, forced glass radius and pill surfaces.
- Button labels mix Vietnamese and English technical terms; icon-only controls depend heavily on tooltips.
- Some screens use inline alerts, some use `role=alert` notices, some use browser `alert`/confirm behavior.
- Empty states vary from dashed bordered blocks to plain text; the user action is not always clear.
- Loading states range from full-screen overlay to inline text; skeletons are not a shared pattern.
- Admin tables/lists are mostly card grids, while data-heavy flashcard lists use dense row layouts. Selection, sorting and pagination patterns are not unified.
- Typography hierarchy is weight-heavy and can become visually dense in long forms.

## Low priority / polish

- Icon styles are mostly Lucide, but several custom SVG/domain icons and emoji symbols coexist.
- The welcome animation, glass sheen and shiny quote add personality but may compete with task-focused medical workflows.
- The Green, Test and Test Light themes have different contrast and surface conventions that need a dedicated accessibility pass.

## Screens requiring redesign

| Priority | Screen | Reason |
|---|---|---|
| High | Main workspace + sidebar | Navigation/panel behavior is the most shared interaction and has the strongest coupling |
| High | Guideline public list/detail | Two read models and content density need one information architecture |
| High | Guideline structured editor | Long form, tabs, hierarchy and publication workflow need consistent authoring patterns |
| High | Calculator admin/detail | Medical inputs, results, references and statuses need a stable form/data layout |
| Medium | MCQ studio | Dense content, folder tree and actions need clearer hierarchy |
| Medium | Drug list/editor | Many sections and linked content need standardized repeated-field editing |
| Medium | Reference tools | Search, calculator, formulas, tables and scores mix different modes |
| Low | Profile/settings and assistant | Mostly polish after shell/navigation rules are stabilized |

## Standardization backlog

- Semantic token layer for color, type, spacing, radius, border and elevation.
- Shared `Button`, `IconButton`, `Field`, `Select`, `Notice`, `EmptyState`, `LoadingState`, `Card`, `Tabs`, `Modal` and `Drawer` primitives.
- One navigation/panel state machine for rail, expanded sidebar, hover and click.
- One admin form layout with section headers, field-level errors, save bar and unsaved-change behavior.
- One public content layout for list, detail, related links and empty states.

## Estimated effort

- High-priority foundation and shell: 3–5 engineering days.
- Guideline public/editor standardization: 3–5 days.
- Calculator/Drug/MCQ form and data-density pass: 4–7 days.
- Accessibility, responsive and interaction regression pass: 2–3 days.
- Total first redesign pass: approximately 12–20 engineering days, excluding new domain behavior.
