<script lang="ts">
  import { opinionLabel, issueCategory } from '../data/issues';
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
    issue.opinionShift >= 80 ? 'var(--score-critical)' : issue.opinionShift >= 60 ? 'var(--score-warning)' : issue.opinionShift >= 40 ? 'var(--score-info)' : 'var(--text-tertiary)'
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
    border-bottom:1px solid var(--bg-sunken);
    border-left:{isActive ? '2px solid ' + scoreColor : '2px solid transparent'};
    /* rgba(25,113,194,0.04) matches --score-info at 4% opacity; not replaceable with var() */
    background:{isActive ? 'rgba(25,113,194,0.04)' : (hovered ? 'var(--bg-sunken)' : 'transparent')};
    transition:background 0.15s ease;
    display:flex;align-items:flex-start;gap:12px;
  "
>
  <div style="flex:1;min-width:0;">
    <div style="display:flex;align-items:center;gap:6px;">
      {#if readState?.state === 'completed'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>
      {:else if readState?.state === 'started'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;"><circle cx="12" cy="12" r="9" stroke="var(--score-warning)" stroke-width="2" fill="none"/><path d="M12 3a9 9 0 0 1 0 18" fill="var(--score-warning)"/></svg>
      {/if}
      {#if issue.status === 'new' && !readState}
        <span style="font-size:10px;font-weight:700;color:var(--status-green-text);background:var(--status-green-bg);padding:2px 6px;border-radius:4px;text-transform:uppercase;flex-shrink:0;">New</span>
      {:else if issue.status === 'updated' && !readState}
        <span style="font-size:10px;font-weight:700;color:var(--status-blue-text);background:var(--status-blue-bg);padding:2px 6px;border-radius:4px;text-transform:uppercase;flex-shrink:0;">Updated</span>
      {/if}
      <span style="font-size:15px;font-weight:600;color:{isActive || readState?.state !== 'completed' ? 'var(--text-primary)' : 'var(--text-secondary)'};line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">{issue.headline}</span>
    </div>
    <p style="font-size:12px;color:var(--text-tertiary);line-height:1.4;margin:4px 0 0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">{issue.context}</p>
    <span style="font-size:10px;font-weight:500;color:var(--text-muted);margin-top:2px;display:block;">{issueCategory(issue)}</span>
    {#if issue.stageScores && issue.finalScore}
      <div style="margin-top:4px;">
        <VerdictBar scores={issue.stageScores} finalScore={issue.finalScore} compact={true} />
      </div>
    {/if}
  </div>
  <span style="font-size:14px;font-weight:700;color:{scoreColor};flex-shrink:0;padding-top:2px;" title="Opinion Shift: {issue.opinionShift} — {label}. How much you'd miss by reading only the headline.">{issue.opinionShift}</span>
</div>
