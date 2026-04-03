<script lang="ts">
  import { savedIssues, toggleSavedIssue } from '../stores/reader';

  interface Props {
    issueId: string;
    label?: string;
    compact?: boolean;
  }
  let { issueId, label = 'Add to Highlights', compact = false }: Props = $props();

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
  aria-label={isSaved ? 'Issue in Highlights' : 'Add issue to Highlights'}
>
  <svg class="bookmark-icon" width="15" height="15" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M7 3h10a1 1 0 0 1 1 1v17l-6-3-6 3V4a1 1 0 0 1 1-1z"></path>
  </svg>
  {#if !compact}
    <span>{isSaved ? 'In Highlights' : label}</span>
  {/if}
</button>

<style>
  .save-issue-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.64);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background 180ms ease,
      border-color 180ms ease,
      color 180ms ease,
      transform 180ms ease,
      box-shadow 180ms ease;
    box-shadow: 0 8px 18px rgba(17, 24, 39, 0.04);
  }

  .save-issue-btn:hover {
    background: var(--bg);
    border-color: var(--border-divider);
    transform: translateY(-1px);
    box-shadow: 0 12px 24px rgba(17, 24, 39, 0.08);
  }

  .save-issue-btn--saved {
    background: rgba(224, 49, 49, 0.06);
    border-color: rgba(224, 49, 49, 0.18);
    color: var(--score-critical);
  }

  .save-issue-btn--saved:hover {
    background: rgba(224, 49, 49, 0.08);
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

  @media (prefers-color-scheme: dark) {
    .save-issue-btn {
      background: rgba(34, 31, 27, 0.74);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.24);
    }

    .save-issue-btn:hover {
      background: rgba(40, 36, 31, 0.94);
      box-shadow: 0 16px 28px rgba(0, 0, 0, 0.28);
    }

    .save-issue-btn--saved {
      background: rgba(224, 49, 49, 0.08);
      border-color: rgba(224, 49, 49, 0.22);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .save-issue-btn {
      transition: none;
    }
  }
</style>
