<script lang="ts">
  import type { SectionKind } from '../lib/feed-sections';

  interface Props {
    label: string;
    count: number;
    kind: SectionKind;
  }
  let { label, count, kind }: Props = $props();

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
  <div class="divider-line"></div>
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
</style>
