<script lang="ts">
  import type { SectionKind, SortMode } from '../lib/feed-sections';

  interface Props {
    label: string;
    count: number;
    kind: SectionKind;
    showSort?: boolean;
    sortMode?: SortMode;
    onSortChange?: (mode: SortMode) => void;
  }
  let { label, count, kind, showSort = false, sortMode = 'latest', onSortChange }: Props = $props();

  let kindColor = $derived(
    kind === 'continue' ? 'var(--score-warning)' :
    kind === 'new' ? 'var(--status-green)' :
    kind === 'completed' ? 'var(--text-muted)' :
    'var(--text-tertiary)'
  );
</script>

<div
  class="section-divider"
  role="separator"
  aria-label="{label}, {count} {count === 1 ? 'issue' : 'issues'}"
  tabindex="-1"
>
  <div class="divider-line"></div>
  <div class="divider-content">
    <span class="divider-label" style="color:{kindColor};">{label}</span>
    <span class="divider-count">{count}</span>
  </div>
  {#if showSort}
    <button class="sort-pill" onclick={() => onSortChange?.(sortMode === 'latest' ? 'shift' : 'latest')}>
      {sortMode === 'latest' ? 'Latest' : 'Biggest Shift'}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
  {:else}
    <div class="divider-line"></div>
  {/if}
</div>

<style>
  .section-divider {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    user-select: none;
    -webkit-user-select: none;
  }

  .divider-line {
    width: 40px;
    height: 1px;
    background: var(--border-subtle);
  }

  .divider-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .divider-label {
    font-family: var(--font-display, 'Manrope', system-ui, sans-serif);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }

  .divider-count {
    font-family: var(--font-body, 'Nunito Sans', system-ui, sans-serif);
    font-size: var(--text-micro);
    color: var(--text-muted);
  }

  .sort-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-pill);
    background: var(--bg-elevated);
    color: var(--text-secondary);
    font: inherit;
    font-size: var(--text-micro);
    font-weight: 700;
    cursor: pointer;
    transition: color 180ms ease, border-color 180ms ease;
  }

  .sort-pill:hover {
    color: var(--text-primary);
    border-color: var(--text-muted);
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
