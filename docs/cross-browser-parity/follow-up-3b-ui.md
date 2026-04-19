# Phase 1 follow-up 3b — Reading Progress UI panel

**Branch:** `parity/phase-1-ui`
**Related:** Phase 1 (`src/lib/reading-state.ts` API), follow-up 3a (key rename + migration trigger).

## Why this PR exists

Phase 1 shipped the `exportAll` / `importAll` / `clearAll` / `ensureDeviceId` / `isStorageAvailable` APIs in `src/lib/reading-state.ts`, but no UI surfaces them. This PR adds the user-facing Reading Progress panel the brief specified.

## What ships

- **`src/components/ReadingProgressPanel.svelte`** — self-contained component that renders:
  - Device identifier display (from `ensureDeviceId`).
  - Storage status indicator ("Saving on this device" / "Not saving on this device").
  - **Export** button — downloads `tfa-reading-progress-<deviceId>-<date>.json`.
  - **Import…** button — opens a native file picker (styled via a visually-hidden `<input type="file">` paired with a real button).
  - **Clear on this device** button — with `window.confirm` guard.
  - A status line that announces `role="status" aria-live="polite"` updates after each action.
  - A short hint paragraph; if storage is unavailable, adds a line suggesting immediate export.

- **`src/pages/progress.astro`** — minimal standalone route at `/progress`. Mounts the panel with `client:idle`. Uses the existing `<UtilityHeader />` for consistency.

## Design notes

- **All tokens from Phase 2** — no hardcoded hex. Focus ring uses the global `:focus-visible` (Phase 2).
- **Logical properties** — `margin-inline-start`, `padding-inline-*`, `min-inline-size`, `min-block-size`. Ready for future RTL (Phase 3.5).
- **Native file picker** — keeps platform-standard UX (Phase 5.5 decision ledger). File input is visually hidden; a styled button triggers it via `fileInput.click()`.
- **No reading-state writes outside the API** — everything goes through `exportAll` / `importAll` / `clearAll` / `ensureDeviceId` / `isStorageAvailable` / `subscribe`. Passes the 3a storage-key guard trivially (no `tfa-*` literals anywhere in the component).
- **`translate="no"` on the device ID** — it's an opaque identifier, not prose (Phase 7).
- **Hydration:** `client:idle` on the page mount, since the panel is an enhancement over a readable static intro (Phase 8a / ADR-0003).

## Not in scope

- **Integrating the panel into the existing info menu / settings drawer.** The route exists at `/progress` and is linkable. Design integration (drawer vs modal vs route) is UI work that should follow a design decision — deliberately not rolled into this PR.
- **Import conflict-resolution UI.** The API's merge rules (completed beats started; max progress; latest ts for position; union for reactions) fire automatically; the status line reports `imported` / `skipped` counts. A future enhancement could surface conflicts for user review.

## CI gates

| Gate | Result |
|---|---|
| `npm run check` | 0 errors |
| `npm run lint` | 0 errors |
| `npm test` | 76 pass (no new tests — existing 25 reading-state tests cover the API) |
| `npm run build` | clean; stealth clean |

## Manual verification

1. Navigate to `/progress`.
2. Device identifier renders and is stable across refreshes.
3. Storage status shows "Saving on this device" (or "Not saving" in Safari private / Brave strict).
4. **Export:** downloads a `tfa-reading-progress-<deviceId>-<date>.json` file. Open in an editor — it contains `version: 1`, `exportedAt`, `deviceId`, `reads`, `reactions`, `position`, `angleCode`, `lastSync`, `notifications`, `dismissals`.
5. **Import:** pick the exported file → status line reports `imported N`. Re-pick same file → reports `skipped` (same or lower progress).
6. **Clear on this device:** confirm dialog → progress cleared; storage status stays correct.
7. Keyboard-only: Tab reaches every button; focus visible; Space/Enter triggers.

## Depends on

- Follow-up 3a (`parity/phase-1-state-consumers`) to be merged first so `reading-state.ts` is actually being used by consumers. If 3b merges before 3a, the panel works in isolation (operates on `tfa:v1:*` keys), but existing users with legacy `tfa-*` state won't have migrated yet.
