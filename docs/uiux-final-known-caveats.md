# Final Known Caveats

## Unavoidable Browser Limitations

| Caveat | Impact | Why unavoidable |
|--------|--------|----------------|
| No haptic feedback on iOS Safari | Enhancement missing for iOS users | Apple blocks navigator.vibrate() in Safari. No workaround exists. |
| Browser-owned scroll momentum curves | Native scroll feels slightly different per browser | Momentum deceleration is browser-internal. Cannot be customized. We preserve native scroll where it's used (DesktopReader, DesktopFeed, card content area). |
| 120Hz frame delivery not guaranteed | Springs may feel slightly different at 120Hz vs 60Hz | Browser may drop to 60Hz under load. Our springs use real delta-time so they settle correctly at any frame rate — only visual smoothness varies. |
| Edge swipe gesture ownership (iOS/Android) | Cannot override OS back gesture | Our card swipe starts from card center. No conflict — but if a user starts from screen edge, the OS captures it. |

## Hardware-Dependent Limitations

| Caveat | Impact | Mitigation |
|--------|--------|-----------|
| backdrop-filter jank on low-end devices | Header blur and overlay blur cause jank | Tier 2+ devices disable backdrop-filter via CSS. Tier detection based on hardwareConcurrency + deviceMemory. |
| Spring animation frame drops on very low-end | Card transitions may feel choppy on <2GB RAM devices | Tier 3+ reduces animation complexity. Tier 4 (reduced-motion) disables all animation. |
| Large page weight on index (3.8MB raw HTML) | Slow parse on very constrained devices | Gzips to ~300KB. Feed content is SSR'd so it renders immediately without JS. |

## Feature Support Differences

| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Pointer events | Full | Full | Full | Full |
| Spring physics (JS) | Full | Full | Full | Full |
| backdrop-filter | Full | Full | Full | Full |
| Vibration API | Full | Blocked | Full | Full |
| deviceMemory API | Full | Not supported | Not supported | Full |
| touch-action: pan-y | Full | Full | Full | Full |
| CSS custom properties | Full | Full | Full | Full |
| IntersectionObserver | Full | Full | Full | Full |
| setPointerCapture | Full | Full | Full | Full |
| prefers-reduced-motion | Full | Full | Full | Full |

## Accepted Non-Blocking Imperfections

| Item | Severity | Why accepted |
|------|----------|-------------|
| InsightReader is 1,299 lines | S3 | Working correctly. Decomposition improves maintainability but does not fix bugs. Post-production work. |
| Overlay entry is CSS keyframe (not interruptible) | S4 | 300ms entry is rarely interrupted. WAAPI upgrade would add complexity for minimal gain. |
| Ghost card interpolation updates 6 properties per frame | S4 | All compositor-safe (transform only). No measured jank. Simplification would reduce visual quality. |
| `motion` package removed but may still be in lockfile cache | S4 | Not imported anywhere. Tree-shaken from bundle. Zero runtime impact. |
| `--text-muted` fails WCAG AA contrast | S3 | Used only on decorative non-informational text. Informational text uses `--text-tertiary` which passes. |
| 7 components use `any` typed props | S3 | Fixed in P13 — zero `any` in active path now. Only `navigator as any` remains (API cast). |
| ContentFingerprint.svelte is orphaned | S4 | Was removed from readers in P15. File exists but is tree-shaken. Can be deleted or repurposed later. |
