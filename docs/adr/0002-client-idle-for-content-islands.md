# ADR-0002: Prefer `client:idle` over `client:load` for content-bearing Svelte islands

**Status:** Accepted (2026-04-18)
**Related:** `docs/cross-browser-parity/00-audit.md` § 2 (SSG shell vs content finding); `docs/cross-browser-parity/brief-v3.md` Phase 8a.

## Context

Phase 0 audit found that `src/pages/issue/[id].astro` renders `<App client:load ... />` as the entire page body. The static HTML produced at build time contains only the island placeholder — no `<article>`, no `<h1>` with the issue headline, no hero `<img>`, no article body, no Opinion Shift score. All of that is rendered by the Svelte island after hydration on `client:load`.

Consequences observed:
- Readers with JavaScript disabled see a skeleton.
- Webviews that strip or delay JS hit the same failure mode.
- Before hydration completes on throttled 3G, LCP can only be the skeleton — the real LCP element never exists in the initial paint.
- Safari with aggressive content blockers occasionally blocks the island bundle.
- The Phase 9 smoke test "raw HTML contains headline" fails on main today.

Astro's `client:load` hydrates the island as soon as the bundle arrives. `client:idle` hydrates in an `requestIdleCallback` (falling back to a deferred `setTimeout`), after the main thread is free. For an island that sits on top of already-rendered static content, `client:idle` is almost always the correct choice: content is usable immediately; interactivity arrives when the browser has spare time.

## Decision

**Any Svelte island that sits on top of content which must be present in the static HTML uses `client:idle` (or a more deferred directive) by default.** `client:load` is reserved for islands whose interactivity is required before first meaningful paint (search box, critical form, real-time data display).

Specifically:
- `src/pages/issue/[id].astro` → `<App client:idle ... />` (after Phase 8a moves content into the prerender).
- Any future island mounted on top of Astro-rendered content: `client:idle`.
- Exceptions documented in-file with a short comment explaining why immediate hydration is required.

## Consequences

### Positive
- JS-disabled readers get the full article (Phase 8.5 acceptance criterion becomes achievable).
- LCP becomes a real static HTML element, not a hydration product — under the 2.5s budget is realistic on Mobile 3G.
- Main thread free during initial paint; other user input (scroll, text selection, link clicks to `<a>` tags) not blocked by hydration.
- Safari content-blocker failures stop being catastrophic — users still read the article even if the island never hydrates.
- Webviews degrade gracefully rather than show skeleton.

### Negative
- Interactive affordances (progress tracking, Reading Path highlighting, Share button, Opinion Shift animation) arrive 100-300ms later than with `client:load`. Acceptable because they are enhancements, not the primary reading experience.
- Author discipline required: content must actually live in the `.astro` file (or a shared module importable by both Astro and Svelte), not inside a Svelte template. Phase 8a does this migration.

### Neutral
- Phase 9's raw-HTML smoke test becomes feasible. Before 8a, it would always fail.
- The "enhance rather than replace" pattern becomes the repo convention. Future islands should mount in ways that don't blow away server-rendered content — typically by targeting children via props rather than rendering a full subtree.

## Alternatives considered

- **A. Keep `client:load`, rely on optimistic UI.** Rejected — doesn't fix JS-disabled / webview / throttled-3G cases.
- **B. `client:visible`.** Considered. `client:visible` hydrates when the island enters the viewport. For the App island on `/issue/[id]`, that's effectively "always, immediately" because it's the entire page body. Doesn't improve on `client:idle`.
- **C. `client:media`.** Not applicable — we want the island on all media.
- **D. Server islands / Astro 4 server directives.** Not applicable while `output: 'static'`; server islands require hybrid/SSR.
- **E. Drop the island entirely and use vanilla JS enhancements.** Rejected — the interactive affordances (progress tracking, reactions, share flow) justify a framework, and Svelte 5's runes are already the repo's idiom.

## Enforcement

Added to Phase 10's `parity-checklist.md`:

> **Island hydration:** new `client:load` usages require a one-line justification in the PR description ("needs interactivity before first paint because…"). Default to `client:idle`.

Phase 9 Playwright smoke includes a raw-HTML content assertion for at least one prerendered page; this fails if a future PR regresses a content-bearing island back to `client:load` without moving content into the prerender.

## Revisit conditions

- If Astro's rendering model changes materially (e.g. server islands become available in `output: 'static'`).
- If a measured LCP regression proves `client:idle` is too aggressive for a specific island (unlikely — `idle` is strictly less work than `load` before first paint).
- If a new island legitimately requires immediate hydration and this ADR's exception rule proves insufficient.
