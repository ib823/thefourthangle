# TABLET AUDIT REPORT — The Fourth Angle

## Executive Summary

The Fourth Angle has a **split personality** on tablet. At 1024px+ (iPad Landscape, iPad Pro), it transforms into a genuinely thoughtful desktop experience with a sidebar feed list, inline scrolling reader, and master-detail pattern — this is real tablet design, not a stretched phone app. But at 769–1023px (iPad Portrait, Samsung Tab A), it collapses into an awkward scaled-up phone layout: single column, full-width search bar, no sidebar, massive wasted whitespace. This means the most common Malaysian tablet viewport — Samsung Tab A at 800px portrait — gets the worst experience. The app has clearly been designed desktop-first with a mobile adaptation, and the tablet viewport between those two poles has been abandoned to CSS media query luck. Jony Ive would hold this iPad in portrait, see the single-column phone layout with 654px-wide cards swimming in whitespace, and ask: "Who decided this was acceptable?"

---

## Viewport: 768×1024 — iPad Portrait

### Page: Today View (/)

**Screenshot observations:**

The layout uses the `app-shell--tablet` class, which is a single-column mobile-scaled layout with no sidebar. The header shows T4A logo + brand name + Notifications + About icons (no search icon — search is a full-width input bar below header instead). Below: Today/Library top tabs, sort toggle (Latest / Biggest Shift), and a single-column feed.

The "TODAY" section headline "See what deserves your full attention." is rendered at 30.12px/34.6px line height in Manrope, only 290px wide (the left half of the 2-column hero grid), producing 18 characters per line — absurdly short for a tablet display.

The hero card is 654px wide with an internal 2-column grid (335px + 248px): headline + body text on the left, Opinion Shift score card on the right. The card uses border-radius: 24px and box-shadow: 0 24px 60px rgba(0,0,0,0.18). Below the hero, the layout splits into two columns: "CONTINUE READING" on the left and "DAILY BRIEFING" on the right. The briefing cards show scores (79, 76, 78) in a single-column list within the right panel.

At the very bottom, the Library section shows a 2×1 grid (Reading + Highlights) with Archive below. A rotating quote closes the page.

The header context area (between hero card and header) has an anomalous peach/cream gradient that bleeds across the full width — there's about 50px of dead space between the header and the "TODAY" label.

**Scores:**

| Criterion | Score (1-10) | Observation |
|-----------|-------------|-------------|
| Layout Adaptation | 4 | Single column at 768px is a phone layout stretched. No sidebar. The 2-column split below the hero (Continue Reading + Daily Briefing) is a good gesture, but the hero section above it wastes the full width on a single card. The max-width constraint (960px) for `tablet-shell` is reasonable but the content within is still phone-structured. |
| Typography | 5 | The "TODAY" title at 30px on a 290px-wide column = 18 ch/line — unusable scan width. Hero headline at 37.65px = 16 ch/line — excessively short. Body text at 14px = 44 ch/line — just below acceptable. The hero context paragraph at 14px/23.1px within 336px = 44 ch/line — low end of tolerable. |
| Touch Targets | 8 | All buttons at 44×44px minimum. Header icons properly spaced. Sort toggle buttons at 104×44px. Tab buttons at 86×44px (Today) and 119×44px (Library). The feed items in the briefing section are generous touch targets. |
| Content Density | 4 | This is the key failure. A 768px-wide tablet shows LESS effective content than the 375px mobile (which at least has a focused, vertical feed). The 768px view has the same number of visible items but surrounded by more whitespace. No additional metadata or score detail is exposed despite the extra space. |
| Visual Design | 7 | The hero card with its internal 2-column grid looks intentional. The cream/peach gradient background is tasteful. Card shadows and border radii (24px) work at this scale. However, the empty white space between the search bar and "TODAY" label feels unearned. |
| Performance | 6 | Same bundle as mobile (1.7MB JS decoded). OG images at 1200×630 for 654px display — 1.8× overscale (better than mobile's 3.8× but still wasteful). Two OG images loaded eagerly on initial view. |

**Critical Issues (must fix):**

1. **No sidebar at 768px — this is a wasted tablet viewport** — The jump from single-column (≤1023px) to sidebar+detail (≥1024px) is too abrupt. At 768px, there are 768 pixels of horizontal space — more than enough for a 260px sidebar + 480px content area. The current layout treats 768px exactly like 375px with more padding. **Fix:** Introduce a sidebar breakpoint at 640px or 700px minimum. Use a narrower sidebar (240px) with a collapsible feed list. The feed items at 309px wide (from the 1024px sidebar) could be condensed to 240px by removing the description text, showing only headline + score.

2. **"TODAY" title cramped at 18 ch/line** — The hero grid's 2-column layout forces the title into a 290px column, which at 30px font produces an unreadable line length. **Fix:** At 768px, stack the "TODAY" title area ABOVE the hero card grid, spanning the full 654px width. This would produce ~40 ch/line at 30px — much more comfortable.

3. **Hero card body text at 14px is too small for arm's-length tablet reading** — A tablet is held 18-24 inches from the face vs 12-16 inches for a phone. 14px body text requires effort at arm's length, especially for the "shared family device" use case where parents may have presbyopia. **Fix:** Increase body text to 16px minimum on tablet, ideally 17-18px as the desktop reader already does.

**Improvements (should fix):**

1. **Full-width search bar wastes prime real estate** — The search input at 654px wide dominates the top of the page at 768px. On mobile it makes sense as a compact header element. On tablet, it should be integrated into a sidebar or collapsed to an icon. **Fix:** At tablet widths, keep search as an icon in the header (like the 1024px desktop view does) rather than a full-width bar.

2. **Library section at bottom of Today page shows numbers but no previews** — With 768px of width, the Library promo section could show thumbnail previews of in-progress reading, not just counts.

**Tablet-Specific Opportunities:**

1. **Side-by-side issue comparison** — On a tablet Saturday morning reading session, users would benefit from opening two issue cards side-by-side. A split-view reading mode where the user can compare the "MACC Chief" story with the "Military Generals" story would be uniquely powerful on iPad. No news app in Malaysia offers this.

---

### Page: Issue Reader (at 768px)

The reader at 768px uses a **full-screen overlay** with a centered card (max-width: 440px). The card area is 440px wide, the card-center is 392px. The headline "big-text" renders at 24px = 30 chars/line — below the 50ch minimum for comfortable reading. The body "sub-text" at 17px = 42 chars/line — acceptable but tight.

The reader retains the mobile swipe-card metaphor at this viewport. This is defensible but suboptimal — at 768px, there's room to show 2 cards simultaneously or use the desktop vertical-scroll format.

**Critical Issue:** The card area max-width of 440px wastes 328px of horizontal space (768 - 440 = 328px of empty overlay). This is a phone card on a tablet screen.

**Fix:** At 768px, widen the card area to 560px (max-width). At 24px headline font, this produces 42 ch/line. At 17px body, this produces 60 ch/line — right in the optimal range.

---

### Page: Share Modal (at 768px)

The share modal correctly uses the **centered modal pattern** (not a bottom sheet). The modal is 480px wide with 24px padding, 16px border-radius, and a proper elevation shadow (0 24px 80px rgba(0,0,0,0.18)). This is correct for tablet — Apple's own HIG prescribes centered popovers on iPad, not bottom sheets. The OG preview card renders well. Share button and Copy link are appropriately positioned.

**Score: 8/10** — The modal is well-executed. The one miss: still no platform-specific share buttons (WhatsApp, Telegram, etc.).

---

### Page: Library Archive (at 768px)

The archive uses a **2-column CSS grid** (343px + 343px, 16px gap = 702px total). Each card shows the OG illustration, headline, body excerpt, and score bar. This is a proper tablet grid — cards are large enough to read without tapping, and the 2-column layout uses the space well.

**Score: 7/10** — Good use of columns, but the cards could show more metadata (editorial stage icons, reading time) to increase information density.

---

## Viewport: 1024×768 — iPad Landscape

### Page: Today View

**Screenshot observations:**

This viewport triggers the `app-shell--desktop` class, which introduces the **sidebar + main content** master-detail layout. The left sidebar is ~320px wide containing: Today/Library tabs, search input, sort toggle, and a scrollable feed list. The main content panel is ~694px wide containing: "TODAY" title, stats pill, hero card, and below-the-fold content.

The sidebar feed list shows issues with headline, score, significance label, and brief excerpt — each item is 263px wide and 352-394px tall (varying with content length). There's no image in the sidebar items, which is correct for a navigation panel.

The "TODAY" title at 40px in a 273px column produces 12 characters per line — even worse than 768px portrait. The hero headline at 51.2px in 288px = 10 chars per line. These are catastrophically short line lengths.

The hero card is 636px wide with a border-radius of 24px. The Opinion Shift score box is embedded within the card alongside the headline and body text.

**Scores:**

| Criterion | Score (1-10) | Observation |
|-----------|-------------|-------------|
| Layout Adaptation | 7 | The sidebar + detail pattern is THE correct tablet layout. It allows browsing the feed while reading content — exactly what Apple's own Mail, Notes, and News apps do. The sidebar at 320px is appropriately sized. Loses points because the sidebar only appears at 1024px, missing the entire iPad Portrait market. |
| Typography | 4 | The "TODAY" title at 12 ch/line and hero headline at 10 ch/line are broken. The content panel's 273px text column (for the title area) is inexplicably narrow — the full panel is 694px but the title is constrained to a 273px column, likely because of a grid/flex layout that reserves space for the stats pill. Body text in the hero context at 14px = 82 ch/line (on the wider main panel) is TOO WIDE — exceeds the 75ch maximum. |
| Touch Targets | 7 | Sidebar feed items at 263×352px are massive tap targets — good for thumb use. But the header icons (Notifications, About) at 44×44px are far top-right — outside comfortable thumb reach in landscape two-handed hold. |
| Content Density | 8 | The sidebar shows 4 issue summaries simultaneously. The main panel shows the hero card with full headline, body, and score. This is genuinely higher information density than mobile — you can scan 4 issues and read the lead simultaneously. |
| Visual Design | 7 | The sidebar/content split looks professional. The separator line between sidebar and content is clean. The hero card shadow works at this scale. The peach gradient in the content area is subtle. |
| Performance | 6 | Same core bundle. The sidebar feed items load without images (text-only) which is efficient. OG images only load for the hero and reader, not the sidebar list. |

**Critical Issues (must fix):**

1. **"TODAY" title at 12 ch/line in a 273px column** — This is the worst typographic line length in the entire app across all viewports. The 273px constraint comes from the title being placed alongside other elements (likely the stats pill) in a flex/grid row. **Fix:** Make the "TODAY" title span the full content width (694px) before the stats pill. The title should be above the metadata, not beside it.

2. **Hero context body text at 82 ch/line** — The body paragraph inside the hero card at 1024+ viewports runs to 82 characters per line, exceeding the 75ch readability maximum. This causes eye-fatigue during the extended Saturday morning reading sessions that tablet users engage in. **Fix:** Add max-width: 640px to the hero context paragraph, or constrain its grid column.

**Improvements (should fix):**

1. **Sidebar should show editorial stage indicators** — At 320px sidebar width, there's room for the PA/BA/FC/AF/CT/SR stage dots below each issue's score. This would let the professional-reference user (civil servant in a meeting) quickly assess editorial rigor without opening each issue.

---

### Page: Issue Reader (at 1024px)

This is where the tablet experience shines. The reader renders **inline** in the main content panel — no overlay, no modal. The sidebar remains visible on the left, allowing the user to jump between issues without closing the reader. This is genuine master-detail design.

The reader shows a "READING PATH" progress bar with 6 segments, lens label ("What they said"), and a Share button. All 6 cards are rendered as a vertical scroll rather than swipe-cards. This is the correct adaptation — tablets are for lean-back reading, not rapid swiping.

The body text at 18px/29.7px in the context area produces 64 ch/line — right in the optimal reading zone. The card "big-text" at 24px produces 36 ch/line — below optimal but acceptable for display text. Each card has a numbered badge, lens icon, lens label, and Highlight button.

**Score: 8/10** — The inline reader with sidebar persistence is excellent. Loses a point because the vertical scroll format doesn't provide visual separation between cards — the cards flow into each other with minimal dividers, making it hard to tell when you've moved from card 2 to card 3.

**Fix:** Add a more prominent card separator (a thin horizontal line with the card number centered, or a subtle background color change between cards) to make the 6-card structure visually scannable.

---

## Viewport: 1024×1366 — iPad Pro Portrait

Same layout as 1024×768 (iPad Landscape) since both trigger the 1024px breakpoint. The extra height (1366 vs 768) means more sidebar items are visible simultaneously (6 instead of 4) and the hero card doesn't require scrolling to see the Opinion Shift score. The overall experience is more spacious but structurally identical.

The hero headline at this viewport shows awkward hyphenation: "US tariff re-set after Supreme Court ruling..." — the word "reset" is hyphenated as "re-set" which changes the meaning (it suggests "re-set" as in "set again" rather than "reset" as in "start over").

**Fix:** Add `hyphens: none` or `word-break: normal` to the hero-headline class to prevent mid-word breaks on proper compound words.

---

## Viewport: 1231×893 — iPad Pro Landscape (approximated)

This is the best-proportioned layout. Sidebar at 320px, main content at 901px. The hero card is wider (more room for the headline), the body text hits the optimal 63 ch/line range, and the "CONTINUE READING" / "DAILY BRIEFING" two-column split below the hero is well-balanced. The stats pill fits on one line. The hero headline at 54px = 17 ch/line is still short but acceptable for a display headline.

**Score: Layout Adaptation 8, Typography 7, Content Density 9, Visual Design 8**

The one issue: the hero context body text at 14px = 82 ch/line exceeds the 75ch maximum. At 901px main panel width, body text needs a max-width constraint.

---

## Viewport: 800×1280 — Samsung Tab A (Android Tablet)

This is the most common tablet in the Malaysian/SEA market and it gets the same treatment as 768px iPad Portrait — single column, no sidebar, phone layout stretched. The `app-shell--tablet` class kicks in at 769px.

The additional 32px of width (800 vs 768) provides no meaningful layout change. The hero card internal grid is slightly wider but the overall experience is identical to 768px. "Read past the first telling" tagline is visible in the header at this width.

**Score: 4/10** across all criteria — same as 768px iPad Portrait. This is the viewport that serves the Samsung Tab A owner sitting on their sofa in Petaling Jaya, watching Astro, wanting to quickly check T4A. They get a phone app on a tablet screen.

---

## Cross-Viewport Findings

**The 769-1023px gap is the critical failure zone.** The app has exactly two layout modes:

- **≤768px**: Mobile single-column (phone-optimized, works well at phone sizes)
- **≥1024px**: Desktop sidebar + detail (well-designed, proper master-detail)

Between 769-1023px, the app uses `app-shell--tablet` which is essentially the mobile layout with slightly wider cards. This gap covers: iPad mini portrait (768px), iPad 10th gen portrait (810px), Samsung Tab A portrait (800px), Samsung Tab S6 Lite portrait (800px). These are the most commonly used tablets in Malaysia. Every single one gets a phone app stretched to tablet width.

**Typography scales inconsistently across viewports:**

| Element | 768px | 1024px | 1231px |
|---------|-------|--------|--------|
| Today title | 30px / 18ch | 40px / 12ch | 40px / 18ch |
| Hero headline | 37.6px / 16ch | 51.2px / 10ch | 54px / 17ch |
| Hero body | 14px / 44ch | 14px / 82ch | 14px / 63ch |
| Reader headline | 24px / 30ch | 51.2px / 19ch | 51.2px / 19ch |
| Reader body | 17px / 42ch | 18px / 64ch | 18px / 64ch |

The 1024px viewport has the worst title line lengths (10-12ch) while simultaneously having the widest body text (82ch). This inversion means the layout grid at 1024px is fighting the typography.

**Consistent strengths across all tablet viewports:**
- Touch targets consistently at 44×44px minimum
- Color palette and contrast ratios hold up on larger, more color-accurate tablet screens
- Dark mode support (11 @media rules) is defined
- The share modal correctly uses centered modal pattern (not bottom sheet) on all tablet viewports
- Font loading is efficient (2 woff2 files, font-display: swap)
- About page content width is well-constrained (max-width: 640px)

---

## Performance Report

| Metric | Value | Assessment |
|--------|-------|------------|
| Initial Requests (per load) | ~13 core resources | Good |
| Main JS Bundle (decoded) | 1.7MB | Poor — unchanged from mobile |
| CSS Files | 2 (82KB total decoded) | Good |
| OG Images | 1200×630 PNG per issue | Poor at 654px display — needs srcset |
| Archive Grid Image Load | Eagerly loads 10+ OG images when scrolling | Poor — needs lazy loading |
| 503 Errors | OG image requests occasionally returning 503 | Bug — CDN rate limiting? |
| Font Loading | 2 woff2 with swap | Excellent |

The archive grid at 768px and the sidebar feed at 1024px trigger notably different image loading patterns. The archive grid at 768px eagerly loads OG images for all visible cards (10+ images), while the sidebar at 1024px uses text-only feed items (no images). The archive grid approach is wasteful — each 1200×630 PNG is ~500KB, so 10 cards = ~5MB of images for a single viewport.

---

## The Tablet Question

**Is this currently a tablet-optimized experience, or a responsive phone app that happens to render on tablets?**

It depends on which tablet you hold.

At 1024px and above, this is genuinely a tablet-considered app. The sidebar + inline reader pattern, the vertical scroll through all 6 cards, the persistent feed navigation — these are deliberate design decisions that respect the tablet as its own medium. Someone designed this desktop experience with care.

At 768-1023px, this is an embarrassment. It is a phone app with more padding. The single-column layout with a full-width search bar, the 654px hero card floating in space, the cramped text columns — this is what happens when a media query says "not desktop" and the fallback is "treat it like a phone." Nobody designed this tablet experience. It fell out of the CSS cascade.

If Jony Ive held an iPad 10th generation in portrait (810px) and opened The Fourth Angle, he would see a phone app with acres of whitespace and say: **"You've designed for the screen sizes you have, not the screen sizes your users have."** The Samsung Tab A at 800px portrait is the most sold tablet in Southeast Asia, and you've given it the phone layout.

---

## The One Thing

**Introduce a compact sidebar at 700px+ instead of 1024px.**

Here's the exact specification:

At `(min-width: 700px)`, render a 240px sidebar containing: the T4A logo (compact), the sort toggle, and a condensed feed list (headline + score only, no excerpt, no description). The main content panel gets `calc(100% - 240px - 1px)` = 459px at 700px, scaling up to 783px at 1024px where the full sidebar with excerpts can render.

The condensed sidebar items would be: a 4px color-coded left border (amber for the lead issue, gray for briefing), the score number (79), and the headline truncated to 2 lines. No body text, no "NEW" badge, no significance label. Just: score and headline. Each item is 240px × 72px — compact, scannable, and sufficient for navigation.

This single change transforms the 768-1023px dead zone into a functioning tablet experience. The user on a Samsung Tab A in portrait can now browse the feed in the sidebar while reading the lead issue in the main panel — exactly as Apple intended the master-detail pattern to work.

At 1024px+, the sidebar expands to 320px and gains excerpts, significance labels, and the search input. This is a progressive enhancement, not a breakpoint cliff.

The implementation cost is moderate — the sidebar component already exists for desktop. It needs a compact variant with reduced typography and no excerpts. The main content panel already handles variable widths. The only new CSS is a `@media (min-width: 700px)` block that activates the sidebar at a lower threshold.

This is the difference between a phone app that renders on tablets and a tablet app that scales from phone to desktop. The Fourth Angle's editorial quality deserves the latter.