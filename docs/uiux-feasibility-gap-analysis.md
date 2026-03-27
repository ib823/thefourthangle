# UI/UX Feasibility & Gap Analysis

## Target: Apple-grade fluidity within browser platform constraints

## What CAN be made Apple-grade

### 1. Spring physics — Already there
The spring solver is mathematically correct, well-tuned, and delta-time capped. The presets produce natural motion. This is already at Apple-grade quality for the physics layer.

### 2. Gesture disambiguation — Already good
30°/60° angle thresholds with dead zones and 3-stage progressive classification. This matches iOS gesture recognizer behavior.

### 3. Rubber band physics — Already there
Apple's 0.55 constant is implemented correctly.

### 4. Card swipe commitment — Good, can improve
Velocity-based commit with fraction-of-width thresholds. The thresholds can be tuned but the model is correct.

### 5. Press feedback — Already good
Immediate scale-down (1 frame), spring return. Matches iOS button feedback pattern.

### 6. Card stack parallax — Good
3-layer stack with scale/translate interpolation during drag. Visually convincing.

### 7. Reduced motion — Already handled
Both CSS (animation/transition-duration: 0.01ms) and JS (prefersReducedMotion flag) paths exist.

## What CANNOT be made identical to Apple

### 1. 120Hz guaranteed frame delivery
- Apple devices run at ProMotion 120Hz with hardware-accelerated compositor
- Web browsers on the same devices may drop to 60Hz under load
- No fix possible from code — hardware/browser limitation
- **Mitigation**: Keep animations compositor-friendly (transform + opacity only) to maximize frame delivery

### 2. Native scroll momentum
- iOS UIScrollView has device-specific deceleration curves tuned per-device
- Browser scroll momentum is browser-owned — cannot be customized
- **Decision**: Preserve native scroll where used (DesktopReader). Do NOT replace with JS simulation.

### 3. Haptic engine precision
- iOS Taptic Engine has precise haptic patterns (impact, selection, notification)
- Web Vibration API is coarse (duration only, no pattern granularity)
- Safari disables navigator.vibrate() entirely
- **Decision**: Keep haptic calls as enhancement. Accept they are Chrome-Android-only.

### 4. Edge swipe gesture ownership
- iOS owns the left-edge swipe for back navigation
- Android owns the left/right edge swipe for back
- Web cannot intercept these
- **Decision**: Our horizontal card swipe already works because it starts from the card center, not the edge. No conflict.

### 5. Scroll position restoration precision
- Native apps restore exact scroll position with pixel accuracy
- Web scroll restoration depends on browser implementation
- **Decision**: Accept browser default. Our position restore (savedPosition) handles issue/card index, not pixel offset.

### 6. Background app state transitions
- iOS apps have precise suspend/resume animations
- Web has visibility change events but no animation hooks for app switching
- **Decision**: Accept. Not relevant for this product.

## What should remain browser-native

| Surface | Decision | Reason |
|---------|----------|--------|
| DesktopReader scroll | Native | Native scroll is faster, smoother, and supports trackpad inertia |
| DesktopFeed scroll | Native | Same — sidebar overflow scroll is browser-native and correct |
| Card content overflow scroll | Native | InsightReader card content area uses `overflow-y: auto` — this is correct |
| Page navigation (Astro routes) | Native | Full page loads to /about, /disclaimer — no need for SPA transition |
| Text selection | Native | Already restored in R7 |
| Scroll-snap | Not used | Could add to MobileBrowser for fallback, but custom spring is better when working |

## Browser/device differences that must be accepted

| Difference | Impact | Mitigation |
|-----------|--------|-----------|
| Safari iOS rubber band on page overscroll | Visible when dragging at page edges | `overscroll-behavior: none` on html+body already applied |
| Chrome Android overscroll glow | Minor visual | `overscroll-behavior: none` suppresses it |
| Safari no Vibration API | No haptics on iOS Safari | Accept — haptics are enhancement only |
| Firefox pointer event timing | Slightly different from Chrome/Safari | Velocity tracker's 100ms window handles this |
| 60Hz vs 120Hz displays | Motion feels different at different refresh rates | Spring physics uses real delta-time — frame-rate independent |
| DPR differences | Sub-pixel rendering varies | Not a motion issue |

## Performance ceilings dependent on hardware

| Constraint | Low-end impact | Mitigation |
|-----------|---------------|-----------|
| backdrop-filter | Causes jank on <4GB RAM devices | Tier 2+ disables it via CSS |
| Complex shadows | Expensive during transitions | Tier 2 simplifies to single 3px shadow |
| Spring animation frame budget | May drop frames if main thread is busy | Keep spring callbacks minimal (transform only) |
| 14KB issues.ts parse time | Blocks main thread during hydration | WS-1 moved to SSR prop + lazy fetch |

## Product-safe target

**"Apple-grade fluidity and coherence within browser platform constraints"**

Concretely, this means:
1. Every gesture response must begin within 1 frame (16ms at 60Hz)
2. Spring animations must run at compositor layer when possible
3. Card transitions must carry velocity naturally
4. Modal/sheet entry/exit must feel physically connected to the triggering action
5. No motion must exist purely for decoration — every animation must serve continuity, feedback, or hierarchy
6. Reduced motion must provide full functionality
7. Native scroll must be preserved where the browser does it better than us
8. The app must feel responsive on a 3-year-old mid-range Android phone
