<script lang="ts">
  import { opinionLabel } from '../data/issues';

  import type { IssueSummary } from '../lib/issues-loader';
  import type { ReadState } from '../stores/reader';

  interface Props {
    issue: IssueSummary;
    readState: ReadState | null;
    isActive: boolean;
    tabIndex?: number;
    itemIndex?: number;
    onClick: () => void;
    hasReaction?: boolean;
    reactionCount?: number;
    hasConnections?: boolean;
    searchTerms?: string;
  }
  let { issue, readState, isActive, tabIndex = 0, itemIndex = 0, onClick, hasReaction = false, reactionCount = 0, hasConnections = false, searchTerms = '' }: Props = $props();

  function highlightText(text: string, terms: string): string {
    if (!terms || terms.length < 2) return text;
    const escaped = terms.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark style="background:var(--amber-light);color:inherit;border-radius:2px;padding:0 1px;">$1</mark>');
  }

  let hovered = $state(false);
  let scoreColor = $derived(
    issue.opinionShift >= 80 ? 'var(--score-strong)' : issue.opinionShift >= 60 ? 'var(--score-medium)' : issue.opinionShift >= 40 ? 'var(--score-partial)' : 'var(--text-tertiary)'
  );
  let label = $derived(opinionLabel(issue.opinionShift));

  let isCompleted = $derived(readState?.state === 'completed');
  let isStarted = $derived(readState?.state === 'started');
  let progress = $derived(readState?.progress ?? 0);
  let savedLabel = $derived(reactionCount > 0 ? `${reactionCount} saved angle${reactionCount === 1 ? '' : 's'}` : '');

  // Visual weight: bold unread → medium reading → light done
  let headlineWeight = $derived(isCompleted ? '500' : (isStarted ? '600' : '700'));
  let headlineColor = $derived(isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)');
  let progressLabel = $derived(isStarted && progress > 0 ? `Resume from insight ${Math.min(progress + 1, 6)} of 6` : (savedLabel || (isCompleted ? 'Done' : '')));
  let optionLabel = $derived(
    `${issue.headline}. Opinion Shift ${issue.opinionShift}. ${isCompleted ? 'Finished.' : progressLabel || 'Not started.'}`
  );
</script>

<button
  type="button"
  class="feed-row"
  data-index={itemIndex}
  onclick={onClick}
  onmouseenter={() => hovered = true}
  onmouseleave={() => hovered = false}
  role="option"
  aria-selected={isActive}
  aria-label={optionLabel}
  tabindex={tabIndex}
  style="
    width:100%;appearance:none;border:none;text-align:left;font:inherit;
    padding:12px 16px;cursor:pointer;
    border-bottom:1px solid var(--bg-sunken);
    background:{isActive ? 'rgba(25,113,194,0.05)' : (hovered ? 'var(--bg-sunken)' : 'transparent')};
    transition:background var(--duration-fast, 150ms) ease;
    display:grid;grid-template-columns:4px minmax(0,1fr) auto;align-items:flex-start;gap:12px;
  "
>
  <div style="width:4px;align-self:stretch;border-radius:999px;background:{scoreColor};opacity:{isActive ? 1 : (isStarted ? 0.7 : 0.28)};"></div>
  <div style="flex:1;min-width:0;">
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
      {#if issue.status === 'new' && !readState}
        <span style="font-size:10px;font-weight:700;color:var(--status-green-text);background:var(--status-green-bg);padding:3px 8px;border-radius:4px;text-transform:uppercase;flex-shrink:0;">New</span>
      {:else if issue.status === 'updated'}
        <span style="font-size:10px;font-weight:700;color:var(--status-blue-text);background:var(--status-blue-bg);padding:3px 8px;border-radius:4px;text-transform:uppercase;flex-shrink:0;">Updated</span>
      {/if}
      {#if hasReaction}
        <span style="font-size:10px;font-weight:700;color:var(--highlight-accent, var(--score-warning));background:var(--highlight-bg, rgba(184,92,0,0.08));padding:3px 8px;border-radius:4px;text-transform:uppercase;flex-shrink:0;">{reactionCount > 0 ? `${reactionCount} saved` : 'Highlighted'}</span>
      {/if}
    </div>
    <span class="balance-title" style="font-size:14px;font-weight:{headlineWeight};color:{isActive ? 'var(--text-primary)' : headlineColor};line-height:1.28;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:2px;">{#if searchTerms}{@html highlightText(issue.headline, searchTerms)}{:else}{issue.headline}{/if}</span>

    <p style="font-size:12px;color:var(--text-tertiary);line-height:1.45;margin:5px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">{issue.context}</p>
  </div>
  <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:2px;padding-top:2px;min-width:54px;">
    <span style="font-size:14px;font-weight:700;color:{scoreColor};font-variant-numeric:tabular-nums;">{issue.opinionShift}</span>
    <span style="font-size:11px;font-weight:600;color:var(--text-muted);">{label}</span>
    {#if progressLabel}
      <span style="font-size:10px;color:var(--text-muted);">{progressLabel}</span>
    {/if}
  </div>
</button>

<style>
  .feed-row:focus-visible {
    outline: 2px solid var(--score-info);
    outline-offset: -2px;
  }
</style>
