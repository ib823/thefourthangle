<script lang="ts">
  /**
   * Phase 8.5 — storage-blocked banner.
   *
   * Listens for the `tfa:storage-unavailable` event emitted by
   * src/lib/reading-state.ts when the first localStorage.setItem probe
   * throws (Safari private mode, Brave aggressive Shields, partitioned
   * storage in cross-origin iframes, some enterprise Edge lockdowns).
   *
   * The banner is a single dismissable line. Since nothing persists in
   * this mode, the dismissal state itself is in-memory only — a refresh
   * re-shows the banner (expected: the user already knows).
   *
   * Import-only component. Mount once near the top of the app shell.
   */
  import { isStorageAvailable } from '../lib/reading-state';
  import { onMount } from 'svelte';

  let visible = $state(false);
  let dismissed = $state(false);

  function onUnavailable() {
    if (!dismissed) visible = true;
  }

  onMount(() => {
    // Check once on mount — the reading-state module probes on first access.
    // If probe already happened before this mount, the event won't fire again,
    // so we query the cached state here.
    if (!isStorageAvailable() && !dismissed) {
      visible = true;
    }
    window.addEventListener('tfa:storage-unavailable', onUnavailable);
    return () => window.removeEventListener('tfa:storage-unavailable', onUnavailable);
  });

  function dismiss() {
    dismissed = true;
    visible = false;
  }
</script>

{#if visible}
  <div
    class="storage-banner"
    role="status"
    aria-live="polite"
    data-testid="storage-blocked-banner"
  >
    <span>Reading progress isn't being saved in this browser. Export manually or open in another browser.</span>
    <button type="button" onclick={dismiss} aria-label="Dismiss storage warning">&times;</button>
  </div>
{/if}

<style>
  .storage-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    padding-inline-start: max(16px, env(safe-area-inset-left));
    padding-inline-end: max(16px, env(safe-area-inset-right));
    background: var(--status-red-bg, #FFF5F5);
    color: var(--text-primary, #212529);
    border-block-end: 1px solid var(--status-red-border, #FFC9C9);
    font-size: var(--text-sm, 0.75rem);
    line-height: 1.45;
    position: sticky;
    top: 0;
    z-index: var(--z-toast, 5000);
  }
  .storage-banner span {
    flex: 1;
  }
  .storage-banner button {
    all: unset;
    width: 28px;
    height: 28px;
    min-width: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    cursor: pointer;
    color: var(--text-secondary, #495057);
    font-size: 18px;
    line-height: 1;
  }
  .storage-banner button:hover,
  .storage-banner button:focus-visible {
    background: rgba(0, 0, 0, 0.06);
  }
  @media (prefers-color-scheme: dark) {
    .storage-banner button:hover,
    .storage-banner button:focus-visible {
      background: rgba(255, 255, 255, 0.08);
    }
  }
</style>
