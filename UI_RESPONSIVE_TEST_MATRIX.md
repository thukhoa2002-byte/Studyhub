# UI Responsive Test Matrix

| Viewport | Verify |
| --- | --- |
| 1440px desktop | Default and Color header, collapsed rail, hover/focus expanded full logo, account menu, admin sidebar |
| 1024px laptop | Expanded rail reserves main-content offset; menu/dialog remains inside viewport |
| 768px tablet | Drawer replaces fixed rail; filters wrap without horizontal overflow; forms retain labels and controls |
| 390px mobile | Drawer close/Escape/focus return, navigation labels, menus and dialogs fit width; panda sits above action safe area |

Across all viewports: test keyboard focus, 200% text zoom, long Vietnamese labels, portalled select positioning, table horizontal scrolling where present, and `prefers-reduced-motion` behavior.
