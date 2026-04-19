# Phase 3 — Progressive enhancement

**Branch:** `parity/phase-3-progressive`
**Depends on:** Phases 0, 1, 2, 8a, 8b merged.

## Scope

Per brief-v3 Phase 3 (narrowed by Phase 0 audit): only the five modern CSS features **actually in use** get baseline + `@supports` treatment. No scaffolding for container queries, `:has()`, subgrid, `color-mix`, `oklch`, `@starting-style`, `@property`, or anchor positioning — none of those appear in source.

## The five features and what was done

### 1. `100dvh` — already paired with `100vh` ✓
Audit confirmed every `100dvh` usage (global.css, App.svelte, pages/404.astro) was already paired with a preceding `100vh` declaration. No change required.

### 2. `scrollbar-gutter: stable` — already applied to the scroll root ✓
`src/styles/global.css:25` applies `scrollbar-gutter: stable` to `html` — the document scroll container on every viewport shape. Verified, no change required.

### 3. `backdrop-filter` — wrapped top-level sites in `@supports`

Structural surfaces (headers, docks, sticky navigation) now split the backdrop-filter into an explicit enhancement block:

```css
.site-header {
  background: var(--header-bg);  /* baseline */
  border-bottom: 1px solid rgba(17, 24, 39, 0.05);
}
@supports ((backdrop-filter: blur(12px)) or (-webkit-backdrop-filter: blur(12px))) {
  .site-header {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
}
```

Sites wrapped:
- `src/styles/global.css` (already had the `.anim-tier-N` override for reduced-motion tiers — preserved)
- `src/components/MobileDock.svelte` (`.dock-prompts`, `.mobile-dock`)
- `src/components/Header.svelte` (`.site-header`)
- `src/components/UtilityHeader.astro` (`.utility-header`)

Sites left with inline `backdrop-filter` (decorative, non-structural):
- `src/components/App.svelte` (`.cinema-exit` button — decoration, rgba background visible without blur)
- `src/components/TodayView.svelte` (two decorative overlays)
- `src/components/InsightReader.svelte` (one drag indicator)

**Rationale for the split:** CSS already silently ignores unknown properties, so the decorative uses work in every browser today. The `@supports` wrapper is valuable on structural surfaces because it lets the brief's "baseline is solid rgba derived from the same token" rule be grep-able from the CSS. For single-property decorative uses where no alternate styling depends on support, the wrapper adds noise without changing output.

The `-webkit-backdrop-filter` fallback remains on every wrapped and unwrapped site — Safari 14-16 supports the prefixed form. The `@supports ((backdrop-filter: …) or (-webkit-backdrop-filter: …))` covers both.

### 4. `text-wrap: balance` / `pretty` — wrapped in `@supports`

```css
.balance-title {
  overflow-wrap: normal;
  word-break: normal;
  hyphens: manual;
}
@supports (text-wrap: balance) {
  .balance-title {
    text-wrap: balance;
  }
}
```

Applied in `src/styles/global.css` to `.balance-title` and `.pretty-copy`. Component-level `text-wrap` declarations (HighlightsPanel, InsightReader, `[id].astro`) rely on the same graceful-degradation behavior — unknown property, ignored. Documented here; not wrapped individually because the ignore-behavior is identical.

Browser support: Chrome/Edge 114+, Firefox 121+, Safari 17.4+ get the balanced headings. Everyone else gets plain wrapping with `overflow-wrap: normal` — readable, not broken.

### 5. `startViewTransition` — JS-level feature-detect + reduced-motion + webview gates

`src/layouts/Base.astro:107-134` previously feature-detected `startViewTransition` but skipped two gates the brief requires:

- **`prefers-reduced-motion: reduce`:** a user who opted out of motion was still getting the crossfade animation.
- **In-app webview (`data-env="webview"`):** some in-app browsers flash-black during the transition because the document-replacement model fights the native navigation chrome.

Both gates now wrap the transition call:

```js
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// ... inside click handler ...
const isWebview = document.documentElement.dataset.env === 'webview';
if (prefersReducedMotion.matches || isWebview) {
  location.href = href;  // instant navigation
  return;
}
document.startViewTransition(() => { location.href = href; });
```

The `data-env="webview"` detector itself lands in Phase 8.5 (UA sniff on `FBAN|FBAV|Instagram|Line|TikTok|wv|MicroMessenger|Twitter`). Until that lands, this branch is dead code — no harm, no cost.

CSS-level `@media (prefers-reduced-motion)` at `global.css:94-99` already kills all animation/transition durations. This JS gate adds the explicit `startViewTransition` skip that CSS can't enforce.

## Explicitly out of scope

From brief-v3 Phase 3, features NOT present in source and therefore NOT scaffolded:

- Container queries (`container-type`, `@container`)
- `:has()`
- `subgrid`
- `color-mix`, `oklch` (Phase 2 deferred too — no new mixing context)
- `@starting-style`, `@property`
- Anchor positioning (`anchor-name`, `position-try`)

Phase 0 audit § E confirmed these are absent. Adding `@supports` scaffolding for features not used would be dead code.

## Acceptance

- `npm run check` → 0 errors
- `npm run lint` → 0 errors
- `npm test` → 76 tests pass
- `npm run build` → clean; 8 inline script hashes (unchanged); stealth clean
- `<html>` receives `js-reader-mounted` only after reduced-motion + webview checks pass (manual verify: devtools → emulate `prefers-reduced-motion: reduce` → click an internal link → no crossfade)
