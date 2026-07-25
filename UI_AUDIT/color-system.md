# StudyHub UI Audit: Color System

## Current semantic palette

The project does not have one centralized token file. The base palette is split between Tailwind utility classes, hardcoded values in `client/src/index.css`, inline SVG/icon colors, and feature-specific component literals.

| Role | Current observed values | Notes |
|---|---|---|
| Page background | `#FFF7FB`, `#fff7fb`, `#fafafa`, `#f8e7c9`, `#fffaf0` | Pink/white default, Basic neutral, Green theme champagne |
| Primary text | `#3B2430`, `#4c0519`, `#881337`, slate `#334155/#475569` | Multiple dark text families |
| Muted text | `#64748b`, `#94a3b8`, `#5b7067`, `#858c95` | Reasonably consistent slate baseline, theme overrides vary |
| Surface | `#fff`, `#ffffff`, `#fffaf0`, translucent white | Cards often rely on `bg-white/*` utilities |
| Border | `#cbd5e1`, `#e2e8f0`, `#fbcfe8`, `#99f6e4`, theme alpha borders | Border colors change per feature accent |
| Pink/rose | `#fb7185`, `#f472b6`, `#e11d48`, `#be185d`, `#fce7f3`, `#fbcfe8` | Default brand and danger/attention family overlap |
| Violet | `#8b5cf6`, `#c4b5fd`, `#6f22ff`, `#4c1d95`, `#f5f3ff` | Admin and formula emphasis |
| Teal/emerald | `#14b8a6`, `#2dd4bf`, `#0f766e`, `#064e3b`, `#008f86`, `#00bf70` | Success, action and Green theme family |
| Blue/sky | `#0799e5`, `#1aa7e6`, `#3b82f6`, `#2563eb`, `#dcecf5` | Links, new status, MCQ progress |
| Amber/warning | `#ffd166`, `#cfa76d`, `#a86b00`, `#f8e7c9` | Warning and Green/champagne overlap |
| Error | `#f43f5e`, `#e11d48`, `#ff1744`, `#c2415b` | Several red scales are used |
| Info | `#0ea5e9`/sky utilities, `#72e8f2` in Test theme | No single info token |

## Themes

- `color`: default pink/teal gradient language.
- `basic`: neutral `#fafafa` canvas.
- `test`: dark liquid-glass theme with `#07090f`, `#111827`, blue/cyan/purple accents.
- `test-light`: light liquid-glass theme with custom `--tl-*` variables and background radial gradients.
- `green`: `#064E3B` Emerald with `#F8E7C9` Champagne, plus `--green-*` variables.

## Hardcoded colors and gradients

- `index.css` contains a large number of hardcoded hex and rgba values, including animation colors and theme overrides.
- `GuidelinesPage.tsx` contains a separate set of hardcoded gray/rose/teal colors.
- `RichTextEditor.tsx` contains a Google-Docs-like highlight/text color palette with many literal colors.
- Gradients are used for page backgrounds, active tabs, glass sheen, welcome screen, calculator/reference panels and Green/Test themes.
- There is no Tailwind configuration with a clearly named custom semantic palette in the audited source; most semantic color names are Tailwind defaults.

## Audit finding

High priority: define semantic CSS variables for brand, content, border, state and theme tokens before redesign. The current color system is expressive but hard to reason about, and semantic meanings are not stable across modules.

## Exhaustive literal inventory

The following hex literals were extracted from `client/src` during the audit. They are listed as an inventory, not as a recommendation to preserve every value:

```text
#000000 #000080 #0000ff #005b96 #0070c0 #008000 #008080 #008c85 #008f86 #00b050 #00bf70 #00ffff #039 #043c2f #064E3B #07090f #0799e5 #08151a #0f766e #0f9d95 #102a40 #111111 #111827 #123c38 #12c88a #14b8a6 #151a29 #172033 #1aa7e6 #1b625a #2563eb #293b49 #2c8066 #2dd4bf #2f91a6 #315f84 #334155 #374151 #3B2430 #3b82f6 #404040 #451323 #475569 #481527 #4a1020 #4b0082 #4c0519 #4c1d95 #526a83 #533b20 #546176 #55c58f #5b7067 #64748b #6b1839 #6b7280 #6eb6c4 #6f22ff #6f9d98 #7030a0 #72e8f2 #78501f #789087 #7890a7 #789bb7 #7f7f00 #7faea7 #808080 #842d49 #858c95 #86622d #881337 #8b5cf6 #94a3b8 #95603f #99f6e4 #9fc5e8 #a2c4c9 #a86b00 #ad8b5e #aebdce #b4a7d6 #b6d7a8 #b9dce3 #bd798c #be185d #bf6f89 #bf9000 #c00000 #c084fc #c2415b #c4b5fd #c73855 #c9a7ff #cbd5e1 #cccccc #ccfbf1 #ce8298 #cf3f58 #cfa76d #cfe2f3 #d0d0d2 #d0e0e3 #d5a6bd #d946ef #d9d2e9 #d9ead3 #dce7ee #dcecf5 #e11d48 #e2e8f0 #e5f1e9 #e65c00 #e9e8ed #ea9999 #ead1dc #eadde2 #eb5975 #ecfdf5 #eeeeee #eefcf6 #f0d9e1 #f0fdfa #f1f1f2 #f2a43a #f3e8ff #f43f5e #f472b6 #f4cccc #f5f3ff #F8E7C9 #f8fafc #f9a8d4 #f9cb9c #fafafa #fb7185 #fbbf24 #fbcfe8 #fce5cd #fce7f3 #ff0000 #ff1744 #ff5875 #ff6600 #ff8fa3 #ffc000 #ffd000 #ffd166 #ffe4ef #ffe599 #fff #fff0f3 #fff1f7 #fff2cc #fff7fb #fffaf0 #ffff00 #ffffff
```

Named CSS variable families include `--tl-*` for Test Light, `--green-*` for Green, plus local `--ripple-*`, `--ribbon-*`, `--accent*`, `--text-h`, `--border`, `--shadow` and `--social-bg` variables.
