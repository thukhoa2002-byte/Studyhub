# UI Acceptance Report

## Implemented

- Official SVG logo and icon integrated as immutable static assets.
- Two-theme runtime implemented: Default and existing Color.
- Per-user Color persistence implemented with eligibility validation.
- Default token palette, typography, focus treatment, reading surfaces, shell and navigation normalization applied.
- Shared page, card, alert, empty-state, status-badge and icon-button primitives applied for new and updated surfaces.
- Shared select uses a portal, viewport-aware below/top placement, keyboard navigation and an explicit unavailable-value state.
- Mobile workspace navigation is a focus-managed drawer; confirmation dialogs restore focus after closing.
- Calculator public list/detail use neutral Default-theme surfaces; teal remains limited to icon accents and metadata.
- Favicon, manifest, and browser title updated.

## Required local verification

- `npm test`
- `npx tsc -b`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Manual acceptance

1. As guest and normal user, confirm only Default is active and Color is absent.
2. As `thukhoa2002@gmail.com` or `totentu162@gmail.com`, choose Color, reload, sign out, and confirm a normal account returns to Default.
3. Verify full logo is shown only when the desktop sidebar expands and the icon is centered while collapsed.
4. Verify Default has no page-wide gradient/glass treatment on reading surfaces and has visible keyboard focus.
5. Open a searchable select near the bottom of a viewport: it must flip above without covering its trigger, and Escape/outside click must close it.
6. Open a confirmation dialog, tab through controls, press Escape and confirm focus returns to the trigger.

No migration, deployment, commit, push, or medical/domain change is included in this sprint.

## Host visual checklist

Run the client from the host terminal and open `http://127.0.0.1:5173`.

### Desktop, Default

- [ ] As a guest, the shell opens with a neutral `#F8FAFC` page background and white reading surfaces.
- [ ] The collapsed desktop sidebar shows only the official StudyHub icon, centered in its rail.
- [ ] Hovering or keyboard-focusing the sidebar expands it; the full official logo appears with no recreated StudyHub wordmark beside it.
- [ ] Moving away collapses the sidebar without clipped logo artwork or horizontal page shift.
- [ ] Mobile-width header shows the official icon, not the older brain/pen image.
- [ ] Tab buttons, account menu, dialogs, inputs and active state have visible blue keyboard focus rings.
- [ ] Long content panels remain white/neutral and readable without a full-page gradient or strong glass blur.

### Theme permissions and persistence

- [ ] Guest account menu has no `Color` or theme selector and remains Default.
- [ ] Sign in as an ordinary non-admin account: theme selector remains absent and Default remains active after refresh.
- [ ] Sign in as `thukhoa2002@gmail.com`: account menu and sidebar account settings show exactly `Default` and `Color`.
- [ ] Select `Color`, refresh, and confirm the existing pink/teal appearance returns.
- [ ] Sign out, then sign in as a normal user: UI resolves immediately to Default with no persisted Color leak.
- [ ] Sign in as `totentu162@gmail.com`: `Color` is available even without an administrator workspace visible.

### Responsive

- [ ] At 1440px and 1024px, sidebar, popovers and account menu stay inside the viewport and never overlap central content.
- [ ] At 768px, workspace navigation wraps without horizontal overflow.
- [ ] At 390px, compact header icon, navigation labels, menus and dialogs remain usable without clipped text.
- [ ] At 390px, open the menu: the drawer traps focus, Escape/backdrop closes it, and focus returns to the menu trigger.
- [ ] At every viewport, the panda remains below dialogs and does not cover fixed submit/delete actions after scrolling to page bottom.
- [ ] At 200% browser zoom, full logo remains proportionate and all primary controls remain reachable.

### Brand metadata

- [ ] Browser tab title is `StudyHub | Learn. Connect. Apply.`.
- [ ] Browser favicon uses the supplied StudyHub icon.
- [ ] The artwork remains unfiltered, uncropped and undistorted in sidebar, header and admin workspace.

Record any visual failure with viewport, signed-in identity category, active theme, route and screenshot. These checks are manual visual acceptance only; they do not alter authentication, publication or medical-content access rules.
