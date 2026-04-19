# Phase 5.5 — OS and Assistive-Technology Matrix

**Branch:** `parity/phase-5-5-at`
**Status:** partially complete — **requires real-hardware sessions** to finish.

## What this PR contains

1. **ARIA + landmark audit** (below) — done from source inspection, no hardware needed.
2. **Native-control decision ledger** — documented choices for `<select>`, `<input type="search">`, etc.
3. **Screen-reader smoke-test playbook** — the script that a human with hardware will run. **Results fields left blank** until the sessions happen.

## What needs hardware sessions (flagged for decision)

The brief requires smoke-tests on:

| Platform | Screen reader | Browser | Status |
|---|---|---|---|
| macOS | VoiceOver | Safari | **pending session** |
| iOS | VoiceOver | Safari | **pending session** |
| Windows | NVDA | Firefox | **pending session** |
| Windows | NVDA | Edge | **pending session** |
| Windows | Narrator | Edge | **pending session** |
| Android | TalkBack | Chrome | **pending session** |

None of these can run in a Codespace. They need:
- Real macOS device (VoiceOver is built into macOS / iOS)
- Real Windows 10/11 (Narrator built in; NVDA free download)
- Real Android device or Android Studio emulator with TalkBack
- A tester willing to run the playbook below

**Decision needed: how to schedule these sessions.** Options:

- **A.** You run the playbook personally on available devices. Cheap, accurate, slow. Typical 30-45 min per platform, so ~3-4 hours total.
- **B.** BrowserStack / AssistivLabs / Polypane cloud VMs. Has NVDA + VoiceOver + JAWS access. ~$50-100/session. Fast.
- **C.** Hire an a11y contractor for a one-time audit (~$1-3k, 1-2 day turnaround, formal report). Highest rigor.
- **D.** Defer until a user reports a concrete AT issue. Acceptable for a minimum-viable-AT launch but violates the brief's parity criterion.

**Recommendation:** **Option A** for the initial pass — use your own macOS VoiceOver + Windows Narrator, run the playbook, record blockers. Follow with option B or C only if blockers surface that need multi-platform reproduction.

## ARIA + landmark audit (from source)

### Landmarks present

| Landmark role | Source | Notes |
|---|---|---|
| `banner` (`<header>`) | `Header.svelte`, `UtilityHeader.astro`, `HighlightsPanel.svelte` | Three headers across different surfaces. Accept — screen readers announce "header landmark" for each. Only one per page at any time. |
| `navigation` (`<nav aria-label="…">`) | `MobileDock.svelte` (Primary navigation), `UtilityHeader.astro` (Main navigation), `SurfaceNav.svelte` (Main navigation), `TodayView.svelte` (Footer navigation) | All nav elements have `aria-label` — no ambiguous "navigation landmark" repeats. |
| `main` (`<main>`) | `App.svelte` (×3 for mobile/tablet/desktop layouts) | One visible at a time (layout-gated). |
| `complementary` (`<aside>`) | `DesktopFeed.svelte` (sidebar), `[id].astro` (Opinion Shift) | Two aside uses — sidebar feed and the inline score card. Both semantically "supplementary to main content." OK. |
| `contentinfo` (`<footer>`) | `TodayView.svelte` | One footer per page. |
| `search` (`<form role="search">`) | `Header.svelte`, `DesktopFeed.svelte`, `App.svelte:965` | All three search forms properly rolled. |
| `region` (`<section aria-labelledby="…">`) | `HighlightsPanel.svelte`, `TodayView.svelte` (3 sections), `[id].astro` (7 cards) | All labelled. |

### ARIA state properties

- **`aria-live="polite"`:** present on notification container (SR announces new items without interrupting).
- **`aria-expanded`, `aria-controls`:** verified on expandable sections (Today page topic chips, sidebar expanders).
- **`aria-labelledby`:** 7+ sites. `[id].astro` uses `aria-labelledby="ssg-headline"` on the article.
- **`aria-current`:** used on active tab indicators (DesktopFeed tablist).

### Icon-only buttons

40+ icon-only buttons across components, every one with `aria-label`. Spot-checks:

- `MobileDock.svelte`: 4 × `aria-label` on dock items.
- `NotificationBell.svelte`: `aria-label` on bell + close panel.
- `InstallPrompt.svelte`: `aria-label` on install + dismiss.
- `DesktopFeed.svelte`: 8 × `aria-label` on interactive controls.
- `VerdictBar.svelte`: `aria-label` on verdict icons (the "?" button from brief is covered).
- `ShareModal.svelte`: `aria-label` on share variant selectors.

### Heading structure

- Single `<h1>` per page (verified in Phase 8a for `/issue/[id]`).
- Home page: `<h1>` on hero, then `<h2>` section heads.
- No skipped levels (h1 → h2 → h3; never h1 → h3).

### Skip-to-content link

Both `Base.astro:85` and `[id].astro:85` have `<a href="#main-content" class="sr-only">Skip to content</a>` as the first body element. Target `<div id="main-content">` present. Keyboard users can skip past the header.

## Native control decisions (ledger)

| Control | Keep native? | Reason |
|---|---|---|
| `<select>` (Sort dropdown, if added) | **Keep native** | OS pickers on touch are consistently better than custom. Listbox polyfills break VoiceOver rotor. |
| `<input type="search">` | **Keep, light style** | Native clear button on iOS, kept. `:focus-visible` gets the global focus ring. No replacement. |
| `<input type="checkbox">` | **Keep native** | Custom checkboxes require full ARIA re-implementation; not worth the complexity. |
| `<input type="date">` (not currently used) | Would keep native | Platform-native date pickers are accessible out of the box. |
| Scrollbars | **Browser default** | `scrollbar-gutter: stable` only. No custom scrollbar styling — breaks OS trackpad gestures. |
| Focus rings | **Global token** | One `:focus-visible` rule using `--color-focus-ring`, from Phase 2. forced-colors mode switches to `Highlight`. |

Nothing is being replaced. If future design pressure adds a custom control, the PR must include a conformance test against VoiceOver + NVDA before merge.

## Keyboard-only pass — items to verify

Run these on a **keyboard alone** (no mouse / no touch):

| # | Flow | Expected behavior |
|---|---|---|
| 1 | Load `/` → Tab through all interactive elements | Focus visits every interactive element in DOM order. No dead stops. Focus ring always visible (blue/system). |
| 2 | Tab → reach "Skip to content" | First Tab press focuses the sr-only skip link (becomes visible). Enter jumps past header to `#main-content`. |
| 3 | Sidebar feed — Enter on a section header | Expands/collapses the section or navigates into it. Arrow keys should move between siblings. |
| 4 | Open an issue (click or Enter) → reader opens → Escape | Escape closes the reader, focus returns to the card that was opened. |
| 5 | J / K in desktop reader | J advances to next card, K returns to previous. Focus moves with selection. |
| 6 | Tab → reach Opinion Shift score card | Gets focus-visible; has accessible name "Opinion Shift score". |
| 7 | Tab → reach Share button → Enter → share modal opens | Focus trapped inside modal. Tab cycles within modal. Escape closes + returns focus. |
| 8 | Tab → icon-only buttons | Every icon button has a spoken aria-label (e.g. "Dismiss banner", "Open notifications"). |
| 9 | Export progress flow (once Phase 1 UI lands in PR #3b) | Entire flow reachable with Tab + Enter; file download triggered via keyboard. |
| 10 | Resize browser zoom to 200% | No horizontal scroll. All content reflows. Interactive elements still reachable. |
| 11 | Zoom text-only to 320% | Reading columns stay in the measure. No overlap. |

Record any blocker with:
- Platform (OS + browser)
- Step # that broke
- Expected behavior
- Actual behavior

File blockers in this PR as inline comments or in `troubleshooting.md` (Phase 10) as ADRs if architectural.

## Screen-reader smoke-test playbook

**Run these paths in each of the 6 platform/SR combinations listed at the top.**

Each path is a single user story. Record the full speech flow as the reader encounters each element, and note any dropped / wrong / confusing announcements.

### Path 1 — Land on home, reach an issue (60 seconds)

1. Navigate to `/`.
2. Tab to sidebar. Expect announcement: "navigation, Primary navigation" or equivalent.
3. Continue tabbing into the feed sections. Each section header announces as "heading level 2" or similar.
4. Tab to an issue card. Announcement: the issue headline, opinion shift score, severity label.
5. Enter / Space to open.
6. Expect reader opens; focus moves to reader's `<h1>` headline.

### Path 2 — Read an issue with a reader (90 seconds)

1. Direct-navigate to `/issue/0146`.
2. Expect first announcement after page load: the skip link, then the article landmark, then the `<h1>` text.
3. Step through each `<section>` (card). Label announces as "What they said" / "What we found · Legal" / etc.
4. Reach the Opinion Shift aside. Announcement: "Opinion Shift score, complementary region, 72 out of 100, Significant."
5. Reach the editorial quality footer. Announcement: "Editorial Quality Score, 76 out of 100."

### Path 3 — Change sort / filter (45 seconds)

1. Sidebar → Sort toggle (Latest / Biggest Shift).
2. Toggle announces current state + role=button.
3. Activating announces the new sort.

### Path 4 — Export progress (once Phase 1 UI lands in PR #3b)

1. Info menu → Reading Progress panel.
2. Announcement flow covers device ID display, storage-status indicator, Export button.
3. Export button Enter → file download triggered.

## Results table — fill after sessions

| Platform / Browser / SR | Path 1 | Path 2 | Path 3 | Path 4 | Blockers |
|---|---|---|---|---|---|
| macOS / Safari / VoiceOver | pending | pending | pending | n/a | |
| iOS / Safari / VoiceOver | pending | pending | pending | n/a | |
| Windows / Firefox / NVDA | pending | pending | pending | n/a | |
| Windows / Edge / NVDA | pending | pending | pending | n/a | |
| Windows / Edge / Narrator | pending | pending | pending | n/a | |
| Android / Chrome / TalkBack | pending | pending | pending | n/a | |

Legend: ✓ clean / ⚠ minor issue / ✗ blocker

## Zoom test

Run browser zoom at 200% and "text only zoom" (Firefox: View → Zoom → Zoom Text Only; Chrome/Safari: system zoom at 200%) at 320%. On `/` and `/issue/0146`:

- No horizontal scroll at either zoom level.
- All content reflows; no clipping.
- Touch targets remain ≥ 44×44 CSS px (they scale).
- Reading column stays at its `max-inline-size: 70ch` cap; text doesn't overflow.

Record: **pending sessions.**

## What's done in this PR regardless of sessions

- This doc.
- ARIA + landmark audit baseline (above).
- Native-control decisions ledger (above).
- Keyboard-pass playbook for later.

## What blocks session work from merging

Nothing blocks *this PR* from merging — it's documentation + a playbook. The actual session results land as a follow-up commit to `/docs/cross-browser-parity/55-at-matrix.md` once the sessions happen.

Any blocker found during sessions → file an ADR in `/docs/adr/` + a fix-forward PR.
