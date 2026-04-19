# Troubleshooting — reader reports → diagnoses → fixes

Each entry maps a common reader report to the likely cause and the fix path. Use this as the first stop when a user writes in about "the site looks wrong" or "my progress disappeared."

---

## "Site looks different in Edge"

**Most common cause:** state divergence. The sidebar structure depended on `tfa-*` localStorage state before Phase 1; different profiles saw different sidebars. Phase 1 fixed this — the four canonical sections always render.

**Diagnostic steps:**
1. Ask the user to open the info menu → Reading Progress panel.
2. Ask for their device ID (e.g. `edge-panda-314`) and browser version.
3. Ask them to Export their reading progress JSON and share the file (it contains no PII, just issue IDs + progress).

**Fixes:**
- If the sidebar shows fewer than four sections → regression of Phase 1 invariant. File as a bug.
- If the sidebar shows four sections but counts differ from what the user expected → their state is correct; the site is working as designed across profiles.

**Related phases:** Phase 1 (four-section invariant), Phase 0 audit.

---

## "My reading progress is missing"

**Most common cause:** storage blocked.
- Safari private mode — every tab starts fresh.
- Brave Shields (aggressive) — may block `localStorage`.
- Firefox ETP strict + storage partitioning — cross-origin iframe scenarios.
- Enterprise Edge with storage-clearing policies.
- Some iframes embedded inside third-party webviews.

**Diagnostic steps:**
1. Did the storage-blocked banner appear? ("Reading progress isn't being saved in this browser. Export manually or open in another browser.")
   - **Yes:** storage is blocked. No data loss — progress was never persisted.
   - **No:** move to step 2.
2. DevTools → Application → Local Storage → `tfa:v1:*` keys present?
   - **No:** storage was cleared (browser tools, \"clear site data,\" device reset).
   - **Yes:** progress is there but the UI isn't reading it. File as a bug.

**Fixes:**
- Storage blocked: suggest Export in a non-private tab.
- Storage cleared: no recovery possible (the site does not store user data off-device by default — only when Angle Code sync is explicitly opted into).
- Angle Code linked → user can sync to a new device.

**Related phases:** Phase 1 (reading-state + storage fallback), Phase 8.5 (banner).

---

## "Fonts look fuzzy on Windows"

**Cause:** Windows ClearType DirectWrite grayscale antialiasing. macOS CoreText and iOS WebKit apply subpixel antialiasing that looks sharper by default.

**Diagnostic steps:** confirm the user is on Windows. That alone usually explains it.

**Fix path:** none — this is a platform-level rendering choice. See `known-differences.md` § Typography. If the user has set Windows' high-DPI display scaling to an unusual value, the effect is amplified; suggest 100% or 125% scaling.

---

## "Hero image doesn't load on mobile data"

**Possible causes:**
1. **Data-Saver / `prefers-reduced-data`** — Chrome Android's Save-Data mode flags. Our current hook does nothing (decorations already minimal; see `docs/cross-browser-parity/05-settings.md`). The hero should still load.
2. **Content blocker** — 1Blocker, AdGuard, or a host-level pi-hole may have blocked the image URL. Check `/og/issue-*-{640w,960w,1200w}.{avif,webp,jpg}` in Network tab.
3. **CSP mismatch** — if a custom CSP has blocked our image origin. Check `report-uri` logs at `tfa-notify.4thangle.workers.dev`.

**Fix path:**
- Confirm the AVIF/WebP/JPEG `<picture>` sources are all unblocked.
- If a specific format is blocked on that device → extension issue, not ours.

**Related phases:** Phase 8b (image pipeline).

---

## "Layout broken with Google Translate on"

**Cause:** Google Translate injects `<font>` wrappers with inline `style` attributes (vertical-align, color). Our defensive rule in `global.css` resets these within the article tree, but if a new surface is added outside `.ssg-article`, `[class*="reader"]`, or `.feed-row`, the Translate wrapping can break alignment.

**Diagnostic steps:**
1. Open DevTools → inspect a broken element.
2. Is it wrapped in `<font>`?
3. Is the wrapping element outside the scoped reset selector?

**Fix:** extend the reset selector in `src/styles/global.css` (Phase 7 block) to cover the new surface.

**Related phases:** Phase 7 (translate resilience).

---

## "Keyboard focus lost after opening sidebar / modal / reader"

**Cause:** a component set `outline: none` on a focus-visible state without a replacement. The global rule in Phase 2 should prevent this, but a new component might have overridden it locally.

**Diagnostic steps:**
1. Ask the user to reproduce the flow; note what they tabbed before focus disappeared.
2. In DevTools, reproduce the steps and watch `document.activeElement` in the Console.

**Fix:**
- Find the component that stole focus.
- Remove local `outline: none` without a matching replacement.
- If the component is a modal, ensure Tab is trapped inside and Escape returns focus to the triggering element.

**Related phases:** Phase 2 (`:focus-visible` consolidation), Phase 5.5 (AT keyboard pass).

---

## "Sidebar sort toggle doesn't seem to do anything"

**Cause:** the sort toggle may be firing but the section contents are filtered server-side or the user has an empty state.

**Diagnostic steps:**
1. Confirm the user has issues in their Continue Reading / Earlier Issues buckets at all.
2. Check the URL — sort mode persists via state.
3. DevTools → `tfa:v1:read:*` keys present?

**Fix:** most often the user has 0 started issues, so both "Latest" and "Biggest Shift" sort the same list. Not a bug.

---

## "View transition animation plays when I asked for reduced motion"

**Cause:** regression of the Phase 3 JS gate. `prefers-reduced-motion: reduce` should skip `document.startViewTransition`.

**Diagnostic steps:**
1. DevTools → Rendering → emulate `prefers-reduced-motion: reduce`.
2. Click an internal link.
3. If the crossfade still plays → the gate is broken.

**Fix:** check `src/layouts/Base.astro` — the click handler must check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` OR `document.documentElement.dataset.env === 'webview'` before calling `startViewTransition`.

**Related phases:** Phase 3 (view-transition JS gate), Phase 5 (reduced-motion).

---

## "In-app webview (Facebook / Instagram) renders badly"

**Diagnostic:** is `document.documentElement.dataset.env === 'webview'` in that environment? (Easiest: open the site via the webview, then tap "Open in browser" / "Open in Chrome" from the webview's menu and run `document.documentElement.dataset.env` in the DevTools console — no, wait, webviews don't expose DevTools. Easier: look at the User Agent string; it should contain `FBAN`, `FBAV`, `Instagram`, etc.)

**Fix paths:**
- Webview detected correctly → crossfade is disabled, storage-blocked banner appears if applicable. If layout still breaks, it's likely a component-specific webview issue — file with a UA string + screenshot.
- Webview NOT detected → add the UA to the regex in `Base.astro` / `[id].astro` inline script.

**Related phases:** Phase 8.5.

---

## "JS disabled — article is readable but sidebar doesn't work"

**Expected behavior.** The SSG article at `/issue/[id]` is fully readable without JS (Phase 8a). Sidebar interactivity (Continue Reading recognition, sort toggle, search, Reading Progress panel) all require JS.

**Fix path:** none — this is documented. Phase 8.5's JS-disabled acceptance criterion is the article's readability, not full sidebar functionality.

---

## "CSP violation reported from my browser"

**Diagnostic:**
1. Check the browser's Console for the specific violation message (script-src, style-src, img-src, etc.).
2. Check `report-uri` logs at `tfa-notify.4thangle.workers.dev/api/csp-report` if a recent violation was logged.

**Fix paths:**
- If it's a legitimate first-party script/style that's missing a hash → `scripts/build-csp-hashes.mjs` should have picked it up at build. Rebuild.
- If it's an injected extension script → CSP is working correctly by blocking it.
- If it's a third-party origin we need → update the CSP allowlist in the headers script.

**Related phases:** Phase 0 audit § K, Phase 7 selector hardening.

---

## Reporting new issues

If the report doesn't match any pattern above, collect:

1. **UA string:** `navigator.userAgent` from the user's DevTools.
2. **Device ID:** from the info menu → Reading Progress panel.
3. **DevTools console errors:** any red messages.
4. **Exported reading progress JSON** (no PII, just issue IDs + progress).
5. **Screenshots:** of the broken state.

File at `.github/issues/new` with the template. New patterns get added here after the third similar report.
