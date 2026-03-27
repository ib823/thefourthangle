# Complete User Flow Map — All Scenarios, All Devices

## How State Persists

The app stores all user state in browser **localStorage** via nanostores/persistent:

| Key | What it stores | Persistence |
|-----|---------------|------------|
| `tfa-read:{issueId}` | Per-issue read state: `{"state":"started","progress":3}` or `{"state":"completed","progress":6}` | Permanent until cleared |
| `tfa-reactions` | JSON map of issueId → array of card indices the user reacted to | Permanent |
| `tfa-pos` | Last position: `{"feedIssueId":"0142","cardIndex":3,"ts":1711500000000}` | Expires after 24 hours |

**No server. No account. All state is device-local and browser-local.**

---

## SCENARIO 1: First-Time User — Mobile Phone

### Step 1: Open the app
- User navigates to `thefourthangle.pages.dev/`
- **What loads**: HTML (SSR-rendered feed with all issue summaries), CSS, JS (36KB gzipped)
- **What they see**: Header with logo + tagline, then a vertical card stack (MobileBrowser)
- **Feed shows**: Top card fully visible, peek of next card behind, hint of third card
- **Cards show**: Headline, context paragraph, opinion shift bar + score, verdict dots, status badge (New/Updated), category
- **No login, no onboarding, no popup**

### Step 2: Browse the feed
- **Swipe up** on the card stack → current card exits upward with spring physics, next card springs into position
- **Swipe down** → go back to previous card
- **At top edge**: rubber band effect (Apple 0.55 constant) — card resists and snaps back
- **At bottom edge**: same rubber band
- **Keyboard**: ArrowDown/ArrowUp navigate, Enter opens
- **Read state visible**: Cards show "New", "Updated", "Exploring" (started), or "Covered" (completed) badges

### Step 3: Open an issue
- **Tap the card** → InsightReader opens as full-screen overlay
- **What happens technically**:
  1. `activeIssue` set to the feed summary
  2. `loadFullIssue(id)` fetches `/issues/{id}.json` (~1.4KB) — the full card text
  3. `history.pushState({reader: true})` — so browser back works
  4. `markStarted(id)` writes `{"state":"started","progress":1}` to localStorage
  5. `lockScroll()` — body scroll locked (iOS-safe position:fixed hack)
  6. Overlay enters with 300ms CSS keyframe (translateY + opacity)
  7. Focus moves to overlay
  8. aria-live announces "Card 1 of 6: What they said"
- **What they see**: Full-screen card with type pill ("What they said"), main text, sub text, progress bar, dot navigation, close button, save/share buttons
- **First time only**: "Swipe to continue" hint animates 3 times then fades

### Step 4: Read through 6 cards
- **Swipe left** → next card (spring-driven exit + enter animation)
- **Swipe right** → previous card
- **Tap dots** → jump to specific card
- **Keyboard**: ArrowLeft/ArrowRight, Escape to close
- **Each card change**:
  - `savePosition(issueId, cardIndex)` updates localStorage
  - `updateProgress(issueId, cardIndex + 1)` updates read state
  - aria-live announces "Card N of 6: {type label}"
  - Progress bar advances
  - Active dot grows, previous dot shrinks

**Card sequence**:
1. Hook ("What they said") — gray
2. Fact 1 ("What we found · {Lens}") — blue
3. Fact 2 ("What we found · {Lens}") — blue
4. Fact 3 ("What we found · {Lens}") — blue
5. Reframe ("The real question") — red
6. View ("The considered view") — purple

### Step 5: Complete an issue
- After swiping past card 6:
  - `markCompleted(issueId)` writes `{"state":"completed","progress":6}`
  - Completion screen shows: checkmark animation, "All 6 perspectives", takeaway quote
  - Trust summary: OpinionBar + VerdictBar (6-stage dots + neutrality score)
  - Buttons: "Share" + "Next topic" (or "Done" if last issue)
  - aria-live announces "All 6 perspectives read."

### Step 6: Share
- Tap "Share" → ShareModal slides up from bottom
  - Shows: preview card with headline + scores, 6 platform buttons (WhatsApp, Telegram, X, Facebook, LinkedIn, Threads), copy link, native share (mobile)
  - Focus trapped in modal
  - Escape or swipe down dismisses
  - Share text is platform-optimized (WhatsApp gets bold + URL last, Twitter gets character-limited)

### Step 7: Next issue or close
- "Next topic" → loads next issue in the reader (same overlay, new content)
- "Done" or close button or swipe down or Escape → reader closes
  - `unlockScroll()` restores body scroll
  - `history.back()` consumes the history entry
  - Focus returns to the feed card that opened the reader
  - Feed now shows the issue as "Covered" (green checkmark badge)

### Step 8: Close the app
- User closes the browser tab or switches away
- **State saved in localStorage**:
  - Which issues are started/completed (permanent)
  - Which cards were reacted to (permanent)
  - Last position: issueId + cardIndex + timestamp (24hr expiry)

### Step 9: Reopen the app (within 24 hours)
- User opens `thefourthangle.pages.dev/` again
- **What happens**:
  1. `getSavedPosition()` reads localStorage → finds `{feedIssueId: "0142", cardIndex: 3, ts: ...}`
  2. Timestamp is within 24 hours → position is valid
  3. `activeIssue` set to the saved issue
  4. `initialFeedIndex` set to the saved issue's position in the feed
  5. MobileBrowser starts at that feed position (card stack shows the saved issue on top)
  6. **If cardIndex > 0**: Reader auto-opens at the exact card they left off (e.g., card 3 of 6)
  7. **If cardIndex = 0**: Feed shows without auto-opening the reader (they had just selected an issue but hadn't started reading)
  8. Cards up to the restored position are marked as read (dots show progress)
  9. The `restoredCardIndex` is cleared after first use — subsequent issue opens start at card 1
- **Feed reflects read state**: Completed issues show "Covered", started issues show "Exploring"

### Step 10: Reopen the app (after 24 hours)
- `getSavedPosition()` returns null (expired)
- App starts fresh at feed position 0 (newest issue on top)
- All read states are still preserved (permanent)
- Feed still shows which issues are read/unread

---

## SCENARIO 2: First-Time User — Desktop/Laptop

### Step 1: Open the app
- **Layout**: Split-pane — 360px feed sidebar on left, reader area on right
- **Feed sidebar**: Scrollable list of all issues with headline, context snippet, opinion shift score, verdict dots, category, read status
- **Right pane**: Empty state — "Edition — March 2026", editorial quote, "~1842 min of reading remaining", "Select an issue from the feed"
- **Header**: Logo, tagline, About link, progress bar (colored segments per issue — green=completed, amber=started, gray=unread)

### Step 2: Browse the feed
- **Scroll** the feed sidebar (native browser scroll, 360px wide)
- **Search**: Click search input or press `/` or `Ctrl+K` → type to filter issues instantly
- **Sort**: Toggle between "Editorial" (default order) and "By topic" (grouped by category)
- **Keyboard**: `j`/`k` or ArrowDown/ArrowUp navigate, Enter opens
- **Hover**: Feed rows highlight on hover

### Step 3: Open an issue
- **Click a feed row** → DesktopReader appears in the right pane
  - Content appears with a subtle 150ms opacity fade
  - `loadFullIssue(id)` fetches card text
  - Feed row gets `aria-current` highlight + colored left border
  - aria-live announces "Now reading: {headline}"
  - Reader scrolls to top

### Step 4: Read through the issue
- **Scroll down** through the reader (native browser scroll)
- All 6 cards displayed as a continuous scroll with dividers between them
- Each card has: type pill, main text, sub text, save/react button
- At the bottom: completion marker, "Share this issue" button, "Copy for verification" link
- **IntersectionObserver**: When user scrolls past completion marker, issue is auto-marked completed

### Step 5: Navigate between issues
- **Click another feed row** → reader content swaps with opacity fade
- **Keyboard**: j/k while reader is open → switches to next/previous issue
- **Escape** → deselects issue, shows empty state

### Step 6: Close and reopen
- Same localStorage persistence as mobile
- On reopen: feed sidebar shows, no issue auto-selected (desktop uses explicit selection)
- Read states preserved

---

## SCENARIO 3: First-Time User — Tablet

### Step 1: Open the app
- **Portrait (768-1024px)**: 2-column grid of DesktopCards with search bar above
- **Landscape (1024px+)**: Same as desktop split-pane

### Step 2: Browse
- Scroll through grid of cards (native scroll)
- Cards have: headline, context, opinion shift, verdict dots, status badge, category

### Step 3: Open an issue
- Tap a card → InsightReader opens as full-screen overlay (same as mobile)
- Same 6-card swipe experience as mobile
- Same completion, share, next issue flow

### Step 4: Close and reopen
- Same persistence as mobile

---

## SCENARIO 4: Shared Link Entry

### Step 1: Receive a shared link
- Someone shares `thefourthangle.pages.dev/issue/0142` via WhatsApp/Telegram/Twitter
- Link preview shows: OG image (1200x630) with headline, verdict dots, opinion shift %, neutrality score

### Step 2: Open the link
- **What loads**: Issue page HTML (10.5KB, has full OG meta) + CSS + JS
- **What happens**:
  1. `initialIssueId = "0142"` passed as prop to App.svelte
  2. `feedData` is NOT inlined (issue pages are lightweight)
  3. On mount: `loadFeedIssues()` fetches feed summaries in background
  4. `loadAndOpenIssue("0142")` fetches the full issue JSON
  5. Reader opens immediately with the shared issue

### Step 3: Read the issue
- Same 6-card reading experience
- Same completion flow

### Step 4: After reading
- "Next topic" → opens next issue
- Close → sees the feed (feed data has loaded by now)
- Can browse other issues normally
- Is now a returning user with read state saved

---

## SCENARIO 5: Returning User — After Reading Several Issues

### What changes after 10+ completed issues
- **Personalized feed order**: `computeAffinity()` calculates per-lens affinity scores based on:
  - Completion rate per lens (Legal, Social, Economic, etc.)
  - Reaction rate (heart button taps per lens)
  - Recency weighting
- **Unread issues sorted by relevance**: Issues matching the user's lens preferences bubble up slightly (max 2-3 position shift)
- **Read issues pushed down**: Completed issues appear after unread
- **This is invisible to the user** — no UI indicator, no "for you" label

### Feed status indicators
- **Unread**: No badge, full-opacity headline
- **New** (first visit): Green "NEW" pill
- **Updated** (content revised): Blue "UPDATED" pill
- **Exploring** (started but not completed): Amber half-circle icon + "Exploring" label
- **Covered** (completed): Green checkmark icon + "Covered" label, dimmed headline

---

## SCENARIO 6: Screen Reader User

### Mobile (VoiceOver/TalkBack)
1. Feed cards have aria-label: "{headline}. Opinion Shift {score}. {status}."
2. Swipe through feed using VO gestures or TalkBack explore-by-touch
3. Tap to open reader → VO announces "Reading: {headline}, dialog"
4. Swipe through cards → aria-live announces "Card N of 6: {type}"
5. Share modal → VO announces "Share {headline}, dialog", focus trapped
6. Completion → announces "All 6 perspectives read."

### Desktop (NVDA/VoiceOver)
1. Feed is `role="listbox"` with `role="option"` items
2. Arrow keys navigate, Enter opens
3. Reader content changes → aria-live announces "Now reading: {headline}"
4. VerdictBar dots: each has `role="img"` with label "Analysis: 88/100 — Reviewed"
5. OpinionBar: `role="meter"` with aria-valuenow

### Reduced Motion
1. All CSS animations/transitions → 0.01ms duration
2. Spring animations → instant resolve to target
3. Stagger delays → 0
4. Full functionality preserved — only motion is removed

---

## SCENARIO 7: Keyboard-Only Desktop User

1. Tab → focuses feed items (roving tabindex: ArrowUp/Down within feed)
2. Enter → opens issue in reader
3. j/k → navigate between issues
4. / → focus search
5. Escape → close search or deselect issue
6. When share modal opens: Tab cycles within modal, Escape closes
7. All focus rings visible (amber box-shadow)

---

## SCENARIO 8: Low-End Android on Slow Network

1. Page loads → SSR content renders immediately (no JS needed for first paint)
2. JS (36KB gzipped) hydrates the page
3. `getAnimationTier()` → likely Tier 2 or 3 (low hardwareConcurrency/deviceMemory)
4. Tier 2: backdrop-filter disabled, box-shadows simplified
5. Tier 3: backdrop-filter disabled
6. Spring animations still run but may drop frames on very low-end devices
7. Card text fetches are 1.4KB each — fast even on 3G
8. Service worker caches assets after first load → faster on repeat visits

---

## SCENARIO 9: PWA / Home Screen Install

1. User adds to home screen → manifest.json provides: standalone display, portrait orientation, "The Fourth Angle" name, 192x512 icons
2. Opens from home screen → standalone mode (no browser chrome)
3. Safe areas respected: `env(safe-area-inset-*)` padding on overlay, header, dots
4. Service worker: network-first for HTML, cache-first for /_a/ assets and /fonts/
5. Offline: previously cached pages available, uncached pages show browser offline message

---

## SCENARIO 10: User Opens About / Disclaimer Pages

1. Click "About" link → full page navigation to /about
2. **View Transitions API** provides a 150ms crossfade (Chrome 111+, progressive enhancement)
3. About page: methodology, 6-stage editorial process, verdict bar explanation, opinion shift explanation, verification links, contact
4. Click "Back" → crossfade back to feed, state fully preserved (scroll position, selected issue, read states)
5. Disclaimer page: same pattern, 18-section legal notice

---

## STATE LIFECYCLE SUMMARY

```
FIRST VISIT          READING              BETWEEN SESSIONS      RETURN VISIT
─────────────        ─────────────        ─────────────         ─────────────
No localStorage      tfa-read:{id}        All tfa-read:* keys   getSavedPosition()
feedData from SSR      = started/progress   persist forever       → restore if < 24h
No activeIssue       tfa-pos = {id,card}  tfa-reactions persist  Feed shows read state
Feed at position 0   tfa-reactions += []  tfa-pos expires 24h    Personalized if 10+ read
```

---

## WHAT DOES NOT PERSIST

| Thing | Why |
|-------|-----|
| Feed scroll position | Browser handles natively; not stored |
| Search query | Cleared on page load |
| Sort mode (Editorial/Topic) | Resets to Editorial |
| Reader card scroll position | Not stored — only card index |
| Active issue on desktop | Not auto-opened on return |
| View mode (mobile/tablet/desktop) | Recalculated from viewport width |
| Animation tier | Recalculated from hardware on each mount |
| Share modal state | Ephemeral — closes when dismissed |
