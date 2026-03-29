<script lang="ts">
  import { onMount } from 'svelte';
  import VerdictBar from './VerdictBar.svelte';
  import IssueImage from './IssueImage.svelte';
  import { opinionLabel, issueCategory } from '../data/issues';

  import type { IssueSummary } from '../lib/issues-loader';
  import type { ReadState } from '../stores/reader';

  interface Props {
    issue: IssueSummary;
    index: number;
    readState: ReadState | null;
    onOpen: () => void;
    onPrefetch?: () => void;
    hasReaction?: boolean;
    hasConnections?: boolean;
  }
  let { issue, index, readState, onOpen, onPrefetch, hasReaction = false, hasConnections = false }: Props = $props();

  let isCompleted = $derived(readState?.state === 'completed');
  let isStarted = $derived(readState?.state === 'started');
  let progress = $derived(readState?.progress ?? 0);

  let visible = $state(false);
  let hovered = $state(false);
  let cardEl: HTMLDivElement | undefined = $state(undefined);

  let scoreColor = $derived(
    issue.opinionShift >= 80 ? 'var(--score-critical)' : issue.opinionShift >= 60 ? 'var(--score-warning)' : issue.opinionShift >= 40 ? 'var(--score-info)' : 'var(--text-tertiary)'
  );
  let label = $derived(opinionLabel(issue.opinionShift));
  let headlineWeight = $derived(isCompleted ? '600' : '700');
  let headlineColor = $derived(isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)');

  const reducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  onMount(() => {
    if (reducedMotion) { visible = true; return; }
    const key = 'tfa_entry_seen';
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) { visible = true; return; }
    const col = index % 2;
    const row = Math.floor(index / 2);
    const delay = Math.min(row * 80 + col * 40, 400);
    if (!cardEl) { visible = true; return; }
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setTimeout(() => {
          visible = true;
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1');
        }, delay);
        obs.disconnect();
      }
    }, { threshold: 0.1 });
    obs.observe(cardEl);
    return () => obs.disconnect();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={cardEl}
  onclick={onOpen}
  onmouseenter={() => { hovered = true; onPrefetch?.(); }}
  onmouseleave={() => hovered = false}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
  role="article"
  tabindex="0"
  aria-label="{issue.headline}. Opinion Shift {issue.opinionShift}. {isCompleted ? 'Covered.' : isStarted ? 'Reading.' : 'Unread.'}"
  style="
    background:{isCompleted ? 'var(--bg-elevated)' : 'var(--bg)'};
    border-radius:16px;padding:18px;cursor:pointer;
    box-shadow:{hovered ? '0 8px 30px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)'};
    transform:{visible ? (hovered ? 'translateY(-3px) scale(1.006)' : 'translateY(0) scale(1)') : 'translateY(24px)'};
    opacity:{visible ? 1 : 0};
    transition:transform var(--duration-medium, 350ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)), opacity var(--duration-medium, 350ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
    content-visibility:auto;
    contain-intrinsic-size:0 240px;
  "
>
  <!-- Top row: status badges + heart -->
  <div style="display:flex;align-items:center;gap:6px;">
    {#if issue.status === 'new' && !readState}
      <span style="font-size:10px;font-weight:700;color:var(--status-green-text);background:var(--status-green-bg);padding:2px 7px;border-radius:6px;text-transform:uppercase;letter-spacing:0.04em;">New</span>
    {:else if issue.status === 'updated' && !readState}
      <span style="font-size:10px;font-weight:700;color:var(--status-blue-text);background:var(--status-blue-bg);padding:2px 7px;border-radius:6px;text-transform:uppercase;letter-spacing:0.04em;">Updated</span>
    {/if}
    {#if issue.edition > 1}
      <span style="font-size:10px;color:var(--text-tertiary);">Ed.{issue.edition}</span>
    {/if}
    <div style="flex:1;"></div>
    {#if hasReaction}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--score-critical)" stroke="none" style="flex-shrink:0;opacity:0.6;">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    {/if}
    {#if isStarted}
      <div style="display:flex;align-items:center;gap:4px;">
        <svg width="14" height="14" viewBox="0 0 24 24" style="flex-shrink:0;">
          <circle cx="12" cy="12" r="9" stroke="var(--bg-sunken)" stroke-width="2.5" fill="none"/>
          <circle cx="12" cy="12" r="9" stroke="var(--score-warning)" stroke-width="2.5" fill="none"
            stroke-dasharray="56.5" stroke-dashoffset="{56.5 - (56.5 * progress / 6)}"
            transform="rotate(-90 12 12)" stroke-linecap="round"/>
        </svg>
        <span style="font-size:9px;font-weight:600;color:var(--score-warning);">Reading</span>
      </div>
    {:else if isCompleted}
      <div style="display:flex;align-items:center;gap:4px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>
        <span style="font-size:9px;font-weight:600;color:var(--status-green);">Covered</span>
      </div>
    {/if}
  </div>

  <!-- Issue art -->
  {#if issue.hasImage}
    <div style="margin:8px -18px 0;height:100px;overflow:hidden;">
      <IssueImage issueId={issue.id} size="card" aspectRatio="auto" borderRadius="0" />
    </div>
  {/if}

  <!-- Headline -->
  <h3 style="font-size:15px;font-weight:{headlineWeight};color:{headlineColor};margin:10px 0 0;line-height:1.35;overflow-wrap:break-word;word-break:break-word;">{issue.headline}</h3>
  <div style="display:flex;align-items:center;gap:4px;margin-top:2px;">
    <span style="font-size:10px;font-weight:500;color:var(--text-muted);">{issueCategory(issue)}</span>
    {#if hasConnections}
      <div style="width:5px;height:5px;border-radius:50%;background:var(--score-info);opacity:0.5;flex-shrink:0;"></div>
    {/if}
  </div>

  <!-- Context -->
  <p style="font-size:12px;color:var(--text-secondary);line-height:1.55;margin:6px 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">{issue.context}</p>

  <!-- Scores: Opinion Shift + Neutrality — clean aligned row -->
  <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">
    <!-- Opinion Shift -->
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="flex:1;height:4px;background:var(--bg-sunken);border-radius:2px;overflow:hidden;">
        <div style="height:100%;width:{issue.opinionShift}%;background:{scoreColor};border-radius:2px;"></div>
      </div>
      <span style="font-size:13px;font-weight:700;color:{scoreColor};min-width:24px;text-align:right;font-variant-numeric:tabular-nums;">{issue.opinionShift}</span>
      <span style="font-size:10px;font-weight:500;color:var(--text-tertiary);white-space:nowrap;">{label}</span>
    </div>

    <!-- Verdict bar (neutrality) -->
    {#if issue.stageScores && issue.finalScore}
      <VerdictBar scores={issue.stageScores} finalScore={issue.finalScore} compact={true} />
    {/if}
  </div>

  <!-- Reading progress bar -->
  {#if isStarted && progress > 0}
    <div style="margin-top:10px;height:2px;background:var(--bg-sunken);border-radius:1px;overflow:hidden;">
      <div style="height:100%;width:{(progress / 6) * 100}%;background:var(--score-warning);border-radius:1px;"></div>
    </div>
  {:else if isCompleted}
    <div style="margin-top:10px;height:2px;background:var(--status-green);border-radius:1px;opacity:0.25;"></div>
  {/if}
</div>
