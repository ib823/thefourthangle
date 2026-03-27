# UI/UX Motion Architecture

## Interaction Principles

1. **Direct manipulation**: Gesture response begins within 1 frame. No perceptible delay between input and visual change.
2. **Physical coherence**: All motion follows spring physics or physically-motivated easing. No arbitrary ease-in-out.
3. **Interruptibility**: Any animation can be interrupted by new input. The new motion starts from current position and velocity.
4. **Continuity**: Transitions between states preserve spatial context. The user always knows where they came from and where they are.
5. **Low-latency response**: Pressed states are immediate (no transition delay). Release states spring back.
6. **Visual hierarchy**: Important elements animate more than background elements. Card stack parallax communicates depth.
7. **Restraint**: No animation exists for decoration. Every motion serves feedback, continuity, or hierarchy.
8. **Accessibility**: prefers-reduced-motion disables all animation. Keyboard navigation provides full functionality.

## Platform Strategy

- **Native scroll preserved**: DesktopReader, DesktopFeed, card content overflow
- **Custom gesture needed**: InsightReader card swipe, MobileBrowser feed swipe, ShareModal drag-dismiss
- **CSS/WAAPI first**: Overlay entry, completion reveal, stagger reveals, hover/focus states
- **JS spring second**: Card swipe physics, dismiss physics, rubber band
- **Compositor-safe**: All hot-path animations use transform + opacity only

## Motion Primitives (token-driven)

All motion uses CSS custom properties from tokens.css:
- Duration: --duration-micro (100ms) through --duration-slow (450ms)
- Easing: --ease-spring, --ease-out-expo, --ease-snap, --ease-out-cubic, --ease-out-quart
- Spring presets: SPRING_DEFAULT (400/28), SPRING_SNAPPY (600/32), SPRING_GENTLE (200/22), SPRING_RUBBER (800/36)

## Physics Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| Swipe commit fraction | 0.3 × width | Minimum drag distance to commit card change |
| Swipe commit velocity | 300 px/s | Minimum velocity to commit regardless of distance |
| Dismiss commit fraction | 0.25 × height | Minimum drag distance to dismiss reader |
| Rubber band constant | 0.55 | Apple's standard resistance factor |
| Gesture dead zone | 3px then 15px | Progressive classification thresholds |
| Gesture angle horizontal | <30° | Horizontal classification |
| Gesture angle vertical | >60° | Vertical classification |
| Press scale | 0.97 | Immediate feedback scale |
| Velocity tracker window | 100ms, 8 samples | Ring buffer for velocity estimation |
| Spring dt cap | 64ms | Prevents explosion at low frame rates |

## Rendering Rules

1. Animate `transform` and `opacity` only in hot paths
2. No `top`, `left`, `width`, `height` animation during gesture
3. `will-change` on elements that animate frequently (card, ghost cards, overlay)
4. Remove `will-change` after animation settles (use WAAPI or class toggle)
5. Use CSS custom properties for dynamic values where CSS can handle the interpolation
6. Batch DOM reads before DOM writes in gesture handlers

## Accessibility Layer

- `prefers-reduced-motion: reduce` → all CSS animation/transition duration → 0.01ms
- JS flag `prefersReducedMotion` → springs resolve instantly, stagger delays → 0
- Keyboard navigation: Left/Right for cards, Escape to close, Tab trap in modals
- aria-live region announces card transitions
- Focus restoration on modal/reader close
