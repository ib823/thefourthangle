# Phase 2 — Rendering baseline (tokens extension)

**Branch:** `parity/phase-2-tokens`
**PR:** #6
**Depends on:** Phases 0, 1, 8a, 8b merged.

## Scope

Per brief-v3 Phase 2: extend the existing `src/styles/tokens.css`; do not create a parallel file. Confirm Tailwind 4 Preflight is the only reset. Add missing semantic tokens only — no pre-emptive additions. Consolidate `:focus-visible`. Add a `[data-theme]` override hook for a future manual theme toggle.

## What was missing vs. what existed

Audited `src/styles/tokens.css` against the Phase 2 list in brief-v3. Existing token surface is already substantial — semantic colors, score/status/verdict palettes, spacing scale (`--space-1`…`--space-16`), type scale, radius, easing curves, duration, elevation, card-type palettes, and a full `@media (prefers-color-scheme: dark)` block.

**Already present** (not re-added):
- `--color-card-bg` — covered by `--card`, `--card-fact-bg`, `--card-hook-bg`, etc.
- `--color-score-*` — `--score-strong/medium/partial/critical/warning/info/neutral`.
- Spacing scale — `--space-1`…`--space-16`.
- Motion scale — `--duration-micro/fast/normal/medium/slow`, `--ease-*`, `--transition-*`.
- Semantic colors — `--bg`, `--text-primary`, `--border-subtle`, `--amber`, etc.

**Added in this phase:**
1. **Z-index scale** — `--z-base` / `--z-sticky` / `--z-dock` / `--z-sidebar` / `--z-header` / `--z-dropdown` / `--z-overlay` / `--z-modal` / `--z-toast`. Previously scattered magic numbers (`5`, `15`, `1500`, `1999`, `2000`, `5000`) replaced where they crossed component boundaries.
2. **`--color-focus-ring`** — alias to the existing `--focus` token, named per the brief so intent is grep-able.
3. **`--color-danger`** — alias to the existing `--status-red`.
4. **`--color-hero-bg`** — `#0f0f23`, the navy behind hero line-art. Was inline in `src/pages/issue/[id].astro`; now tokenised so a later design change touches one line.
5. **`[data-theme="dark"]` override selector** — mirrors the `@media (prefers-color-scheme: dark)` block. Vanilla CSS does not let us share a token block across a media query and a selector, so both blocks exist and must stay in lock-step. Future theme-toggle UI (not in this phase) writes `data-theme` to `<html>` and gets a full dark pass without touching tokens.css.
6. **`:root:not([data-theme="light"])`** in the media query — lets a future user force-light against an OS dark preference.

## Focus-visible consolidation

`src/styles/global.css` previously had **two** `:focus-visible` rules with hard-coded `#1971C2`:
- Line 86-89: outline-based
- Line 115-118: box-shadow based (same color, later rule wins)

Consolidated into **one** rule using `var(--color-focus-ring, #1971C2)`. Keeps both the outline (for high-contrast + forced-colors) and the box-shadow (for keyboard-user emphasis).

## Hard-coded z-index → token

| Before | After | Location |
|---|---|---|
| `z-index: 2000` | `var(--z-modal, 2000)` | `global.css` `.share-backdrop`, `NotificationBell.svelte` panel, `InstallPrompt.svelte` popover |
| `z-index: 1500` | `var(--z-overlay, 1500)` | `global.css` `.pattern-backdrop` |
| `z-index: 5000` | `var(--z-toast, 5000)` | `global.css` `.sr-only:focus` (skip link) |
| `z-index: 1999` | `calc(var(--z-modal, 2000) - 1)` | `NotificationBell.svelte` backdrop (lives just below its sibling modal) |

Low-number z-index values (`0`, `1`, `5`, `15`) inside components were left as-is. Those are local stacking contexts — they don't cross component boundaries and don't benefit from global tokenisation.

## Tailwind Preflight

Confirmed: `src/styles/global.css:1` has `@import "tailwindcss"`. Tailwind 4's built-in Preflight is active. No second reset is loaded. No changes needed for this item.

## Fallbacks

Every `var(--token, fallback)` uses the hex value as a fallback so that a CSS bundle load failure (e.g. content blocker) still renders the component with its original color. Consistent with the Phase 8a SSG-article pattern.

## What's out of scope (deferred)

- **`color-mix` / `oklch` enhanced values** — brief says "only if the token is actually used." None of the new tokens participate in color-mixing contexts today. Skipped to honour the "no pre-emptive additions" rule.
- **Theme-toggle UI** — no UI writes `data-theme` yet. The selector hook is in place; a Phase 5 or follow-up adds the control.
- **Replacing every inline hex in Svelte components** — a large mechanical diff that risks visual regressions without a rigorous before/after matrix. Kept to high-impact replacements (z-index, focus, hero bg). Phase 10 docs will call out remaining inline values for future cleanup.

## Acceptance

- `npm run check` → 0 errors
- `npm run lint` → 0 errors
- `npm test` → all tests pass (76+)
- `npm run build` → clean; stealth clean; 8 inline script hashes (unchanged from Phase 8b)
- Visual: no regressions on hero background, focus ring, modal/backdrop stacking (manual eye test)
