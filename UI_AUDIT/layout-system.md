# StudyHub UI Audit: Layout System

## Containers and shell

- Main admin shell: `max-w-[1800px]`, centered with a fixed `w-64` admin sidebar on large screens.
- Public/reference content commonly uses `max-w-[1200px]`, `max-w-[1600px]` or `max-w-3xl` depending on feature.
- Main workspace sidebar: fixed desktop rail `w-20`; expands to `15rem` on hover, focus or open panel.
- Mobile/sidebar behavior is handled through Tailwind breakpoints and alternate grid layouts rather than a separate shell.

## Grid and spacing

- Common grids: `grid-cols-2`, `sm:grid-cols-2`, `md:grid-cols-2`, `lg:grid-cols-2`, `lg:grid-cols-3`, and feature-specific arbitrary columns.
- Form fields frequently use two columns on medium/large screens and one column on mobile.
- Common spacing values are Tailwind defaults (`.5rem`, `.75rem`, `1rem`, `1.25rem`, `1.5rem`, `2rem`), with many local exceptions.
- Sidebar navigation uses a fixed `3.65rem` row and glider math to animate the active surface.
- Desktop content often uses `px-4`, `sm:px-6`, `xl:px-8`; admin content has larger section padding.

## Surfaces

- Standard card radius: `rounded-xl` or `rounded-2xl`.
- Glass system forces `.glass-panel`, `.glass-card`, `.glass-dialog` to `1.25rem` radius.
- Pills and active gliders use `rounded-full` or `rounded-[999px]`.
- Shadows range from Tailwind `shadow-sm`/`shadow-lg` to custom glass shadows with multiple inset layers.
- Borders are usually 1px, pastel and feature-colored.

## Responsive behavior

- Tailwind/default breakpoints are used: mobile below `640px`, tablet `640–1023px`, desktop `1024px+`.
- `index.css` has explicit `max-width: 639px`, `640–1023px`, `min-width: 1024px` rules for workspace navigation.
- Desktop sidebar rail becomes a two-column/stacked workspace navigation on smaller widths.
- Some panels are hidden at `max-width: 1023px` (`.mcq-access-popover`, `.mcq-sections-popover`, `.reference-sections-popover`) rather than replaced with a documented mobile interaction.
- Tables and long form content depend on wrapping/scrolling; no global responsive table contract is documented.

## Layout risks

- Different max-widths create visible density changes between public reference, admin and calculator screens.
- Fixed sidebar panel positioning (`left: 15rem`) is tightly coupled to one expanded width.
- `backdrop-filter`, fixed overlays and long admin forms need viewport and zoom testing.
- A global spacing/radius scale is implied by utility classes but not codified for reuse.
