# ADR-0002: Phase 8 split into 8a (SSG content migration) + 8b (responsive image pipeline)

**Status:** Accepted (2026-04-18)
**Related:** `docs/cross-browser-parity/00-audit.md` § 2 (SSG shell vs SSG content finding); `docs/cross-browser-parity/brief-v3.md` Phases 8a, 8b, 8.5; ADR-0003 (`client:idle` hydration policy — the enabling technique for 8a).

## Context

The v2 brief combined "validate SSG output" and "add responsive image pipeline" into a single Phase 8. Phase 0 audit (§ 2) found that `/issue/[id]` raw HTML contains only the Svelte island placeholder — no `<article>`, no headline `<h1>`, no deck `<p>`, no hero `<img>`, no Opinion Shift score. All of that is rendered post-hydration by `App.svelte` with `client:load`.

Consequences observed:
- Readers with JavaScript disabled see a skeleton.
- Webviews that strip or delay JS hit the same failure mode.
- Safari with aggressive content blockers occasionally blocks the island bundle, leaving readers on a blank page.
- Throttled 3G LCP can only ever be the skeleton — the real LCP element doesn't exist in the initial paint.
- Phase 9's smoke test "raw HTML contains headline/deck/hero/score" would fail against main today.

Two distinct concerns are bundled under Phase 8 in v2:

1. **Correctness:** the article must be in the initial HTML so JS-disabled, webview, slow-network, and content-blocked readers can read it. This is a user-facing correctness fix.
2. **Performance:** hero images should be served in modern formats (AVIF, WebP) with a JPEG fallback and per-width `srcset` so LCP can hit the <2.5s target on Mobile 3G.

These are different kinds of work, with different risk profiles, different review shapes, and different scopes of affected code.

## Decision

**Phase 8 splits into two independent PRs, in priority order:**

### Phase 8a — SSG content migration (correctness)
Branch: `parity/phase-8a-ssg-content`.

Scope:
- Move issue content rendering from the client-hydrated `App.svelte` into `src/pages/issue/[id].astro`'s frontmatter and template.
- Required elements in the prerendered HTML: `<article>` landmark, `<h1>` with the actual issue headline, deck `<p>`, hero `<img>` (simple `src` — responsive `<picture>` lands in 8b), full article body (every card's heading + prose), Opinion Shift card with numeric score baked in, `<time datetime>` for `sourceDate`.
- Switch `App.svelte` from `client:load` to `client:idle` (see ADR-0003).
- The Svelte island's job narrows to **interactivity only** — progress tracking, Reading Path highlighting, Share button, Opinion Shift animation — it enhances the prerendered DOM rather than replacing it.
- If content currently lives inside a Svelte template, it moves into the `.astro` file or a shared module (`src/lib/render-issue.ts`) importable from both.

Gates:
- `curl $SITE/issue/0146 | grep -c '<article'` ≥ 1.
- `curl $SITE/issue/0146 | grep '<h1'` returns the real issue headline, not a skeleton.
- JS disabled in devtools → `/issue/[id]` remains fully readable.

This is a **prerequisite for Phase 8.5's JS-disabled acceptance criterion and for Phase 9's raw-HTML smoke test.**

### Phase 8b — Responsive image pipeline (performance)
Branch: `parity/phase-8b-image-pipeline`.

Scope:
- Generate AVIF + WebP + JPEG fallback at 1x, 2x, 3x widths for hero illustrations.
- Render heroes via `<picture>` with correctly ordered `<source>` elements (AVIF → WebP → `<img>` fallback).
- Hero: `loading="eager"` + `fetchpriority="high"`. Non-hero: `loading="lazy"` + `decoding="async"` (already in place; verify).
- Update build pipeline (`scripts/generate-og-images.mjs` or a sibling script) to emit the three formats at each width.
- Target LCP < 2.5 s on Mobile 3G for `/` and `/issue/0146`.

This is a **performance enhancement**, not a correctness fix. It ships after 8a.

### Ordering with other phases

Priority after 8a lands:
```
Phase 1  (done)  →  Phase 8a  (correctness)  →  Phases 2-7  →  Phase 8b  →  Phase 8.5 verification  →  Phase 9  →  Phase 10
```

8a goes ahead of 2-7 because it fixes a user-facing bug (JS-disabled readers can't read the article). 2-7 are polish — tokens, progressive enhancement, typography, user-setting support, a11y — and none of them regress if 8a hasn't landed. 8b is purely performance and parallelizable with 2-7.

## Consequences

### Positive
- Two focused PRs of tractable size instead of one sprawling one. Reviewer cognitive load drops.
- The correctness fix (8a) can ship on its own timeline — it does not wait for the image pipeline work.
- JS-disabled / webview / content-blocker readers get the full article as soon as 8a merges, without waiting for 8b.
- LCP improvement (8b) can be measured against a stable baseline (post-8a) rather than against a moving target.
- Clear test gates per PR: 8a's gate is "raw HTML contains the article"; 8b's gate is "LCP < 2.5s on Mobile 3G." Each passes or fails on its own merits.

### Negative
- Two PRs to review instead of one.
- Hero image in 8a is a simple `<img>` with a single `src` — not the optimal format for LCP. Briefly accepted until 8b lands.
- Requires discipline to not bundle 8b work into 8a under pressure. Reviewer catches this.

### Neutral
- Phase 8.5 (webview + degraded-environment + no-JS) depends on 8a, not 8b. Its acceptance criterion "JS-disabled readers see the full article" is fully satisfied by 8a alone.
- Phase 9 Playwright smoke tests that assert raw-HTML content are gated by 8a. Smoke tests that assert LCP thresholds are gated by 8b.

## Alternatives considered

### A. Keep Phase 8 as a single PR
Rejected — bundling correctness work with a larger performance refactor delays the user-facing fix behind the image pipeline's build-time infrastructure work. Also makes the PR harder to review.

### B. Do image pipeline (8b) first, then content migration (8a)
Rejected — reverses the user value. Users on Safari with content blockers, users on Facebook's in-app webview, users on bad networks, and users with JS disabled all get nothing meaningful until 8a lands. Image pipeline benefits users who already see the article; 8a benefits users who currently see a skeleton.

### C. Move only the bare minimum (headline + deck) into SSG; keep body + hero in the island
Rejected — leaves the hero image (the LCP element candidate) out of the initial paint, so LCP remains skeleton-bound. Also inconsistent — a reader with JS disabled would see a headline with no body.

### D. Use Astro's `<ClientRouter>` / View Transitions to solve this
Considered and rejected — View Transitions are already in use (`Base.astro:118`) for navigation crossfades, which is orthogonal to the SSG content problem. They don't render content that isn't in the HTML.

### E. Server-side rendering (`output: 'server'` or `output: 'hybrid'`)
Rejected as out of scope — requires a Cloudflare Worker runtime, changes the deploy pipeline, introduces a new server-side failure domain, and the current SSG model is sufficient for static content. The real issue is that Astro's `.astro` template isn't rendering the content, not that the content needs runtime generation.

## Enforcement

Each PR has a dedicated acceptance test listed above. CI smoke tests in Phase 9 make the 8a gate automated.

Phase 10's `parity-checklist.md` (to be written) will include:

> **Content location for static routes:** all user-visible content — headline, body, hero, scores — lives in the `.astro` file or a shared module importable from Astro. Svelte islands enhance prerendered DOM; they do not render it.

PR reviews gate on this. Phase 9 automated smoke tests enforce it.

## Revisit conditions

- If Astro introduces server islands in `output: 'static'` and they become a cleaner alternative for progressive hydration, revisit ADR-0003 (hydration directive) — this ADR (the split itself) stands.
- If a future content type (e.g. real-time dashboards, live updates) legitimately requires runtime rendering, that type's route can be SSR'd independently without breaking this decision for static issue pages.
- If the Mobile 3G LCP target changes materially, revisit 8b's scope — not 8a's.
