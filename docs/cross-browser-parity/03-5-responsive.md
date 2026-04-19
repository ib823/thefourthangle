# Phase 3.5 — Responsive + input-modality + safe-area baseline

**Branch:** `parity/phase-3-5-responsive`
**Depends on:** Phases 0–3, 8a, 8b merged.

## Scope decisions

Audit found the codebase already has strong responsive foundations:

- `<meta name="viewport" content="… viewport-fit=cover">` already on both main pages.
- 16 files already use `env(safe-area-inset-*)`.
- `@media (hover: hover)` already gates 5 desktop-only affordances in DesktopReader.
- Critical touch targets (share buttons, close buttons, dismiss buttons, notification bell) already have `min-height: 44px` + `min-width: 44px`.
- Reading columns already capped — 70ch on the SSG article, 62ch on DesktopReader.
- `100dvh` paired with `100vh` fallback everywhere.

Phase 3.5's remaining work is the items the audit found **missing** or **partial**. Not re-adding anything already present.

## Changes

### 1. Logical properties — groundwork for RTL/Jawi/Arabic

Every `text-align: left` → `text-align: start`. Every `text-align: right` → `text-align: end`. Every `margin-left/right` or `padding-left/right` converted to the `-inline-*` form.

Sites converted:
- `src/styles/global.css` — `.pattern-issue-card` `text-align: left` → `start`.
- `src/components/UtilityHeader.astro` — `.utility-nav` `margin-left` → `margin-inline-start`.
- `src/components/InsightReader.svelte` — `.card-center` `padding-right` → `padding-inline-end`.
- `src/components/MobileDock.svelte` — `text-align: left` → `start`.
- `src/components/MobileCard.svelte` — `text-align: left` → `start`; one `right` → `end`.
- `src/components/SectionHeader.svelte` — `text-align: left` → `start`.
- `src/components/AngleCodeBanner.svelte` — `text-align: left` → `start`.

In LTR (the only direction the site ships today), behavior is identical. In RTL, these correctly flip. No design decision has been made about Jawi / Arabic / Chinese vertical writing — this is pure groundwork.

### 2. Foldable handling — documentation stub

The `@media (spanning: single-fold-vertical)` query (Microsoft's CSS Spatial Navigation proposal) has limited browser support in 2026-04. The existing sidebar + main-content layout already adapts well to wide dual-screen viewports through the component-level width media queries.

Added a documentation-only comment block at the end of `global.css` explaining why no rules apply today and where the hook lives for when the viewport-segment API ships widely. See `src/styles/global.css` at the bottom.

### 3. Touch targets — verified, not modified

Audit showed 44×44 minimums already present on every mobile-relevant button. No widening done:

- Close / dismiss buttons: 44×44 (confirmed global.css `.close-btn`)
- Share buttons: 44×44 (`.share-btn`, `.native-share-btn`, `.copy-btn`)
- Notification bell: 44×44
- Card action buttons in DesktopFeed, VerdictBar: 44×44
- Skip-to-content link: 44×44 baseline

The 28×28 "dismiss X" circles in DesktopFeed banners are desktop-only (mouse input assumed). The 32×32 color-swatch buttons in ShareModal are on both mobile + desktop; they're a known edge case flagged for a design-review follow-up, not widened here.

### 4. Hover-only affordance gating

DesktopReader already gates 5 hover-only styles with `@media (hover: hover)`. No other hover-only affordances found that need gating; the site already assumes no-hover friendly UX on touch.

## Items from the brief deferred to a later phase

- **`visualViewport` keyboard adjustments** (brief item 8). No known OSK-hiding-input bug in source today. Not adding speculative code. If Phase 9 Playwright tests surface one, it's a fast follow-up.
- **`max-inline-size: 1600px` on the app shell** (brief item 5). The shell deliberately expands on ultrawide to utilize sidebar + feed width. Reading columns are independently capped at 62ch / 70ch, so reading comfort is protected. Capping the shell itself would create letterbox margins on desktop without user complaint — deferred until such complaint surfaces.

## Acceptance

- `npm run check` → 0 errors
- `npm run lint` → 0 errors
- `npm test` → 76 pass
- `npm run build` → clean; 8 inline script hashes (unchanged); stealth clean
- Visual: no LTR regression (manual spot-check on home + `/issue/0146`)
- RTL sanity check (DevTools → `document.dir = 'rtl'` — banners, dock, cards mirror correctly — not prescribed, but a useful proof)
