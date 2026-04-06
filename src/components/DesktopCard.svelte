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
  let totalAngles = $derived(issue.cards.length || 6);

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
    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        delayTimer = setTimeout(() => {
          visible = true;
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1');
        }, delay);
        obs.disconnect();
      }
    }, { threshold: 0.1 });
    obs.observe(cardEl);
    return () => {
      obs.disconnect();
      if (delayTimer) clearTimeout(delayTimer);
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events — onkeydown handles Enter/Space below -->
<!-- svelte-ignore a11y_no_static_element_interactions — role="article" + tabindex="0" make this interactive -->
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
  <div style="display:flex;align-items:center;gap:8px;">
    {#if issue.status === 'new' && !readState}
      <span style="font-size:var(--text-micro);font-weight:700;color:var(--status-green-text);background:var(--status-green-bg);padding:4px 8px;border-radius:var(--radius-sm);text-transform:uppercase;">New</span>
    {:else if issue.status === 'updated'}
      <span style="font-size:var(--text-micro);font-weight:700;color:var(--status-blue-text);background:var(--status-blue-bg);padding:4px 8px;border-radius:var(--radius-sm);text-transform:uppercase;">Updated</span>
    {/if}
    {#if hasReaction}
      <span style="font-size:var(--text-micro);font-weight:700;color:var(--highlight-accent);background:var(--highlight-bg);padding:4px 8px;border-radius:var(--radius-sm);text-transform:uppercase;">Highlighted</span>
    {/if}
    <div style="flex:1;"></div>
  </div>

  <!-- Issue art -->
  {#if issue.hasImage}
    <div style="margin:8px -18px 0;overflow:hidden;opacity:{isCompleted ? 0.5 : 1};transition:opacity 0.2s ease-out;">
      <IssueImage issueId={issue.id} size="hero" aspectRatio="1.91/1" borderRadius="0" alt="Illustration for {issue.headline}" />
    </div>
  {/if}

  <!-- Headline -->
  <h3 class="balance-title" title={issue.headline} style="font-size:var(--text-body);font-weight:{isCompleted ? 600 : 700};color:{isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)'};margin:10px 0 0;line-height:1.28;overflow-wrap:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">{issue.headline}</h3>
  <!-- Context -->
  <p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.55;margin:6px 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">{issue.context}</p>

  <!-- Score row -->
  <div style="margin-top:14px;display:flex;align-items:center;gap:8px;" title="{issue.opinionShift} — {opinionLabel(issue.opinionShift)}: Reading only the headline would hide about {issue.opinionShift}% of the story">
    <div style="flex:1;height:2px;background:var(--bg-sunken);border-radius: var(--radius-pill);overflow:hidden;">
      <div style="height:100%;width:{issue.opinionShift}%;background:{scoreColor};border-radius: var(--radius-pill);"></div>
    </div>
    <span style="font-size:var(--text-body);font-weight:700;color:{scoreColor};min-width:24px;text-align:right;font-variant-numeric:tabular-nums;">{issue.opinionShift}</span>
    {#if hasReaction}
      <svg width="10" height="10" viewBox="0 0 24 24" fill={scoreColor} stroke="none" style="opacity:0.4;flex-shrink:0;">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    {/if}
  </div>

  <!-- Progress bar: orange for reading, dim green for done -->
  {#if isStarted && progress > 0}
    <div style="margin-top:10px;height:3px;background:var(--bg-sunken);border-radius: var(--radius-pill);overflow:hidden;">
      <div style="height:100%;width:{(progress / totalAngles) * 100}%;background:var(--score-warning);border-radius: var(--radius-pill);"></div>
    </div>
  {:else if isCompleted}
    <div style="margin-top:10px;height:3px;background:var(--status-green);border-radius: var(--radius-pill);opacity:0.3;"></div>
  {/if}
</div>
