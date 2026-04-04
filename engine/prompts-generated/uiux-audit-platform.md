# Platform-Specific Progressive Enhancement Audit — The Fourth Angle

**Target:** https://thefourthangle.pages.dev  
**Scope:** Identify platform-specific UX gaps across iOS, Android, Windows, Linux, macOS  
**Method:** Visual inspection + DevTools + device emulation at each target viewport

---

## Instructions

You are auditing a progressive web app for **platform-aware progressive enhancement** — not different designs per OS, but correct behavior on each platform. The app is an editorial analysis tool targeting Malaysian readers across all devices.

For each platform below, use Chrome DevTools device emulation (toggle device toolbar, select the device, and reload). For desktop platforms, resize the browser and check computed styles. Inspect the live site at the URL above.

**For every finding, report:**
1. What you observed (screenshot description or DevTools measurement)
2. What the platform convention expects
3. Severity: P0 (broken), P1 (wrong convention), P2 (enhancement), P3 (nice-to-have)
4. Exact CSS property or HTML attribute to fix

---

## PART 1: Meta Tags & Head (inspect `<head>` once, applies everywhere)

Check the HTML `<head>` for:

1. **`<meta name="theme-color">`** — Should exist for Android Chrome (colors the address bar) and Safari 15+ (tab bar tint). Should have light and dark variants:
   ```html
   <meta name="theme-color" content="#F8F9FA" media="(prefers-color-scheme: light)">
   <meta name="theme-color" content="#1A1A1A" media="(prefers-color-scheme: dark)">
   ```
   
2. **`<meta name="color-scheme" content="light dark">`** — Tells the browser the page supports both schemes. Makes native form controls (inputs, selects, scrollbars) automatically adapt. Without this, dark mode form elements stay light-themed.

3. **`<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`** — For iOS PWA standalone mode. Makes the status bar transparent so the app extends under it.

4. **`<meta name="apple-mobile-web-app-capable" content="yes">`** — Required for iOS PWA home screen behavior.

5. **`<meta name="viewport">`** — Should include `viewport-fit=cover` for safe area insets to work:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
   ```

6. **Manifest `<link rel="manifest">`** — Check the manifest JSON for `theme_color`, `background_color`, `display: standalone`, and `icons` array with proper sizes.

---

## PART 2: iOS Mobile (iPhone 14 Pro — 393×852)

Emulate iPhone 14 Pro in DevTools. Reload the page. Check:

### Visual
- [ ] Status bar area: does content push below the notch/Dynamic Island? Check `env(safe-area-inset-top)`.
- [ ] Bottom safe area: does the navigation dock clear the home indicator? Check `env(safe-area-inset-bottom)`.
- [ ] Scroll bounce: does the page rubber-band at top/bottom? Is `overscroll-behavior` set correctly?
- [ ] Text selection: long-press on a headline — does the selection UI feel native (magnifier loupe)?
- [ ] Tap highlight: tap any button — is there a gray flash? Should be suppressed via `-webkit-tap-highlight-color: transparent`.
- [ ] Input focus: tap the search input — does the viewport zoom in? If font-size < 16px on the input, iOS will zoom. Check computed font-size on all `<input>` elements.
- [ ] Backdrop blur: does the header use `backdrop-filter: blur()`? Check it renders (some iOS versions need `-webkit-backdrop-filter`).
- [ ] Modal presentation: open the Share modal — does it present as a bottom sheet? Does it respect safe area at the bottom?
- [ ] Scroll momentum: swipe the feed — does it have inertial momentum? Check for `-webkit-overflow-scrolling: touch` or if the browser handles it natively.

### Functional
- [ ] Add to Home Screen: check if the PWA install flow works (or if the InstallPrompt component shows the iOS-specific "tap Share > Add to Home Screen" guide).
- [ ] Push notifications: in the notification bell, does it correctly detect iOS Safari and show/hide the subscribe button based on PWA mode?
- [ ] Copy link: tap "Copy link" in the Share modal — does `navigator.clipboard.writeText` work? iOS Safari requires a user gesture.
- [ ] Native share: does `navigator.share()` invoke the iOS share sheet?

### DevTools
- [ ] Check all `env(safe-area-inset-*)` computed values are non-zero in the emulated device.
- [ ] Check no horizontal overflow (document wider than viewport).
- [ ] Check all touch targets are >= 44×44px (Apple HIG minimum).

---

## PART 3: Android Mobile (Samsung Galaxy S21 — 360×800)

Emulate Galaxy S21 (or Pixel 7) in DevTools. Reload. Check:

### Visual
- [ ] Status bar: Android has a standard 24px status bar. Is the header positioned correctly below it?
- [ ] Navigation bar: Android 10+ has gesture navigation (bottom bar). Check bottom padding respects this.
- [ ] Overscroll glow: Android Chrome shows an edge glow instead of rubber-band. Is `overscroll-behavior` set to control this?
- [ ] Input zoom: same check as iOS — inputs with font-size < 16px will zoom on some Android browsers.
- [ ] Font rendering: check body text renders in Nunito Sans (not falling back to Roboto). Inspect computed `font-family`.
- [ ] Scrollbar: Android Chrome shows thin scrollbars by default. Check they don't conflict with any custom scrollbar CSS.
- [ ] Haptic feedback: the app uses a `haptic()` function — check if `navigator.vibrate` is available (it should be on Android).

### Functional  
- [ ] PWA install: Chrome on Android shows an install banner or "Add to Home Screen" in menu. Check the manifest is valid.
- [ ] Push notifications: Android supports Web Push fully. Check the subscribe flow works.
- [ ] Share: `navigator.share()` should invoke Android's share sheet.
- [ ] Back gesture: swipe from left edge — does it trigger browser back? The app shouldn't conflict with this gesture.

### DevTools
- [ ] Check `theme-color` meta tag reflects in the address bar color.
- [ ] Check `navigator.vibrate` is callable (for haptic feedback on card swipe/save).
- [ ] Run Lighthouse mobile audit — note any PWA, accessibility, or performance flags.

---

## PART 4: iOS Tablet (iPad 10th gen — 810×1080 portrait, 1080×810 landscape)

Emulate iPad in DevTools. Check both orientations.

### Portrait (810px)
- [ ] Layout: does it show a sidebar+main panel? (The recent update should activate desktop layout at 768px+.) If not, it's still showing the phone layout — that's a regression.
- [ ] Sidebar width: should be compact (240px) with headline+score only, no excerpts.
- [ ] Touch targets: all buttons >= 44×44px? iPad users hold the device differently — check thumb reach zones.
- [ ] Split keyboard: if user has split keyboard enabled, does the layout reflow correctly?
- [ ] Multitasking: iPad Split View at 50/50 gives ~507px per app. Does the layout degrade gracefully to mobile?

### Landscape (1080px)
- [ ] Layout: should show full desktop layout with 320px sidebar.
- [ ] Content width: check the main panel doesn't stretch beyond 1400px max-width.
- [ ] Keyboard shortcuts: check if J/K navigation works for card-to-card scrolling.

### Both Orientations
- [ ] Safe areas: iPad Pro has no notch but does have home indicator. Check bottom spacing.
- [ ] Backdrop blur: verify header glassmorphism renders correctly.
- [ ] Pointer events: iPad supports Apple Pencil (pointer: fine) and finger (pointer: coarse). Check `@media (pointer:)` queries.

---

## PART 5: Android Tablet (Samsung Tab A — 800×1280 portrait)

Emulate at 800×1280. Check:

- [ ] Same sidebar layout as iPad portrait (should activate at 768px+)?
- [ ] Samsung Internet browser differences: any rendering issues with backdrop-filter?
- [ ] System navigation: Samsung tablets have hardware/software nav buttons. Check bottom padding.
- [ ] Font rendering: Samsung devices sometimes use Samsung Sans. Verify custom fonts load.
- [ ] Dark mode: Samsung has system-wide dark mode. Toggle `prefers-color-scheme: dark` in DevTools and verify the full dark theme applies — header, sidebar, cards, modals.

---

## PART 6: macOS Desktop (1440×900 Safari, 1920×1080 Chrome)

### Safari-Specific
- [ ] Backdrop filter: verify `backdrop-filter: blur()` works (Safari pioneered this, should work).
- [ ] Font smoothing: check `-webkit-font-smoothing: antialiased` is applied.
- [ ] Elastic scroll: Safari has page-level elastic scroll. Does `overscroll-behavior` suppress it on the app shell?
- [ ] Smart zoom: double-tap on text — does Safari smart-zoom interfere with the card interaction?
- [ ] Privacy: check no localStorage/sessionStorage calls fail (Safari has stricter storage limits in private browsing).

### Chrome-Specific
- [ ] Scrollbar: check custom `::-webkit-scrollbar` styles apply.
- [ ] Dark mode: toggle `prefers-color-scheme: dark` — verify complete dark theme.
- [ ] Keyboard navigation: Tab through the entire page. Check focus ring visibility on every interactive element.
- [ ] J/K navigation: open an issue reader, press J/K — verify smooth card scrolling.

### Both Browsers
- [ ] Max-width: at 1920px, verify `.app-main--desktop` has `max-width: 1400px` and is centered.
- [ ] Hover states: check every interactive element has a visible hover response (hero card, sidebar items, header icons, buttons).
- [ ] Right-click: check no custom context menus or interference with native right-click.
- [ ] Cmd+F: verify browser find works (content not hidden in shadow DOM or overflow:hidden containers).

---

## PART 7: Windows Desktop (1920×1080 Edge/Chrome)

- [ ] ClearType rendering: check font hinting. Manrope and Nunito Sans should render crisply at all sizes. Look for fuzzy text at small sizes (11-12px).
- [ ] High DPI: if testing at 150% scaling (common on Windows laptops), verify images and text scale correctly. Check OG images aren't blurry.
- [ ] Scrollbar: Windows Chrome/Edge show wider scrollbars than macOS. Check they don't overlap content.
- [ ] Dark mode: Windows 10/11 dark mode should trigger `prefers-color-scheme: dark`. Verify in DevTools.
- [ ] Accessibility: check Windows High Contrast mode — toggle `prefers-contrast: more` in DevTools. Verify the high-contrast token overrides in tokens.css activate.

---

## PART 8: Linux Desktop (1920×1080 Firefox)

- [ ] Firefox scrollbar: Firefox uses `scrollbar-color` and `scrollbar-width` properties, NOT `::-webkit-scrollbar`. Check if scrollbar styling exists for Firefox. If not, the default system scrollbar will show.
- [ ] Font rendering: Linux font rendering varies hugely. Check if Manrope/Nunito load via WOFF2 or fall back to system-ui (which may be DejaVu Sans or Liberation Sans on many distros).
- [ ] Backdrop filter: Firefox supports `backdrop-filter` since v103 (2022). Verify it renders, and check the `.anim-tier-2` fallback (which disables backdrop-filter for low-end devices).
- [ ] Dark mode: Linux desktop environments (GNOME, KDE) set `prefers-color-scheme`. Verify.
- [ ] GTK scrollbars: some Linux themes have overlay scrollbars. Check they don't conflict with custom scrollbar CSS.
- [ ] Selection color: check `::selection` styling works in Firefox.

---

## PART 9: Cross-Platform Progressive Enhancement Gaps

After completing all platform checks, compile a synthesis:

### Missing `<meta>` Tags
List every missing meta tag that should exist for proper platform integration.

### Missing CSS Media Queries
List any platform-appropriate media queries not found:
- `@media (pointer: coarse)` — touch device
- `@media (pointer: fine)` — mouse device  
- `@media (hover: hover)` — device supports true hover
- `@media (hover: none)` — touch-only (hover states are fake)
- `@media (display-mode: standalone)` — PWA mode
- `@media (forced-colors: active)` — Windows High Contrast
- `@media (prefers-contrast: more)` — high contrast preference

### Missing Progressive Enhancements
- `navigator.vibrate()` for Android haptics
- `navigator.connection` for network-aware image loading
- `scrollbar-color` / `scrollbar-width` for Firefox
- `color-scheme: light dark` on `:root` for native controls

### Platform-Specific Bugs
Any rendering, interaction, or functional bug specific to one platform.

---

## Output Format

For each part, produce a table:

| Finding | Platform | Severity | Current | Expected | Fix |
|---------|----------|----------|---------|----------|-----|

Then a prioritized action plan:
- **P0**: Broken functionality on a specific platform
- **P1**: Wrong platform convention (users will notice)
- **P2**: Enhancement that improves perceived quality
- **P3**: Nice-to-have polish

End with **The One Thing** — the single highest-impact cross-platform improvement.
