# Phase 6 — Viewport + browser-chrome resilience

**Branch:** `parity/phase-6-viewport`

## Audit

Most viewport items were already handled in earlier phases. This phase closes the remaining gaps.

| Brief item | Status |
|---|---|
| `min-inline-size: 320px` baseline | Implicit — no layout block requires < 320 px. Audit found no narrower hardcoded widths. No change. |
| `max-inline-size: 70ch` reading (SSG article) | **Already in Phase 8a** (line 176 of `[id].astro`). No change. |
| `max-inline-size: 62ch` desktop reader body | Already present in `DesktopReader.svelte`. No change. |
| `max-inline-size: 1600px` app shell | **Deferred** (Phase 3.5) — shell deliberately expands on ultrawide; reading columns independently capped. Documented in 03-5-responsive.md. |
| `100vh` → `100dvh` with fallback | **Verified in Phase 3.** Every `100dvh` already paired with preceding `100vh`. |
| Edge sidebar / Chrome side panel / Safari toolbars / Android pull-to-refresh | Existing responsive breakpoints + `dvh` handle these — manual verify below. |
| **Print stylesheet** | **Added in this PR.** |

## New in this phase

### `@media print` — clean printed article

A reader printing `/issue/[id]` from their browser gets a clean single-column article based on the Phase 8a SSG surface, not the interactive reader. Sidebar, dock, share modal, notification bell, and all buttons are hidden. Hero image prints at page width with `page-break-inside: avoid`.

Key rules (see `src/styles/global.css`):

```css
@media print {
  /* Hide every interactive shell element */
  .site-header, .utility-header, .mobile-dock, button, ... { display: none !important; }

  /* SSG article becomes the print surface */
  body { background: #fff; color: #000; font-family: serif; }
  .ssg-article { display: block !important; }

  /* Expand URLs as footnotes for traceability */
  a[href]:not([href^="#"])::after { content: " (" attr(href) ")"; }

  /* Cards + score card stay together on page */
  .ssg-card, .ssg-article__score { page-break-inside: avoid; }
}
```

Intentional choices:
- **Serif typography in print** (Georgia / Times fallback). Serifs read better on paper than sans.
- **No fixed `@page` size.** Honour the user's printer defaults (Letter / A4 per locale).
- **URL footnote expansion** only for external/same-origin links, not fragment-only (`#foo`) anchors. Fragment links are skip-nav artifacts that don't mean anything on paper.
- **`d-island` hidden** — post-stealth custom element name for `astro-island`. Keeps the print output clean even if hydration markers leak.

## Manual verification

1. **Edge sidebar open (Windows 11):** `/issue/0146` renders without horizontal scroll. Reading column stays at 70ch.
2. **Chrome side panel (macOS):** same.
3. **Safari bottom toolbar shows + hides:** `100dvh` snaps correctly; no gap at bottom.
4. **iOS Safari with tab bar at top vs bottom:** article content not clipped by either toolbar.
5. **Android Chrome pull-to-refresh:** page content doesn't fire PTR when scrolling top.
6. **Print preview** (Cmd/Ctrl+P on `/issue/0146`): single-column article, no sidebar, URLs in footnotes, hero image present.

## Acceptance

- `npm run check` → 0 errors
- `npm run lint` → 0 errors
- `npm test` → 76 pass
- `npm run build` → clean; stealth clean; 8 hashes unchanged
- Print preview renders a readable single-column article (manual)
