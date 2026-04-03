<script lang="ts">
  import { onMount } from 'svelte';
  import IssueImage from './IssueImage.svelte';
  import { opinionLabel } from '../data/issues';

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
    issue.opinionShift >= 80 ? 'var(--score-strong)' : issue.opinionShift >= 60 ? 'var(--score-medium)' : issue.opinionShift >= 40 ? 'var(--score-partial)' : 'var(--text-tertiary)'
  );
  let label = $derived(opinionLabel(issue.opinionShift));

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
  aria-label="{issue.headline}. Opinion Shift {issue.opinionShift}."
  style="
    background:{isCompleted ? 'var(--bg-elevated)' : 'var(--bg)'};
    border-radius:var(--radius-lg);padding:18px;cursor:pointer;
    box-shadow:{hovered ? '0 8px 30px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)'};
    transform:{visible ? (hovered ? 'translateY(-3px) scale(1.006)' : 'translateY(0) scale(1)') : 'translateY(24px)'};
    opacity:{visible ? 1 : 0};
    transition:transform var(--duration-medium, 350ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)), opacity var(--duration-medium, 350ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
    content-visibility:auto;
    contain-intrinsic-size:0 240px;
  "
>
  <!-- Top row: status pill + heart -->
  <div style="display:flex;align-items:center;gap:6px;">
    {#if issue.status === 'new' && !readState}
      <span style="font-size:var(--text-micro);font-weight:700;color:var(--status-green-text);background:var(--status-green-bg);padding:3px 8px;border-radius:var(--radius-sm);text-transform:uppercase;">New</span>
    {:else if issue.status === 'updated'}
      <span style="font-size:var(--text-micro);font-weight:700;color:var(--status-blue-text);background:var(--status-blue-bg);padding:3px 8px;border-radius:var(--radius-sm);text-transform:uppercase;">Updated</span>
    {/if}
    {#if hasReaction}
      <span style="font-size:var(--text-micro);font-weight:700;color:var(--highlight-accent);background:var(--highlight-bg);padding:3px 8px;border-radius:var(--radius-sm);text-transform:uppercase;">Highlighted</span>
    {/if}
    <div style="flex:1;"></div>
  </div>

  <!-- Issue art -->
  {#if issue.hasImage}
    <div style="margin:8px -18px 0;overflow:hidden;opacity:{isCompleted ? 0.5 : 1};transition:opacity 0.15s ease;">
      <IssueImage issueId={issue.id} size="hero" aspectRatio="1.91/1" borderRadius="0" alt="Illustration for {issue.headline}" />
    </div>
  {/if}

  <!-- Headline -->
  <h3 class="balance-title" style="font-size:var(--text-body);font-weight:{isCompleted ? 600 : 700};color:{isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)'};margin:10px 0 0;line-height:1.28;overflow-wrap:normal;">{issue.headline}</h3>
  <!-- Context -->
  <p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.55;margin:6px 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">{issue.context}</p>

  <!-- Score row -->
  <div style="margin-top:14px;display:flex;align-items:center;gap:8px;">
    <div style="flex:1;height:4px;background:var(--bg-sunken);border-radius: var(--radius-pill);overflow:hidden;">
      <div style="height:100%;width:{issue.opinionShift}%;background:{scoreColor};border-radius: var(--radius-pill);"></div>
    </div>
    <span style="font-size:var(--text-body);font-weight:700;color:{scoreColor};min-width:24px;text-align:right;font-variant-numeric:tabular-nums;">{issue.opinionShift}</span>
    {#if hasReaction}
      <svg width="10" height="10" viewBox="0 0 24 24" fill={scoreColor} stroke="none" style="opacity:0.4;flex-shrink:0;">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    {/if}
  </div>

  <!-- Progress bar: orange for reading, dim green for done -->
  {#if isStarted && progress > 0}
    <div style="margin-top:10px;height:3px;background:var(--bg-sunken);border-radius: var(--radius-pill);overflow:hidden;">
      <div style="height:100%;width:{(progress / 6) * 100}%;background:var(--score-warning);border-radius: var(--radius-pill);"></div>
    </div>
  {:else if isCompleted}
    <div style="margin-top:10px;height:3px;background:var(--status-green);border-radius: var(--radius-pill);opacity:0.3;"></div>
  {/if}
</div>
