# UI/UX Motion & Interaction Audit

## Stack Summary
- **Framework**: Astro 6.0.8 + Svelte 5 (runes) — static SSG with client-hydrated islands
- **Build**: Vite, deployed to Cloudflare Pages
- **Styling**: Tailwind CSS 4.2.2 + CSS custom properties (tokens.css)
- **Animation**: Custom spring physics, velocity tracker, rubber band, easing helpers — no third-party animation library in active use
- **State**: nanostores (persistent + in-memory)

## Interaction Surfaces

### 1. InsightReader (mobile/tablet card reader) — 1,299 lines
**Classification: Custom gesture layer needed**

The core interaction surface. A full-screen overlay with a 3-card stack (active + 2 ghosts). Handles:
- Horizontal swipe to navigate cards (spring-driven)
- Vertical swipe to dismiss reader
- Gesture disambiguation (horizontal vs vertical vs ambiguous)
- Rubber-band physics at card boundaries
- Spring-based card enter/exit animations
- Multi-touch cancellation
- Scroll-within-card detection and coordination
- Keyboard navigation (Left/Right/Escape)
- Swipe hint animation
- Completion screen with staggered button entry

**Current quality**: Good spring physics, proper velocity tracking, correct pointer capture. The gesture disambiguation is conservative (3-stage classification with dead zones). Card transitions carry velocity between swipes.

**Issues found**:
- `touch-action: none` on overlay/card-area is maximally aggressive — prevents browser scroll optimization on the overlay container even where native scroll could be used (card content area)
- 6 transform properties updated per frame during drag (card + 2 ghosts)
- offsetWidth read per pointer move
- Scroll indicator timeout created on every scroll event without debounce
- Ghost card interpolation recalculates on every frame (could cache width)

### 2. MobileBrowser (mobile feed) — 381 lines
**Classification: Custom gesture layer needed**

Vertical card stack with peek-behind parallax. Handles:
- Vertical swipe to browse cards (spring-driven)
- 3-card stack interpolation during drag
- Keyboard navigation (Up/Down/Enter)
- Position restore from localStorage

**Current quality**: Good. Same spring/velocity system as InsightReader. Properly bounded interpolation.

**Issues found**:
- Same offsetHeight read per pointer move pattern
- No scroll-snap fallback for browsers where custom gesture fails

### 3. ShareModal (bottom sheet) — 432 lines
**Classification: Custom transition layer needed**

Bottom sheet with drag-to-dismiss. Handles:
- Slide-up entry with staggered button reveal
- Touch drag to dismiss (downward only)
- Focus trap and keyboard close
- Copy animation with 5-phase setTimeout sequence
- Backdrop click dismiss

**Current quality**: Entry animation is polished. Focus management is correct (WS-2).

**Issues found**:
- Copy animation uses 5 nested setTimeout calls — brittle, hard to interrupt
- Drag-to-dismiss uses raw Touch events with fixed 100px threshold (no velocity-based commit)
- No velocity-influenced dismiss (a fast flick should dismiss faster than a slow drag past threshold)

### 4. DesktopReader (scroll reader) — 206 lines
**Classification: Native browser scroll should be preserved**

Scroll-based card reader for desktop. Uses native scroll with IntersectionObserver for completion tracking.

**Current quality**: Correct. Native scroll is the right choice here.

**Issues found**: None significant.

### 5. DesktopCard (tablet/grid card) — 117 lines
**Classification: Acceptable as-is**

Hover lift with viewport-triggered entry. Uses CSS transitions for hover states and IntersectionObserver for entry.

**Issues found**:
- box-shadow transition (350ms) is paint-expensive — could use pseudo-element opacity instead

### 6. MobileCard (feed card) — 264 lines
**Classification: Acceptable as-is**

Feed card with viewport-triggered animations (scale, opacity, bar fill). Uses IntersectionObserver.

**Issues found**:
- Bar fill animation updates width without will-change hint

### 7. Header (sticky header) — 100 lines
**Classification: Native browser scroll should be preserved**

Sticky header with backdrop-filter blur. Static positioning, no custom scroll handling.

**Issues found**:
- backdrop-filter: blur(12px) is always on — may impact scroll performance on low-end devices (already handled by tier system)

### 8. OpinionBar (score meter) — 73 lines
**Classification: Acceptable as-is**

Animated fill bar on intersection. Uses rAF with outExpo easing.

**Issues found**: None significant.

## Physics Library Assessment

### spring.ts — Excellent
- Euler integration with dt capping at 64ms (prevents explosion at low frame rates)
- 4 well-tuned presets (default ζ≈0.7, snappy ζ≈0.65, gentle ζ≈0.78, rubber ζ≈0.64)
- Immutable state, clean API
- Proper settle detection (displacement + velocity below precision)

### velocity.ts — Excellent
- Ring buffer (8 samples, 100ms age window) — standard iOS-like approach
- Proper atan2 gesture classification with 30°/60° thresholds
- Apple rubber band constant (0.55) implemented correctly

### scroll-physics.ts — Good
- Passive scroll listener — correct
- ResizeObserver for dimension tracking — correct
- Fade gradient mask using CSS mask-image — compositor-friendly
- shouldBlockSwipe() for scroll-vs-swipe coordination — good heuristic

### animation.ts — Good
- Easing functions (outExpo, outCubic, outBack, outQuart, decel)
- Generic tween function with rAF
- Stagger utility for sequential reveals
- Animation tier detection (hardware concurrency + deviceMemory)
- Haptic feedback helper

### press.ts — Good
- Immediate scale-down on pointerdown (no delay)
- CSS spring-back on release
- Correctly skips button/link children

## CSS Motion Tokens

Well-organized in tokens.css:
- 5 easing curves (spring, out-expo, in-out-sine, snap, out-cubic, out-quart)
- 5 duration tiers (micro 100ms, fast 150ms, normal 250ms, medium 350ms, slow 450ms)
- These are DEFINED but INCONSISTENTLY USED — many components use hardcoded duration/easing values instead of tokens

## Performance Tier System

4-tier animation degradation:
- Tier 1: Full animations (≥4 cores, ≥4GB RAM)
- Tier 2: No backdrop-filter, simplified shadows
- Tier 3: No backdrop-filter
- Tier 4: All animations disabled (prefers-reduced-motion)

CSS rules apply `!important` overrides. JS spring animations check a prefersReducedMotion flag.

## Anti-Patterns Found

1. **Inconsistent motion token usage**: Components use raw duration/easing values instead of CSS custom properties
2. **5-nested setTimeout copy animation**: In ShareModal — should be a state machine or WAAPI sequence
3. **Scroll indicator timeout per scroll event**: Creates new timeout on every scroll, not debounced
4. **touch-action: none on overlay**: Prevents browser from optimizing scroll on card content overflow area
5. **No velocity-based dismiss**: ShareModal drag-to-dismiss uses fixed 100px threshold regardless of velocity
6. **box-shadow transitions**: DesktopCard transitions box-shadow (expensive) instead of using pseudo-element opacity
7. **No WAAPI usage**: Everything is rAF + manual spring or CSS transitions — WAAPI could improve some transitions
8. **Reader overlay entry**: Uses CSS keyframe animation (overlayEnter) — could use WAAPI for interruptibility
