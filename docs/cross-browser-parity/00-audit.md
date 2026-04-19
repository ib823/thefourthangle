# Phase 0 — Cross-Browser Parity Audit

**Branch:** `parity/phase-0-audit`
**Date:** 2026-04-18
**Scope:** read-only. No source files modified. This document records the observed state of the repository so Phase 1 can plan from facts.

---

## Resolutions from agent escalation (2026-04-18)

The three findings flagged below (see "TL;DR") went to the engagement owner for decision. The audit doc is preserved as the honest point-in-time discovery; this section records what was *decided*, separately from what was *found*. Amendments to the brief live in `docs/cross-browser-parity/brief-v3.md` (PR pending); ADRs live under `docs/adr/`.

### Item 1 — Font budget
**Decision:** approved. Raise ceiling from 20 KB brotli → **60 KB brotli**. CI measures on-the-wire bytes (`content-encoding: br` if negotiated, raw woff2 otherwise). Keep `font-display: swap` and preload one critical weight per family; lazy-load the rest. Recorded in ADR-0001.

### Item 2 — SSG shell vs SSG content
**Decision:** Phase 8 is real SSG content-rendering work, not validation. Split into two branches:
- **`parity/phase-8a-ssg-content`** — move issue body, headline, deck, hero `<picture>`, Opinion Shift score into the Astro frontmatter+template so the static HTML contains the article as real DOM. Svelte island switches from `client:load` → `client:idle` and enhances rather than replaces. **Correctness fix — prerequisite for Phase 8.5 and Phase 9's first-HTML smoke test.**
- **`parity/phase-8b-image-pipeline`** — AVIF + WebP + JPEG `<picture>` pipeline with responsive widths. Parallel/optional work; ships after 8a.

Phase 8.5's JS-disabled path is promoted from "verify" → **"acceptance criterion for Phase 8a."**

Phase priority order after amendments: Phase 1 → **Phase 8a** (ahead of 2-7 because it's correctness) → Phases 2-7 → Phase 8b → Phase 8.5 validation → Phase 9 → Phase 10.

Client-island hydration policy: prefer `client:idle` over `client:load` for any island sitting on top of content that must be present in the static HTML. Recorded in ADR-0002.

### Item 3 — Sidebar groups
**Decision:** the invariant is **"four canonical feed sections from `buildFeedSections`, always rendered with count ≥ 0, in canonical order, locked to a `FEED_SECTIONS` const"**, plus **"`Today` is a separate always-rendered surface."**

The v2 brief's "five groups" language is corrected throughout brief-v3: Phase 1 scope, Phase 9 smoke tests, Deliverables checklist, Definition of Done all move to four canonical sections + `Today` sibling.

Phase 1's headline deliverable is this fix. Testing: Vitest unit (empty / partial / fully-populated state returns four entries each), Playwright smoke (all four headers + count badges visible on clean and heavily-used profiles), manual verification in PR (two browsers, different storage states, sidebar structure identical).

### Lighthouse + axe baselines
**Decision:** approved deferral to first Phase 9 CI run (no Chrome binary in Codespaces dev container). The baseline numbers are explicitly recorded as **TBD — Phase 9** rather than silently missing. Phase 9's PR must check a first baseline into `/docs/cross-browser-parity/baselines/` so future regressions have a comparator.

---

## TL;DR — escalation items for decision before Phase 1

Three findings contradict the v2 brief's assumed facts and require a decision before work begins.

### 1. Font payload is ~55 KB brotli, not 5.5 KB. Phase 4's 20 KB ceiling is unreachable as written.

Measured directly: `manrope-latin.woff2` = 24,836 bytes, `nunito-latin.woff2` = 31,076 bytes. Brotli barely compresses these because `woff2` is already brotli-compressed internally:

| File | raw | gzip -9 | brotli -9 |
|---|---:|---:|---:|
| manrope-latin.woff2 | 24,836 | 24,879 | 24,833 |
| nunito-latin.woff2 | 31,076 | 31,118 | 31,075 |
| **total** | **55,912** | **55,997** | **55,908** |

Options for Phase 4:
- **A.** Raise the budget to 60 KB brotli (keep both fonts; acknowledge woff2's compression floor).
- **B.** Drop one family (likely Manrope — display-only) → falls to ~31 KB brotli.
- **C.** Drop both custom fonts in favour of system stacks → 0 KB. Biggest CrUX-parity win; accepts platform typography differences.
- **D.** Further subset the unicode-range within Latin (marginal — current files are already latin-core subsets).

**Decision needed before Phase 4.** Recommended: **(A)** with a 60 KB brotli budget, because the visual identity is design-intent and the payload is a one-time cost under aggressive Cloudflare caching. Option (C) is the pure-parity answer but a design regression.

### 2. `/issue/[id]` is SSG-shell + client-hydrated content, not SSG-content.

The Astro page (`src/pages/issue/[id].astro`) renders an `<App client:load>` island as the entire body. The static HTML does not contain the issue headline, deck, hero image, or article body — only the page title tag, OpenGraph meta tags, and the island placeholder.

Raw HTML fetch of `/issue/0146` (17.7 KB):
- `<h1>` count: **1**, but its content is a generic "New issues publish three times a week" skeleton — not the issue's actual headline ("Gig Workers Got SOCSO in 2025 — Retirement Floor Still Missing").
- `<article>` count: **0**
- `<picture>` count: **0**
- `<img src="*og/issue-0146*">` present: **no**
- Svelte island markers: **yes** (`astro-island`)

Consequences for later phases:
- **Phase 8's "validation" framing is wrong.** Phase 8 is real SSG work: rendering headline / deck / hero / body / Opinion Shift score into the static HTML via Astro. The island remains for interactivity, but the reading-critical content must be in the initial HTML.
- **Phase 8.5's JS-disabled checklist is currently false.** Readers without JS see the skeleton, not the issue.
- **Phase 9's smoke test "first HTML contains headline, deck, hero, score via raw HTML fetch"** will fail against main today.

**Decision needed before Phase 8.** Recommended: reframe Phase 8 as real SSG content-rendering work (not validation) and keep Phase 8.5's no-JS checklist as a real deliverable of Phase 8.

### 3. Sidebar groups are currently conditional, not always-rendered. Phase 1 assumes "always render with count 0" — this is a behavioural change, not a documentation update.

`buildFeedSections` in `src/lib/feed-sections.ts:79-89` only pushes a section to the output array `if (sections.length > 0)`. Empty groups are silently omitted. This is the precise root cause of the "Edge renders differently" report that opened the engagement — a browser with different `tfa-read:*` state genuinely sees a different sidebar structure.

Phase 1's "render five fixed groups with count badges including zero" is the correct fix. Noted here so the v2 brief's "structure must never depend on state" requirement is understood as a semantic change, not a presentational tweak.

---

## A. Stack & rendering

| Item | Value | Source |
|---|---|---|
| Astro | 6.0.8 | `package.json:28` |
| `output` mode | `'static'` (pure SSG, no SSR) | `astro.config.mjs:15` |
| Svelte | 5.54.1 | `package.json:31` |
| `@astrojs/svelte` | ^8.0.3 | `package.json:25` |
| Tailwind | 4.2.2 | `package.json:32` |
| Preflight activation | `@import "tailwindcss";` | `src/styles/global.css:1` |
| Build assets folder | `_a/` | `astro.config.mjs:19` → `build: { assets: '_a' }` |

`src/layouts/Base.astro:19-20` (verbatim):

```html
<html lang="en" prefix="og: https://ogp.me/ns#">
<body data-build-id={buildId}>
```

Neither `<html>` nor `<body>` carries app-specific class names in source. Any class names observed in the deployed site (`anim-tier-1`, `app-shell-root`, etc. claimed in v1 brief) are stealth artefacts or do not exist — treat as opaque.

## B. Stealth behaviour (tests must target stable hooks)

`scripts/stealth.mjs` runs post-build and modifies `dist/`. Verified transformations:

| Transformation | Lines | What changes |
|---|---|---|
| Custom element tag names | 80-82 | `astro-island` → `d-island`, `astro-slot` → `d-slot`, `astro-static-slot` → `d-ss` |
| Astro globals | 85-95 | `Astro` → `_R`, `astro:load` → `_r:l`, etc. |
| Astro data attributes | 106-108 | `data-astro-template` → `data-t`, `data-astro-cid-*` → `data-c-*`, other `data-astro-*` → `data-x` |
| JSON component names | 111 | `"name":"<ComponentName>"` → `"name":"c"` |
| Svelte runtime markers | 98-100 | `window.__svelte` → `window._s`, `svelte-*` class names → hashed |
| HTML comments | 103 | stripped |
| Asset filenames | 52-72 | `_a/<hash>.js` renamed via `shortHash()` |
| CSS Svelte class names | 146-158 | `svelte-*` → hashed |
| PNG metadata | 29-46, 167-176 | strips all chunks except IHDR/IDAT/IEND/sRGB/tRNS/PLTE |
| JPEG EXIF/ICC/IPTC | 178-209 | stripped |
| Identity guard | 211-253 | fails build if any of 30 dangerous terms remain (framework names, vendor names, etc.) |

**Not touched (safe for test selectors):**
- ARIA roles (`role=`, `aria-*`)
- Text content inside elements
- `data-*` attributes that do NOT start with `data-astro-` (repo-owned `data-*` is preserved)
- Tailwind class names (only `svelte-*` scoped classes are obfuscated)

**Rule for Phase 9 Playwright:** every selector must use (a) ARIA role, (b) accessible name via `getByRole(..., { name: ... })`, (c) text content, or (d) a `data-*` attribute the project owns. Never assert on class names, font-family names, or element tag names that stealth might rename.

## C. `tfa-*` storage namespace — definitive enumeration

**Count: 16 keys across both storages.** The v2 brief's "13" was an undercount; my earlier "14" was close but missed `tfa-reactions` and the two sessionStorage keys.

### localStorage (14)

| # | Key | Value shape | Writer | Reader(s) | Category |
|--:|---|---|---|---|---|
| 1 | `tfa-read:<id>` (persistentMap prefix; ~86 physical keys, one per started/completed issue) | JSON `{state: 'started'\|'completed', progress: 0-6}` or legacy string `'true'` | `src/stores/reader.ts:8,21,28,32` | `reader.ts:11`, `sync.ts:81`, `PushPrompt.svelte:42`, `feed-sections.ts:22-26` | state |
| 2 | `tfa-reactions` | JSON `Record<issueId, number[]>` | `src/stores/reader.ts:36,52` | `reader.ts:39`, `sync.ts:96` | state |
| 3 | `tfa-pos` | JSON `{feedIssueId, cardIndex, ts}` or empty string | `src/stores/reader.ts:85,88`, `src/lib/sync.ts:138` | `reader.ts:93`, `sync.ts:97` | state |
| 4 | `tfa-notifications` | JSON array of `NotificationItem` | `src/stores/notifications.ts:16,33` | `notifications.ts:21` | notification-log |
| 5 | `tfa-angle-code` | string (6-char uppercase alphanumeric) | `src/lib/sync.ts:35` | `sync.ts:31,45`, `AngleCodeBanner.svelte:28` | sync |
| 6 | `tfa-last-sync` | string (epoch ms) | `src/lib/sync.ts:55` | `sync.ts:50` | sync |
| 7 | `tfa-device-id` | string (`d_` + 16 hex) | `src/lib/sync.ts:65` | `sync.ts:61` | sync |
| 8 | `tfa-install-dismissed` | `String(Date.now())` | `src/lib/install-state.ts:14,82`, `InstallPrompt.svelte:60` | `install-state.ts:32`, `InstallPrompt.svelte:23` | ui-dismissal |
| 9 | `tfa-sync-banner-dismissed` | `'1'` | `App.svelte:141` | `App.svelte:139` | ui-dismissal |
| 10 | `tfa-welcome-dismissed` | `'1'` | `TodayView.svelte:125` | `TodayView.svelte:124` | ui-dismissal |
| 11 | `tfa-push-subscribed` | `'true'` | `PushPrompt.svelte:95`, `NotificationBell.svelte:106` | `PushPrompt.svelte:31`, `NotificationBell.svelte:67`, `135` | push |
| 12 | `tfa-push-endpoint` | string (push subscription URL) | `PushPrompt.svelte:96`, `NotificationBell.svelte:107` | `App.svelte:472`, `NotificationBell.svelte:136` | push |
| 13 | `tfa-push-dismissed` | `String(Date.now())` | `PushPrompt.svelte:106` | `PushPrompt.svelte:37` | ui-dismissal |
| 14 | `tfa-sync-prompt-dismissed` | `'1'` | `MobileDock.svelte` (const `SYNC_DISMISS_KEY`) | `MobileDock.svelte:44` | ui-dismissal |

### sessionStorage (2)

| # | Key | Value | Writer | Reader | Category |
|--:|---|---|---|---|---|
| 15 | `tfa-cinema-dismissed` | `'1'` (session-scoped; does not persist across tabs/close) | `App.svelte:116` | `App.svelte:109` | ui-dismissal |
| 16 | `tfa-sw-build` | string (build id) | `Base.astro:74,78,86`, `[id].astro:97,101,109` | `Base.astro:69`, `[id].astro:92` | sw-versioning |

### Notes for Phase 1 migration design

- **`tfa-read:<id>` expands to many physical keys** — migration must iterate, not assume a single key.
- **`tfa-pos` has dual writers** — the reader store AND the sync worker both write it (`sync.ts:138` on remote pull). Migration must not race with sync.
- **Some values are opaque strings, some are JSON.** Schema-validate per-key rather than assuming JSON.
- **sessionStorage keys probably don't need `tfa:v1:` migration** — they're session-scoped and regenerate on next visit. Document and either leave alone or migrate for consistency. My recommendation: leave them; they expire naturally.
- **Push keys (11-13) are coupled to an active browser `PushSubscription` object.** Renaming the key does not invalidate the subscription, but `NotificationBell.svelte:135-136` resets them together. Phase 1 must preserve that coupling.

## D. Sidebar grouping

Current function (`src/lib/feed-sections.ts:34-89`):

```ts
export function buildFeedSections(
  issues: IssueSummary[],
  readMap: Record<string, string>,
  now: Date = new Date(),
  sortMode: SortMode = 'latest',
): FeedSection[] {
  const continueReading: IssueSummary[] = [];
  const newThisWeek: IssueSummary[] = [];
  const explore: IssueSummary[] = [];
  const completed: IssueSummary[] = [];

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

  for (const issue of issues) {
    const rs = parseReadState(readMap[issue.id]);
    if (rs?.state === 'completed') completed.push(issue);
    else if (rs?.state === 'started') continueReading.push(issue);
    else if (issue.sourceDate && issue.sourceDate >= cutoff) newThisWeek.push(issue);
    else explore.push(issue);
  }

  // sort...

  const sections: FeedSection[] = [];
  if (continueReading.length > 0) sections.push({ kind: 'continue', label: 'Continue Reading', ... });
  if (newThisWeek.length > 0)     sections.push({ kind: 'new',      label: 'New This Week',    ... });
  if (explore.length > 0)         sections.push({ kind: 'explore',  label: 'Earlier Issues',   ... });
  if (completed.length > 0)       sections.push({ kind: 'completed',label: 'Completed',        ... });
  return sections;
}
```

**Note:** the brief lists five groups (`Today`, `Continue Reading`, `New This Week`, `Earlier Issues`, `Completed`) but the code only builds four. `Today` is handled separately upstream (not in this function). Phase 1's "five fixed groups" needs to account for that — `Today` must be threaded into this structure or explicitly wrapped around it in the rendering layer.

Rendered in `src/components/DesktopFeed.svelte:364-375` (tabpanel) and `src/components/TodayView.svelte` (mobile).

## E. Modern CSS inventory — narrow, confirmed

Present (file:line references):
- `scrollbar-gutter: stable` — `src/styles/global.css:25`
- `100dvh` — `global.css:42,56,61`, `src/pages/404.astro`, `App.svelte`
- `text-wrap: balance` — `global.css:72`, `HighlightsPanel.svelte`, `InsightReader.svelte`
- `text-wrap: pretty` — `global.css:79`
- `backdrop-filter: blur(*)` — 11+ occurrences across `global.css`, `MobileDock.svelte`, `UtilityHeader.astro`, `TodayView.svelte`, `Header.svelte`, `App.svelte`, `InsightReader.svelte` (most paired with `-webkit-backdrop-filter`)
- `@view-transition { navigation: auto; }` — `global.css:160-162`
- `::view-transition-old(root)` / `::view-transition-new(root)` — `global.css:163-167`

Absent (verified by grep): `container-type`, `@container`, `:has(`, `subgrid`, `dvw`, `svh`, `lvh`, `color-mix`, `oklch`, `@starting-style`, `@property`, `anchor-name`, `position-try`, `@supports` (entirely unused — we have no progressive-enhancement guards today).

Phase 3's scope therefore reduces to: the five features above + adding `@supports` where missing.

## F. Font inventory

See escalation item 1 for the payload-size issue.

`src/styles/global.css:5-19`:

```css
@font-face {
  font-family: 'Manrope';
  src: url('/fonts/manrope-latin.woff2') format('woff2');
  font-weight: 600 800;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Nunito Sans';
  src: url('/fonts/nunito-latin.woff2') format('woff2');
  font-weight: 400 700;
  font-style: normal;
  font-display: swap;
}
```

- `font-display: swap` already set on both.
- **No `<link rel="preload" as="font">`** in `Base.astro` — Phase 4 item.
- **No `unicode-range` declaration** — the files are subset at source (latin-only) but the CSS does not advertise that to the browser.
- Tailwind token usage: `var(--font-body)` globally on `body`; token definition likely in `src/styles/tokens.css` (verify in Phase 2).

## G. View Transitions wiring

Single call site: `src/layouts/Base.astro:118`, inside a global `click` handler on internal anchors.

```js
if ('startViewTransition' in document) {
  document.addEventListener('click', (e) => {
    // ... same-origin internal navigation only ...
    e.preventDefault();
    document.startViewTransition(() => { location.href = href; });
  });
}
```

- Feature-detected via `'startViewTransition' in document` ✓
- Scoped to same-origin internal navigation ✓
- **Does NOT check `prefers-reduced-motion` before invoking** — Phase 5 must add this gate. The global CSS rule at `global.css:94-99` disables transitions for reduced motion at the CSS level, but the JS still wraps navigation in `startViewTransition`, which can still cause a visual flash.

## H. Image pipeline

Current state:
- Hero formats: PNG (original, ~150-200 KB) + per-width WebP (`-640w.webp`, `-960w.webp`, `-1200w.webp`, 6-26 KB each).
- No `<picture>` element in any component.
- Hero rendered via `<img src="/og/issue-<id>.png" loading="eager" fetchpriority="high" decoding="sync" />` in `DesktopReader.svelte:324`, `InsightReader.svelte:1088`, `IssueImage.svelte:34-36`.
- Non-hero images use `loading="lazy"` `decoding="async"`.
- **Key gap:** browsers pick PNG even when WebP would be smaller. Phase 8 `<picture>` pipeline is real work.
- **No AVIF** at all.

Stealth strips PNG metadata, so OG images are lean on that axis already.

## I. Bundle + asset sizes

Measured from `dist/` after `npm run build` with stealth:

| Artefact | raw | gzip -9 | brotli -9 |
|---|---:|---:|---:|
| `_a/BG17x4Tn.js` (main bundle) | 326,398 | 102,798 | 91,190 |
| `_a/B9EyczzO.css` (main CSS) | 60,021 | 10,626 | 9,859 |
| `_a/CB53Ll_i.css` (secondary CSS) | 39,295 | 10,362 | 9,715 |
| `_a/m06r8SAY.js` (secondary JS) | 29,916 | 11,704 | 11,394 |
| `_a/C9I6RRSK.css` (tertiary CSS) | 4,389 | — | — |
| `_a/BcL-I-B3.js` (tertiary JS) | 1,089 | — | — |
| **Critical-path JS+CSS (top 4)** | **455,630** | **135,490** | **122,158** |
| Fonts (both woff2) | 55,912 | 55,997 | 55,908 |
| Total `dist/` | 32 MB | — | — |

OG PNGs dominate the 32 MB; fixed cost per issue, cached aggressively. Not on the critical path.

**Bundle budget note for Phase 9:** a reasonable headline to hold going forward is "**+10 KB brotli per phase**, hard stop +30 KB brotli total across the refactor" — translating the brief's gz budget to brotli.

## J. Semantic HTML / a11y landmarks

On `/issue/[id]` raw HTML:

| Element | Count | Notes |
|---|--:|---|
| `<main>` | 1 | good |
| `<h1>` | 1 | but content is skeleton, not issue headline — see escalation 2 |
| `<article>` | 0 | Phase 5 / 8 item |
| `<header>` | 0 (page-level) | `Header.svelte` exists but only hydrates client-side |
| `<nav>` | 0 (server-rendered) | same |
| `<aside>` | 0 (server-rendered) | same |
| `<time datetime>` | 0 | Phase 5 item |
| `<cite>` | 0 | Phase 5 item |

ARIA is present in Svelte components (verified: `role="tab"`, `role="tablist"`, `role="tabpanel"`, `role="listbox"`, `role="search"`, `role="status"` with `aria-live="polite"`, `aria-label` on icon-only buttons throughout `MobileDock.svelte`, `DesktopFeed.svelte`). After hydration the page is well-landmarked; before hydration it is near-bare.

## K. CSP / security posture

`dist/_headers` (generated by build):

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-...' [7 inline hashes]; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://tfa-notify.4thangle.workers.dev https://tfa-sync.4thangle.workers.dev; object-src 'none'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests; report-uri https://tfa-notify.4thangle.workers.dev/api/csp-report
```

Plus `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `Cross-Origin-Opener-Policy: same-origin`. Strong posture.

**Dangerous-HTML usage:** one instance of `{@html ...}` in `src/components/FeedRow.svelte:79`, used by the `highlightText(text, terms)` function at `FeedRow.svelte:21-26`. `terms` (search input) is regex-escaped before use; `text` is `issue.headline` (repo-controlled content). No external-input path reaches the `<mark>` wrapping. **Not a vulnerability today.** Flag for review if headline sourcing ever changes.

## L. Off-device state transmission

**`src/lib/sync.ts` does transmit user state off-device** (read positions, reactions, completed issues, progress) to `https://tfa-sync.4thangle.workers.dev`, but **only when a user has explicitly set an Angle Code** (`isLinked()` check gates all network calls). No Angle Code → no network → state stays local. File header states: "No accounts, no PII, no tracking."

Per the brief's escalation rule, this is worth surfacing but is **not an escalation**: it is a consent-based, user-opted feature. Validation task for Phase 1: confirm the Angle-Code setup UI clearly communicates what is synced before the user commits.

## M. Existing CI gates

`.github/workflows/deploy.yml` runs on push to main:
1. `npm ci`
2. `npm run check` (Astro typecheck — 0 errors)
3. `npm run lint` (Biome — 0 errors, 41 warnings)
4. `npm test` (Vitest — 44 tests pass)
5. validate signing secret
6. `npm run build` (includes `scripts/validate-issues.mjs`, `scripts/stealth.mjs`, signing, CSP hashing)
7. `npm run check-signatures`
8. deploy to Cloudflare Pages

**Phase 9 extends this workflow** — does not replace it and does not create a parallel file.

## N. Test infrastructure

Vitest only. 4 test files, all unit:
- `src/lib/__tests__/feed-sections.test.ts` — `buildFeedSections` behaviour
- `src/lib/__tests__/reader.test.ts` — read-state parsing, reactions
- `src/lib/__tests__/spring.test.ts` — animation util
- `src/lib/__tests__/velocity.test.ts` — gesture util

Playwright: absent. axe: absent. Visual regression: absent. All to be set up from scratch in Phase 9.

## O. Baseline Lighthouse / axe measurements — TBD (Phase 9)

No Chrome/Chromium binary available in this Codespaces environment (`which chrome chromium` returns empty). `npx lighthouse` and `npx @axe-core/cli` both require a browser runner. Installing Chrome in the dev container is a non-trivial side-effect that I will not take in a read-only audit phase.

**Metrics status:**
- LCP on `/` (Mobile 3G): **TBD — Phase 9**
- LCP on `/issue/0146` (Mobile 3G): **TBD — Phase 9**
- INP on `/` and `/issue/0146`: **TBD — Phase 9**
- CLS on `/` and `/issue/0146`: **TBD — Phase 9**
- Lighthouse Performance (Mobile + Desktop): **TBD — Phase 9**
- Lighthouse Accessibility / Best Practices / SEO: **TBD — Phase 9**
- `axe-core` serious/critical violations: **TBD — Phase 9**

**Resolution (per Item 3 in Resolutions section above):** Phase 9's PR must produce a first baseline run using the GitHub Actions runner (which has Chrome) and check the resulting reports into **`docs/cross-browser-parity/baselines/`** — at minimum `baselines/lighthouse-home-YYYY-MM-DD.json`, `baselines/lighthouse-issue-YYYY-MM-DD.json`, `baselines/axe-home-YYYY-MM-DD.json`, `baselines/axe-issue-YYYY-MM-DD.json`. These become the comparator for every later phase's regression checks.

## P. Stable hooks cheatsheet for tests

When Phase 9 Playwright tests land, every selector must target one of these:

- **Roles:** `page.getByRole('tab', { name: 'Continue Reading' })`, `getByRole('heading', { level: 1 })`, `getByRole('searchbox')`, etc.
- **Accessible names via `aria-label`:** preserved through stealth; safe to assert.
- **Text content:** stealth never touches inner text.
- **Project-owned `data-*` attributes** (not `data-astro-*`): preserved. If needed, Phase 1 can add e.g. `data-group="continue-reading"` on each sidebar section.

Never target: class names, `font-family` strings, element tag names that might be renamed (`astro-island` → `d-island`), Astro-internal data attributes (`data-astro-cid-*` → `data-c-*`, non-deterministic).

---

## What Phase 1 should assume

1. Migrate **14 localStorage keys** (not 13). Leave the 2 sessionStorage keys alone or document their cadence.
2. Treat `tfa-read:*` as a prefix covering ~86 physical entries, not a single key.
3. Synchronize migration against `sync.ts` writes to `tfa-pos` — debounce or lock.
4. Render **five** sidebar groups always (`Today`, `Continue Reading`, `New This Week`, `Earlier Issues`, `Completed`), including a zero-count empty state for each. This requires `buildFeedSections` restructuring + a `Today` group threaded in, plus removal of the `if (length > 0)` guards.
5. The Reading Progress panel must export/import the full 14-key state, not just read/position.
6. Tests for Phase 1 use `aria-label` / `getByRole` / `getByText` — never class names.

## What later phases need to re-scope

- **Phase 4 (typography):** budget must be raised from 20 KB brotli to 60 KB brotli, or a font must be dropped. Decision pending.
- **Phase 8 (SSG):** reframe from validation to real SSG content-rendering work. The headline, deck, hero `<img>` (with `<picture>` + AVIF/WebP/PNG), article body, and Opinion Shift score must all appear in the initial static HTML.
- **Phase 8.5 (no-JS):** promote the no-JS path from "verify" to "deliver," blocked on Phase 8.
- **Phase 9 (CI):** first run establishes Lighthouse + axe baselines (not available locally due to no Chrome in Codespaces).

---

## STOP

Phase 0 is complete. No source files were modified. I am waiting for explicit approval on the three escalation items above before starting Phase 1.
