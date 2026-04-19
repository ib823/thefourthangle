# The Fourth Angle

Non-partisan Malaysian issues analysis platform. Every issue goes through a 6-stage editorial pipeline, scored for neutrality and opinion shift. Static site on Cloudflare Pages.

Live: https://thefourthangle.pages.dev

---

## Stack

Astro 6 (SSG, `output: 'static'`) + Svelte 5 islands + Tailwind 4 + Cloudflare Pages. Content lives one-file-per-issue in `src/data/issues/{id}.json`; the build pipeline generates the reader JSON, search index, fact graph, OG images (AVIF/WebP/JPEG at 640/960/1200w), and CSP hashes. See [`CLAUDE.md`](./CLAUDE.md) for the full publishing workflow.

## Development

```bash
npm install
npm run dev           # Astro dev server
npm test              # Vitest unit
npm run lint          # Biome
npm run check         # Astro typecheck
npm run build         # full build + stealth hardening + CSP hashes
npm run e2e           # Playwright matrix (chromium + firefox + webkit × 3 viewports)
npm run e2e:chromium  # chromium-only fast path
npm run check-fonts   # font budget gate (60 KB brotli)
npm run check-bundle  # JS+CSS bundle-size gate
```

## Cross-browser support

The site is actively tested to meet the [Cross-Browser Parity brief v3](./docs/cross-browser-parity/brief-v3.md).

### Supported matrix

**Browsers:** two latest stable of each evergreen engine.

| Engine | Browsers |
|---|---|
| Chromium | Chrome, Edge, Brave, Opera, Arc, Samsung Internet |
| WebKit | Safari (macOS 13+; iOS 16+; iPad 16+) |
| Gecko | Firefox (desktop + Android) |

Plus common in-app webviews (Facebook, Instagram, TikTok, LINE, WeChat, X/Twitter) — detected and gated in Phase 8.5.

**Viewports:** 320×568 (small phone) through 3440×1440 (ultrawide). Reading column capped at 70ch; hydrated reader at 62ch.

**Operating systems:** Windows 10/11, macOS (Intel + Apple Silicon), Linux (GNOME/KDE), iOS 16+, iPadOS 16+, Android 9+, ChromeOS.

**Assistive tech smoke-tested each release** (Phase 5.5 matrix): VoiceOver (macOS + iOS), NVDA (Windows Firefox + Edge), Narrator (Windows Edge), TalkBack (Android Chrome).

**User preferences respected:**
`prefers-reduced-motion`, `prefers-color-scheme`, `prefers-contrast`, `forced-colors`, `prefers-reduced-transparency`, `prefers-reduced-data`, text-zoom to 200%, OS-level dyslexia fonts.

### Acceptable differences

Font smoothing, scrollbar chrome, native picker UI, emoji glyphs, PWA install flow, form autofill appearance, spell-check underlines, and in-app webview feature gaps vary by platform. These differ by design — see [`docs/cross-browser-parity/known-differences.md`](./docs/cross-browser-parity/known-differences.md) for the complete list with rationale.

### Contributor guide

Every UI / state / build-output change must pass the [Parity Checklist](./docs/cross-browser-parity/parity-checklist.md) before merge.

### Reader report triage

"Site looks wrong in…" / "My progress disappeared" / "Translate broke the layout" → start with [`docs/cross-browser-parity/troubleshooting.md`](./docs/cross-browser-parity/troubleshooting.md).

---

## Repository layout

```
src/
  components/      Svelte islands (hydrated on client:idle or client:load)
  data/
    issues/        one JSON per issue (canonical content source)
    issues.ts      import.meta.glob aggregator
    issue-types.ts Issue type + CARD_TYPES + opinionLabel/Color
  layouts/
    Base.astro     global layout
  lib/
    reading-state.ts  single read/write interface for all tfa-* keys
    feed-sections.ts  FEED_SECTIONS const + buildFeedSections (always 4)
    ...
  pages/           Astro routes (issue/[id].astro is SSG with client:idle enhancement)
  styles/
    tokens.css     design tokens (light + dark + high-contrast)
    global.css     reset + progressive-enhancement blocks
scripts/
  generate-og-images.mjs    AVIF+WebP+JPEG × 3 widths per issue
  check-font-budget.mjs     Phase 4 gate (60 KB brotli)
  check-bundle-budget.mjs   Phase 9 gate (+10 KB OR +5%)
  stealth.mjs               post-build framework-fingerprint stripping
  ...
tests/
  e2e/             Playwright smoke tests (Phase 9)
docs/
  cross-browser-parity/  brief-v3 + per-phase docs + playbooks
  adr/                   MADR architectural decisions
```

## Content

Issues live at `src/data/issues/{id}.json`. Publishing workflow documented in [`CLAUDE.md`](./CLAUDE.md). Each issue goes through 6 editorial stages (preambles in `engine/templates/stage{1-6}-preamble.txt`) before publication.

## License + editorial

Copyright The Fourth Angle. Editorial content is intended for public-interest analysis. Redistribution of analysis without attribution is not permitted. Fair-use quotation welcome.
