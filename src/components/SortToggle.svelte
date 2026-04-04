<script lang="ts">
  import type { SortMode } from '../lib/feed-sections';

  interface Props {
    sortMode: SortMode;
    variant?: 'inline' | 'sidebar';
    panelId?: string;
    idPrefix?: string;
    onChange?: (mode: SortMode) => void;
  }

  let { sortMode, variant = 'inline', panelId, idPrefix = 'issue-sort', onChange }: Props = $props();

  function activate(mode: SortMode) {
    onChange?.(mode);
  }

  function onKeyDown(event: KeyboardEvent, mode: SortMode) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    if (event.key === 'Home') {
      activate('latest');
      return;
    }
    if (event.key === 'End') {
      activate('shift');
      return;
    }
    activate(mode === 'latest' ? 'shift' : 'latest');
  }
</script>

<div
  class="sort-toggle"
  class:sort-toggle--sidebar={variant === 'sidebar'}
  role="tablist"
  aria-label="Issue sorting"
  style={`--sort-index:${sortMode === 'shift' ? 1 : 0};`}
>
  <button class="sort-chip" class:sort-chip--active={sortMode === 'latest'} id={`${idPrefix}-latest`} onclick={() => activate('latest')} onkeydown={(event) => onKeyDown(event, 'latest')} role="tab" tabindex={sortMode === 'latest' ? 0 : -1} aria-selected={sortMode === 'latest'} aria-controls={panelId}>
    Latest
  </button>
  <button class="sort-chip" class:sort-chip--active={sortMode === 'shift'} id={`${idPrefix}-shift`} onclick={() => activate('shift')} onkeydown={(event) => onKeyDown(event, 'shift')} role="tab" tabindex={sortMode === 'shift' ? 0 : -1} aria-selected={sortMode === 'shift'} aria-controls={panelId}>
    Biggest Shift
  </button>
</div>

<style>
  .sort-toggle {
    position: relative;
    display: inline-grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: center;
    padding: 4px;
    border-radius: var(--radius-pill);
    background: rgba(255, 255, 255, 0.74);
    border: 1px solid var(--border-subtle);
    box-shadow: 0 8px 18px rgba(17, 24, 39, 0.04);
    isolation: isolate;
  }

  .sort-toggle::before {
    content: '';
    position: absolute;
    inset: 4px auto 4px 4px;
    width: calc(50% - 4px);
    border-radius: var(--radius-pill);
    background: var(--bg-sunken);
    box-shadow: 0 10px 24px rgba(17, 24, 39, 0.08);
    transform: translate3d(calc(var(--sort-index, 0) * 100%), 0, 0);
    transition:
      transform 420ms cubic-bezier(0.2, 0.85, 0.2, 1),
      background 180ms ease,
      box-shadow 180ms ease;
    will-change: transform;
    z-index: 0;
  }

  .sort-chip {
    position: relative;
    z-index: 1;
    min-height: 44px;
    min-width: 0;
    padding: 0 16px;
    border: none;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 700;
    transition: color 180ms ease, transform 180ms ease;
  }

  @media (hover: hover) {
    .sort-chip:hover {
      transform: translateY(-1px);
      color: var(--text-primary);
    }
  }

  .sort-chip--active {
    background: transparent;
    color: var(--text-primary);
  }

  .sort-toggle--sidebar {
    box-shadow: none;
  }

  .sort-toggle--sidebar .sort-chip {
    min-height: 44px;
    font-size: var(--text-xs);
    padding-inline: 12px;
  }

  @media (prefers-color-scheme: dark) {
    .sort-toggle {
      background: rgba(34, 31, 27, 0.9);
      border-color: var(--border-divider);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.24);
    }

    .sort-toggle::before {
      background: rgba(200, 150, 58, 0.14);
      box-shadow: 0 12px 26px rgba(0, 0, 0, 0.26);
    }

    .sort-chip {
      color: var(--text-muted);
    }

    .sort-chip--active {
      background: transparent;
      color: var(--text-primary);
    }
  }
</style>
