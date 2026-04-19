# Parity checklist — every PR

Every PR that touches UI, state, or build output must pass the items below before merge. Items grouped by phase so you can see which phase each rule comes from.

## State + sidebar invariant (Phase 1)

- [ ] All new state reads/writes go through `src/lib/reading-state.ts` — **never** `localStorage.getItem`/`setItem` directly (outside `reading-state.ts` itself).
- [ ] New storage keys prefixed `tfa:v1:*` (no legacy `tfa-*` creation).
- [ ] Any new sidebar section is added to `FEED_SECTIONS` in `src/lib/feed-sections.ts` — **never** rendered outside that list.
- [ ] Empty-state rendering tested (a section with count `0` must still render).

## Tokens (Phase 2)

- [ ] New color / spacing / radius / z-index / motion values resolved from `src/styles/tokens.css` — not inline hex or magic numbers.
- [ ] New tokens only if the audit-first rule was followed (extend, don't duplicate).
- [ ] Focus treatment uses the global `:focus-visible` rule; **no** local `outline: none` without a replacement.

## Progressive enhancement (Phase 3)

- [ ] `100dvh` always paired with `100vh` fallback.
- [ ] `backdrop-filter` on structural surfaces wrapped in `@supports ((backdrop-filter) or (-webkit-backdrop-filter))` with a solid rgba baseline.
- [ ] `text-wrap: balance/pretty` wrapped in `@supports`.
- [ ] `startViewTransition` gated on both `prefers-reduced-motion` AND `dataset.env === 'webview'`.
- [ ] **No scaffolding** for CSS features not already present (container queries, `:has()`, subgrid, `color-mix`, etc.).

## Responsive + logical properties (Phase 3.5)

- [ ] Every new `text-align` is `start`/`end` — never `left`/`right`.
- [ ] Every new margin/padding/inset is `-inline-*` / `-block-*` — never `-left`/`-right`/`-top`/`-bottom` (except where the design is intrinsically physical, e.g. top/bottom of a fixed bar).
- [ ] Touch targets ≥ 44×44 CSS px on mobile viewports.
- [ ] Hover-only affordances behind `@media (hover: hover) and (pointer: fine)`.
- [ ] `env(safe-area-inset-*)` applied to any bottom-fixed / top-fixed UI.

## Typography (Phase 4)

- [ ] Font budget ≤ 60 KB brotli on-the-wire (enforced by `npm run check-fonts`).
- [ ] New fonts added with `font-display: swap`.
- [ ] Only one critical weight per family preloaded.

## User / OS settings (Phase 5)

- [ ] New animations gated by `@media (prefers-reduced-motion: reduce)`.
- [ ] New colours have a `forced-colors: active` fallback (system colors or visible border) if hue is the only signal.
- [ ] New glass / translucent surfaces covered by the `prefers-reduced-transparency: reduce` kill block (in `global.css`) or a local equivalent.
- [ ] New dark-mode tokens added to **both** the `@media (prefers-color-scheme: dark)` block and the `:root[data-theme="dark"]` block in `tokens.css`.

## ARIA + AT (Phase 5.5)

- [ ] New interactive elements have an accessible name (`aria-label`, `aria-labelledby`, or visible text).
- [ ] New landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`, `role="search"`, etc.) have `aria-label` when two of the same landmark appear on a page.
- [ ] Keyboard-only flow verified: Tab reaches every interactive element; focus visible; no traps.
- [ ] Native controls (`<select>`, `<input type="search">`, scrollbars, focus rings) kept native unless replacement is justified by an ADR.

## Viewport (Phase 6)

- [ ] Reading columns cap at `max-inline-size: 70ch` (SSG article) or `62ch` (hydrated reader).
- [ ] Print stylesheet — changes to article structure verified in `Cmd/Ctrl+P` preview.

## Translate / extensions (Phase 7)

- [ ] Identity / numeric / date elements marked `translate="no"` (brand, scores, dates, URLs).
- [ ] New content surface added? The Google-Translate `<font>`-unset rule in `global.css` covers the default surfaces; if the new surface is outside those selectors, add it.

## SSG content + images (Phases 8a, 8b)

- [ ] New content surface at a static URL renders user-visible content in the `.astro` file (not post-hydration). Readers with JS disabled must see the full article.
- [ ] Content-bearing island uses `client:idle` (or more deferred). `client:load` only with a one-line justification.
- [ ] New hero images go through the `<picture>` pipeline: AVIF → WebP → JPEG at 640/960/1200 widths. Hero role: `loading="eager"` + `fetchpriority="high"`. Non-hero: `loading="lazy"` + `decoding="async"`.
- [ ] Explicit `width` / `height` on every new `<img>` to prevent CLS.

## Webview + degraded environments (Phase 8.5)

- [ ] No feature assumes `localStorage.setItem` will succeed — if relevant, listen for `tfa:storage-unavailable` and degrade gracefully.
- [ ] New features that fail in in-app webviews are gated on `document.documentElement.dataset.env === 'webview'`.

## CI (Phase 9)

- [ ] `npm run check-fonts` green (font budget).
- [ ] `npm run check-bundle` green (or baseline updated with justification).
- [ ] `npm run e2e` green in CI across all 7 project × viewport combos.
- [ ] `npx playwright test tests/e2e/a11y.spec.ts` green (no serious/critical axe violations).

## Test-hook rule

- [ ] Every Playwright selector uses ARIA role, text content, or a **repo-owned `data-*` attribute** — **never** stealth-renamed class names, `data-astro-*`, or framework tag names (`astro-island`, etc.). See ADR-0002 Phase 8 split + the Phase 0 audit § B for the stealth rename list.

## Inline script rule

- [ ] New `<script is:inline>` must not contain framework names (`astro`, `svelte`, `astro-island`) in comments or strings — the stealth verification scanner fails the build.
