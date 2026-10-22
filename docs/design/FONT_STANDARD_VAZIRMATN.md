# TTO Design System — typography baseline

**Approved standard font (2026-10-22): Vazirmatn / وزیرمتن**, for **all three** portals and their shared controls, charts, menus, dialogs, forms and future application pages.

- Next.js 16 apps: `next/font/google` Vazirmatn with Arabic and Latin subsets, font variable `--tto-font`. Bundled/self-hosted at Next build time; no browser Google font request at runtime.
- All body/forms/interactive controls: `font-family:var(--tto-font),Vazirmatn,Tahoma,Arial,sans-serif`.
- Legacy static-only review shells use the same font by Google Fonts CSS. These are superseded by Next previews and are not production templates.
- Standard direction RTL and `lang=fa`, sensible numerical LTR spans as needed. Font loading cannot imply successful domain/API implementation.
- Verify actual Next build and browser computed font on all three protected previews. Source reference repository with 15 files stays read-only.
