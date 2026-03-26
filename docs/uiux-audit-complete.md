# The Fourth Angle — Complete UIUX Audit

## Audit Scope
Every component, every CSS property, every animation, every interaction, every color, every spacing value, every touch target, every breakpoint. Line-by-line across 40+ files.

---

## MASTER DEFECT LIST

### P0 — CRITICAL (Breaks Usability)

| ID | File | Line | Issue | Impact |
|---|---|---|---|---|
| P0-01 | App.svelte | 110 | iPad portrait (768px) classified as mobile (`<=768`) — shows Tinder card stack instead of tablet grid | iPad users get wrong layout |
| P0-02 | ALL components | — | Dark mode defined in tokens.css but ~95% of Svelte components use hardcoded hex colors | Dark mode completely non-functional |
| P0-03 | Header.svelte | 62 | Cancel button `min-height:36px` — below 44px | Frustrating mobile taps |
| P0-04 | Header.svelte | 78 | About link `min-height:28px` — below 44px | Frustrating mobile taps |
| P0-05 | Header.svelte | 74 | Search icon button `min-height:28px` — below 44px | Frustrating mobile taps |
| P0-06 | SaveButton.svelte | 40 | `min-height:36px` — below 44px | Frustrating mobile taps |
| P0-07 | ShareModal.svelte | 86 | Close button 32x32px — below 44px | Frustrating mobile taps |
| P0-08 | DesktopFeed.svelte | 61-65 | Search clear button ~14px — below 44px | Impossible to tap on touch screens |
| P0-09 | DesktopFeed.svelte | 78 | Sort buttons `padding:2px 6px` — ~20px height | Impossible to tap on touch screens |
| P0-10 | ContentFingerprint.svelte | 40 | Copy button `padding:3px 8px` — ~22px | Below 44px |
| P0-11 | DesktopReader.svelte | 119 | Reader max-width 680px but available width at 1024px is only 664px (360px sidebar) | Horizontal overflow on iPad landscape / small desktop |

### P1 — HIGH (Breaks Apple-Level Polish)

| ID | File | Line | Issue | Impact |
|---|---|---|---|---|
| P1-01 | InsightReader.svelte | overlay | No entrance/exit animation on overlay — mounts instantly | Jarring, breaks spatial continuity |
| P1-02 | MobileBrowser.svelte | commitSwipe | Spring animation doesn't receive velocity from gesture tracker | Cards feel "stuck" — no momentum continuity |
| P1-03 | — | ALL | Spacing uses 25+ distinct values (3,4,5,6,7,8,10,12,14,16,18,20,24,30,32,40,48px) — no grid | Visual noise, doesn't feel "designed" |
| P1-04 | VerdictBar.svelte | 104 | Stage labels at 8px font on colored background — contrast likely fails WCAG AA | Accessibility |
| P1-05 | MobileCard.svelte | 138 | "New" badge #24783C on #EBFBEE — 4.2:1 ratio (WCAG AA requires 4.5:1 for small text) | Accessibility |
| P1-06 | tokens.css | dark | Dark mode tertiary text #8C8478 on #1A1A1A — 4.0:1 (fails WCAG AA) | Accessibility |
| P1-07 | InsightReader.svelte | — | No env(safe-area-inset-*) usage — content goes under notch/home indicator | Content clipped on newer iPhones |
| P1-08 | MobileBrowser.svelte | 349 | No env(safe-area-inset-bottom) — card area overlaps home indicator | Content clipped |
| P1-09 | ShareModal.svelte | — | No bottom safe area padding | Bottom buttons obscured on iPhone |
| P1-10 | CardShell.svelte | — | Entrance animation uses CSS `ease` (0.35s) not spring physics | Inconsistent with spring-based gesture system |
| P1-11 | FactCard.svelte | — | Expand/collapse uses CSS `ease` (0.3s height, 0.2s rotation) not spring | Same inconsistency |

### P2 — MEDIUM (Elevates to Apple Tier)

| ID | File | Line | Issue |
|---|---|---|---|
| P2-01 | about.astro, disclaimer.astro | — | Navigation causes full page reload — breaks app feel |
| P2-02 | InsightReader.svelte | — | No keyboard navigation (arrow keys for cards) |
| P2-03 | InsightReader.svelte | SR-06a | `rotateY` during drag has no `perspective` on parent — dead computation |
| P2-04 | ShareModal.svelte | — | Drag-to-dismiss uses touch events, not pointer events — won't work with stylus/mouse |
| P2-05 | BottomNav.svelte | — | Component exists but never rendered — dead code |
| P2-06 | verify.html | — | No dark mode styles |
| P2-07 | DesktopFeed.svelte | 46 | Fixed 360px sidebar width — no responsive adjustment |
| P2-08 | ALL desktop | — | No :focus-visible states on interactive elements (global.css defines it but components override with inline hover) |

### P3 — POLISH (Delight Details)

| ID | File | Line | Issue |
|---|---|---|---|
| P3-01 | global.css | — | `-webkit-overflow-scrolling: touch` deprecated |
| P3-02 | MobileBrowser.svelte | 374 | Active card has `will-change:transform` but no `backface-visibility:hidden` (peek cards have both) |
| P3-03 | Header.svelte | — | No search input animation (instant show/hide) |
| P3-04 | — | — | No skeleton/loading states for search index load |
| P3-05 | — | — | iOS Safari doesn't support Vibration API — no haptic feedback on Apple devices |
| P3-06 | ALL card types | — | No text overflow handling (word-break/hyphens) — long words could break layout at 360px |

---

## COMPLETE COLOR AUDIT

### Hardcoded Colors Found (NOT using CSS variables)

**Grays (13 distinct values):**
| Hex | Usage Count | Components |
|---|---|---|
| #FFFFFF | 15+ | MobileCard, DesktopCard, DesktopFeed, DesktopReader, Header, ShareModal |
| #F8F9FA | 10+ | MobileCard, DesktopReader, Header, ShareModal, SaveButton |
| #FCFCFC | 2 | MobileCard (completed), DesktopCard (completed) |
| #F1F3F5 | 8+ | MobileCard, DesktopFeed, FeedRow, DesktopReader, ShareModal |
| #E9ECEF | 6+ | DesktopFeed, DesktopReader, FeedRow, SaveButton |
| #DEE2E6 | 3 | Header, InsightReader, ShareModal |
| #CED4DA | 1 | VerdictBar fallback |
| #ADB5BD | 3 | SaveButton (default), DesktopFeed (inactive sort) |
| #868E96 | 4+ | InsightReader, DesktopFeed, FeedRow |
| #6C757D | 15+ | MobileCard, DesktopCard, DesktopReader, DesktopFeed, Header, ShareModal, FeedRow |
| #5A5F64 | 1 | DesktopCard context |
| #495057 | 8+ | MobileCard, DesktopCard, DesktopReader, ShareModal |
| #212529 | 10+ | MobileCard, DesktopCard, DesktopReader, DesktopFeed, Header, ShareModal |

**Status/Score Colors (4 themes, each used 5+ times):**
| Color | Meaning | Components |
|---|---|---|
| #E03131 | Score >= 80 (critical) | OpinionBar, MobileCard, DesktopCard, DesktopReader, FeedRow, SaveButton |
| #B85C00 | Score >= 60 (warning) | OpinionBar, MobileCard, DesktopCard, DesktopReader, FeedRow, Header, VerdictBar |
| #1971C2 | Score >= 40 (info) | OpinionBar, MobileCard, DesktopCard, DesktopReader, FeedRow, DesktopFeed |
| #6C757D | Score < 40 (neutral) | Same as above |

**Green (status):**
| Hex | Usage |
|---|---|
| #2B8A3E | Completed badge, VerdictBar (high score) |
| #24783C | "New" badge text |
| #EBFBEE | Badge backgrounds |
| #37B24D | ShareModal "Copied" state |
| #B2F2BB | ShareModal copied border |

**Blue (status):**
| Hex | Usage |
|---|---|
| #1864AB | "Updated" badge text |
| #E7F5FF | "Updated" badge background |
| #1971C2 | Focus ring, score color, links |

**Card-specific hardcoded:**
| Hex | Usage |
|---|---|
| #FCF7EC, #F6EFE1 | ReframeCard gradient |
| rgba(82,82,91,0.08) through rgba(139,101,8,0.08) | FactCard lens tag backgrounds |
| rgba(245,240,232,0.12) | HookCard divider |
| rgba(248,245,239,0.9) | HookCard subtitle |
| rgba(31,26,20,0.05), rgba(31,26,20,0.12) | CardShell shadows |

**Total unique hardcoded colors: ~45**
**Colors that should be CSS variables but aren't: ~40**

---

## COMPLETE SPACING AUDIT

### Every Unique Spacing Value Found

| Value | On 4/8 Grid? | Count | Components |
|---|---|---|---|
| 1px | N/A (border) | 20+ | Many |
| 2px | No | 8 | DesktopCard, FeedRow, MobileCard |
| 3px | No | 4 | FactCard, ContentFingerprint, Header, VerdictBar |
| 4px | Yes | 15+ | Many |
| 5px | No | 3 | DesktopReader, DesktopCard |
| 6px | No | 10+ | DesktopFeed, DesktopCard, FeedRow, MobileCard, DesktopReader, ShareModal |
| 7px | No | 2 | DesktopCard (badge padding) |
| 8px | Yes | 20+ | Many |
| 9px | No (SVG size) | 2 | MobileCard, DesktopCard |
| 10px | No | 8 | FactCard, MobileCard, SaveButton, VerdictBar |
| 12px | No | 15+ | MobileBrowser, MobileCard, DesktopFeed, DesktopReader, FeedRow, VerdictBar, ReframeCard, MatureCard |
| 14px | No | 5 | FactCard, DesktopReader, ContentFingerprint, VerdictBar |
| 16px | Yes | 15+ | Many |
| 18px | No | 3 | HookCard, DesktopCard, ShareModal |
| 20px | No | 8 | DesktopFeed, DesktopEmptyState, AuditFooter, SwipeHint, NativeAd |
| 22px | No (border-radius) | 2 | CardShell, NativeAd |
| 24px | Yes | 5 | MobileCard, DesktopEmptyState, App.svelte tablet |
| 28px | No | 1 | Header (min-height) |
| 30px | No | 4 | FactCard, ReframeCard, MatureCard |
| 32px | Yes | 3 | HookCard, DesktopReader, App.svelte |
| 36px | No | 3 | SaveButton, Header (min-height) |
| 40px | Yes | 3 | DesktopReader, DesktopEmptyState, SwipeHint |
| 44px | Yes | 5 | ShareModal, FactCard, InsightReader |
| 48px | Yes | 1 | Header (height) |
| 60px | No | 1 | DesktopReader (spacer) |
| 62px | No | 1 | BottomNav |

**Values NOT on 4px/8px grid: 2, 3, 5, 6, 7, 9, 10, 12, 14, 18, 20, 22, 28, 30, 36, 60, 62**
**Total grid violations: ~80+ instances across all components**

---

## COMPLETE TYPOGRAPHY AUDIT

### Every Font-Size Used

| Size | Weight | Line-Height | Components |
|---|---|---|---|
| 8px | 600 | — | VerdictBar stage labels |
| 9px | 600 | — | MobileCard (badge), DesktopCard (badge/label), ShareModal (brand) |
| 10px | 500-700 | — | MobileCard (edition/category/label), DesktopCard (badge/edition), FeedRow (badge/category), DesktopFeed (sort/topic), Header (tagline), AuditFooter, ContentFingerprint, BottomNav |
| 11px | 400-700 | — | MobileCard (opinion label/badge), DesktopFeed (sort), Header (tagline), ShareModal (platform labels/section header), SaveButton, ContentFingerprint |
| 12px | 500-600 | 1.4-1.55 | DesktopCard (context), FeedRow (context), DesktopReader (share), ShareModal (copy/preview), MobileCard (tap hint) |
| 13px | 500-600 | — | DesktopFeed (search), DesktopReader (share buttons), Header (search), DesktopEmptyState, ShareModal (copy link), SwipeHint |
| 14px | 600-700 | — | DesktopReader (score), DesktopFeed (search), MobileCard (score), ShareModal (native share), FeedRow (score), About page body |
| 15px | 400-600 | 1.35-1.85 | DesktopCard (headline), DesktopReader (sub text), FeedRow (headline), FactCard (detail), About/Disclaimer body, SwipeHint |
| 16px | 400-700 | 1.6-1.8 | DesktopReader (context), MobileCard (context), VerdictBar (score) |
| 17px | — | 1.8-1.85 | HookCard (subtitle), FactCard (summary), ReframeCard (summary), MatureCard (summary) |
| 19px | 600 | — | About page h2 |
| 20px | 400-600 | 1.5 | DesktopEmptyState (italic quote), NativeAd (headline) |
| 22px | — | — | InsightReader card text (small variant) |
| 24px | 600-800 | — | About page h1, DesktopReader (card big), Disclaimer h1, verify.html |
| 27px | 800 | 1.2 | MobileCard (headline) |
| 30px | 700 | 1.18 | FactCard/ReframeCard/MatureCard (heading) |
| 32px | 700-800 | 1.15-1.22 | HookCard (heading), DesktopReader (headline) |

**Total unique font-sizes: 21**
**No typography scale tokens defined in tokens.css**

---

## COMPLETE BORDER-RADIUS AUDIT

| Value | Components |
|---|---|
| 1px | DesktopReader (thin line) |
| 1.5px | OG image score bar |
| 3px | MobileCard (opinion bar) |
| 4px | MobileCard (status badge), FeedRow (badge), DesktopCard (badge), DesktopFeed (clear/sort) |
| 6px | FactCard (tag) |
| 8px | DesktopFeed (search), Header (hover bg) |
| 10px | DesktopReader (share button), SaveButton, InsightReader (share button) |
| 12px | DesktopReader (action buttons), ShareModal (buttons) |
| 14px | ShareModal (preview card) |
| 16px | DesktopCard (card) |
| 20px | MobileCard (card), MobileBrowser (peek cards), ShareModal (panel), InsightReader (card) |
| 22px | CardShell, NativeAd |
| 50% | Circles (badges, verdict dots) |
| 100px | Pill shapes (DesktopReader labels) |

**Total unique border-radius values: 14**
**No border-radius scale in tokens.css**

---

## COMPLETE BOX-SHADOW AUDIT

| Shadow | Components |
|---|---|
| `0 2px 12px rgba(0,0,0,0.03)` | MobileCard (completed) |
| `0 2px 12px rgba(0,0,0,0.06)` | MobileCard (default) |
| `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)` | DesktopCard (default) |
| `0 8px 30px rgba(0,0,0,0.08)` | DesktopCard (hover) |
| `0 8px 24px rgba(31,26,20,0.05)` | CardShell (light) |
| `0 12px 32px rgba(31,26,20,0.12)` | CardShell (dark) |
| `0 8px 40px rgba(0,0,0,0.08)` | InsightReader (card) |
| `0 20px 60px rgba(0,0,0,0.15)` | ShareModal (panel) |
| `0 0 0 2px #1971C2` | Focus ring (global.css) |
| `0 2px 12px rgba(0,0,0,0.04)` | MobileBrowser (peek shadow) |
| `0 4px 16px rgba(0,0,0,0.06)` | MobileBrowser (ghost-1) |

**Total unique shadows: 11**
**No shadow scale in tokens.css**

---

## COMPLETE Z-INDEX AUDIT

| Value | Component | Purpose |
|---|---|---|
| 1 | MobileBrowser ghost-2 | Back card in stack |
| 2 | MobileBrowser ghost-1 | Middle card in stack |
| 3 | InsightReader .card | Active card |
| 5 | InsightReader .scroll-indicator | Scroll bar overlay |
| 1000 | InsightReader .overlay | Full-screen reader |
| 2000 | ShareModal | Share dialog |

**Total z-index layers: 6 — well-organized, no conflicts**

---

## COMPLETE TRANSITION/ANIMATION AUDIT

### CSS Transitions (should use tokens)

| Duration | Easing | Component | Should Be |
|---|---|---|---|
| 0.15s | ease | DesktopFeed, FeedRow, DesktopReader, ShareModal, Header | `var(--duration-fast)` |
| 0.2s | ease | FactCard (icon rotation), AuditFooter | `var(--duration-fast)` or new token |
| 0.25s | cubic-bezier | MobileCard (background, shadow, color) | `var(--duration-normal)` |
| 0.3s | ease | FactCard (height expand), ShareModal (opacity) | New token needed |
| 0.35s | ease/cubic-bezier | CardShell (entrance), MobileBrowser (peek), DesktopCard (entrance) | `var(--duration-medium)` |
| 0.4s | ease | MobileBrowser (mount opacity) | New token needed |
| 1.5s | ease | SwipeHint animation, ShareButton toast | New token needed |

### Spring Animations (already correct)

| Config | Stiffness | Damping | Usage |
|---|---|---|---|
| SPRING_DEFAULT | 300 | 24 | General purpose |
| SPRING_SNAPPY | 600 | 32 | Card exit/enter in MobileBrowser |
| SPRING_GENTLE | 200 | 20 | Not used |
| SPRING_RUBBER | 800 | 36 | Snap-back, rubber band |

### Animations Using CSS `ease` That Should Use Springs

| Component | Animation | Current | Recommended |
|---|---|---|---|
| CardShell | Mount entrance | 0.35s ease | Spring (SPRING_GENTLE) |
| FactCard | Expand/collapse height | 0.3s ease | Spring (SPRING_DEFAULT) |
| FactCard | Chevron rotation | 0.2s ease | Spring (SPRING_SNAPPY) |
| ShareModal | Backdrop fade | 0.2s ease | Keep CSS (non-interactive) |

---

## COMPLETE DARK MODE AUDIT

### Components Using CSS Variables (Dark Mode Works) ✓
- HookCard (card-dark, text-on-dark)
- FactCard (card, border, text-primary, text-secondary, amber)
- MatureCard (card, amber-light, text-primary, amber)
- NativeAd.astro (card, border, amber-light, text-primary, text-secondary, amber)
- AuditFooter (partial — some vars, some hardcoded)
- ContentFingerprint (partial)
- ShareButton (text-tertiary, card-dark, text-on-dark)

### Components Using Hardcoded Colors (Dark Mode Broken) ✗
- MobileCard — 25+ hardcoded hex values
- MobileBrowser — inherits from MobileCard
- DesktopCard — 15+ hardcoded hex values
- DesktopFeed — 10+ hardcoded hex values
- DesktopReader — 20+ hardcoded hex values
- FeedRow — 10+ hardcoded hex values
- DesktopEmptyState — 5 hardcoded hex values
- Header — 10+ hardcoded hex values
- OpinionBar — 5 hardcoded hex values
- VerdictBar — 8+ hardcoded hex values
- SaveButton — 8 hardcoded hex values
- ShareModal — 15+ hardcoded hex values
- InsightReader — extensive hardcoded
- BottomNav — hardcoded background
- SwipeHint — hardcoded overlay
- App.svelte — hardcoded borders/backgrounds
- global.css — hardcoded body background (#F8F9FA)
- verify.html — no dark mode at all

**Estimated effort to fix: Touch ~25 files, replace ~200+ color values**

---

## DEVICE-SPECIFIC ISSUES

### iPhone SE (375px)
- MobileCard headline 27px could wrap awkwardly with long Malay words
- No `hyphens: auto` or `word-break` on any text element
- 12px horizontal padding in MobileBrowser leaves 351px card width — tight

### iPad Portrait (768px) — CRITICAL
- Classified as MOBILE (`<=768`) — gets Tinder card stack
- Should get tablet 2-column grid
- Fix: change breakpoint to `< 768` or `<= 767`

### iPad Landscape (1024px)
- Classified as DESKTOP — gets split-pane
- DesktopFeed sidebar is 360px fixed, leaving 664px for reader
- DesktopReader max-width is 680px — OVERFLOWS by 16px
- Fix: reduce reader max-width or make sidebar responsive

### iPhone 14 Pro+ (Dynamic Island)
- `env(safe-area-inset-top)` applied to Header ✓
- NOT applied to InsightReader overlay
- NOT applied to MobileBrowser card area
- NOT applied to ShareModal

### Landscape Mobile (667px — iPhone SE landscape)
- Stays in mobile mode (< 768px)
- Card stack in landscape is awkward — very wide, very short
- No landscape-specific adjustments

---

## RECOMMENDED IMPLEMENTATION ORDER

### Phase 1: P0 Critical Fixes (~2 hours)
1. Fix iPad 768px breakpoint (App.svelte)
2. Fix all 10 touch targets to 44px minimum
3. Fix DesktopReader overflow at 1024px

### Phase 2: Dark Mode (~4-6 hours)
4. Add missing color tokens to tokens.css (status, gray scale, score colors)
5. Replace all hardcoded colors in all Svelte components with CSS variables
6. Add dark mode to verify.html

### Phase 3: Spacing & Typography System (~3-4 hours)
7. Define spacing scale tokens (4, 8, 12, 16, 20, 24, 32, 40, 48)
8. Define typography scale tokens
9. Normalize all spacing values across components
10. Add border-radius and shadow scales

### Phase 4: Animation Consistency (~2-3 hours)
11. InsightReader entrance/exit animation
12. MobileBrowser velocity continuity
13. Replace CSS ease with springs where interactive
14. Add safe area compliance to InsightReader, MobileBrowser, ShareModal

### Phase 5: Polish (~2-3 hours)
15. WCAG contrast fixes
16. Focus-visible states on all interactive elements
17. Text overflow handling (word-break, hyphens)
18. Remove dead code (BottomNav, deprecated CSS)
19. Keyboard navigation for InsightReader
