<script lang="ts">
  import type { SectionKind } from '../lib/feed-sections';

  interface Props {
    label: string;
    count: number;
    kind: SectionKind;
    collapsed: boolean;
    onToggle: () => void;
  }
  let { label, count, kind, collapsed, onToggle }: Props = $props();

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
  class="section-header"
  role="heading"
  aria-level={2}
>
  <button
    class="section-toggle"
    onclick={onToggle}
    onkeydown={handleKeydown}
    aria-expanded={!collapsed}
    aria-label="{label}, {count} {count === 1 ? 'issue' : 'issues'}"
  >
    <svg
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

  .section-toggle:hover {
    background: var(--bg-sunken);
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
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex: 1;
    text-align: left;
  }

  .section-count {
    font-family: var(--font-body, 'Nunito Sans', system-ui, sans-serif);
    font-size: 10px;
    font-weight: 500;
    color: var(--text-faint);
  }
</style>
