<script lang="ts">
  import type { SectionKind, SortMode } from '../lib/feed-sections';

  interface Props {
    id?: string;
    controlsId?: string;
    label: string;
    count: number;
    kind: SectionKind;
    collapsed: boolean;
    onToggle: () => void;
    showSort?: boolean;
    sortMode?: SortMode;
    onSortChange?: (mode: SortMode) => void;
  }
  let { id, controlsId, label, count, kind, collapsed, onToggle, showSort = false, sortMode = 'latest', onSortChange }: Props = $props();

  let kindColor = $derived(
    kind === 'continue' ? 'var(--score-warning)' :
    kind === 'new' ? 'var(--status-green)' :
    kind === 'completed' ? 'var(--text-muted)' :
    'var(--text-tertiary)'
  );

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  }
</script>

<div
  {id}
  class="section-header"
  role="heading"
  aria-level={2}
>
  <button
    class="section-toggle"
    onclick={onToggle}
    onkeydown={handleKeydown}
    aria-expanded={!collapsed}
    aria-controls={controlsId}
    aria-label="{label}, {count} {count === 1 ? 'issue' : 'issues'}"
  >
    <svg
      aria-hidden="true"
      class="chevron"
      class:chevron--collapsed={collapsed}
      width="10" height="10" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round"
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
    <span class="section-label" style="color:{kindColor};">{label}</span>
    <span class="section-count">{count}</span>
    {#if showSort}
      <button class="sort-pill" onclick={(e) => { e.stopPropagation(); onSortChange?.(sortMode === 'latest' ? 'shift' : 'latest'); }}>
        {sortMode === 'latest' ? 'Latest' : 'Biggest Shift'}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    {/if}
  </button>
</div>

<style>
  .section-header {
    border-bottom: 1px solid var(--bg-sunken);
  }

  .section-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 20px;
    background: none;
    border: none;
    cursor: pointer;
    min-height: 44px;
    transition: background var(--duration-fast, 150ms) ease;
  }

  @media (hover: hover) {
    .section-toggle:hover {
      background: var(--bg-sunken);
    }
  }

  .chevron {
    color: var(--text-faint);
    transition: transform var(--duration-fast, 150ms) ease;
    flex-shrink: 0;
  }

  .chevron--collapsed {
    transform: rotate(-90deg);
  }

  .section-label {
    font-family: var(--font-display, 'Manrope', system-ui, sans-serif);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex: 1;
    text-align: left;
  }

  .section-count {
    font-family: var(--font-body, 'Nunito Sans', system-ui, sans-serif);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-faint);
  }

  .sort-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    padding: 4px 10px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-pill);
    background: var(--bg-elevated);
    color: var(--text-secondary);
    font: inherit;
    font-size: var(--text-xs);
    font-weight: 700;
    cursor: pointer;
    transition: color 180ms ease, border-color 180ms ease;
  }

  @media (hover: hover) {
    .sort-pill:hover {
      color: var(--text-primary);
      border-color: var(--text-muted);
    }
  }

  .sort-pill svg {
    color: var(--text-faint);
  }

  @media (prefers-color-scheme: dark) {
    .sort-pill {
      background: rgba(34, 31, 27, 0.9);
      border-color: var(--border-divider);
    }
  }
</style>
