# Phase 7 — Extension, translate, and third-party resilience

**Branch:** `parity/phase-7-extensions`

## Audit

| Brief item | Status |
|---|---|
| Replace `:nth-child` / `:first-child` / `:last-child` / `>` that assume DOM shape | Grep found none that assume injected shape. No change. |
| `translate="no"` on brand / scores / dates / URLs | **Added in this PR.** |
| Google Translate `<font>` defensive unset | **Added in this PR.** |
| CSP strict (Phase 0 audit § K) | Already clean (`default-src 'self'` + allowlisted connect-src workers). No change. |
| Extension compatibility (Grammarly / LanguageTool / 1Password / uBlock / Dark Reader) | Selector hardening via `translate="no"` + `<font>` unset covers the common injection modes. Documented. |

## Changes

### `translate="no"` on identity elements

Google Translate skips nodes with `translate="no"`. Applied to:
- Brand block (`src/components/Header.svelte:85`) — "The Fourth Angle" + tagline
- Opinion Shift score number + `/ 100` (`src/pages/issue/[id].astro:247`)
- Source date `<time>` (`src/pages/issue/[id].astro:225`)
- Editorial Quality Score value (`src/pages/issue/[id].astro:285`)

Rationale: these are identity / numeric / metadata elements. Translating "The Fourth Angle" to "Der Vierte Winkel" or translating `72` to anything breaks the brand and the semantics of the score.

### Google Translate `<font>` wrapper unset

Google Translate wraps translated text in `<font>` elements with inline style attributes that override site typography (vertical-align, color, size). Scoped reset:

```css
.ssg-article font,
[class*="reader"] font,
.feed-row font {
  all: unset;
  font: inherit;
  color: inherit;
}
```

Scoped to the article tree so brand-mark `<font>` (which won't happen given `translate="no"`) and any legit `<font>` usage outside the article are untouched. Elements with `translate="no"` never get wrapped to begin with.

## Verified in earlier phases

- **CSP posture** (Phase 0 audit § K): `default-src 'self'` + explicit allowlists for worker origins + `report-uri`. Strict and well-configured. No change.
- **Strict typography tokens** (Phase 2 + 4): single `:focus-visible`, `font-smoothing: antialiased`, `font-variant-numeric: tabular-nums` site-wide. Extensions that inject their own CSS (Dark Reader, Grammarly) can override any of these; our rules hold if they don't.
- **No `dangerouslySetInnerHTML` / `set:html`** (Phase 0 audit § K). The one `{@html}` in `FeedRow.svelte:79` is over repo-controlled text, escape-tested in Phase 0.

## Manual extension test matrix

The brief asks for tests with Grammarly / LanguageTool / AdBlock Plus / uBlock Origin / 1Password / Bitwarden / Dark Reader. I can't run browser extensions in a Codespace. Documented for the Phase 9 Playwright extension-loading work or for the Phase 5.5 hardware-session playbook:

| Extension | What to check | Expected behavior |
|---|---|---|
| **Grammarly** | Loads on the issue page | Adds its toolbar without breaking scroll / selection. Typing in search is not interrupted. |
| **LanguageTool** | Same. | |
| **AdBlock Plus / uBlock Origin** | Page loads with default rules | All content visible; no blocked requests in console. CSP doesn't block anything critical. |
| **1Password / Bitwarden** | Visit any form (search) | Autofill indicator doesn't push layout around. Focus-visible ring still visible. |
| **Dark Reader** | Page in light + dark mode | Our dark tokens apply when `prefers-color-scheme: dark`; Dark Reader should detect this and disable itself, or its re-colouring should respect the existing palette. |
| **Google Translate** (mobile Chrome → translate page) | Toggle translation | Brand stays "The Fourth Angle". Scores stay numeric. Article body translates cleanly without broken line heights. |

Record results in `troubleshooting.md` (Phase 10) if any extension breaks. Fix via additional selector hardening, never by asking users to disable extensions.

## CSP check (no change this phase)

From `dist/_headers` (Phase 0 audit):
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-...'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://tfa-notify.4thangle.workers.dev https://tfa-sync.4thangle.workers.dev; object-src 'none'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests; report-uri https://tfa-notify.4thangle.workers.dev/api/csp-report
```

Strict, well-scoped. `'unsafe-inline'` on `style-src` is required because Svelte scoped styles inline; removing it would require a build-time style-hash pass similar to the script-hash one. Documented as acceptable.

## Acceptance

- `npm run check` → 0 errors
- `npm run lint` → 0 errors
- `npm test` → 76 pass
- `npm run build` → clean; stealth clean; 8 inline hashes unchanged

## How to verify

```bash
# Brand + scores marked translate="no"
grep -rE 'translate="no"' src/ | head

# Font unset rule present
grep -A 3 "font { all: unset" src/styles/global.css || grep -A 1 "Google Translate" src/styles/global.css
```

In browser (Chrome mobile): Menu → Translate → confirm brand + numbers remain English while prose translates.
