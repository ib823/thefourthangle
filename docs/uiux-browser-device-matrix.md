# Browser & Device Compatibility Matrix

## Interaction Classes

### Mobile Touch (iOS Safari, Chrome Android)
| Feature | Safari iOS | Chrome Android | Notes |
|---------|-----------|---------------|-------|
| Spring card swipe | Full | Full | Custom pointer events, velocity tracking |
| Rubber band at edges | Full | Full | Custom rubber band (Apple 0.55 constant) |
| Drag-to-dismiss modal | Full | Full | Touch events with velocity-based commit |
| Haptic feedback | Not supported | Full | navigator.vibrate() — Safari blocks it |
| Press feedback | Full | Full | Pointer events + CSS transition |
| Native card content scroll | Full | Full | touch-action: pan-y on content area |
| Reduced motion | Full | Full | Both CSS and JS paths |
| Backdrop blur | Full (Tier 1) | Full (Tier 1) | Disabled on Tier 2+ devices |
| 120Hz ProMotion | Supported | Device-dependent | Spring physics is frame-rate independent |

### Desktop Mouse (Chrome, Safari, Firefox, Edge)
| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Hover lift (DesktopCard) | Full | Full | Full | Full |
| Click to open reader | Full | Full | Full | Full |
| Keyboard nav (j/k/Enter/Escape) | Full | Full | Full | Full |
| Native scroll (DesktopReader) | Full | Full | Full | Full |
| Focus visible ring | Full | Full | Full | Full |
| Backdrop blur | Full | Full | Full | Full |

### Desktop Trackpad
| Feature | Status | Notes |
|---------|--------|-------|
| Native scroll inertia | Preserved | DesktopReader, DesktopFeed use native scroll |
| Scroll snap | Not used | Custom spring is better for card navigation |
| Pinch zoom | Browser-native | No custom handling |
| Trackpad swipe-back | Browser-native | Not intercepted; history.pushState handles it |

### High Refresh Rate Displays (120Hz+)
| Feature | Status | Notes |
|---------|--------|-------|
| Spring animations | Frame-rate independent | Uses real delta-time in spring solver |
| CSS transitions | Browser-handled | Interpolated at display refresh rate |
| Gesture tracking | Pointer events at display rate | velocity tracker uses performance.now() |

### Reduced Motion
| Feature | Status | Notes |
|---------|--------|-------|
| CSS animations | Disabled (0.01ms) | Global `prefers-reduced-motion` rule |
| CSS transitions | Disabled (0.01ms) | Same global rule |
| JS spring animations | Instant resolve | prefersReducedMotion flag checked |
| Stagger reveals | Instant | Delay set to 0 |
| Card transitions | Instant snap | No spring, direct value assignment |
| Keyboard navigation | Full | Unaffected by motion preference |

## Known Unavoidable Differences

| Difference | Browsers affected | Mitigation |
|-----------|------------------|-----------|
| Scroll momentum curve | All — browser-specific | Accept. Native scroll is always used where appropriate. |
| Haptic feedback | iOS Safari — blocked | Accept. Haptics are enhancement-only. |
| backdrop-filter performance | Low-end devices | Tier 2+ disables via CSS |
| Touch event timing | Firefox slightly different | 100ms velocity window absorbs differences |
| Overscroll visual | Android shows glow by default | overscroll-behavior: none suppresses it |
| Page bounce on iOS | Safari elastic overscroll | overscroll-behavior: none on html/body |
