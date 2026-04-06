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
  let totalAngles = $derived(issue.cards.length || 6);
  let nextAngle = $derived(Math.min((readState?.progress ?? 0) + 1, totalAngles));

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
    issue.opinionShift >= 80 ? 'var(--score-strong)' : issue.opinionShift >= 60 ? 'var(--score-medium)' : issue.opinionShift >= 40 ? 'var(--score-partial)' : 'var(--text-tertiary)'
  );

  function opinionTone(score: number): string {
    if (score >= 80) return 'Headline hides most of it';
    if (score >= 60) return 'Headline misses key context';
    if (score >= 40) return 'Headline only tells part of it';
    return 'Headline gets the surface';
  }
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
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0;">
    <div style="display:flex;align-items:center;gap:8px;">
      {#if issue.status === 'new' && !readState}
        <span style="font-size: var(--text-micro);font-weight:700;color:var(--status-green-text);background:var(--status-green-bg);padding:4px 8px;border-radius: var(--radius-sm);text-transform:uppercase;">New</span>
      {:else if issue.status === 'updated'}
        <span style="font-size: var(--text-micro);font-weight:700;color:var(--status-blue-text);background:var(--status-blue-bg);padding:4px 8px;border-radius: var(--radius-sm);text-transform:uppercase;">Updated</span>
      {/if}
      {#if hasReaction}
        <span style="font-size: var(--text-micro);font-weight:700;color:var(--highlight-accent);background:var(--highlight-bg);padding:4px 8px;border-radius: var(--radius-sm);text-transform:uppercase;">Highlighted</span>
      {/if}
    </div>
    {#if isStarted && readState && readState.progress > 0}
      <span class="meta-pill">Next: angle {nextAngle}</span>
    {:else if isCompleted}
      <span class="meta-pill">Complete</span>
    {:else}
      <span class="meta-pill">Ready</span>
    {/if}
  </div>

  <!-- Issue art -->
  {#if issue.hasImage}
    <div class="mobile-card-art" style="margin:12px -24px 0;border-radius:0;overflow:hidden;opacity:{isCompleted ? 0.6 : 1};transition:opacity 0.2s ease-out;">
      <IssueImage issueId={issue.id} size="hero" aspectRatio="1.91/1" borderRadius="0" {eager} alt="Illustration for {issue.headline}" />
    </div>
  {/if}

  <div class="score-panel">
    <div class="score-panel-kicker">Opinion Shift</div>
    <div class="score-panel-main">
      <span class="score-number score-number--hero" style="color:{scoreColor};">{displayScore}</span>
      <div class="score-panel-copy">
        <div class="score-panel-line">{opinionTone(issue.opinionShift)}</div>
        <div class="score-panel-meta">
          <span>{label}</span>
          {#if hasReaction}
            <span class="score-panel-dot"></span>
            <span>Highlighted</span>
          {/if}
        </div>
      </div>
    </div>
    <div style="margin-top:10px;height:3px;background:var(--bg-sunken);border-radius: var(--radius-pill);overflow:hidden;">
      <div class="bar-fill" style="height:100%;width:{barFillPercent}%;background:{scoreColor};border-radius: var(--radius-pill);"></div>
    </div>
  </div>

  <!-- Headline -->
  <h2 class="headline balance-title" style="color:{isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)'};font-weight:{isCompleted ? 600 : 700};">{issue.headline}</h2>

  <!-- Context -->
  <p class="context-text">{issue.context}</p>

  <!-- Bottom: progress bar only — no text labels -->
  <div style="flex:1;min-height:16px;"></div>
  <div style="flex-shrink:0;">
    <div class="mobile-callout">
      {#if isStarted && readState && readState.progress > 0}
        Continue from angle {nextAngle}
      {:else if isCompleted}
        Revisit the full read
      {:else}
        Start reading
      {/if}
    </div>
    {#if isStarted && readState && readState.progress > 0}
      <div style="height:3px;background:var(--bg-sunken);border-radius: var(--radius-pill);overflow:hidden;">
        <div style="height:100%;width:{(readState.progress / totalAngles) * 100}%;background:var(--score-warning);border-radius: var(--radius-pill);transition:width var(--duration-normal, 250ms) ease;"></div>
      </div>
    {:else if isCompleted}
      <div style="height:3px;background:var(--status-green);border-radius: var(--radius-pill);opacity:0.3;"></div>
    {/if}
  </div>
</div>

<style>
  .mobile-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl);
    padding: 24px;
    cursor: pointer;
    overflow: hidden;
    min-height: var(--tap-min, 44px);
    transition: background var(--duration-normal, 250ms) var(--ease-out-cubic, cubic-bezier(0.33, 1, 0.68, 1)),
                box-shadow var(--duration-normal, 250ms) var(--ease-out-cubic, cubic-bezier(0.33, 1, 0.68, 1));
    touch-action: pan-y;
    overflow-anchor: none;
    -webkit-tap-highlight-color: transparent;
  }

  .headline {
    font-size: var(--text-title-lg);
    line-height: 1.08;
    margin: 16px 0 0;
    letter-spacing: -0.035em;
    transition: color var(--duration-normal, 250ms) var(--ease-out-cubic, cubic-bezier(0.33, 1, 0.68, 1));
    overflow-wrap: normal;
    hyphens: auto;
    max-width: 20ch;
  }

  .bar-fill {
    transition: width var(--duration-slow, 450ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
  }

  .score-number {
    font-size: var(--text-body);
    font-weight: 700;
    min-width: 24px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .score-number--hero {
    font-family: var(--font-display);
    font-size: var(--text-hero);
    line-height: 0.92;
    letter-spacing: -0.05em;
    min-width: 54px;
    text-align: left;
  }

  .score-panel {
    margin-top: 16px;
    padding: 14px 16px;
    border-radius: var(--radius-lg);
    background: var(--bg);
    border: 1px solid var(--border-subtle);
  }

  .score-panel-kicker,
  .meta-pill {
    font-size: var(--text-micro);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .score-panel-kicker {
    color: var(--text-tertiary);
  }

  .meta-pill {
    color: var(--text-secondary);
    background: var(--bg-sunken);
    padding: 4px 8px;
    border-radius: var(--radius-pill);
  }

  .score-panel-main {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .score-panel-line {
    font-size: var(--text-body);
    line-height: 1.35;
    font-weight: 700;
    color: var(--text-primary);
  }

  .score-panel-meta {
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-secondary);
  }

  .score-panel-dot {
    width: 4px;
    height: 4px;
    border-radius: var(--radius-round);
    background: var(--border-divider);
  }

  .context-text {
    font-size: var(--text-body-lg);
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 12px 0 0;
    font-weight: 400;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .mobile-callout {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-secondary);
    margin: 0 0 10px;
  }

  @media (max-width: 390px) {
    .mobile-card {
      padding: 20px;
    }

    .headline {
      font-size: var(--text-title);
    }

    .score-number--hero {
      font-size: var(--text-hero);
      min-width: 48px;
    }

    .context-text {
      font-size: var(--text-body);
    }
  }

  @media (max-height: 640px) {
    .mobile-card {
      padding: 18px;
      border-radius: var(--radius-lg);
    }

    .mobile-card-art {
      margin: 10px -18px 0 !important;
    }

    .headline {
      font-size: var(--text-title);
      margin-top: 12px;
    }

    .score-panel {
      margin-top: 12px;
      padding: 12px 14px;
    }

    .score-number--hero {
      font-size: var(--text-metric);
      min-width: 46px;
    }

    .context-text {
      margin-top: 10px;
      font-size: var(--text-body);
      -webkit-line-clamp: 2;
    }

    .mobile-callout {
      margin-bottom: 8px;
    }
  }

  @media (orientation: landscape) and (max-height: 640px) {
    .mobile-card {
      padding: 16px 18px;
    }

    .mobile-card-art {
      display: none;
    }

    .headline {
      font-size: var(--text-subtitle);
      line-height: 1.15;
      margin-top: 10px;
      max-width: 100%;
    }

    .score-panel {
      margin-top: 10px;
      padding: 10px 12px;
    }

    .score-panel-main {
      gap: 10px;
    }

    .score-number--hero {
      font-size: var(--text-title-lg);
      min-width: 40px;
    }

    .score-panel-line {
      font-size: var(--text-ui);
    }

    .score-panel-meta,
    .mobile-callout {
      font-size: var(--text-micro);
    }

    .context-text {
      margin-top: 8px;
      font-size: var(--text-ui);
      line-height: 1.45;
      -webkit-line-clamp: 2;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mobile-card,
    .headline,
    .bar-fill {
      transition: none !important;
    }
  }
</style>
