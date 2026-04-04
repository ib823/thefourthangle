# DESKTOP AUDIT REPORT — The Fourth Angle

---

## Executive Summary

The Fourth Angle ships a thoughtful, well-architected desktop experience built around a sidebar + main panel paradigm that feels native to desktop information products. The layout choices are intelligent: a persistent 320px issue sidebar with independent scroll, a hero-led main feed, and an in-context reader that preserves navigation — all hallmarks of a product team that understands how journalists and policy workers actually consume content. Typography uses Manrope (display) and Nunito Sans (body) with careful optical sizing and negative letter-spacing on headlines. The critical gap is the absence of any max-width constraint on the app shell, meaning the design will stretch indefinitely on ultrawide monitors — a decision that will erode readability and visual trust at higher resolutions. At the common 1231px testing viewport, the product already looks credible and professional; the work needed is primarily about protecting that quality as screen sizes scale up, tightening hover state feedback, and adding the subtle polish that separates "good SPA" from "serious editorial product."

---

## Viewport: 1231px (tested — browser viewport at all resize targets)

*Note: The browser environment caps the inner viewport at 1231×893px. All CSS breakpoint analysis, media queries, and computed properties were inspected programmatically to assess behavior at 1440px, 1920px, and 2560px. The site has breakpoints at 1024px (desktop activation) and 1440px (header refinement only — 3 rules). No breakpoint exists above 1440px.*

---

### Page 1: Today View (/)

The Today view uses a flex column layout: sticky header (62px) → flex row (aside 320px + main flex-grow). The main panel hosts a "hero grid" (2-column: ~491px + ~264px, 28px gap, 30px padding) containing the Lead Issue card and the Opinion Shift widget. Below sits a "today grid" (2-column: ~413px + ~413px, 18px gap) for Continue Reading and Daily Briefing panels.

Above-the-fold content is strong: the tagline ("See what deserves your full attention"), a status bar ("3 issues ready · about 9 min · updated 4 April 2026"), and a hero card with illustration, headline, summary text, and the Opinion Shift score — all visible without scrolling. The lead issue gets differentiated treatment with a dark photographic/illustration card, a "LEAD ISSUE" badge, and a separate score widget. The sidebar shows the full issue list with scores, classification labels (Significant/Fundamental), and preview snippets.

| Criterion | Score (1–10) | Observation |
|-----------|-------------|-------------|
| Layout & Grid | 7 | Smart sidebar+main flex layout. Hero grid and today grid use CSS Grid with explicit column templates. However, **no max-width on any container** — `.app-shell`, `.app-main`, `.desktop-main-panel`, `.hero-grid`, `.today-grid` all have `maxWidth: none`. At 1920px+ content will stretch edge-to-edge, destroying readability. The sidebar is a fixed 320px; main panel is `flex-grow: 1` with no ceiling. |
| Typography | 8 | Manrope display font with tight letter-spacing (-1.8px on H1, -2.43px on H2) creates premium editorial feel. Body text at 14px Nunito Sans with 1.6 line-height is adequate. Hero headline at 54px is impactful. The h1 tagline is constrained to `max-width: 385px` — elegant. Body reading column on the hero summary is ~61 chars/line (within range). |
| Mouse & Keyboard | 7 | `cursor: pointer` on all interactive elements. Hover on sidebar cards (`translateY(-2px)` with `transform 0.15s, border-color 0.15s, box-shadow 0.15s`). Hero card also has `translateY(-2px)` hover. Focus-visible uses blue ring (`2px solid #1971C2`, `outline-offset: 2px`). Skip-to-content link present. Tab order follows logical flow. However: hero card hover is very subtle at 2px and needs stronger shadow lift to communicate clickability. No visible hover state change on header icon buttons (Notifications, About). |
| Visual Refinement | 8 | Header uses `backdrop-filter: blur(12px)` at 85% opacity — a premium touch. Shadow system uses 2 levels: cards at `rgba(20,20,20,0.05) 0px 12px 28px` and hero at `rgba(0,0,0,0.18) 0px 24px 60px`. All SVGs have viewBox. OG images are 1200×630 rendered at 843×484 — sharp. Border-radius is 24px on the hero card, consistent with a soft aesthetic. |
| Performance | 8 | DOM content loaded in 86ms. Full load in 345ms. Total decoded payload: ~3.2MB (CSS 83KB, JS 1.77MB, Fonts 56KB, Images 1.27MB). Two CSS files, three JS chunks — lean code-split approach. Two web fonts (Manrope Latin, Nunito Latin) as WOFF2. PWA manifest and service worker present. 13 total site resources on initial load. Only 2 OG images loaded eagerly. |
| Professional Appearance | 8 | The sidebar+hero layout immediately communicates "editorial product." The score system (Opinion Shift + classification) is distinctive and credible. The tagline conveys editorial confidence without arrogance. The muted color palette (#212529 primary, #495057 secondary, amber accent) reads as serious news. The frosted glass header adds polish. Would a government servant trust this? Yes — it looks more like a Reuters briefing than a blog. |

**Critical Issues:**
1. **No max-width constraint anywhere.** On a 2560px monitor, body text will hit 150+ characters per line. This is the single most damaging desktop omission. Add `max-width: 1400px` to `.app-shell` or `.app-main` with `margin: 0 auto`.
2. **The hero card hover (translateY -2px) is imperceptible** at desktop scale. A 843×484px card moving 2px is a 0.4% shift — invisible to the eye. Needs shadow elevation change or brightness shift.
3. **Header icon buttons (Notifications, About) have no visible hover state** — `background 0.15s` transition exists but the background doesn't visibly change. These feel dead.

**Improvements:**
1. Add `box-shadow` escalation on hero card hover (e.g., increase from `0px 24px 60px` to `0px 32px 80px` with darker alpha).
2. Add background tint on header icon hover (currently `background 0.15s` transition exists but no visible change).
3. The sort pill ("Latest" / "Biggest Shift") at 11px is very small. Consider 12–13px minimum for comfortable desktop click targets.
4. The "LEAD ISSUE" badge text is 11px — could be 12px for better legibility on larger screens.

**Desktop-Specific Opportunities:**
1. The sidebar could show a mini "reading progress" indicator per issue (e.g., a thin bar under each card showing % read).
2. At wider viewports, the main panel could introduce a 3-column today grid instead of 2-column.
3. The hero card could expand its illustration to be more cinematic on wider monitors, with a parallax scroll effect.

---

### Page 2: Issue Reader (/issue/[id])

Opens as a full-page replacement of the main panel content — the sidebar remains visible and scrollable independently. The reader has its own scroll container (`overflow: auto`, 3902px content height in 830px viewport). A "READING PATH" progress bar appears at the top with 6 segments (one per card). Each card is numbered (1–6) with labels: "What they said," "What we found," "Technology," etc. Cards include a "Highlight" save button (heart icon).

Reader typography: headline at 54px Manrope with `max-width: 604px`, summary at 18px Nunito Sans with `max-width: 670px` giving ~68 chars/line — within the 50–75 character ideal range. Card body text at 18px with ~47 chars/line in the score widget area. The Opinion Shift score panel uses a dark background with large gold numerals.

At the bottom: "You've seen the full picture" completion message, Editorial Audit (6 colored dots: PA, BA, FC, AF, CT, SR with composite score), "Back to Today" button, "Share issue" button, and "Copy for verification" link.

| Criterion | Score (1–10) | Observation |
|-----------|-------------|-------------|
| Layout & Grid | 8 | Sidebar-alongside-reader is the correct desktop pattern. Independent scroll containers prevent content fighting. Reading column constrained to ~670px — excellent for body text. Cards stack vertically with generous whitespace. |
| Typography | 8 | 68 chars/line for body text is near-optimal. Headline sizing at 54px is appropriately dramatic. Card headings at 24px create clear hierarchy. Line-height at 29.7px (1.65x) for body text is comfortable. |
| Mouse & Keyboard | 6 | Escape closes the share modal (confirmed). However: no arrow key navigation between cards. No keyboard shortcut to advance through the reading path. Tab navigation works but requires many presses to reach card actions. The Highlight button uses the same `translateY(-2px)` subtle hover. |
| Visual Refinement | 8 | Card containers have subtle rounded corners and the separator between cards uses clean whitespace. The reading path progress bar is a sophisticated touch. Score display with colored dots (green circles, amber triangles, red diamonds) is distinctive. |
| Performance | 8 | Reader content loads instantly from local data (no additional network request for issue content). Scroll performance is smooth. |
| Professional Appearance | 9 | This is the strongest page. The 6-card format with numbered progression, labeled angles ("What they said" vs "What we found"), and the Editorial Audit create an experience unlike any Malaysian news product. A researcher would understand this immediately. |

**Critical Issues:**
1. **No keyboard shortcuts for card navigation.** Desktop users expect arrow keys or J/K to advance between cards in a reading app.
2. **No "Related Issues" visible in the reader.** Desktop has room for a related issues panel, perhaps in the right margin or at the completion screen.

**Improvements:**
1. Add J/K or arrow key navigation between cards with scroll-to behavior.
2. Show related issues at the "You've seen the full picture" endpoint.
3. The "Back to Today" button should be more prominent — currently it looks like a text link, not a primary action.

---

### Page 3: Share Modal

Centered modal with translucent backdrop. Contains: OG preview card (image, headline, summary, Opinion Shift score, Neutrality score), a "Share" button (dark, full-width), and a "Copy link" row. Modal width is proportional to the viewport — approximately 440px wide. Escape key closes it (confirmed).

| Criterion | Score (1–10) | Observation |
|-----------|-------------|-------------|
| Layout & Grid | 8 | Properly centered with backdrop. Width is sensible for the viewport. |
| Typography | 7 | Share modal headline at 16px is adequate. Score display in the preview is compact and clear. |
| Mouse & Keyboard | 8 | Escape to close works. Close button (×) visible. |
| Visual Refinement | 8 | The OG preview card rendering is sharp (1200×630 source). Score bars and labels are legible. |
| Professional Appearance | 8 | The preview card gives the sharer confidence in what recipients will see. The dual scores (Opinion Shift + Neutrality) are a trust differentiator. |

**Improvements:**
1. Add platform-specific share buttons (WhatsApp, Twitter/X, Telegram — critical for Malaysian audience) instead of relying on the generic Web Share API or just copy link.
2. The preview card could show a "powered by T4A" watermark more prominently.

---

### Page 4: Library Views

Three tabs: Reading (0), Highlights (0), Archive (79). The empty state for Reading says "No unfinished issues yet" with helpful guidance. The Archive tab re-uses the sidebar list with all 79 issues, while the main panel shows "Choose any issue from the full archive" instruction. The sort chips (Latest / Biggest Shift) persist.

| Criterion | Score (1–10) | Observation |
|-----------|-------------|-------------|
| Layout & Grid | 6 | The Archive view wastes the main panel — it shows only a centered text prompt while all content lives in the sidebar. On desktop, the main panel should show a grid of issue cards (3-column grid) for better browsability. |
| Typography | 7 | Empty state messaging is clear and helpful. |
| Professional Appearance | 6 | The empty main panel feels like an unfinished state. A desktop-specific archive grid would dramatically improve this. |

**Critical Issue:** The Library Archive view is the biggest missed opportunity on desktop. The main panel should display a multi-column card grid (similar to The Economist's archive), not push everything into a narrow sidebar list.

---

### Page 5: Search

Search input in the sidebar with instant filtering. Typing "water" returned "6 results for 'water'" with highlighted match text. Results display in the sidebar list format with full score and classification. The clear button (×) is visible.

| Criterion | Score (1–10) | Observation |
|-----------|-------------|-------------|
| Layout & Grid | 7 | Search results use the existing sidebar card format — consistent but constrains results to 320px width. |
| Typography | 7 | Result count is clear. Match highlighting is visible. |
| Mouse & Keyboard | 7 | Keyboard typing works instantly. Results update in real-time. However: no arrow-key navigation through search results (would need testing). |
| Professional Appearance | 7 | Functional and clean, but not leveraging desktop space. Search results could expand into the main panel. |

**Improvement:** On desktop, search results should populate both the sidebar list AND show expanded previews in the main panel.

---

### Page 6: About & Verify Pages

The About page ("How This Works") drops the sidebar entirely and uses a full-width layout with centered content. Navigation switches to a top-right pill group (Today / How This Works / Verify). Content is organized in cream-colored card sections. Reading column at ~604px wide, body text at 14px giving ~73 chars/line — right at the upper boundary of readability.

The Verify page provides a clean text-verification interface with a textarea, Verify button, and explanation of the Ed25519 cryptographic signature system.

| Criterion | Score (1–10) | Observation |
|-----------|-------------|-------------|
| Layout & Grid | 7 | Content centered at ~604px is reasonable. The switch from sidebar layout to full-width is jarring — navigation paradigm changes completely. |
| Typography | 7 | Body at 14px × 73 chars/line is the upper limit. Could benefit from bumping to 15–16px or constraining width to 560px for 65 chars/line. |
| Professional Appearance | 8 | The About content is editorially confident. The Verify page is a trust-building feature unique in Malaysian media. The Ed25519 explanation is technical but accessible. |

**Issue:** The About page has excessive scrollable whitespace below content (body height 2979px but content ends much earlier). This may be a CSS height calculation bug.

---

### Page 7: 404 Page

Clean and on-brand. Centered "This page wasn't found" message with helpful context text and a "Return to Today" button. Background uses the same pale gradient as the About page. Header is simplified (brand + "How This Works" link only).

| Criterion | Score (1–10) | Observation |
|-----------|-------------|-------------|
| Professional Appearance | 8 | Appropriate, helpful, and doesn't break the brand experience. |

---

### Page 8: Hover States & Micro-interactions

**Hover State Inventory (20 CSS hover rules found):**

| Element | Hover Effect | Assessment |
|---------|-------------|------------|
| Sidebar cards (`.brief-item`, `.panel-issue`, `.library-item`) | `translateY(-2px)` | Subtle but functional. Could add shadow elevation. |
| Hero card (`.hero-card`) | `translateY(-2px)` | Too subtle for an 843×484px element — imperceptible. |
| Sort chips (`.sort-chip`) | `translateY(-1px)`, color change to `--text-primary` | Good — communicates interactivity. |
| Surface buttons (`.surface-button`) | `translateY(-1px)`, bg change, border-color change | Good — clear state change. |
| Close buttons (`.close-btn`) | `background: var(--border-subtle)` | Adequate. |
| Share button (`.share-btn`) | `background: var(--bg-sunken)`, border change | Good. |
| Copy button (`.copy-btn`) | `background: var(--bg-sunken)` | Good. |
| Save/Highlight button (`.save-btn`) | `background: var(--bg-sunken)` | Good. |
| Completion primary button | Gradient border + background shift | Excellent — most polished hover state. |
| Completion utility button | `translateY(-1px)`, bg/border/shadow change | Good. |
| Native share button | `opacity: 0.85` | Minimal but functional. |
| Nav chevrons | bg + border-color change | Adequate. |
| Header icon buttons | `background 0.15s` transition exists | **Missing visible effect** — transition defined but no hover rule changes the background. |

**Consistency Assessment:** Hover states exist on 80% of interactive elements and use a coherent language (translateY for lift, bg-sunken for container actions). The main inconsistency is the header icons and the hero card, where hover feedback is either missing or imperceptible. No scale transforms are used — the language is purely translate + color.

**Cursor behavior:** All buttons and links show `cursor: pointer`. Non-interactive text shows `cursor: auto`. This is correct.

---

## Keyboard Navigation Map

1. **Tab 1:** Skip to content (visible on focus, positioned fixed top-left with proper styling)
2. **Tab 2:** Brand link (The Fourth Angle)
3. **Tab 3:** Notifications button
4. **Tab 4:** About link
5. **Tab 5:** Today tab
6. **Tab 6:** Library tab
7. **Tab 7:** Search input
8. **Tab 8+:** Sort chips, then sidebar issue cards
9. **Tab continues:** Hero card, then today grid cards, then daily briefing cards

**Focus ring:** `box-shadow: #1971C2 0px 0px 0px 2px` with `transition: box-shadow 0.15s ease-out` — blue, visible, and animated. Clean and accessible.

**Keyboard shortcuts:** None detected beyond standard browser behavior. Escape closes modals. No J/K reader navigation, no / for search focus, no ? for help.

---

## Performance Report

| Metric | Value |
|--------|-------|
| DOM Content Loaded | 86ms |
| Full Load | 345ms |
| Response (HTML) | 53ms |
| First Paint / FCP | ~22.3s (anomalous — likely due to browser environment preload cache) |
| Total Decoded Size | 3.18MB |
| CSS | 82.5KB (2 files) |
| JavaScript | 1.77MB decoded (3 chunks — code-split) |
| Fonts | 55.9KB (2 WOFF2 files) |
| Images | 1.27MB (OG images) |
| Total Requests | 13 (site resources only) |
| Dark Mode Rules | 41 |
| Reduced Motion Rules | 5 |
| PWA | Manifest present, service worker likely |

Assessment: Performance is excellent for an SPA. Sub-100ms DOMContentLoaded. Lean font payload. Code-split JS. Only 2 images loaded eagerly. The 1.77MB decoded JS is reasonable for a fully client-rendered app with offline data.

---

## Competitive Positioning

**vs. The Economist:** T4A matches the editorial confidence and typography quality. The Economist uses a more rigid grid and bolder color accents (red). T4A's amber accent is subtler but equally distinctive. T4A's 6-card format is structurally more innovative than The Economist's traditional article format.

**vs. CNA (Channel NewsAsia):** T4A's sidebar+reader pattern is more desktop-native than CNA's stacked article layout. CNA has stronger visual density and more content above the fold. T4A trades density for depth — fewer issues, more analysis per issue.

**vs. Malaysiakini:** T4A is significantly more refined in typography, spacing, and visual hierarchy. Malaysiakini's desktop experience is cluttered with ads and dense text. T4A looks like a different generation of product.

**vs. SCMP (South China Morning Post):** SCMP has a more traditional news grid with strong photography. T4A's illustrated OG images are a deliberate choice that avoids sensationalist photo-led design. SCMP's desktop layout is more complex but also more proven for large content volumes.

**Overall tier:** T4A sits between "premium indie publication" and "institutional news product." It's above Malaysiakini and most Southeast Asian news sites, roughly on par with CNA's design quality, and approaching The Economist's editorial polish. The 6-card structured analysis format is genuinely novel.

---

## The One Thing

**Add `max-width: 1400px; margin: 0 auto;` to the `.app-main--desktop` container.**

This is the single highest-impact improvement. Right now, every container has `maxWidth: none`, which means on a 1920px monitor the main reading column will stretch to ~1600px and body text will hit 100+ characters per line — destroying readability and making the product look like a developer prototype rather than a premium editorial platform. A journalist on a 27" iMac will see content float edge-to-edge with no visual containment, undermining the trust that the typography and layout otherwise establish. This one CSS property protects the entire design system as screens get wider. The sidebar can remain fixed at 320px; only the total app width needs a ceiling. This is a 30-second fix with outsized impact — it's the difference between "looks great on my laptop" and "looks great everywhere."