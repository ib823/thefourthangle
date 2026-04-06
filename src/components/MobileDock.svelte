<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    surfaceMode: 'today' | 'library';
    libraryCount?: number;
    onGoToday?: () => void;
    onOpenLibrary?: () => void;
    syncLinked?: boolean;
    onSyncTap?: () => void;
    showInstall?: boolean;
    installIsIOS?: boolean;
    onInstallTap?: () => void;
    onInstallDismiss?: () => void;
  }

  let {
    surfaceMode,
    libraryCount = 0,
    onGoToday,
    onOpenLibrary,
    syncLinked = false,
    onSyncTap,
    showInstall = false,
    installIsIOS = false,
    onInstallTap,
    onInstallDismiss,
  }: Props = $props();

  // Sync prompt: 7-day dismissal, never when linked or standalone
  const SYNC_DISMISS_KEY = 'tfa-sync-prompt-dismissed';
  const SYNC_COOLDOWN = 7 * 24 * 60 * 60 * 1000;

  let syncDismissed = $state(false);
  let isStandalone = $state(false);

  // Animation states
  let syncVisible = $state(false);
  let installVisible = $state(false);
  let syncLeaving = $state(false);
  let installLeaving = $state(false);

  onMount(() => {
    isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const dismissedAt = localStorage.getItem(SYNC_DISMISS_KEY);
    syncDismissed = !!dismissedAt && Date.now() - parseInt(dismissedAt) < SYNC_COOLDOWN;

    // Stagger entrance animations
    requestAnimationFrame(() => {
      syncVisible = true;
      installVisible = true;
    });
  });

  let showSyncCard = $derived(!syncLinked && !syncDismissed && !isStandalone);
  let showInstallCard = $derived(showInstall && !isStandalone);

  function dismissSync() {
    syncLeaving = true;
    setTimeout(() => {
      syncDismissed = true;
      localStorage.setItem(SYNC_DISMISS_KEY, String(Date.now()));
      syncLeaving = false;
    }, 200);
  }

  function dismissInstallCard() {
    installLeaving = true;
    setTimeout(() => {
      onInstallDismiss?.();
      installLeaving = false;
    }, 200);
  }

  function handleInstallTap() {
    if (installIsIOS) {
      // iOS: open a guide sheet — delegate to parent
      onInstallTap?.();
    } else {
      onInstallTap?.();
    }
  }
</script>

<div class="dock-container">
  {#if showSyncCard || showInstallCard}
    <div class="dock-prompts">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      {#if showInstallCard}
        <div
          class="dock-prompt-card"
          class:dock-prompt-card--visible={installVisible && !installLeaving}
          class:dock-prompt-card--leaving={installLeaving}
          onclick={handleInstallTap}
          role="button"
          tabindex="0"
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleInstallTap(); } }}
          aria-label={installIsIOS ? 'Add to your home screen' : 'Install for quick access'}
        >
          <svg class="dock-prompt-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span class="dock-prompt-text">{installIsIOS ? 'Add to your home screen' : 'Install for quick access'}</span>
          <button
            class="dock-prompt-dismiss"
            onclick={(e: MouseEvent) => { e.stopPropagation(); dismissInstallCard(); }}
            aria-label="Dismiss install prompt"
          >&times;</button>
        </div>
      {/if}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      {#if showSyncCard}
        <div
          class="dock-prompt-card"
          class:dock-prompt-card--visible={syncVisible && !syncLeaving}
          class:dock-prompt-card--leaving={syncLeaving}
          onclick={() => onSyncTap?.()}
          role="button"
          tabindex="0"
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSyncTap?.(); } }}
          aria-label="Sync your reading across devices"
        >
          <svg class="dock-prompt-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span class="dock-prompt-text">Sync your reading across devices</span>
          <button
            class="dock-prompt-dismiss"
            onclick={(e: MouseEvent) => { e.stopPropagation(); dismissSync(); }}
            aria-label="Dismiss sync prompt"
          >&times;</button>
        </div>
      {/if}
    </div>
  {/if}

  <nav class="mobile-dock" aria-label="Primary navigation">
    <button class="dock-item" class:dock-item--active={surfaceMode === 'today'} onclick={() => onGoToday?.()} aria-current={surfaceMode === 'today' ? 'page' : undefined}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path></svg>
      <span>Today</span>
    </button>
    <button class="dock-item" class:dock-item--active={surfaceMode === 'library'} onclick={() => onOpenLibrary?.()} aria-current={surfaceMode === 'library' ? 'page' : undefined}>
      <div class="dock-icon-wrap">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H20v15.5A2.5 2.5 0 0 0 17.5 16H3z"></path><path d="M20 18.5A2.5 2.5 0 0 1 17.5 21H6a3 3 0 0 1-3-3V5.5"></path></svg>
        {#if libraryCount > 0}
          <span class="dock-badge">{libraryCount > 9 ? '9+' : libraryCount}</span>
        {/if}
      </div>
      <span>Library</span>
    </button>
  </nav>
</div>

<style>
  .dock-container {
    position: sticky;
    bottom: 0;
    z-index: 15;
    flex-shrink: 0;
    margin-top: auto;
  }

  /* ── Prompt cards area ── */
  .dock-prompts {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0 14px;
    background:
      linear-gradient(180deg, rgba(248, 249, 250, 0.72) 0%, rgba(255, 255, 255, 0.96) 100%);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  .dock-prompt-card {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 14px;
    background: none;
    border: none;
    border-top: 1px solid rgba(17, 24, 39, 0.06);
    border-radius: 0;
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 300ms ease-out, transform 300ms ease-out;
  }

  .dock-prompt-card:first-child {
    border-top-left-radius: var(--radius-lg);
    border-top-right-radius: var(--radius-lg);
  }

  .dock-prompt-card--visible {
    opacity: 1;
    transform: translateY(0);
  }

  .dock-prompt-card--leaving {
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 200ms ease-out, transform 200ms ease-out;
  }

  .dock-prompt-icon {
    color: var(--text-tertiary);
    flex-shrink: 0;
  }

  .dock-prompt-text {
    flex: 1;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-secondary);
    line-height: 1.3;
  }

  .dock-prompt-dismiss {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    color: var(--text-muted);
    font-size: var(--text-body);
    line-height: 1;
    min-width: 32px;
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .dock-prompt-dismiss:hover {
    background: var(--bg-sunken);
  }

  /* ── Dock navigation ── */
  .mobile-dock {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    min-height: calc(78px + env(safe-area-inset-bottom, 0px));
    padding: 10px 14px max(14px, calc(10px + env(safe-area-inset-bottom, 0px)));
    border-top: 1px solid rgba(17, 24, 39, 0.08);
    background:
      linear-gradient(180deg, rgba(248, 249, 250, 0.72) 0%, rgba(255, 255, 255, 0.96) 100%);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 -12px 30px rgba(17, 24, 39, 0.08);
  }

  .dock-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 58px;
    border: none;
    border-radius: var(--radius-lg);
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    font: inherit;
    font-size: var(--text-xs);
    font-weight: 700;
    transition: background 0.2s ease-out, color 0.2s ease-out, transform 0.2s ease-out;
  }

  .dock-item--active {
    background: rgba(255, 255, 255, 0.9);
    color: var(--text-primary);
    box-shadow: 0 10px 22px rgba(17, 24, 39, 0.08);
  }

  .dock-icon-wrap {
    position: relative;
    display: inline-flex;
  }

  .dock-badge {
    position: absolute;
    top: -6px;
    right: -10px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: var(--radius-pill);
    background: rgba(210, 140, 40, 0.12);
    color: var(--score-warning);
    font-size: var(--text-micro);
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* Landscape: compact dock to reclaim vertical space */
  @media (orientation: landscape) and (max-height: 500px) {
    .mobile-dock {
      min-height: calc(54px + env(safe-area-inset-bottom, 0px));
      padding: 6px 14px max(8px, calc(6px + env(safe-area-inset-bottom, 0px)));
    }
    .dock-item {
      min-height: 42px;
      gap: 2px;
    }
    .dock-item span {
      font-size: 0.5625rem;
    }
    .dock-prompts { display: none; }
  }

  @media (max-width: 480px) {
    .dock-prompts { padding: 0 12px; }
  }

  @media (prefers-color-scheme: dark) {
    .dock-prompts {
      background: linear-gradient(180deg, rgba(20, 19, 18, 0.78) 0%, rgba(20, 19, 18, 0.98) 100%);
    }
    .dock-prompt-card {
      border-top-color: rgba(255, 255, 255, 0.08);
    }
    .mobile-dock {
      background: linear-gradient(180deg, rgba(20, 19, 18, 0.78) 0%, rgba(20, 19, 18, 0.98) 100%);
      border-top-color: rgba(255, 255, 255, 0.08);
      box-shadow: 0 -18px 34px rgba(0, 0, 0, 0.28);
    }
    .dock-item--active {
      background: rgba(200, 150, 58, 0.14);
      box-shadow: 0 10px 22px rgba(0, 0, 0, 0.22);
    }
  }
</style>
