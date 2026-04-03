<script lang="ts">
  interface Props {
    surfaceMode: 'today' | 'library';
    libraryCount?: number;
    variant?: 'inline' | 'sidebar';
    onGoToday?: () => void;
    onOpenLibrary?: () => void;
  }

  let {
    surfaceMode,
    libraryCount = 0,
    variant = 'inline',
    onGoToday,
    onOpenLibrary,
  }: Props = $props();
</script>

<nav class="surface-nav" class:surface-nav--sidebar={variant === 'sidebar'} aria-label="Main navigation">
  <button class="surface-button" class:surface-button--today={surfaceMode === 'today'} onclick={() => onGoToday?.()} aria-current={surfaceMode === 'today' ? 'page' : undefined}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path></svg>
    <span>Today</span>
  </button>

  <button class="surface-button" class:surface-button--library={surfaceMode === 'library'} onclick={() => onOpenLibrary?.()} aria-current={surfaceMode === 'library' ? 'page' : undefined}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H20v15.5A2.5 2.5 0 0 0 17.5 16H3z"></path><path d="M20 18.5A2.5 2.5 0 0 1 17.5 21H6a3 3 0 0 1-3-3V5.5"></path></svg>
    <span>Library</span>
    <span class="surface-badge" aria-label={`${libraryCount} items in your library`}>{libraryCount}</span>
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
    min-height: 44px;
    padding: 0 14px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.72);
    color: var(--text-secondary);
    cursor: pointer;
    transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 700;
    letter-spacing: 0.01em;
    box-shadow: 0 8px 18px rgba(17, 24, 39, 0.04);
  }

  .surface-button:hover {
    transform: translateY(-1px);
    background: var(--bg);
    border-color: var(--border-divider);
  }

  .surface-button[aria-current='page'] {
    background: var(--bg-sunken);
    border-color: var(--border-divider);
    box-shadow: 0 10px 22px rgba(17, 24, 39, 0.08);
  }

  .surface-button--today {
    background: rgba(210, 140, 40, 0.12);
    border-color: rgba(210, 140, 40, 0.28);
    color: var(--score-warning);
  }

  .surface-button--library {
    color: var(--score-warning);
  }

  .surface-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: rgba(210, 140, 40, 0.12);
    color: inherit;
    font-size: var(--text-micro);
    font-weight: 700;
    line-height: 1;
  }

  .surface-nav--sidebar .surface-button {
    min-height: 44px;
    padding-inline: 12px;
    font-size: var(--text-xs);
    box-shadow: none;
  }

  @media (max-width: 767px) {
    .surface-nav {
      gap: 6px;
    }

    .surface-button {
      min-height: 44px;
      padding-inline: 12px;
      font-size: var(--text-xs);
    }
  }

  @media (prefers-color-scheme: dark) {
    .surface-button {
      background: rgba(34, 31, 27, 0.9);
      border-color: var(--border-divider);
      color: var(--text-secondary);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.24);
    }

    .surface-button:hover {
      background: rgba(41, 37, 32, 0.98);
    }

    .surface-button[aria-current='page'] {
      background: rgba(200, 150, 58, 0.14);
      border-color: rgba(200, 150, 58, 0.3);
      color: var(--text-primary);
    }

    .surface-button--today {
      background: rgba(200, 150, 58, 0.16);
      border-color: rgba(200, 150, 58, 0.34);
      color: var(--score-warning);
    }

    .surface-badge {
      background: rgba(200, 150, 58, 0.16);
    }

  }
</style>
