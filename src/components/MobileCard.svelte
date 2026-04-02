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
    isSaved?: boolean;
    hasConnections?: boolean;
    eager?: boolean;
  }
  let { issue, readState, onOpen, onPrefetch, hasReaction = false, isSaved = false, hasConnections = false, eager = false }: Props = $props();

  let isCompleted = $derived(readState?.state === 'completed');
  let isStarted = $derived(readState?.state === 'started');
  let totalAngles = $derived(issue.cards.length || 6);

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
        <span style="font-size:10px;font-weight:700;color:var(--status-green-text);background:var(--status-green-bg);padding:3px 8px;border-radius:4px;text-transform:uppercase;">New</span>
      {:else if issue.status === 'updated'}
        <span style="font-size:10px;font-weight:700;color:var(--status-blue-text);background:var(--status-blue-bg);padding:3px 8px;border-radius:4px;text-transform:uppercase;">Updated</span>
      {/if}
      {#if isSaved}
        <span style="font-size:10px;font-weight:700;color:var(--score-warning);background:rgba(210,140,40,0.1);padding:3px 8px;border-radius:4px;text-transform:uppercase;">Saved</span>
      {/if}
    </div>
    {#if isStarted && readState && readState.progress > 0}
      <span class="meta-pill">Angle {Math.min(readState.progress + 1, totalAngles)} of {totalAngles}</span>
    {:else if isCompleted}
      <span class="meta-pill">All {totalAngles} angles read</span>
    {:else}
      <span class="meta-pill">{totalAngles} angles</span>
    {/if}
  </div>

  <!-- Issue art -->
  {#if issue.hasImage}
    <div class="mobile-card-art" style="margin:12px -24px 0;border-radius:0;overflow:hidden;opacity:{isCompleted ? 0.6 : 1};transition:opacity 0.15s ease;">
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
          {#if isSaved}
            <span class="score-panel-dot"></span>
            <span>Saved</span>
          {/if}
          {#if hasReaction}
            <span class="score-panel-dot"></span>
            <span>Marked</span>
          {/if}
        </div>
      </div>
    </div>
    <div style="margin-top:10px;height:6px;background:var(--bg-sunken);border-radius:3px;overflow:hidden;">
      <div class="bar-fill" style="height:100%;width:{barFillPercent}%;background:{scoreColor};border-radius:3px;"></div>
    </div>
  </div>

  <!-- Headline -->
  <h2 class="headline" style="color:{isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)'};font-weight:{isCompleted ? 700 : 800};">{issue.headline}</h2>

  <!-- Context -->
  <p class="context-text">{issue.context}</p>

  <!-- Bottom: progress bar only — no text labels -->
  <div style="flex:1;min-height:16px;"></div>
  <div style="flex-shrink:0;">
    <div class="mobile-callout">
      {#if isStarted && readState && readState.progress > 0}
        Continue from angle {Math.min(readState.progress + 1, totalAngles)} of {totalAngles}
      {:else if isCompleted}
        Revisit the full six-angle read
      {:else}
        Tap to read all {totalAngles} angles
      {/if}
    </div>
    {#if isStarted && readState && readState.progress > 0}
      <div style="height:3px;background:var(--bg-sunken);border-radius:2px;overflow:hidden;">
        <div style="height:100%;width:{(readState.progress / totalAngles) * 100}%;background:var(--score-warning);border-radius:2px;transition:width var(--duration-normal, 250ms) ease;"></div>
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

  .score-number--hero {
    font-family: var(--font-display);
    font-size: 42px;
    line-height: 0.92;
    letter-spacing: -0.05em;
    min-width: 54px;
    text-align: left;
  }

  .score-panel {
    margin-top: 16px;
    padding: 14px 16px;
    border-radius: 18px;
    background: var(--bg);
    border: 1px solid var(--border-subtle);
  }

  .score-panel-kicker,
  .meta-pill {
    font-size: 10px;
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
    border-radius: 999px;
  }

  .score-panel-main {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .score-panel-line {
    font-size: 14px;
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
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .score-panel-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--border-divider);
  }

  .context-text {
    font-size: 16px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 12px 0 0;
    font-weight: 450;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .mobile-callout {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-secondary);
    margin: 0 0 10px;
  }

  @media (max-width: 390px) {
    .mobile-card {
      padding: 20px;
    }

    .headline {
      font-size: 24px;
    }

    .score-number--hero {
      font-size: 38px;
      min-width: 48px;
    }

    .context-text {
      font-size: 15px;
    }
  }

  @media (max-height: 640px) {
    .mobile-card {
      padding: 18px;
      border-radius: 18px;
    }

    .mobile-card-art {
      margin: 10px -18px 0 !important;
    }

    .headline {
      font-size: 24px;
      margin-top: 12px;
    }

    .score-panel {
      margin-top: 12px;
      padding: 12px 14px;
    }

    .score-number--hero {
      font-size: 36px;
      min-width: 46px;
    }

    .context-text {
      margin-top: 10px;
      font-size: 15px;
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
      font-size: 21px;
      line-height: 1.15;
      margin-top: 10px;
    }

    .score-panel {
      margin-top: 10px;
      padding: 10px 12px;
    }

    .score-panel-main {
      gap: 10px;
    }

    .score-number--hero {
      font-size: 32px;
      min-width: 40px;
    }

    .score-panel-line {
      font-size: 13px;
    }

    .score-panel-meta,
    .mobile-callout {
      font-size: 10px;
    }

    .context-text {
      margin-top: 8px;
      font-size: 13px;
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
