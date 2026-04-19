# Phase 5 — User and OS setting support

**Branch:** `parity/phase-5-settings`

## Audit (what was already in place)

| Preference | Coverage on main (pre-Phase 5) |
|---|---|
| `prefers-reduced-motion: reduce` | 5 usages — `global.css` global animation kill + component-level gates |
| `prefers-color-scheme: dark` | 19 usages — `tokens.css` full dark pass + component overrides |
| `prefers-contrast: more` | 1 usage — `tokens.css` high-contrast token pack |
| `forced-colors: active` | 1 usage — `global.css` Windows High Contrast mode (borders, links, focus) |
| `prefers-reduced-transparency: reduce` | **0 — missing** |
| `prefers-reduced-data: reduce` | **0 — missing** |
| Manual theme override via `data-theme="dark"` | Added in Phase 2 |

Plus the `startViewTransition` JS got its reduced-motion gate in Phase 3.

## Changes in this phase

### 1. `prefers-reduced-transparency: reduce`

New block in `global.css` that disables every `backdrop-filter` site-wide and promotes translucent headers/docks to opaque:

```css
@media (prefers-reduced-transparency: reduce) {
  *, *::before, *::after {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .site-header,
  .utility-header,
  .dock-prompts,
  .mobile-dock {
    background: var(--bg-elevated, #F8F9FA) !important;
  }
}
```

Covers every structural surface wrapped in Phase 3's `@supports` block plus the decorative ones left inline. The `!important` is justified here because this is a user-preference override against every other site-defined backdrop style.

### 2. `prefers-reduced-data: reduce` — documented hook

CSS-only levers for Save-Data mode are narrow: `<link rel="preload">` has already fired by the time CSS parses, so the fonts arrive regardless. The hero image at 3.4 KB AVIF on mobile has no lower-quality variant worth serving. Added a documented-but-empty block as a hook for future decoration suppression:

```css
@media (prefers-reduced-data: reduce) {
  /* reserved: future decoration suppression */
}
```

A later phase (or a follow-up) can gate auto-played videos, parallax backgrounds, or other non-essential decorations here.

### 3. Opinion Shift severity — already text-based, verified

The brief asks: "Opinion Shift card gets a solid border and a textual severity label rather than relying on gradient hue alone" under `forced-colors`.

Audit: every component rendering Opinion Shift (`DesktopReader`, `DesktopCard`, `InsightReader`, `MobileCard`, `FeedRow`, and the SSG article) already renders the textual severity label (`opinionLabel(issue.opinionShift)` → "Fundamental" / "Significant" / "Partial" / "Surface") alongside the number. In forced-colors mode, colors are replaced with system colors but text content is preserved — the severity is always readable.

The existing `@media (forced-colors: active)` block in `global.css:376-405` adds `border: 1px solid ButtonText` to hero cards and panels, which satisfies the "solid border" part of the rule.

No change required — the behavior already holds.

### 4. Semantic HTML for Reader Mode — already in place from Phase 8a

Edge Immersive Reader, Safari Reader, and Firefox Reader all extract the article from `<article>` + `<h1>` + `<p>` signals. Phase 8a added the full SSG article with `<article>`, `<header>`, single `<h1>`, deck `<p>`, hero `<figure>`, `<aside>` for Opinion Shift, `<section>` per card, `<time datetime>`, and `<footer>` for the quality score.

Manual verify: on a published issue URL, trigger Reader Mode (Safari address-bar button, Firefox Reader-view button, Edge Immersive Reader). Headline, deck, hero, body, and Opinion Shift all extract cleanly.

## Not changed

- `prefers-reduced-motion` already fully covered — audit confirmed no additional animation sites needed gating. The Phase 3 addition of the `startViewTransition` JS gate was the last gap.
- `prefers-contrast: more` already has a token pack — no new work.
- `prefers-color-scheme: dark` fully covered (Phase 2 added the `data-theme` hook; the main dark pass is pre-existing).
- `forced-colors: active` already has its block — the Opinion Shift severity concern is covered by textual labels that already exist.

## Acceptance

- `npm run check` → 0 errors
- `npm run lint` → 0 errors
- `npm test` → 76 pass
- `npm run build` → clean; 8 hashes unchanged; stealth clean

## Manual verification steps

1. **Reduced motion:** DevTools → Rendering → emulate `prefers-reduced-motion: reduce` → all transitions snap instantly; View Transitions skip.
2. **Forced colors:** Windows 11 → Settings → Accessibility → Contrast themes → Aquatic (or Desert) → the site renders with system colors; Opinion Shift severity label still readable.
3. **Reduced transparency:** macOS → Settings → Accessibility → Display → Reduce transparency → headers become opaque; `backdrop-filter` gone.
4. **Reduced data:** Chrome DevTools → Network → throttle to "Low-end mobile" + Lighthouse Save-Data → no blocked behavior today (hook reserved for later).
5. **Reader mode:** Safari Reader on `/issue/0146` — headline, deck, hero, body, Opinion Shift all extract.
