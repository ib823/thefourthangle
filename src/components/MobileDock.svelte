<script lang="ts">
  interface Props {
    surfaceMode: 'today' | 'library';
    libraryCount?: number;
    onGoToday?: () => void;
    onOpenLibrary?: () => void;
  }

  let {
    surfaceMode,
    libraryCount = 0,
    onGoToday,
    onOpenLibrary,
  }: Props = $props();
</script>

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

<style>
  .mobile-dock {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    min-height: calc(78px + env(safe-area-inset-bottom, 0px));
    padding: 10px 14px max(14px, calc(10px + env(safe-area-inset-bottom, 0px)));
    margin-top: auto;
    border-top: 1px solid rgba(17, 24, 39, 0.08);
    background:
      linear-gradient(180deg, rgba(248, 249, 250, 0.72) 0%, rgba(255, 255, 255, 0.96) 100%);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    position: sticky;
    bottom: 0;
    z-index: 15;
    box-shadow: 0 -12px 30px rgba(17, 24, 39, 0.08);
    flex-shrink: 0;
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
  }

  @media (prefers-color-scheme: dark) {
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
