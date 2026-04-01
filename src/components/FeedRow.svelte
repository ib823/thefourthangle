<script lang="ts">
  import { opinionLabel, issueCategory } from '../data/issues';
  import VerdictBar from './VerdictBar.svelte';
  import IssueImage from './IssueImage.svelte';

  import type { IssueSummary } from '../lib/issues-loader';
  import type { ReadState } from '../stores/reader';

  interface Props {
    issue: IssueSummary;
    readState: ReadState | null;
    isActive: boolean;
    onClick: () => void;
    hasReaction?: boolean;
    hasConnections?: boolean;
    searchTerms?: string;
  }
  let { issue, readState, isActive, onClick, hasReaction = false, hasConnections = false, searchTerms = '' }: Props = $props();

  // L3: Highlight matching search terms in headline
  function highlightText(text: string, terms: string): string {
    if (!terms || terms.length < 2) return text;
    const escaped = terms.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark style="background:var(--amber-light);color:inherit;border-radius:2px;padding:0 1px;">$1</mark>');
  }

  let hovered = $state(false);
  let scoreColor = $derived(
    issue.opinionShift >= 80 ? 'var(--score-critical)' : issue.opinionShift >= 60 ? 'var(--score-warning)' : issue.opinionShift >= 40 ? 'var(--score-info)' : 'var(--text-tertiary)'
  );
  let label = $derived(opinionLabel(issue.opinionShift));

  let isCompleted = $derived(readState?.state === 'completed');
  let isStarted = $derived(readState?.state === 'started');
  let progress = $derived(readState?.progress ?? 0);

  // Typographic weight: 700 unread → 600 reading → 500 done (research-backed)
  let headlineWeight = $derived(isCompleted ? '500' : (isStarted ? '600' : '700'));
  let headlineColor = $derived(isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)');
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  onclick={onClick}
  onkeydown={(e) => { if (e.key === 'Enter') onClick(); }}
  onmouseenter={() => hovered = true}
  onmouseleave={() => hovered = false}
  role="presentation"
  aria-current={isActive ? 'true' : undefined}
  aria-label="{issue.headline}. Opinion Shift {issue.opinionShift}. {isCompleted ? 'Covered.' : isStarted ? 'Reading.' : 'Unread.'}"
  style="
    padding:14px 20px;cursor:pointer;
    border-bottom:1px solid var(--bg-sunken);
    border-left:{isActive ? '2px solid ' + scoreColor : '2px solid transparent'};
    background:{isActive ? 'rgba(25,113,194,0.04)' : (hovered ? 'var(--bg-sunken)' : 'transparent')};
    transition:background var(--duration-fast, 150ms) ease;
    display:flex;align-items:flex-start;gap:12px;
  "
>
  <!-- Thumbnail -->
  {#if issue.hasImage}
    <div style="width:48px;height:48px;flex-shrink:0;border-radius:8px;overflow:hidden;background:var(--bg-sunken);">
      <IssueImage issueId={issue.id} size="thumb" aspectRatio="1/1" borderRadius="8px" alt="Illustration for {issue.headline}" />
    </div>
  {/if}
  <div style="flex:1;min-width:0;">
    <!-- Leading indicator + headline -->
    <div style="display:flex;align-items:center;gap:6px;">
      {#if isStarted}
        <!-- Progress ring: reading state -->
        <svg width="14" height="14" viewBox="0 0 24 24" style="flex-shrink:0;">
          <circle cx="12" cy="12" r="9" stroke="var(--bg-sunken)" stroke-width="2.5" fill="none"/>
          <circle cx="12" cy="12" r="9" stroke="var(--score-warning)" stroke-width="2.5" fill="none"
            stroke-dasharray="{56.5}" stroke-dashoffset="{56.5 - (56.5 * progress / 6)}"
            transform="rotate(-90 12 12)" stroke-linecap="round"/>
        </svg>
      {:else if isCompleted}
        <!-- Checkmark: done state -->
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>
      {:else}
        <!-- Unread dot -->
        <div style="width:6px;height:6px;border-radius:50%;background:var(--score-info);flex-shrink:0;"></div>
      {/if}
      {#if issue.status === 'new' && !readState}
        <span style="font-size:10px;font-weight:700;color:var(--status-green-text);background:var(--status-green-bg);padding:2px 6px;border-radius:4px;text-transform:uppercase;flex-shrink:0;">New</span>
      {:else if issue.status === 'updated' && !readState}
        <span style="font-size:10px;font-weight:700;color:var(--status-blue-text);background:var(--status-blue-bg);padding:2px 6px;border-radius:4px;text-transform:uppercase;flex-shrink:0;">Updated</span>
      {/if}
      <span style="font-size:15px;font-weight:{headlineWeight};color:{isActive ? 'var(--text-primary)' : headlineColor};line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">{#if searchTerms}{@html highlightText(issue.headline, searchTerms)}{:else}{issue.headline}{/if}</span>
    </div>

    <p style="font-size:12px;color:var(--text-tertiary);line-height:1.4;margin:4px 0 0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">{issue.context}</p>

    {#if hasConnections}
      <span style="font-size:11px;color:#1864AB;font-weight:600;margin-top:2px;display:inline-block;">Connected</span>
    {/if}

    <!-- Progress bar: reading state only -->
    {#if isStarted && progress > 0}
      <div style="margin-top:6px;height:2px;background:var(--bg-sunken);border-radius:1px;overflow:hidden;">
        <div style="height:100%;width:{(progress / 6) * 100}%;background:var(--score-warning);border-radius:1px;transition:width var(--duration-normal, 250ms) ease;"></div>
      </div>
    {/if}
  </div>
  <!-- Right column: score + heart -->
  <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;padding-top:2px;">
    <span style="font-size:14px;font-weight:700;color:{scoreColor};font-variant-numeric:tabular-nums;" title="Opinion Shift: {issue.opinionShift} — {label}. How much you'd miss by reading only the headline.">{issue.opinionShift}</span>
    {#if hasReaction}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--score-critical)" stroke="none" style="opacity:0.65;">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    {/if}
  </div>
</div>
