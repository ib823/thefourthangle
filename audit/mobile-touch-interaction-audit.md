# The Fourth Angle — Frontend Interaction Quality Audit
## Apple-Grade Fluidity Benchmark Assessment

**Audit Date:** 2026-03-27
**Auditor Role:** Senior Frontend QA Lead, Motion Systems Auditor, Browser Performance Analyst, Interaction Design Reviewer
**Target URL:** https://thefourthangle.pages.dev
**Codebase:** Astro 5 + Svelte 5 (Runes), static build on Cloudflare Pages

---

## 1. Executive Summary

### What the App Is
The Fourth Angle is a Malaysian policy analysis platform presenting investigative issues through a card-based reading interface. On mobile it presents a vertical card stack (swipe up/down to browse issues), with a horizontal card reader (swipe left/right through perspectives). On desktop it presents a list/detail split pane with scrollable reader.

### Overall Frontend Quality
**Strong visual design, weak interaction fidelity.** The visual layer — typography, color, spacing, dark mode, badges — is production-grade. The motion layer has serious structural problems that make the mobile experience feel fundamentally wrong to anyone accustomed to native-quality touch interaction.

### Overall Motion Quality
**4/10.** The spring physics engine is well-implemented in isolation. The gesture system architecture is fatally flawed: it fights the browser instead of cooperating with it, resulting in interactions that feel stuck, unresponsive, and broken on mobile touch devices.

### Overall Apple-Grade Closeness
**28%.** The visual restraint and spring math suggest Apple-level aspiration. The actual touch experience is closer to a 2014 PhoneGap app than a 2026 native-feeling web app.

### Major Strengths
- Well-architected spring physics engine with proper damping models
- Clean design tokens and CSS custom properties
- Reduced motion support throughout
- Accessibility: ARIA roles, screen reader announcements, keyboard navigation
- Animation tier detection for low-end devices
- Dark mode with full token coverage
- Performance-aware: content-visibility, virtual scrolling in desktop feed, will-change on correct elements

### Major Weaknesses
- **BLOCKER:** `touch-action: none` on primary mobile containers destroys all native touch behavior
- **BLOCKER:** Pointer capture before gesture classification creates a 10px dead zone where nothing responds
- **HIGH:** Ambiguous gestures (30°–60° diagonal) are silently dropped or treated as card drags, not scroll
- **HIGH:** Vertical gestures in InsightReader are repurposed as dismiss-overlay, not scroll
- **HIGH:** No inertial/momentum behavior on card swipes — cards snap or spring but don't coast
- **HIGH:** The entire mobile feed is a custom swipe surface with zero native scroll
- **MEDIUM:** Share modal touch-dismiss calls `preventDefault()` in `touchmove`, preventing native scroll inside the panel

---

## 2. Environment and Test Coverage

### Tested URL
https://thefourthangle.pages.dev

### Browsers Used
- Source-code analysis (primary method — complete codebase access)
- WebFetch of deployed site (rendered HTML structure inspection)
- No live browser DevTools session available (limitation)

### Device/Viewport Matrix
Analysis covers all 32 specified viewports through code path analysis of the viewport breakpoint system:
- **Mobile (< 768px):** `viewMode = 'mobile'` → MobileBrowser + InsightReader
- **Tablet (768–1023px):** `viewMode = 'tablet'` → Grid of DesktopCards + InsightReader
- **Desktop (≥ 1024px):** `viewMode = 'desktop'` → DesktopFeed sidebar + DesktopReader

### Orientations Tested
- Portrait and landscape behavior inferred from responsive breakpoints
- No orientation-specific CSS or JS detected — viewport width is the only discriminator

### Input Modes Analyzed
- Touch (pointer events, touch events)
- Mouse (click, hover, mouseenter/mouseleave)
- Keyboard (full keyboard navigation)
- Reduced motion (media query detection + class-based overrides)
- Dark/light mode (prefers-color-scheme with full token remapping)

### Capabilities Unavailable
- **No live browser DevTools** — cannot run Lighthouse, Performance panel, paint flashing, layer inspection
- **No real device testing** — cannot confirm actual iOS Safari/Chrome Android behavior
- **No frame rate measurement** — jank assessment is inference-based from code patterns
- **No multi-browser testing** — cannot confirm Firefox/Safari-specific behaviors
- **Confidence: HIGH for code-level findings, MEDIUM for runtime behavior inferences**

---

## 3. Interaction Benchmark Against Apple-Grade Principles

### A. Direct Manipulation

**Definition:** Content appears attached to the user's input with zero perceptible lag between gesture and visual response.

**What Was Observed:**
- MobileBrowser: Container has `touch-action: none` (line 344). All pointer events go through JS on the main thread. Pointer is captured immediately on `pointerdown` via `setPointerCapture()` (line 149). After capture, there is a 10px dead zone (`GESTURE_SLOP = 10`) before any visual response occurs (line 183).
- InsightReader: Same pattern. 3px dead zone for initial classification, then up to 15px for ambiguous re-classification (lines 492, 501).
- Card transforms are applied directly to DOM elements via `style.transform` (not reactive state), which is the correct approach for drag performance.

**Where App Succeeds:**
- Transform application during drag is direct DOM manipulation, avoiding Svelte reactivity overhead
- `backface-visibility: hidden` and `will-change: transform` promote elements to compositor layers correctly

**Where App Fails:**
- **10px of zero response** before anything moves. On a 390×844 phone, 10px is ~2.5% of the viewport width and clearly perceptible. Apple's threshold is typically 3–5px.
- **Pointer capture before gesture classification** means the browser's scroll engine never sees the touch start, so native scroll cannot take over even when the gesture is classified as vertical.
- Users will feel the card is "stuck" for the first finger movement, then it jumps to catch up.

**Severity:** BLOCKER

---

### B. Momentum / Inertia

**Definition:** When released, movement continues with believable momentum proportional to the gesture velocity.

**What Was Observed:**
- MobileBrowser: On release, either `commitSwipe()` or `snapBack()` is called. `commitSwipe()` uses spring physics with initial velocity. `snapBack()` uses `SPRING_SNAPPY` (stiffness=600, damping=32). There is no coast/glide phase — the card either commits to the next position or springs back.
- InsightReader: Same pattern. `goTo()` uses a spring with stiffness=600, damping=38 for exit, then stiffness=500, damping=26 for enter. Exit velocity is passed as `initialVelocity` to the spring, which is correct.

**Where App Succeeds:**
- Spring physics incorporate initial velocity, so faster swipes produce faster animations
- Exit duration is proportional to remaining distance: `Math.max(180, Math.min(350, remaining / width * 350))`

**Where App Fails:**
- **No coasting phase.** In Apple's card stack (e.g., Wallet app), a fast flick causes the card to slide out with decreasing velocity, not spring to a fixed position. The spring-only approach feels mechanical rather than physical.
- **The feed has zero momentum.** MobileBrowser is a custom swipe-to-change-card interface with no scroll momentum at all. You swipe, the card changes or snaps back. There is no continuous scrollable feed. This is a fundamental design choice, not a bug, but it means the feed feels nothing like native scroll.

**Severity:** HIGH

---

### C. Interruptibility

**Definition:** Ongoing motion can be stopped or redirected cleanly by fresh input.

**What Was Observed:**
- MobileBrowser: `animating` flag blocks new `pointerdown` events (line 144). During spring animation, if the user touches, nothing happens until animation completes.
- InsightReader: Same — `animating` blocks pointer events (line 451).
- However, `cancelSpring` / `cancelAnimation` functions exist and are called at the start of new drags... but only if `animating` is false, which it won't be because the guard blocks the event handler before reaching the cancellation code.

**Where App Succeeds:**
- Cancel functions exist architecturally
- Spring state tracks velocity, so in theory a mid-animation interrupt could preserve momentum

**Where App Fails:**
- **Animations are NOT interruptible in practice.** The `if (animating) return;` guard at the top of `onPointerDown` means the user cannot grab a card mid-flight. This is a critical failure for Apple-grade interaction. In iOS, you can always grab a card mid-transition.
- **Typical animation durations:** 180–350ms for exit + ~200ms for enter = ~400–550ms of total non-interruptible time. Half a second of unresponsiveness after every swipe.

**Severity:** HIGH

---

### D. Physical Coherence

**Definition:** Swipe, dismiss, settle, and snap behaviors feel like one unified physical system.

**What Was Observed:**
- Four different spring configs: DEFAULT (400/28), SNAPPY (600/32), GENTLE (200/22), RUBBER (800/36)
- InsightReader uses custom configs: exit (600/38), enter (500/26), rubber-band (324/36), snap-back (SNAPPY)
- MobileBrowser uses SNAPPY for snap-back, custom for commit
- ShareModal uses CSS transitions (200ms/300ms ease), not springs
- Velocity threshold is 500px/s across all surfaces
- Distance threshold is 15% across all surfaces

**Where App Succeeds:**
- Consistent velocity/distance thresholds
- Spring parameters are in a reasonable physical range
- Rubber-band uses Apple's actual constant (0.55)

**Where App Fails:**
- **ShareModal uses CSS transitions while everything else uses spring physics.** The dismiss animation (200ms ease) feels categorically different from card springs.
- **Three different damping values for similar operations** (28, 32, 36, 38) create subtle inconsistency. Apple uses 1–2 spring configs for an entire app.
- **Enter spring has damping=26 (underdamped)** causing visible overshoot on card entry. This is intentional for "life" but inconsistent with the snappy exit.

**Severity:** MEDIUM

---

### E. Spatial Continuity

**Definition:** Transitions preserve context and spatial understanding.

**What Was Observed:**
- MobileBrowser: Cards stack vertically with peek cards behind (scale 0.95/0.90, translateY 12/24px). Swiping up reveals the next card from behind — spatial metaphor is clear.
- InsightReader: Opens as a full-screen overlay with `overlayEnter` animation (translateY 24px → 0, opacity 0 → 1). Cards swipe horizontally. Closing is either button or vertical drag dismiss.
- Desktop: Feed → Reader transition uses opacity crossfade (150ms).
- Route transitions: Astro View Transitions API with crossfade (150ms).

**Where App Succeeds:**
- Card stack peek metaphor on mobile is spatially clear
- Progress bar and dot navigation maintain position awareness in reader
- Ghost cards in InsightReader interpolate during drag (scale/translate), reinforcing the stack

**Where App Fails:**
- **Mobile feed-to-reader transition has no spatial connection.** Tapping a card in MobileBrowser opens InsightReader as a fixed overlay sliding up from below. There's no shared-element transition or expansion from the card's position. Context is broken.
- **Closing the reader drops you back to the same card position, which is good,** but the animation (translateY up) doesn't suggest "returning to the stack."
- **Desktop has no transition at all between articles** — just opacity flash.

**Severity:** MEDIUM

---

### F. Native-Like Browser Behavior

**Definition:** Scrolling feels browser-native where it should. Gestures don't fight the browser.

**What Was Observed:**
This is the catastrophic failure area.

**Mobile Feed (MobileBrowser):**
- `touch-action: none` on container (line 344)
- `setPointerCapture()` on every touch (line 149)
- Vertical gestures: after 10px slop + classification, if vertical, calls `cancelDrag()` which releases pointer capture
- But by then the browser's scroll gesture recognizer has lost its chance. The browser needs to see the initial `touchstart` in a `touch-action: auto/pan-y` context to begin native scrolling.
- **Result: The mobile feed CANNOT scroll natively. Period. It is a custom swipe-between-discrete-cards interface.** There is no "slide down when holding finger" because the UI doesn't scroll — it transitions between cards.

**InsightReader:**
- `.overlay` has `touch-action: none` (line 932)
- `.card-area` has `touch-action: none` (line 1016)
- `.active-card` has `touch-action: none` (line 1066)
- `.card-center` (content area inside the card) has `touch-action: pan-y` (line 1112) and `overflow-y: auto` (line 1109)
- The content area SHOULD scroll natively, but the pointer events on the parent card element capture before the touch reaches the content area
- `shouldBlockSwipe()` (scroll-physics.ts line 94) attempts to prevent swipe initiation during mid-scroll, but only checks at `pointerdown` time — doesn't prevent capture

**ShareModal:**
- `ontouchmove` handler calls `e.preventDefault()` when dragging (line 209)
- Panel has `overflow-y: auto` but `max-height: 90vh`
- The `preventDefault` in touchmove blocks native scroll within the panel during drag-to-dismiss

**Global:**
- `html { overscroll-behavior: none }` kills iOS rubber-band at page edges
- `body { touch-action: manipulation }` is correct (preserves tap/zoom)
- `body { overscroll-behavior: none }` prevents scroll chaining

**Where App Succeeds:**
- `touch-action: pan-y` on `.card-center` is the right intent
- `overscroll-behavior-y: contain` correctly isolates card content scroll
- `shouldBlockSwipe()` attempts gesture coordination

**Where App Fails:**
- **The mobile feed has NO native scroll at all.** This is the primary user complaint. Users expect to scroll a feed; they get discrete card transitions.
- **`touch-action: none` at the container level overrides `touch-action: pan-y` on children.** CSS `touch-action` is inherited through the containment chain. A child with `pan-y` inside a parent with `none` will NOT get native pan behavior in most browsers.
- **Pointer capture on the card element intercepts touches that should reach the scrollable content area.** Even though `shouldBlockSwipe()` exists, it only gates swipe initiation — it doesn't prevent the pointer capture that steals the touch from the browser.
- **The entire interaction model fights the browser's touch handling.** It captures every touch, classifies in JS, then tries to "hand back" to the browser for scrolling. Browsers don't work this way — once JS captures a pointer, native scroll is dead for that gesture.

**Severity:** BLOCKER

---

### G. Performance Quality

**Definition:** No visible jank, hitching, dropped frames, or long-task behavior.

**What Was Observed (code-level inference):**
- Drag transforms use direct DOM manipulation (`el.style.transform = ...`) — correct, avoids reactivity overhead
- `will-change: transform` on all moving elements — promotes to compositor layers
- `backface-visibility: hidden` prevents unnecessary repainting of back faces
- `content-visibility: auto` on off-screen cards with `contain-intrinsic-size` — correct
- Desktop feed uses virtual scrolling with `ITEM_HEIGHT = 132` and `BUFFER = 8`
- Animation tier detection adjusts effects for low-end devices
- Spring physics use `requestAnimationFrame` with dt capped at 64ms for stability
- `getCardWidth()` caches `offsetWidth` per drag session to avoid layout thrashing

**Where App Succeeds:**
- Strong awareness of compositor-friendly animations (transform + opacity only during drag)
- Virtual scrolling on desktop prevents DOM bloat
- Animation tier system degrades gracefully
- No `top`/`left`/`width`/`height` animations during drag

**Where App Fails:**
- **`backdrop-filter: blur(20px)` on InsightReader overlay** is expensive and runs on every frame during overlay transforms. On mid-range phones this will cause frame drops during drag-to-dismiss.
- **`filter: brightness()` on peek cards** during drag (MobileBrowser line 356) triggers repaint, not just composite. This should use opacity instead.
- **InsightReader applies `style.opacity` during exit animation** (line 262), which is fine, but combined with backdrop-filter on the parent, forces recomposition of the blur on every frame.
- **`interpolateDots()` queries `dotsContainerEl.querySelectorAll('.dot')` on every pointer move event.** This creates a new NodeList per frame. Should cache dot references.
- **No `passive: true` on pointer event handlers.** Pointer events are non-cancelable by default in most cases, but the pattern is worth noting.

**Confidence:** MEDIUM (code-level inference, no runtime profiling)

**Severity:** MEDIUM (backdrop-filter), LOW (other items)

---

### H. Restraint

**Definition:** Motion is purposeful rather than decorative.

**What Was Observed:**
- Entry animations: Cards fade+slide in with IntersectionObserver (DesktopCard, MobileCard)
- Score bar fills animate with countUp and tween
- Opinion dots scale in with stagger
- Swipe hint has a looping nudge animation
- Check circle on completion bounces in
- Share buttons stagger in on modal open

**Where App Succeeds:**
- No gratuitous parallax, particle effects, or page-level animation
- Entry animations are staggered and brief
- Haptic feedback is used sparingly (5ms) at meaningful moments
- Animation tier system disables effects on low-end devices

**Where App Fails:**
- **Swipe hint nudge animation loops infinitely** (`animation: nudgeHint 1.5s ease-in-out infinite`). This is visually noisy, especially for users who already know how to swipe.
- **Card entry animations (scale in, count up, dot scale)** run on every card even after the user has seen dozens. Should decay or skip after N views.
- **3D rotateY on card drag** (InsightReader line 175: `rotateY = dx * 0.015`) is decorative and adds no functional information. It also triggers 3D composition for minimal visual gain.

**Severity:** LOW

---

### I. Accessibility

**Definition:** Reduced motion respected, keyboard usable, focus states visible, gesture-only actions have alternatives.

**What Was Observed:**
- `prefers-reduced-motion` detection in MobileBrowser, InsightReader, MobileCard, DesktopCard, and OpinionBar
- Reduced motion: all animations skip or use instant transitions
- `.reduced-motion` class disables CSS animations in InsightReader
- Global CSS: `@media (prefers-reduced-motion: reduce)` sets all durations to 0.01ms
- Keyboard: Full navigation (↑↓ browse, Enter open, ←→ navigate cards, Escape close, Tab focus trap in modals)
- ARIA: `role="dialog"`, `aria-modal="true"`, `aria-label` on reader, `aria-live="polite"` for card transition announcements
- Focus: `:focus-visible` with 2px ring, `tabindex` on interactive elements
- Touch targets: 44px minimum (`--tap-min: 44px`) on buttons, dots, close button
- Skip link: `<a href="#main-content" class="sr-only">` in Base.astro

**Where App Succeeds:**
- Comprehensive reduced-motion support throughout
- Screen reader announcements for card transitions
- Keyboard navigation covers all flows
- Touch target sizes meet WCAG 2.5.8
- Focus management: focus trapped in modals, restored to origin on close

**Where App Fails:**
- **Dot navigation buttons have visual size 6×4px** (content area), relying on 20px padding for touch target. The visual target is too small for discoverability even though the touch target is correct.
- **No skip-to-content for card reader** — keyboard user must Tab through all dots to reach content
- **Card swipe has no non-gesture alternative on mobile.** Dots exist but are easy to miss. No explicit "Next" / "Previous" buttons visible.

**Severity:** MEDIUM (dot visibility), LOW (others)

---

## 4. Page and Component Audit

### 4.1 Mobile Feed (MobileBrowser.svelte)

**Viewports:** All <768px (phone portrait/landscape)
**Actions Tested (code path analysis):** Touch card, swipe up/down, keyboard nav, press state, card transition

**Expected Behavior:** A scrollable feed of cards that the user can browse by swiping up/down, similar to iOS Wallet or a social media feed.

**Actual Behavior:** A discrete card stack where swiping up shows the next card and swiping down shows the previous. There is no scrollable list — only one card is visible at a time (plus two peek cards behind). The entire container has `touch-action: none`, so the browser's native scroll engine is completely disabled.

**Findings:**

| ID | Severity | Finding |
|----|----------|---------|
| F-01 | BLOCKER | `touch-action: none` on container kills all native touch scrolling |
| F-02 | BLOCKER | `setPointerCapture()` called before gesture classification — browser scroll cannot take over |
| F-03 | HIGH | 10px dead zone before any visual response (GESTURE_SLOP = 10) |
| F-04 | HIGH | Ambiguous gestures (30°–60°) continue as card drag instead of releasing to browser |
| F-05 | HIGH | No momentum/coast on card transitions — spring-only commit or snap-back |
| F-06 | HIGH | Animation is not interruptible — `if (animating) return` blocks all input during transition |
| F-07 | MEDIUM | `filter: brightness()` on peek cards during drag causes repaint, not composite-only |
| F-08 | LOW | Card entry opacity transition (0.4s) delays first meaningful paint on mount |

---

### 4.2 Insight Reader (InsightReader.svelte)

**Viewports:** All <1024px (phone + tablet, both orientations)
**Actions Tested:** Horizontal card swipe, vertical dismiss, content scroll, dot navigation, share, keyboard

**Expected Behavior:** A full-screen reader where cards swipe horizontally between perspectives. Card content should be natively scrollable when it overflows. Vertical drag should dismiss the overlay.

**Actual Behavior:** Horizontal swipe works but with a 3–15px dead zone during gesture disambiguation. Vertical drag triggers overlay dismiss (not scroll). Card content area has `touch-action: pan-y` but is nested inside `touch-action: none` containers, making native scroll unreliable. Content scrollability depends on `shouldBlockSwipe()` being true at exactly the right moment.

**Findings:**

| ID | Severity | Finding |
|----|----------|---------|
| R-01 | BLOCKER | Nested `touch-action` conflict: `.overlay` and `.card-area` have `none`, child `.card-center` has `pan-y` — browser may not honor the child value |
| R-02 | HIGH | Vertical gesture = dismiss overlay, not scroll content. Users who want to scroll long card text will accidentally dismiss. |
| R-03 | HIGH | Pointer capture on `.active-card` intercepts touches meant for `.card-center` scroll |
| R-04 | HIGH | Ambiguous gestures (15px threshold) are silently cancelled — user drags diagonally and nothing happens |
| R-05 | HIGH | Exit + enter animation = ~400–550ms of non-interruptible time |
| R-06 | MEDIUM | `backdrop-filter: blur(20px)` on overlay is expensive during drag-to-dismiss transforms |
| R-07 | MEDIUM | `querySelectorAll('.dot')` called on every pointermove during drag — creates new NodeList per frame |
| R-08 | MEDIUM | 3D `rotateY` effect on drag is decorative and forces 3D composition for minimal benefit |
| R-09 | LOW | Completion bounce animation (`bounceIn`) could feel cheap on low-end devices |

---

### 4.3 Share Modal (ShareModal.svelte)

**Viewports:** All (bottom sheet on mobile, centered modal on desktop)
**Actions Tested:** Open, backdrop close, button close, drag-to-dismiss, copy link, platform share

**Expected Behavior:** Bottom sheet that can be dragged down to dismiss. Content should be scrollable if it overflows.

**Actual Behavior:** Bottom sheet slides up (300ms cubic-bezier). Drag-to-dismiss works via `ontouchmove` with velocity detection. However, `preventDefault()` in the `touchmove` handler (line 209) blocks native scroll within the panel. Dismiss thresholds are 100px distance or 500px/s velocity.

**Findings:**

| ID | Severity | Finding |
|----|----------|---------|
| S-01 | MEDIUM | `e.preventDefault()` in touchmove blocks native scroll in the share panel during any downward movement |
| S-02 | MEDIUM | Uses CSS transition (300ms ease) while all other surfaces use spring physics — feels disconnected |
| S-03 | LOW | No spring physics on drag-to-dismiss — snaps closed with CSS transition instead of physical settle |
| S-04 | LOW | Stagger animation on share buttons (120ms per button) adds perceptible delay to interactability |

---

### 4.4 Desktop Feed (DesktopFeed.svelte)

**Viewports:** ≥1024px
**Actions Tested:** Scroll, keyboard navigation, search, sort, hover

**Expected Behavior:** Scrollable sidebar with issue list, responsive to mouse wheel and keyboard.

**Actual Behavior:** Native scroll with `overflow-y: auto` and `overscroll-behavior: contain`. Virtual scrolling for performance. Roving tabindex for keyboard. Hover effects on rows.

**Findings:**

| ID | Severity | Finding |
|----|----------|---------|
| D-01 | LOW | Hover state uses inline style manipulation in `onfocusin`/`onfocusout` instead of CSS pseudo-class — potential jank if browser doesn't batch |
| D-02 | NICE | Virtual scrolling with 132px item height is well-tuned |

---

### 4.5 Desktop Reader (DesktopReader.svelte)

**Viewports:** ≥1024px
**Actions Tested:** Scroll, article switch, share

**Expected Behavior:** Scrollable article pane with native browser scroll.

**Actual Behavior:** Native `overflow-y: auto` scroll. Article switch uses opacity crossfade (150ms). IntersectionObserver marks completion at scroll bottom.

**Findings:**

| ID | Severity | Finding |
|----|----------|---------|
| DR-01 | MEDIUM | Article switch is opacity-only crossfade (150ms) with no spatial transition. Feels like a flash, not a navigation. |
| DR-02 | LOW | `contentOpacity` reactive state causes Svelte re-render for each opacity change — should use direct DOM manipulation or CSS transition on the element |

---

### 4.6 Desktop Card (DesktopCard.svelte)

**Viewports:** ≥768px
**Actions Tested:** Hover, click, entry animation

**Expected Behavior:** Card appears with entry animation, responds to hover with subtle lift.

**Actual Behavior:** IntersectionObserver triggers staggered fade+slide entry. Hover applies `translateY(-3px) scale(1.006)` with shadow change. Good transform-based animation.

**Findings:**

| ID | Severity | Finding |
|----|----------|---------|
| DC-01 | NICE | Transform-based hover animation is compositor-friendly and smooth |
| DC-02 | LOW | Stagger entry animation on every page visit — could be skipped for return visits |

---

### 4.7 Mobile Card (MobileCard.svelte)

**Viewports:** <768px
**Actions Tested:** Tap, entry animations

**Expected Behavior:** Card inside the stack, tappable to open reader.

**Actual Behavior:** Entry animations include countUp (score), tween (bar fill), stagger (dots), and scale (badge). `touch-action: manipulation` is correct. IntersectionObserver-based animation.

**Findings:**

| ID | Severity | Finding |
|----|----------|---------|
| MC-01 | LOW | `touch-action: manipulation` on card is correct, but parent MobileBrowser's `touch-action: none` overrides it |
| MC-02 | LOW | Entry animation runs every time the card enters viewport (e.g., swiping back to a card) |

---

### 4.8 Header (Header.svelte)

**Viewports:** All
**Actions Tested:** Search toggle, progress bar

**Expected Behavior:** Sticky header with search and read progress.

**Actual Behavior:** `position: sticky` with `backdrop-filter: blur(12px)`. Read progress segments at bottom.

**Findings:**

| ID | Severity | Finding |
|----|----------|---------|
| H-01 | LOW | `backdrop-filter: blur(12px)` on sticky header may cause scroll jank on low-end devices during MobileBrowser use |

---

## 5. Device-Class and Orientation Findings

### Phone Portrait (320–430 × 568–932)
- **Critical:** The mobile feed is the ONLY view on phones. `touch-action: none` means zero native scrolling.
- **Critical:** InsightReader overlay consumes full viewport. Content scroll inside cards is unreliable due to nested `touch-action` conflict.
- All 8 phone portrait viewports hit the same code path (`viewMode = 'mobile'`).
- Small screens (320×568) will have minimal peek card visibility behind the active card.
- Large phones (430×932) will have more dead space inside cards since max-width is 440px.

### Phone Landscape (568–932 × 320–430)
- Same `mobile` view mode. Cards will be very short (320–430px viewport height minus header).
- InsightReader cards may overflow significantly in landscape, making the `touch-action` conflict worse as more content needs scrolling.
- No landscape-specific layout adjustments detected.

### Small Tablet Portrait (768–810 × 1024–1280)
- `viewMode = 'tablet'`: Uses 2-column grid of DesktopCards + InsightReader on tap.
- Native page scroll (no `touch-action: none` on the grid container). This is correct.
- InsightReader overlay still has `touch-action: none` problems.

### Small Tablet Landscape (1024–1280 × 768–810)
- `viewMode = 'desktop'` (≥1024px): DesktopFeed sidebar + DesktopReader.
- Native scroll in both panes. No touch-action issues.
- 1024×768 will feel cramped with 360px sidebar + 664px reader.

### Large Tablet Portrait (820–1024 × 1112–1366)
- 820–1023px: `tablet` mode. 1024px: `desktop` mode.
- The 1024×1366 viewport (iPad Pro 12.9") switches to desktop mode in portrait, which may feel inappropriate for a vertical tablet.

### Large Tablet Landscape (1112–1366 × 820–1024)
- All ≥1024px wide → `desktop` mode. Good.

### Small Laptop / Desktop (1280–1536 × 720–864)
- `desktop` mode. Native scroll. No interaction issues.

### Standard Desktop (1600–2560 × 900–1440)
- `desktop` mode. Max-width 640px on reader keeps content readable.

### Ultrawide (3440 × 1440)
- `desktop` mode. DesktopFeed is fixed at 360px, reader is flex:1.
- Reader max-width 640px means massive whitespace on ultrawide. No layout issue, but wasted space.

---

## 6. Motion and Scroll Findings

### 6.1 Scrolling

| ID | Finding | Severity |
|----|---------|----------|
| SCR-01 | Mobile feed has NO native scroll — it's a discrete card switcher with `touch-action: none` | BLOCKER |
| SCR-02 | InsightReader card content (`card-center`) intends native scroll (`touch-action: pan-y`, `overflow-y: auto`) but is nested inside `touch-action: none` parents, making browser behavior unpredictable | BLOCKER |
| SCR-03 | Desktop feed uses native `overflow-y: auto` with virtual scrolling — correct | PASS |
| SCR-04 | Desktop reader uses native `overflow-y: auto` — correct | PASS |
| SCR-05 | `overscroll-behavior: none` on html/body prevents all rubber-banding at page level | LOW |
| SCR-06 | `overscroll-behavior-y: contain` on card-center correctly isolates card scroll | PASS |
| SCR-07 | ShareModal panel has `overflow-y: auto` but `preventDefault()` in touchmove handler fights it | MEDIUM |

### 6.2 Swiping / Drag

| ID | Finding | Severity |
|----|---------|----------|
| SWP-01 | 10px gesture slop in MobileBrowser before any visual response | HIGH |
| SWP-02 | 3px dead zone + up to 15px ambiguity resolution in InsightReader | HIGH |
| SWP-03 | Ambiguous gestures (30°–60° angle) are dropped in InsightReader after double-classification | HIGH |
| SWP-04 | MobileBrowser treats ambiguous gestures as card drag (not released to browser) | HIGH |
| SWP-05 | Rubber-band at edges uses Apple's constant (0.55) — correct feel | PASS |
| SWP-06 | Commit threshold: 500px/s velocity OR 15% distance — reasonable | PASS |
| SWP-07 | Haptic feedback at commit threshold — good | PASS |
| SWP-08 | Multi-touch cancellation correctly aborts drag | PASS |

### 6.3 Dismiss

| ID | Finding | Severity |
|----|---------|----------|
| DIS-01 | InsightReader vertical dismiss: dy > 200px OR vy > 500px/s — reasonable thresholds | PASS |
| DIS-02 | Vertical gesture classification means ANY downward movement in reader = dismiss attempt, not scroll | HIGH |
| DIS-03 | ShareModal drag-to-dismiss: 100px OR 500px/s — lower threshold risks accidental dismiss | MEDIUM |
| DIS-04 | ShareModal dismiss uses CSS transition, not spring — inconsistent with card physics | LOW |

### 6.4 Route Transitions

| ID | Finding | Severity |
|----|---------|----------|
| RT-01 | Astro View Transitions API provides crossfade between pages — good progressive enhancement | PASS |
| RT-02 | Desktop article switch: 150ms opacity fade only — feels like a flash, not a transition | MEDIUM |
| RT-03 | Mobile feed→reader: overlay slides up from 24px below with 300ms animation — no shared element | MEDIUM |
| RT-04 | Browser back button support via popstate — correct | PASS |
| RT-05 | History push on reader open — correct | PASS |

### 6.5 Snap Behavior

| ID | Finding | Severity |
|----|---------|----------|
| SNP-01 | MobileBrowser: cards snap to discrete positions (previous/current/next) — clear and predictable | PASS |
| SNP-02 | InsightReader: same discrete snap behavior | PASS |
| SNP-03 | No CSS `scroll-snap` used anywhere — all snapping is custom JS. On mobile feed this is necessary (not a scroll container), but card-center content could benefit from it. | NICE-TO-HAVE |

### 6.6 Interruptions

| ID | Finding | Severity |
|----|---------|----------|
| INT-01 | Card transitions are non-interruptible (400–550ms blocking window) | HIGH |
| INT-02 | ShareModal close animation (200ms) blocks interaction during close | LOW |
| INT-03 | Spring animations have cancel functions but they're unreachable due to `animating` guard | HIGH |

---

## 7. Performance and Rendering Findings

| ID | Finding | Evidence | Confidence | Severity |
|----|---------|----------|------------|----------|
| P-01 | `backdrop-filter: blur(20px)` on InsightReader overlay causes compositor overhead during drag transforms | Code: overlay has `will-change: transform, opacity` + `backdrop-filter: blur(20px)`. During vertical dismiss, `overlayEl.style.transform` and `overlayEl.style.opacity` are modified per frame, forcing blur recomputation. | HIGH | MEDIUM |
| P-02 | `filter: brightness()` on peek cards is paint-triggering | Code: MobileBrowser peek cards have inline `filter:brightness(0.92)` and `filter:brightness(0.96)`. During drag, the active card's peers have filter applied. `filter` triggers paint, not just composite. | HIGH | MEDIUM |
| P-03 | `querySelectorAll('.dot')` per pointermove event | Code: `interpolateDots()` at InsightReader line 201. Creates new NodeList on every pointer move. At 60fps with touch, this is 60 querySelectorAll calls/second. | HIGH | LOW |
| P-04 | `getCardWidth()` reads `offsetWidth` (layout query) once per drag session | Code: InsightReader line 144. Cached per session — correct pattern. | HIGH | PASS |
| P-05 | All drag transforms are transform-only (translateX/Y, rotate, scale) | Code analysis across all components | HIGH | PASS |
| P-06 | `content-visibility: auto` on off-screen cards | Code: MobileBrowser ghost cards | HIGH | PASS |
| P-07 | Spring physics cap dt at 64ms | Code: spring.ts — prevents explosion on slow frames | HIGH | PASS |
| P-08 | No `requestAnimationFrame` batching — each spring runs its own rAF loop | Code: animateSpring creates independent rAF per spring. Exit and enter springs run sequentially (enter starts in exit's callback), so no overlap. But if multiple springs ran concurrently, they'd each have their own rAF. | MEDIUM | LOW |

---

## 8. Accessibility and Reduced-Motion Findings

### What Works
- **Reduced motion detection:** `prefers-reduced-motion` is checked in MobileBrowser, InsightReader, MobileCard, DesktopCard, OpinionBar
- **Reduced motion behavior:** All CSS animations disabled via `.reduced-motion` class and `@media` query. Spring animations skip to final state. Entry animations skip. Completion bounce skipped.
- **Keyboard navigation:**
  - Desktop: ↑↓/j/k browse feed, Enter open, Escape close, Ctrl+K search, Tab through elements
  - Mobile: ←→ navigate cards, Escape close reader
  - Modal: Tab trapped, Escape closes
- **Screen reader:** `aria-live="polite"` announcements on card transitions. `role="dialog"` on reader. `aria-label` on major elements.
- **Focus management:** Focus trapped in modals. Focus restored to trigger element on close. Skip link in layout.
- **Touch targets:** 44px minimum on buttons and dot navigation (via padding)

### What Fails

| ID | Finding | Severity |
|----|---------|----------|
| A-01 | Dot navigation buttons are visually 6×4px content area — nearly invisible as interactive elements. Touch target (44px via padding) is correct but discoverability is poor. | MEDIUM |
| A-02 | No explicit "Next card" / "Previous card" buttons in InsightReader mobile — gesture-only with dot backup | MEDIUM |
| A-03 | `color` contrast on tertiary text (`#6C757D` on `#FFFFFF`) is 4.6:1 — passes AA for normal text but fails AA for small text (12px) | MEDIUM |
| A-04 | Swipe hint text "Swipe to continue" is gesture-only instruction — should also mention tapping dots or using arrow keys | LOW |
| A-05 | InsightReader vertical dismiss has no button alternative — only gesture-based. Close button exists but dismiss-by-drag has no equivalent for keyboard/switch users. | LOW (close button covers it) |

---

## 9. Findings Table

| ID | Severity | Area | Component | Browser | Viewport | Reproduction Steps | Expected | Actual | Likely Cause | Recommended Fix |
|----|----------|------|-----------|---------|----------|-------------------|----------|--------|-------------|-----------------|
| F-01 | BLOCKER | Touch/Scroll | MobileBrowser | All mobile | <768px | Touch and drag up/down on feed | Native scroll or smooth card transition | Nothing moves for 10px, then card drags manually | `touch-action: none` on container | Remove `touch-action: none`; use gesture disambiguation that cooperates with browser scroll |
| F-02 | BLOCKER | Touch/Scroll | MobileBrowser | All mobile | <768px | Touch anywhere on card area | Browser should have option to handle scroll | Pointer captured immediately, browser scroll disabled | `setPointerCapture()` before classification | Delay pointer capture until gesture is classified as horizontal/card-swipe |
| R-01 | BLOCKER | Touch/Scroll | InsightReader | All mobile | <1024px | Try to scroll long card content | Content scrolls natively | Touch captured by parent, scroll blocked | `touch-action: none` on overlay/card-area overrides child's `pan-y` | Remove `touch-action: none` from overlay; use `touch-action: pan-y` on card-area; only apply `touch-action: none` during active horizontal drag via JS |
| F-03 | HIGH | Gesture | MobileBrowser | All mobile | <768px | Touch and move slowly | Immediate visual response | 10px dead zone before movement | `GESTURE_SLOP = 10` | Reduce to 4–5px |
| F-04 | HIGH | Gesture | MobileBrowser | All mobile | <768px | Swipe at 45° angle | Release to browser for scroll | Treated as card drag (ambiguous → horizontal fallthrough) | `classifyGesture` returns 'ambiguous' and code continues as horizontal | Treat ambiguous as vertical (default to scroll) |
| R-02 | HIGH | Gesture | InsightReader | All mobile | <1024px | Swipe down on reader | Scroll card content or explicit dismiss action | Overlay begins dismiss animation | Vertical gesture = dismiss, always | Only allow dismiss from specific drag handle zone, not entire card area |
| R-03 | HIGH | Gesture | InsightReader | All mobile | <1024px | Touch scrollable content area | Native scroll | Pointer captured by card element | `setPointerCapture()` on card, before touch reaches content | Don't capture pointer if touch target is inside `.card-center` |
| R-04 | HIGH | Gesture | InsightReader | All mobile | <1024px | Swipe at 45° angle | Some response | Nothing — ambiguous classification cancelled after 15px | Double classify + cancel on persistent ambiguity | Default ambiguous to vertical (scroll/dismiss) after timeout |
| F-05 | HIGH | Motion | MobileBrowser | All | <768px | Fast flick up on card | Card coasts with momentum | Card springs to next position (no coast) | Spring-only commit, no deceleration phase | Add momentum coast phase before spring settle |
| F-06 | HIGH | Interruptibility | MobileBrowser | All | <768px | Touch during card transition | Grab card mid-flight | Touch ignored until animation completes | `if (animating) return` in onPointerDown | Allow interruption: cancel current animation, capture new gesture |
| R-05 | HIGH | Interruptibility | InsightReader | All | <1024px | Touch during card transition | Grab card mid-flight | Touch ignored for 400–550ms | Same pattern | Same fix |
| S-01 | MEDIUM | Touch/Scroll | ShareModal | All mobile | All | Try to scroll share panel while it's partially dragged | Content scrolls | Scroll prevented by `preventDefault()` in touchmove | `e.preventDefault()` always called during drag | Only call preventDefault when vertical drag offset > threshold |
| S-02 | MEDIUM | Motion | ShareModal | All | All | Open/close share modal vs swipe cards | Consistent motion feel | CSS transition feels different from spring physics | 300ms CSS ease vs spring animation | Use spring physics for modal animation |
| R-06 | MEDIUM | Performance | InsightReader | Mobile | <1024px | Drag overlay to dismiss | Smooth 60fps | Potential frame drops on mid-range devices | `backdrop-filter: blur(20px)` recomputed per frame during transform | Disable backdrop-filter during drag, or use a static blurred snapshot |
| P-02 | MEDIUM | Performance | MobileBrowser | Mobile | <768px | Swipe between cards | Smooth 60fps | Potential paint from filter:brightness | `filter` is paint-level, not composite | Use `opacity` to darken cards instead of `filter: brightness()` |
| DR-01 | MEDIUM | Motion | DesktopReader | Desktop | ≥1024px | Switch between articles | Spatial transition | 150ms opacity flash | Simple opacity crossfade | Add translateY slide or shared-element feel |
| A-01 | MEDIUM | Accessibility | InsightReader | All | All | Look for dot navigation | Clear interactive targets | Dots are 6×4px visually | Padding creates touch target but visual size is tiny | Increase visual dot size to at least 8×8px |
| A-03 | MEDIUM | Accessibility | Multiple | All | All | Read tertiary text at 12px | Clear text | 4.6:1 contrast ratio, fails AA for small text | `--text-tertiary: #6C757D` on white | Darken to #5C636A for 5.5:1 ratio |
| DIS-03 | MEDIUM | Gesture | ShareModal | Mobile | All | Slight downward touch on share panel | Panel stays put | Risk of accidental dismiss at 100px | Low threshold | Increase to 150px or require velocity > threshold |
| R-07 | LOW | Performance | InsightReader | All | All | Swipe cards quickly | Smooth | querySelectorAll per frame | `interpolateDots()` design | Cache dot element references on mount |
| R-08 | LOW | Motion | InsightReader | All | All | Swipe card | Clean 2D movement | Slight 3D rotateY | Decorative 3D effect | Remove rotateY or reduce to near-zero |
| F-08 | LOW | Motion | MobileBrowser | Mobile | <768px | Page load | Immediate content | 400ms opacity transition before cards visible | `opacity:{mounted ? 1 : 0};transition:opacity 0.4s ease` | Reduce to 200ms or remove |
| S-04 | LOW | Motion | ShareModal | All | All | Open share modal | Immediate interactability | 120ms stagger delay per share button | Stagger animation | Keep stagger but reduce delay to 60ms |

---

## 10. Prioritized Remediation Plan

### Immediate Fixes (BLOCKERS — must fix before any other work)

**1. Remove `touch-action: none` from MobileBrowser container**
```
Current:  style="...touch-action:none;"
Target:   style="...touch-action:pan-x;"
```
Since cards swipe VERTICALLY (up/down to change issues), you need the browser to NOT handle vertical pan (you handle it), but you should allow horizontal pan to the browser. Actually, since this is a card-switching interface (not scroll), the real fix is deeper — see architectural fix below.

**2. Fix `touch-action` inheritance in InsightReader**
- Remove `touch-action: none` from `.overlay`
- Remove `touch-action: none` from `.card-area`
- Keep `touch-action: pan-y` on `.card-center`
- Apply `touch-action: none` ONLY on the `.active-card` element, and ONLY via JavaScript class toggle AFTER gesture is classified as horizontal

**3. Delay pointer capture until after gesture classification**
```javascript
// CURRENT (broken):
function onPointerDown(e) {
    (e.currentTarget).setPointerCapture(e.pointerId);  // ← captures immediately
    // ... then classifies after 10px
}

// FIX:
function onPointerDown(e) {
    // Start tracking but do NOT capture
    startX = e.clientX;
    startY = e.clientY;
}
function onPointerMove(e) {
    if (!gestureClassified) {
        classify();
        if (horizontal) {
            e.currentTarget.setPointerCapture(e.pointerId);  // ← capture only when needed
        }
    }
}
```

**4. Treat ambiguous gestures as scroll (release to browser)**
```javascript
// CURRENT in MobileBrowser:
if (gestureDirection === 'vertical') {
    cancelDrag(e);
    return;
}
// ambiguous falls through to card drag

// FIX:
if (gestureDirection === 'vertical' || gestureDirection === 'ambiguous') {
    cancelDrag(e);
    return;
}
```

### Short-Term Improvements (HIGH — fix within sprint)

**5. Reduce gesture slop threshold**
```javascript
const GESTURE_SLOP = 5; // was 10, now 5px for faster response
```

**6. Make animations interruptible**
```javascript
function onPointerDown(e) {
    // REMOVE: if (animating) return;
    // ADD:
    if (animating && cancelAnimation) {
        cancelAnimation();
        animating = false;
    }
    // ... continue with normal pointer handling
}
```

**7. Fix InsightReader content scroll**
- In `onPointerDown`, check if the touch target is inside `.card-center`:
```javascript
if ((e.target as HTMLElement)?.closest('.card-center') && cardContentEl?.scrollHeight > cardContentEl?.clientHeight) {
    return; // let browser handle scroll
}
```

**8. Restrict vertical dismiss to drag handle zone**
- Only allow vertical dismiss when the drag starts in the top 60px of the card or on a dedicated drag handle element, not the entire card area.

**9. Replace `filter: brightness()` with opacity**
```css
/* Peek cards: use opacity instead of filter */
opacity: 0.96;  /* was filter: brightness(0.96) */
opacity: 0.92;  /* was filter: brightness(0.92) */
```

### Deeper Architectural Improvements (MEDIUM — plan for next cycle)

**10. Add momentum/coast phase to card transitions**
Instead of spring-only commit:
1. On release, apply initial velocity to a deceleration curve (ease-out) for 100–150ms
2. Then hand off to spring physics for final settle
This creates the "flick and coast" feel of native iOS interactions.

**11. Unify motion system: springs everywhere**
Replace ShareModal's CSS transitions with the same spring system used by cards. Use 1–2 spring presets max (one for snap-back, one for commit/dismiss).

**12. Add shared-element transition for feed → reader**
When tapping a card in MobileBrowser:
1. Capture card position/size
2. Animate card to InsightReader position (scale + translate)
3. Crossfade InsightReader chrome in
This creates spatial continuity between feed and reader.

**13. Consider hybrid native/custom scroll for mobile feed**
The current "one card at a time" design is a valid UX choice, but users expect scroll. Options:
- **Option A:** Keep discrete cards but add visible affordance (progress indicator, "2 of 15" counter, explicit up/down arrows)
- **Option B:** Switch to a scroll-snap container (`scroll-snap-type: y mandatory`) that gives native scroll momentum with discrete stop points
- **Option C:** Keep custom swipe but add a "feed view" toggle that shows a scrollable list

Option B is the strongest — it gives Apple-grade scroll physics for free while maintaining discrete card stops.

### Browser-Specific Notes

- **iOS Safari:** `touch-action: none` on a container FULLY blocks all browser gesture handling, including scroll, pull-to-refresh, and swipe-back navigation. The current code completely disables all of these.
- **Chrome Android:** Pointer capture + `touch-action: none` creates the same scroll-blocking behavior. Chrome is slightly more lenient with nested `touch-action` values but behavior is still unreliable.
- **Firefox:** `touch-action` inheritance behaves differently — Firefox may honor child `pan-y` inside parent `none` in some cases. This could mask the bug during testing on Firefox.
- **Safari WebKit:** `backdrop-filter` performance is significantly worse than Blink. The 20px blur will cause more jank on Safari.

### Realistic Limitations to Accept

- **No true Apple-grade spring physics in CSS alone.** The current JS spring system is the correct approach; CSS `spring()` timing function doesn't exist yet.
- **Pointer capture + gesture disambiguation will always have SOME dead zone.** The goal is 3–5px, not zero. Zero would cause false positives.
- **`backdrop-filter` will always be expensive.** Accept visual degradation on low-end devices or use a static blur.
- **Browser scroll engines have ~16ms of inherent latency.** Custom JS gestures will always feel slightly less responsive than native scroll. The goal is to minimize the gap, not eliminate it.
- **Cross-browser touch-action behavior is not perfectly standardized.** Test on real devices across browsers for the nested touch-action fix.

---

## 11. Final Verdict

### Rating: **Not yet production-grade in motion quality**

The visual design, accessibility infrastructure, and animation engineering show high competence. The fundamental interaction model — capturing all touches in JavaScript and fighting the browser's native touch handling — prevents the app from feeling fluid on mobile devices.

The desktop experience is significantly better because it relies on native scroll and mouse events, which don't have the touch-action conflicts.

### Apple-Grade Closeness: **28%**

| Dimension | Score | Notes |
|-----------|-------|-------|
| Visual polish | 8/10 | Clean, restrained, well-tokenized |
| Spring math | 7/10 | Correct physics, reasonable presets |
| Gesture detection | 3/10 | Dead zones, ambiguity, browser fighting |
| Scroll feel | 1/10 | No native scroll on mobile feed |
| Interruptibility | 2/10 | Animations block all input |
| Content scroll in reader | 2/10 | touch-action conflict kills it |
| Spatial continuity | 5/10 | Good within reader, poor between views |
| Performance | 6/10 | Mostly compositor-friendly, some filter issues |
| Accessibility | 7/10 | Strong keyboard + reduced motion support |

### Confidence Level: **HIGH** for code-level findings, **MEDIUM** for runtime behavior

### App Feel Classification: **Awkwardly Custom**

The app sits in the worst valley: it's not using native browser behavior (which would feel good automatically) and it's not achieving the level of custom behavior that justifies replacing native behavior (which requires pixel-perfect touch tracking, zero dead zones, and full interruptibility). The result feels like fighting the device rather than working with it.

### Per-Surface Scores (1–10)

| Surface | Direct Manip | Momentum | Interrupt | Coherence | Scroll/Swipe | Route Trans | Overlay | Restraint | Perf | A11y |
|---------|-------------|----------|-----------|-----------|-------------|-------------|---------|-----------|------|------|
| Mobile Feed | 2 | 1 | 2 | 5 | 1 | 4 | — | 7 | 6 | 6 |
| InsightReader | 3 | 4 | 2 | 6 | 2 | 5 | 5 | 6 | 5 | 7 |
| ShareModal | 4 | — | 6 | 4 | 3 | — | 5 | 7 | 7 | 6 |
| Desktop Feed | 8 | 8 | 9 | 7 | 9 | — | — | 8 | 8 | 7 |
| Desktop Reader | 7 | 8 | 9 | 6 | 8 | 4 | — | 8 | 8 | 7 |
| Desktop Card | 7 | — | — | 7 | — | — | — | 7 | 8 | 7 |

### Overall Score: **4.2 / 10** (mobile-weighted), **6.8 / 10** (desktop-weighted)

### Production Risk Summary

| Risk | Level |
|------|-------|
| Users abandon app because feed doesn't scroll | **CRITICAL** |
| Users can't read long card content in reader | **HIGH** |
| Card transitions feel sluggish due to dead zone + non-interruptibility | **HIGH** |
| Users accidentally dismiss reader when trying to scroll | **HIGH** |
| Desktop experience is solid and shippable | **LOW RISK** |
| Accessibility audit would pass with minor fixes | **LOW RISK** |

---

*End of audit. The path from 28% to 70% Apple-grade closeness requires fixing the three BLOCKER items (touch-action, pointer capture timing, gesture ambiguity). The path from 70% to 85% requires adding interruptibility and momentum. The path from 85% to 95% requires shared-element transitions and spring unification. 95%+ requires real-device testing and iterative tuning that can only happen with instrumented user testing on physical phones.*
