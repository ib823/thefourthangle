<script lang="ts">
  import { savedIssues, toggleSavedIssue } from '../stores/reader';

  interface Props {
    issueId: string;
    label?: string;
    compact?: boolean;
  }
  let { issueId, label = 'Save issue', compact = false }: Props = $props();

  let savedRaw = $state('{}');
  $effect(() => {
    const unsub = savedIssues.subscribe(v => { savedRaw = v; });
    return unsub;
  });

  let savedMap = $derived.by(() => {
    try { return JSON.parse(savedRaw) as Record<string, number>; } catch { return {}; }
  });
  let isSaved = $derived(!!savedMap[issueId]);

  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    toggleSavedIssue(issueId);
    try { navigator.vibrate?.(6); } catch {}
  }
</script>

<button
  class="save-issue-btn"
  class:save-issue-btn--saved={isSaved}
  class:save-issue-btn--compact={compact}
  onclick={handleClick}
  aria-pressed={isSaved}
  aria-label={isSaved ? 'Issue saved for later' : 'Save issue for later'}
>
  <svg class="bookmark-icon" width="15" height="15" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M7 3h10a1 1 0 0 1 1 1v17l-6-3-6 3V4a1 1 0 0 1 1-1z"></path>
  </svg>
  {#if !compact}
    <span>{isSaved ? 'Saved' : label}</span>
  {/if}
</button>

<style>
  .save-issue-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-elevated);
    color: var(--text-tertiary);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
  }

  .save-issue-btn:hover {
    background: var(--bg-sunken);
    border-color: var(--border-divider);
  }

  .save-issue-btn--saved {
    background: rgba(210, 140, 40, 0.12);
    border-color: rgba(210, 140, 40, 0.3);
    color: var(--score-warning);
  }

  .save-issue-btn--saved:hover {
    background: rgba(210, 140, 40, 0.16);
  }

  .save-issue-btn--compact {
    min-width: 44px;
    padding-inline: 12px;
  }

  .bookmark-icon {
    flex-shrink: 0;
  }

  .save-issue-btn span {
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .save-issue-btn {
      transition: none;
    }
  }
</style>
