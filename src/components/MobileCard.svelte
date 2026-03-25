<script lang="ts">
  import OpinionBar from './OpinionBar.svelte';
  import VerdictBar from './VerdictBar.svelte';
  import { opinionLabel } from '../data/issues';

  interface Props {
    issue: any;
    readState: any;
    onOpen: () => void;
  }
  let { issue, readState, onOpen }: Props = $props();

  let isCompleted = $derived(readState?.state === 'completed');
  let isStarted = $derived(readState?.state === 'started');

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
  }

  let label = $derived(opinionLabel(issue.opinionShift));
</script>

<div
  onclick={onOpen}
  onkeydown={handleKeydown}
  role="article"
  tabindex="0"
  aria-label="{issue.headline}. Opinion Shift {issue.opinionShift}. {issue.status === 'new' ? 'New.' : issue.status === 'updated' ? 'Updated.' : ''} {isCompleted ? 'Read.' : isStarted ? 'In progress.' : 'Unread.'}"
  style="height:100%;display:flex;flex-direction:column;background:{isCompleted ? '#FCFCFC' : '#FFFFFF'};border-radius:20px;padding:24px;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,{isCompleted ? '0.03' : '0.06'});overflow:hidden;transition:background 0.2s ease, box-shadow 0.2s ease;"
>
  <!-- Top row: badges -->
  <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
    {#if isStarted}
      <span style="font-size:11px;font-weight:700;color:#B85C00;background:#FFF4E6;padding:4px 8px;border-radius:4px;">{readState.progress}/6 read</span>
    {:else if isCompleted}
      <div style="display:flex;align-items:center;gap:4px;">
        <div style="width:16px;height:16px;border-radius:50%;background:#EBFBEE;display:flex;align-items:center;justify-content:center;">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#2B8A3E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span style="font-size:10px;color:#6C757D;">Read</span>
      </div>
    {:else}
      {#if issue.status === 'new'}
        <span style="font-size:11px;font-weight:700;color:#24783C;background:#EBFBEE;padding:4px 8px;border-radius:4px;text-transform:uppercase;">New</span>
      {:else if issue.status === 'updated'}
        <span style="font-size:11px;font-weight:700;color:#1864AB;background:#E7F5FF;padding:4px 8px;border-radius:4px;text-transform:uppercase;">Updated</span>
      {/if}
    {/if}
    {#if issue.edition > 1}
      <span style="font-size:10px;color:#6C757D;">Ed.{issue.edition}</span>
    {/if}
  </div>

  <!-- Headline -->
  <h2 style="font-size:27px;font-weight:800;line-height:1.2;color:{isCompleted ? '#495057' : '#212529'};margin:16px 0 0;letter-spacing:-0.02em;transition:color 0.2s ease;">{issue.headline}</h2>

  <!-- Score row -->
  <div style="display:flex;align-items:center;gap:8px;margin-top:12px;">
    <div style="flex:1;">
      <OpinionBar score={issue.opinionShift} height={6} showLabel={false} />
    </div>
    <span style="font-size:14px;font-weight:700;color:{issue.opinionShift >= 80 ? '#E03131' : issue.opinionShift >= 60 ? '#B85C00' : issue.opinionShift >= 40 ? '#1971C2' : '#6C757D'};">{issue.opinionShift}</span>
    <span style="font-size:11px;font-weight:600;color:#495057;">{label}</span>
  </div>
  <!-- Verdict bar -->
  {#if issue.stageScores && issue.finalScore}
    <div style="margin-top:12px;">
      <VerdictBar scores={issue.stageScores} finalScore={issue.finalScore} compact={false} />
    </div>
  {/if}

  <!-- Context -->
  <p style="font-size:16px;color:#495057;line-height:1.6;margin:12px 0 0;font-weight:450;">{issue.context}</p>

  <!-- Bottom — source attribution placeholder + hint -->
  <div style="flex:1;min-height:16px;"></div>
  <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
    {#if !readState}
      <span style="font-size:12px;color:#6C757D;font-weight:500;">Tap to read</span>
    {/if}
  </div>
</div>
