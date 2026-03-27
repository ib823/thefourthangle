# Performance Baseline

## Before/After Changes

### Gesture Hot Path (InsightReader pointer move)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| offsetWidth reads per drag | 1 per pointer move (~60/s) | 1 per drag session (cached) | -98% layout reads |
| Ghost card transforms per frame | 6 properties (scale + translateY + brightness × 2 ghosts) | Same | No change — already compositor-safe |
| Card content touch-action | `none` (blocks all browser optimization) | `pan-y` on content area | Native vertical scroll restored |

### ShareModal Animation

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Copy animation setTimeout depth | 5 nested levels | Flat sequence array | Cleaner, same timing |
| Drag dismiss commit | Fixed 100px threshold | 100px OR 500px/s velocity | Velocity-aware — fast flicks commit |

### DesktopCard Hover

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| box-shadow transition | 150ms transition (paint-heavy) | Instant swap (no transition) | Eliminates paint cost on hover |
| transform transition | 350ms out-expo (compositor) | Unchanged | Already compositor-safe |

### Motion Token Consistency

| Metric | Before | After |
|--------|--------|-------|
| MobileCard bar-fill duration | Hardcoded 400ms | Token `--duration-slow` (450ms) |
| MobileCard badge transition | Hardcoded 300ms | Token `--duration-medium` (350ms) |

### Build Output

| Metric | Value |
|--------|-------|
| Total dist | 39MB |
| Main JS gzipped | 36KB |
| Issue HTML | 10.5KB |
| Build time | ~11s |
| Pages | 1003 |
| Stealth | Zero violations |

## Remaining Performance Characteristics

### Compositor-safe animations (already optimized)
- Card swipe: transform + opacity only
- Ghost card parallax: transform only
- Press feedback: transform + filter (filter is moderately expensive but single-frame)
- Overlay entry: opacity + transform (keyframe)
- Completion reveal: opacity + transform

### Native scroll surfaces (preserved)
- DesktopReader: `overflow-y: auto` with native scroll
- DesktopFeed: `overflow-y: auto` with native scroll
- Card content area: `overflow-y: auto` with `touch-action: pan-y`

### Performance tier system (active)
- Tier 1 (high-end): Full animations, backdrop-filter, complex shadows
- Tier 2 (mid): No backdrop-filter, simplified shadows, reduced box-shadow
- Tier 3 (low): No backdrop-filter
- Tier 4 (reduced-motion): All animation disabled

## Interaction Hotspots — Risk Assessment

| Hotspot | Risk Level | Notes |
|---------|-----------|-------|
| InsightReader pointer move | **Low** | Width cached, transform-only updates |
| MobileBrowser pointer move | **Low** | Same pattern, height cached |
| ShareModal drag | **Low** | Simple touch tracking, velocity calculation |
| DesktopCard hover | **Low** | box-shadow no longer transitioned |
| Header backdrop-filter | **Low** | Static position, tier-gated |
| OpinionBar fill animation | **Low** | IntersectionObserver-triggered, rAF-driven |
