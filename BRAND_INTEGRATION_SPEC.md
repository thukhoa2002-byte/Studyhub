# Brand Integration Specification

## Approved assets

- `client/public/brand/studyhub-logo.svg`
- `client/public/brand/studyhub-icon.svg`

Both files are copied unchanged from the approved supplied SVGs. Components reference them as static files, use `object-contain`, and do not apply filters, masks, transforms, clipping, or direct shadow.

## Placement

- Expanded desktop sidebar: full logo.
- Collapsed desktop sidebar: icon.
- Compact mobile header: icon.
- Admin workspace: full logo.
- Welcome/loading surface: icon.
- Browser and PWA metadata: icon through `client/index.html` and `client/public/manifest.webmanifest`.

The supplied full logo contains the StudyHub identity, so adjacent recreated StudyHub wordmark/slogan text is not shown.
