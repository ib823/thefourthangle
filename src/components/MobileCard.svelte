<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { opinionLabel, CARD_TYPES } from '../data/issues';
  import { pressAction } from '../lib/actions/press';
  import { tween, countUp, ease } from '../lib/animation';

  import IssueImage from './IssueImage.svelte';
  import type { IssueSummary } from '../lib/issues-loader';
  import type { ReadState } from '../stores/reader';

  interface Props {
    issue: IssueSummary;
    readState: ReadState | null;
    onOpen: () => void;
    onPrefetch?: () => void;
    hasReaction?: boolean;
    hasConnections?: boolean;
    eager?: boolean;
  }
  let { issue, readState, onOpen, onPrefetch, hasReaction = false, hasConnections = false, eager = false }: Props = $props();

  let isCompleted = $derived(readState?.state === 'completed');
  let isStarted = $derived(readState?.state === 'started');

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
  }

  let label = $derived(opinionLabel(issue.opinionShift));

  // Viewport animation state
  let hasEnteredViewport = $state(false);
  let displayScore = $state(0);
  let barFillPercent = $state(0);
  let prefersReducedMotion = false;

  let cardEl: HTMLElement | undefined = $state(undefined);
  let observer: IntersectionObserver | undefined;
  let cleanups: (() => void)[] = [];

  onMount(() => {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      hasEnteredViewport = true;
      displayScore = issue.opinionShift;
      barFillPercent = issue.opinionShift;
      return;
    }

    if (cardEl) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && !hasEnteredViewport) {
              hasEnteredViewport = true;
              startEntryAnimations();
              observer?.disconnect();
            }
          }
        },
        { threshold: 0.3 }
      );
      observer.observe(cardEl);
    }
  });

  function startEntryAnimations() {
    const cancelBar = tween(0, issue.opinionShift, 400, ease.outExpo, (v) => {
      barFillPercent = v;
    });
    cleanups.push(cancelBar);

    const cancelCount = countUp(0, issue.opinionShift, 400, (v) => {
      displayScore = v;
    });
    cleanups.push(cancelCount);
  }

  onDestroy(() => {
    observer?.disconnect();
    cleanups.forEach(fn => fn());
  });

  let scoreColor = $derived(
    issue.opinionShift >= 80 ? 'var(--score-critical)' : issue.opinionShift >= 60 ? 'var(--score-warning)' : issue.opinionShift >= 40 ? 'var(--score-info)' : 'var(--text-tertiary)'
  );
</script>

<div
  bind:this={cardEl}
  use:pressAction={{ scale: 0.97 }}
  onclick={onOpen}
  onpointerdown={() => onPrefetch?.()}
  onkeydown={handleKeydown}
  role="article"
  tabindex="0"
  aria-label="{issue.headline}. Opinion Shift {issue.opinionShift}."
  class="mobile-card"
  style="background:var(--bg-elevated);box-shadow:0 2px 12px rgba(0,0,0,{isCompleted ? '0.03' : '0.06'});position:relative;"
>

  <!-- Status pill: NEW or UPDATED only -->
  <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
    {#if issue.status === 'new' && !readState}
      <span style="font-size:10px;font-weight:700;color:var(--status-green-text);background:var(--status-green-bg);padding:3px 8px;border-radius:4px;text-transform:uppercase;">New</span>
    {:else if issue.status === 'updated'}
      <span style="font-size:10px;font-weight:700;color:var(--status-blue-text);background:var(--status-blue-bg);padding:3px 8px;border-radius:4px;text-transform:uppercase;">Updated</span>
    {/if}
  </div>

  <!-- Issue art -->
  {#if issue.hasImage}
    <div style="margin:12px -24px 0;border-radius:0;overflow:hidden;opacity:{isCompleted ? 0.6 : 1};transition:opacity 0.15s ease;">
      <IssueImage issueId={issue.id} size="hero" aspectRatio="1.91/1" borderRadius="0" {eager} alt="Illustration for {issue.headline}" />
    </div>
  {/if}

  <!-- Headline -->
  <h2 class="headline" style="color:{isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)'};font-weight:{isCompleted ? 700 : 800};">{issue.headline}</h2>

  <!-- Score row -->
  <div style="display:flex;align-items:center;gap:8px;margin-top:12px;">
    <div style="flex:1;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="flex:1;height:6px;background:var(--bg-sunken);border-radius:3px;overflow:hidden;">
          <div class="bar-fill" style="height:100%;width:{barFillPercent}%;background:{scoreColor};border-radius:3px;"></div>
        </div>
      </div>
    </div>
    <span class="score-number" style="color:{scoreColor};">{displayScore}</span>
    {#if hasReaction}
      <svg width="10" height="10" viewBox="0 0 24 24" fill={scoreColor} stroke="none" style="opacity:0.4;flex-shrink:0;">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    {/if}
    <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">{label}</span>
  </div>

  <!-- Context -->
  <p class="context-text">{issue.context}</p>

  <!-- Bottom: progress bar only — no text labels -->
  <div style="flex:1;min-height:16px;"></div>
  <div style="flex-shrink:0;">
    {#if isStarted && readState && readState.progress > 0}
      <div style="height:3px;background:var(--bg-sunken);border-radius:2px;overflow:hidden;">
        <div style="height:100%;width:{(readState.progress / 6) * 100}%;background:var(--score-warning);border-radius:2px;transition:width var(--duration-normal, 250ms) ease;"></div>
      </div>
    {:else if isCompleted}
      <div style="height:3px;background:var(--status-green);border-radius:2px;opacity:0.3;"></div>
    {/if}
  </div>
</div>

<style>
  .mobile-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    border-radius: 20px;
    padding: 24px;
    cursor: pointer;
    overflow: hidden;
    min-height: var(--tap-min, 44px);
    transition: background var(--duration-normal, 250ms) var(--ease-out-cubic, cubic-bezier(0.33, 1, 0.68, 1)),
                box-shadow var(--duration-normal, 250ms) var(--ease-out-cubic, cubic-bezier(0.33, 1, 0.68, 1));
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .headline {
    font-size: 27px;
    line-height: 1.2;
    margin: 16px 0 0;
    letter-spacing: -0.02em;
    transition: color var(--duration-normal, 250ms) var(--ease-out-cubic, cubic-bezier(0.33, 1, 0.68, 1));
    overflow-wrap: break-word;
    word-break: break-word;
    hyphens: auto;
  }

  .bar-fill {
    transition: width var(--duration-slow, 450ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
  }

  .score-number {
    font-size: 14px;
    font-weight: 700;
    min-width: 24px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .context-text {
    font-size: 16px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 12px 0 0;
    font-weight: 450;
  }

  @media (prefers-reduced-motion: reduce) {
    .mobile-card,
    .headline,
    .bar-fill {
      transition: none !important;
    }
  }
</style>
