<script lang="ts">
  interface Props {
    surfaceMode: 'today' | 'browse' | 'saved' | 'marked';
    savedCount?: number;
    markedCount?: number;
    onGoToday?: () => void;
    onOpenBrowse?: () => void;
    onOpenSaved?: () => void;
    onOpenMarked?: () => void;
  }

  let {
    surfaceMode,
    savedCount = 0,
    markedCount = 0,
    onGoToday,
    onOpenBrowse,
    onOpenSaved,
    onOpenMarked,
  }: Props = $props();
</script>

<nav class="mobile-dock" aria-label="Primary navigation">
  <button class="dock-item" class:dock-item--active={surfaceMode === 'today'} onclick={() => onGoToday?.()}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path></svg>
    <span>Today</span>
  </button>
  <button class="dock-item" class:dock-item--active={surfaceMode === 'browse'} onclick={() => onOpenBrowse?.()}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M9 20V10"></path></svg>
    <span>Browse</span>
  </button>
  <button class="dock-item" class:dock-item--active={surfaceMode === 'saved'} onclick={() => onOpenSaved?.()}>
    <div class="dock-icon-wrap">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      {#if savedCount > 0}
        <span class="dock-badge">{savedCount > 9 ? '9+' : savedCount}</span>
      {/if}
    </div>
    <span>Saved</span>
  </button>
  <button class="dock-item" class:dock-item--active={surfaceMode === 'marked'} onclick={() => onOpenMarked?.()}>
    <div class="dock-icon-wrap">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"></path></svg>
      {#if markedCount > 0}
        <span class="dock-badge dock-badge--critical">{markedCount > 9 ? '9+' : markedCount}</span>
      {/if}
    </div>
    <span>Marked</span>
  </button>
</nav>

<style>
  .mobile-dock {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid rgba(17, 24, 39, 0.08);
    background:
      linear-gradient(180deg, rgba(248, 249, 250, 0.72) 0%, rgba(255, 255, 255, 0.96) 100%);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    flex-shrink: 0;
  }

  .dock-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 58px;
    border: none;
    border-radius: 16px;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
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
    border-radius: 999px;
    background: rgba(210, 140, 40, 0.12);
    color: var(--score-warning);
    font-size: 9px;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .dock-badge--critical {
    background: rgba(224, 49, 49, 0.1);
    color: var(--score-critical);
  }

  @media (prefers-color-scheme: dark) {
    .mobile-dock {
      background: linear-gradient(180deg, rgba(26, 26, 26, 0.72) 0%, rgba(26, 26, 26, 0.96) 100%);
      border-top-color: rgba(255, 255, 255, 0.06);
    }

    .dock-item--active {
      background: rgba(61, 56, 48, 0.82);
    }
  }
</style>
