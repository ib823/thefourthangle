# Known differences across browsers + OSes

Parity means equivalent *experience* — same information, same affordances, same reading flow, same accessibility, same state model. Parity does **not** mean pixel-identical rendering. The differences below are expected, acceptable, and documented so reader reports ("the site looks different on my phone") can be mapped to a root cause.

## Typography

### Font smoothing
- **macOS / iOS:** CoreText subpixel antialiasing with `-webkit-font-smoothing: antialiased` applied. Thinner strokes, higher contrast.
- **Windows (ClearType):** DirectWrite grayscale antialiasing. Heavier strokes, slightly wider letterforms at small sizes.
- **Linux:** FreeType with hinting. Similar to Windows in weight; more variation by distro.
- **Android:** Skia's Android Magic text renderer. Closer to macOS than to Windows.

**Why we accept it:** these are OS-level rendering decisions. Forcing uniform antialiasing degrades one platform to give the illusion of parity on another. Readers still get the same words, hierarchy, and information.

### Manrope + Nunito Sans rendering
Minor weight-perception differences between WebKit (macOS/iOS), Blink (Chrome/Edge/Android), and Gecko (Firefox) because each engine's stroke-to-pixel snap differs. Headings look ~5% "lighter" on WebKit than on Blink at small sizes. Not a bug.

## Scrollbars

- **Windows:** 17 px overlay scrollbar, OS-styled. `scrollbar-gutter: stable` reserves the column.
- **macOS:** auto-hiding scrollbar (user setting: always vs. when scrolling). `scrollbar-gutter: stable` still reserves the column; scrollbar appears on scroll.
- **iOS / Android:** native swipe-to-scroll indicators; no persistent bar.
- **Firefox (all OSes):** thinner scrollbars by default. `scrollbar-gutter: stable` handles this identically.

**Why we accept it:** custom scrollbars break OS trackpad gestures, assistive-technology scroll announcements, and accessibility tooling. Platform-default scrollbars are the safest bar. `scrollbar-gutter: stable` prevents layout jump — same intent everywhere.

## Native pickers

- **`<select>`:** renders native on every platform. macOS uses a sheet; iOS uses a scroll wheel; Android uses a Material bottom sheet; Windows uses a dropdown. Different chrome, same semantics.
- **`<input type="search">`:** iOS adds a native clear button; macOS shows a magnifying-glass; others vary. Left native.
- **`<input type="date">`:** platform-native picker. iOS / iPadOS wheel, Android calendar, desktop calendar popup.
- **File upload (`<input type="file">`):** not used today; would use native dialog.

**Why we accept it:** native pickers are AT-compatible out of the box. Custom pickers require full ARIA re-implementation and break on VoiceOver's rotor, TalkBack's explore-by-touch, and NVDA's focus-mode. See ADR-0003 for the broader "keep native" decision.

## Emoji glyphs

- **macOS / iOS:** Apple Color Emoji. Colourful, rounded, editorial style.
- **Windows 11:** Segoe UI Emoji (redesigned, Fluent). Flatter, more geometric.
- **Android:** Noto Color Emoji. Material-style.
- **WhatsApp / Slack in-app:** sometimes custom-rendered; not our control.

**Why we accept it:** emoji are OS-provided fonts. Overriding with a custom emoji set (e.g. Twemoji) would add 1-2 MB and lose system updates. The Fourth Angle does not use emoji in editorial copy, so the exposure is minimal (mostly in UI affordances like the reader's `🔖` save button if any).

## PWA install UX

- **iOS Safari:** "Add to Home Screen" — requires manual action from Share menu. No install prompt. Manifest read but not announced.
- **Chrome / Edge (Chromium):** install prompt fires automatically on engagement (mini-info-bar) or via the "Install" menu item.
- **Firefox:** manual install via address bar icon (if extension).
- **Samsung Internet:** install prompt similar to Chrome.

**Why we accept it:** Apple's deliberate friction against PWAs is platform-wide; it's not our site specifically. `InstallPrompt.svelte` handles Chromium's `beforeinstallprompt` event; iOS users see a custom explainer.

## Form autofill appearance

- **Chrome:** yellow tint over autofilled fields.
- **Safari:** blue tint.
- **Firefox:** no tint; only the dropdown indicates autofill.
- **1Password / Bitwarden extensions:** inject their own overlay UI.

**Why we accept it:** autofill indicators are user-trust signals from the browser / password manager. Overriding `:-webkit-autofill` with our background breaks the trust signal. Left default.

## Spell-check underlines

- **Chrome / Edge:** red/blue squigglies on misspellings.
- **Firefox:** red squigglies; setting-dependent.
- **Safari:** `spellcheck` attribute controls.
- **Mobile keyboards:** provide their own.

**Why we accept it:** spell-check is a user feature. We don't write into form inputs ourselves; anything the user types is theirs to spellcheck.

## In-app webview feature gaps

These environments use embedded browser engines with restricted feature sets. The site detects them (Phase 8.5, `dataset.env="webview"`) and gates known-fragile features:

| Webview | Engine | Known limits | Our mitigation |
|---|---|---|---|
| **Facebook / Messenger** (FBAN/FBAV) | Chromium (Android) / WKWebView (iOS) | View Transitions flash-black; storage sometimes partitioned | Skip View Transitions; storage-blocked banner if applicable |
| **Instagram** | Same as FB | Same | Same |
| **Line** | WKWebView | Same | Same |
| **TikTok** | Chromium | Aggressive JS throttling; no autoplay | Skip View Transitions; SSG content readable without JS (Phase 8a) |
| **WeChat** (MicroMessenger) | X5 (Blink fork) | Older rendering; some modern CSS absent | `@supports` wrappers (Phase 3) keep layout usable |
| **X / Twitter** | Chromium | Usually fine | Minimal webview-specific gating |
| **Android `wv` (generic)** | System WebView | Varies by Android version | Same gates |

**Reader report path:** "Site looks wrong when I tap the link in Facebook" → `troubleshooting.md` → check `dataset.env` is set → confirm View Transitions are skipped → surface the "Open in your browser" affordance.

## JS-disabled readers

The article at `/issue/[id]` is fully readable with JavaScript disabled (Phase 8a). Sidebar feed at `/` degrades to a static list of recent issues — no interactive sorting or filtering. This is documented and accepted; every hundred-reader sample will likely include one or two JS-disabled or JS-blocked users.

## Dark mode

- **`prefers-color-scheme: dark`:** automatic — site switches.
- **`[data-theme="dark"]`:** manual opt-in (hook exists; no toggle UI yet).
- **Dark Reader extension:** may re-colour the site on top of our dark mode; can produce double-dark. Users who run Dark Reader on a site that already has dark mode typically disable Dark Reader for that site. Not our bug.

## Acceptable differences in screen-reader speech flow

VoiceOver, NVDA, TalkBack, and Narrator each announce the same content slightly differently — landmark labels, heading-level phrasing, link vs button distinction. The Phase 5.5 matrix verifies the same information is announced everywhere; verbatim speech parity is not a goal.

## Screenshot + share card rendering

The `og:image` PNG at `1200×630` is what social scrapers fetch. What ships on Facebook / Twitter / LinkedIn / Slack / Discord / WhatsApp / LINE / WeChat / Telegram is whatever each platform's own card renderer produces from that image + meta. The site has no control after the scrape.
