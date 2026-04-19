# Phase 1 follow-up 3a — Consumer migration to `tfa:v1:*` keys

**Branch:** `parity/phase-1-state-consumers`
**Related:** Phase 1 (`src/lib/reading-state.ts` introduced the API and migration).

## Why this PR exists

Phase 1 shipped `reading-state.ts` with a one-shot `migrate()` that copies legacy `tfa-*` keys to `tfa:v1:*`. But no consumer imported from `reading-state.ts`, so `migrate()` **never ran** — it was dead code. Consumers kept reading and writing the legacy `tfa-*` keys directly.

This PR:

1. Renames every consumer's localStorage key from `tfa-*` to `tfa:v1:*`.
2. Imports `migrate` into `App.svelte`'s `onMount` so the migration actually fires on boot, copying any legacy state a user already has into the new namespace.
3. Adds a CI guard (`scripts/check-storage-keys.mjs`) that fails the build if a future PR reintroduces a legacy `tfa-<name>` literal outside the allowed files.

## Files touched

### Library + store files
- `src/lib/sync.ts` — `TOKEN_KEY`, `LAST_SYNC_KEY`, `DEVICE_ID_KEY` constants + `tfa-pos` setter on remote pull.
- `src/stores/reader.ts` — `persistentMap('tfa-read:', …)` → `persistentMap('tfa:v1:read:', …)`; `persistentAtom('tfa-reactions', …)` → `'tfa:v1:reactions'`; `persistentAtom('tfa-pos', …)` → `'tfa:v1:pos'`.
- `src/stores/notifications.ts` — `STORAGE_KEY`.
- `src/lib/install-state.ts` — `DISMISS_KEY`.

### Components
- `src/components/App.svelte` — `tfa-sync-banner-dismissed`, `tfa-push-endpoint`.
- `src/components/TodayView.svelte` — `tfa-welcome-dismissed`.
- `src/components/MobileDock.svelte` — `tfa-sync-prompt-dismissed`.
- `src/components/InstallPrompt.svelte` — `tfa-install-dismissed`.
- `src/components/PushPrompt.svelte` — `tfa-push-subscribed`, `tfa-push-dismissed`, `tfa-push-endpoint`, `tfa-read:` prefix scan.
- `src/components/NotificationBell.svelte` — `tfa-push-subscribed`, `tfa-push-endpoint`.
- `src/components/AngleCodeBanner.svelte` — `StorageEvent.key` match for cross-tab sync.

### Migration trigger
- `src/components/App.svelte` — `onMount` imports `migrate` from `reading-state` and calls it as the first step. Wrapped in try/catch so a storage-blocked environment doesn't break mount.

## Intentionally NOT migrated

- **sessionStorage keys** (`tfa-cinema-dismissed`, `tfa-sw-build`) — session-scoped, regenerate naturally; no persistence issue. Left as `tfa-*`.
- **Cloudflare Worker service names** (`tfa-notify`, `tfa-sync` in `wrangler.toml`) — these are infrastructure identifiers, not storage keys.

## CI guard

`scripts/check-storage-keys.mjs` greps `src/` for `'tfa-<name>'` literals. Allowed files:
- `src/lib/reading-state.ts` (the `LEGACY_KEYS` source of truth + `V1_KEYS` mapping)
- `src/lib/__tests__/reading-state.test.ts` (migration tests exercise legacy → v1)

sessionStorage literals are detected and skipped by regex (matches `sessionStorage` in the line).

Wired into `npm run build` right after `check-font-budget`. Exposed as `npm run check-storage-keys`.

## Migration behaviour on existing users

On the first page load after this PR deploys:

1. User navigates to `/` or `/issue/[id]`.
2. `App.svelte` hydrates (via `client:load` for home, `client:idle` for issue).
3. Its `onMount` calls `migrate()`.
4. `migrate()` reads the sentinel `tfa:v1:migrated` — absent.
5. It iterates all 14 scalar legacy keys, the `tfa-read:*` prefix (one physical key per started/completed issue), and copies each to the `tfa:v1:*` form.
6. Legacy keys deleted after successful copy.
7. Sentinel `tfa:v1:migrated` set to `'1'`.
8. On every subsequent boot, sentinel is present — `migrate()` is a no-op.

Users who clear site data after this PR has run once: migration re-fires (sentinel cleared with the rest) — safe.

Users who were created after this PR: never had legacy keys; `migrate()` finds nothing to migrate, writes sentinel, done.

## Acceptance

- `npm run check` → 0 errors
- `npm run lint` → 0 errors
- `npm test` → 76 pass (25 migration tests unchanged)
- `npm run check-storage-keys` → OK
- `npm run build` → clean; stealth clean; hash count unchanged
- Manual: seed `tfa-angle-code=ABC123` + `tfa-read:0001={...}` in localStorage, reload, verify `tfa:v1:angle-code` and `tfa:v1:read:0001` present + legacy absent, then reload again and verify no migration churn.
