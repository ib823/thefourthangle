<script lang="ts">
  import { opinionLabel } from '../data/issues';
  import VerdictBar from './VerdictBar.svelte';

  interface Props {
    issue: any;
    readState: { state: string; progress: number } | null;
    isActive: boolean;
    onClick: () => void;
  }
  let { issue, readState, isActive, onClick }: Props = $props();

  let hovered = $state(false);
  let scoreColor = $derived(
    issue.opinionShift >= 80 ? '#E03131' : issue.opinionShift >= 60 ? '#B85C00' : issue.opinionShift >= 40 ? '#1971C2' : '#6C757D'
  );
  let label = $derived(opinionLabel(issue.opinionShift));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  onclick={onClick}
  onkeydown={(e) => { if (e.key === 'Enter') onClick(); }}
  onmouseenter={() => hovered = true}
  onmouseleave={() => hovered = false}
  role="button"
  tabindex="0"
  aria-current={isActive ? 'true' : undefined}
  aria-label="{issue.headline}. Opinion Shift {issue.opinionShift}."
  style="
    padding:16px 20px;cursor:pointer;
    border-bottom:1px solid #F1F3F5;
    border-left:{isActive ? '2px solid ' + scoreColor : '2px solid transparent'};
    background:{isActive ? 'rgba(25,113,194,0.04)' : (hovered ? '#F1F3F5' : 'transparent')};
    transition:background 0.15s ease;
    display:flex;align-items:flex-start;gap:12px;
  "
>
  <div style="flex:1;min-width:0;">
    <div style="display:flex;align-items:center;gap:6px;">
      {#if readState?.state === 'completed'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2B8A3E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>
      {:else if readState?.state === 'started'}
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#B85C00;flex-shrink:0;"></span>
      {/if}
      {#if issue.status === 'new' && !readState}
        <span style="font-size:10px;font-weight:700;color:#24783C;background:#EBFBEE;padding:2px 6px;border-radius:4px;text-transform:uppercase;flex-shrink:0;">New</span>
      {:else if issue.status === 'updated' && !readState}
        <span style="font-size:10px;font-weight:700;color:#1864AB;background:#E7F5FF;padding:2px 6px;border-radius:4px;text-transform:uppercase;flex-shrink:0;">Updated</span>
      {/if}
      <span style="font-size:15px;font-weight:600;color:{isActive || readState?.state !== 'completed' ? '#212529' : '#495057'};line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">{issue.headline}</span>
      {#if readState?.state === 'started' && readState.progress}
        <span style="font-size:10px;color:#B85C00;flex-shrink:0;">{readState.progress}/6</span>
      {/if}
    </div>
    <p style="font-size:12px;color:#6C757D;line-height:1.4;margin:4px 0 0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">{issue.context}</p>
    {#if issue.stageScores && issue.finalScore}
      <div style="margin-top:4px;">
        <VerdictBar scores={issue.stageScores} finalScore={issue.finalScore} compact={true} />
      </div>
    {/if}
  </div>
  <span style="font-size:14px;font-weight:700;color:{scoreColor};flex-shrink:0;padding-top:2px;" title="Opinion Shift: {issue.opinionShift} — {label}. How much you'd miss by reading only the headline.">{issue.opinionShift}</span>
</div>
