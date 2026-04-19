# Phase 4 — Typography (narrow scope per ADR-0001)

**Branch:** `parity/phase-4-typography`
**Budget:** total font payload ≤ 60 KB brotli on the wire (ADR-0001).

## What was already in place

- `font-display: swap` on both `@font-face` declarations (`global.css:10`, `:18`).
- `font-variant-numeric: tabular-nums` on individual score displays (Opinion Shift, count badges, connected-issue scores, etc.) — 7+ sites.
- No manual `<br>` tags used for line shaping anywhere in `src/components/` or `src/pages/`.
- Line-height tokens locked (`--leading-tight: 1.15` through `--leading-loose: 1.65`).
- Current font payload: 55,912 bytes raw / brotli (woff2 is pre-compressed; brotli-over-HTTP is a no-op on woff2).

## Changes in this phase

### 1. `<link rel="preload">` on critical fonts

Added to both `src/layouts/Base.astro` (`<head>`) and `src/pages/issue/[id].astro` (`<head>`):

```html
<link rel="preload" href="/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/nunito-latin.woff2" as="font" type="font/woff2" crossorigin />
```

`crossorigin` is mandatory for font preloads (even same-origin) — without it, the preload is fetched anonymously and the later `@font-face` fetch misses the preload cache. See the MDN note on font preloading for why.

Both fonts are the *only* weights in use (Manrope 600-800 range and Nunito Sans 400-700 range, single woff2 file each — they're variable-ish but delivered as a single static weight range). So "one critical weight per family" resolves to "preload both files."

### 2. Global typography rules

`src/styles/global.css` body rule extended with:

```css
text-rendering: optimizeLegibility;
font-feature-settings: "kern", "liga", "calt";
font-variant-numeric: tabular-nums;
```

- `text-rendering: optimizeLegibility` — enables kerning and standard ligatures on all text.
- `font-feature-settings: "kern", "liga", "calt"` — explicitly requests the same features at the OpenType level (redundant but grep-able).
- `font-variant-numeric: tabular-nums` — site-wide tabular figures so count badges, timestamps, and scores align in vertical stacks without per-component overrides.

The existing `-webkit-font-smoothing: antialiased` and `-moz-osx-font-smoothing: grayscale` were already on the body rule.

### 3. Font-budget CI gate

New script: `scripts/check-font-budget.mjs`. Sums the on-the-wire byte size of every font file under `public/fonts/` and fails if total > 60 KB (ADR-0001 ceiling).

Wired into:
- `npm run build` pipeline (right after `validate-issues`, before asset generation)
- Available as `npm run check-fonts`

Current output:
```
nunito-latin.woff2        31076 B
manrope-latin.woff2       24836 B
total                     55912 B  (54.6 KB)
budget                    61440 B  (60.0 KB)
OK: 5528 B headroom (5.4 KB).
```

Any future PR that adds a font weight or family will trip this gate if it blows the budget. Gate is in `npm run build`, which GitHub Actions runs per `.github/workflows/deploy.yml`.

## Explicitly out of scope (per ADR-0001)

- Further `unicode-range` subsetting. The files are already latin-core subsets per their filenames.
- Multi-script splitting (Chinese / Tamil / Jawi / Arabic). Not needed at current payload — budget has 5 KB headroom, plus Jawi / Arabic would be separate font families with their own unicode-range gates.
- Variable-font weight-range switching. Both files are already delivered as single woff2 blobs covering their weight range.
- Manual `<br>` removal — none present. Audit clean.

## Acceptance

- `npm run check` → 0 errors
- `npm run lint` → 0 errors
- `npm test` → 76 pass
- `npm run check-fonts` → OK (5.4 KB headroom)
- `npm run build` → clean; stealth clean; 8 inline hashes unchanged
- DevTools → Network → both woff2 files show `(preload)` in initiator and hit cache on the subsequent `@font-face` fetch (manual verify)
