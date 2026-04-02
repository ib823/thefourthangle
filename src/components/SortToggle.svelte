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

<div class="sort-toggle" class:sort-toggle--sidebar={variant === 'sidebar'} role="tablist" aria-label="Issue sorting">
  <button class="sort-chip" class:sort-chip--active={sortMode === 'latest'} id={`${idPrefix}-latest`} onclick={() => activate('latest')} onkeydown={(event) => onKeyDown(event, 'latest')} role="tab" tabindex={sortMode === 'latest' ? 0 : -1} aria-selected={sortMode === 'latest'} aria-controls={panelId}>
    Latest
  </button>
  <button class="sort-chip" class:sort-chip--active={sortMode === 'shift'} id={`${idPrefix}-shift`} onclick={() => activate('shift')} onkeydown={(event) => onKeyDown(event, 'shift')} role="tab" tabindex={sortMode === 'shift' ? 0 : -1} aria-selected={sortMode === 'shift'} aria-controls={panelId}>
    Most Hidden
  </button>
</div>

<style>
  .sort-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.74);
    border: 1px solid var(--border-subtle);
    box-shadow: 0 8px 18px rgba(17, 24, 39, 0.04);
  }

  .sort-chip {
    min-height: 32px;
    padding: 0 12px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
  }

  .sort-chip:hover {
    transform: translateY(-1px);
    color: var(--text-primary);
  }

  .sort-chip--active {
    background: var(--bg-sunken);
    color: var(--text-primary);
  }

  .sort-toggle--sidebar {
    box-shadow: none;
  }

  .sort-toggle--sidebar .sort-chip {
    min-height: 30px;
    font-size: 11px;
    padding-inline: 10px;
  }
</style>
