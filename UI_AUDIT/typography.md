# StudyHub UI Audit: Typography

## Fonts

- Primary UI font: `Be Vietnam Pro` loaded from Google Fonts in `client/src/index.css`.
- Fallback: `sans-serif`; selected components use `Arial`, `Georgia` or `Times New Roman` for special presentation.
- Formula editor/preview deliberately uses `Times New Roman, Georgia, serif`.
- Test themes override the body font to `Arial, Helvetica, sans-serif`.

## Scale and hierarchy

Observed Tailwind and CSS sizes:

| Layer | Typical sizes | Typical weight |
|---|---|---|
| Display/welcome | `2rem` and occasional `text-4xl` | 800–900 |
| Page title | `text-2xl` to `text-4xl` | 800–900 |
| Section title | `text-lg` to `text-xl` | 800–900 |
| Card title | `text-base` to `text-lg` | 700–900 |
| Body | `1rem`, `text-sm` | 500–700 |
| Metadata/helper | `text-xs`, `text-[11px]`, `text-[10px]` | 500–800 |
| Formula | `1.05rem` to `1.6rem`, serif | 600–900 |

The CSS base is `16px` with `line-height: 1.6`; rich text uses `1.75` and `.rich-content` uses `1.8`.

## Findings

- Weight is used as the main hierarchy signal; many labels are bold or extra-bold.
- Uppercase eyebrow labels with letter spacing recur in admin and reference pages.
- Some screens mix Vietnamese UI text with English technical labels (`Guideline`, `Formula`, `Help center`, source states).
- Font size and weight are mostly utility-class driven, with no documented type scale or heading component.
- Long labels in the sidebar and medical tools rely on truncation or wrapping; the same semantic level does not always have the same size.
- Accessibility follow-up: verify contrast for light slate metadata, pastel borders, disabled controls and dark/test themes.
