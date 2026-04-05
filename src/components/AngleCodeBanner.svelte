<script lang="ts">
  import { isLinked, getAngleCode, getLastSyncTime, onSyncChange } from '../lib/sync';
  import { onDestroy } from 'svelte';

  interface Props {
    onTap: () => void;
  }

  let { onTap }: Props = $props();

  let linked = $state(isLinked());
  let code = $state(getAngleCode() || '');
  let lastSync = $state(getLastSyncTime());

  function refresh() {
    linked = isLinked();
    code = getAngleCode() || '';
    lastSync = getLastSyncTime();
  }

  // Listen for sync state changes (link/unlink/sync)
  const unsubSync = onSyncChange(refresh);
  onDestroy(unsubSync);

  // Also refresh on storage events (cross-tab unlink)
  $effect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'tfa-angle-code') refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  });

  function syncDot(): string {
    if (!lastSync) return 'var(--text-muted)';
    const diff = Date.now() - lastSync;
    if (diff < 5 * 60_000) return 'var(--status-green)';
    return 'var(--score-warning)';
  }
</script>

<button class="angle-banner" onclick={onTap} aria-label={linked ? `Angle Code: ${code}` : 'Set up cross-device sync'}>
  {#if linked}
    <div class="banner-dot" style="background:{syncDot()};"></div>
    <span class="banner-code">{code}</span>
    <span class="banner-label">Synced</span>
  {:else}
    <svg class="banner-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
    <span class="banner-label">Sync across devices</span>
    <svg class="banner-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
  {/if}
</button>

<style>
  .angle-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    background: var(--bg-elevated);
    cursor: pointer;
    transition: background 0.15s;
    text-align: left;
  }

  .angle-banner:hover {
    background: var(--bg-sunken);
  }

  .banner-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .banner-code {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--text-primary);
  }

  .banner-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
    flex: 1;
  }

  .banner-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .banner-chevron {
    color: var(--text-muted);
    flex-shrink: 0;
  }
</style>
