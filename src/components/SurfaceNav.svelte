<script lang="ts">
  interface Props {
    surfaceMode: 'today' | 'browse' | 'saved' | 'marked';
    savedCount?: number;
    markedCount?: number;
    variant?: 'inline' | 'sidebar';
    onGoToday?: () => void;
    onOpenBrowse?: () => void;
    onOpenSaved?: () => void;
    onOpenMarked?: () => void;
  }

  let {
    surfaceMode,
    savedCount = 0,
    markedCount = 0,
    variant = 'inline',
    onGoToday,
    onOpenBrowse,
    onOpenSaved,
    onOpenMarked,
  }: Props = $props();
</script>

<nav class="surface-nav" class:surface-nav--sidebar={variant === 'sidebar'} aria-label="Surface navigation">
  <button class="surface-button" class:surface-button--today={surfaceMode === 'today'} onclick={() => onGoToday?.()}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path></svg>
    <span>Today</span>
  </button>

  <button class="surface-button" class:surface-button--active={surfaceMode === 'browse'} onclick={() => onOpenBrowse?.()}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M9 20V10"></path></svg>
    <span>Browse</span>
  </button>

  <button class="surface-button" class:surface-button--saved={surfaceMode === 'saved'} onclick={() => onOpenSaved?.()}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
    <span>Saved</span>
    <span class="surface-badge" aria-label="{savedCount} saved issues">{savedCount}</span>
  </button>

  <button class="surface-button" class:surface-button--marked={surfaceMode === 'marked'} onclick={() => onOpenMarked?.()}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"></path></svg>
    <span>Marked</span>
    <span class="surface-badge surface-badge--critical" aria-label="{markedCount} marked issues">{markedCount}</span>
  </button>
</nav>

<style>
  .surface-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .surface-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.72);
    color: var(--text-secondary);
    cursor: pointer;
    transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.01em;
    box-shadow: 0 8px 18px rgba(17, 24, 39, 0.04);
  }

  .surface-button:hover {
    transform: translateY(-1px);
    background: var(--bg);
    border-color: var(--border-divider);
  }

  .surface-button--today {
    background: rgba(210, 140, 40, 0.12);
    border-color: rgba(210, 140, 40, 0.28);
    color: var(--score-warning);
  }

  .surface-button--active {
    background: var(--bg-sunken);
    border-color: var(--border-divider);
    color: var(--text-primary);
  }

  .surface-button--saved {
    color: var(--score-warning);
  }

  .surface-button--marked {
    color: var(--score-critical);
  }

  .surface-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    background: rgba(210, 140, 40, 0.12);
    color: inherit;
    font-size: 10px;
    font-weight: 800;
    line-height: 1;
  }

  .surface-badge--critical {
    background: rgba(224, 49, 49, 0.1);
  }

  .surface-nav--sidebar .surface-button {
    min-height: 36px;
    padding-inline: 12px;
    font-size: 11px;
    box-shadow: none;
  }

  @media (max-width: 767px) {
    .surface-nav {
      gap: 6px;
    }

    .surface-button {
      min-height: 36px;
      padding-inline: 12px;
      font-size: 11px;
    }
  }
</style>
