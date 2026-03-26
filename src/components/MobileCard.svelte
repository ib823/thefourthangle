<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import OpinionBar from './OpinionBar.svelte';
  import VerdictBar from './VerdictBar.svelte';
  import { opinionLabel, issueCategory } from '../data/issues';
  import { pressAction } from '../lib/actions/press';
  import { tween, stagger, countUp, ease } from '../lib/animation';

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
  let category = $derived(issueCategory(issue));

  // Viewport animation state
  let hasEnteredViewport = $state(false);
  let displayScore = $state(0);
  let barFillPercent = $state(0);
  let dotScales: number[] = $state([]);
  let badgeScale = $state(0);
  let prefersReducedMotion = false;

  let cardEl: HTMLElement | undefined = $state(undefined);
  let observer: IntersectionObserver | undefined;
  let cleanups: (() => void)[] = [];

  // Number of opinion dots (mapped from score thresholds)
  const dotCount = 5;

  onMount(() => {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Initialize dot scales
    dotScales = Array(dotCount).fill(0);

    if (prefersReducedMotion) {
      // Skip animations, show final state immediately
      hasEnteredViewport = true;
      displayScore = issue.opinionShift;
      barFillPercent = issue.opinionShift;
      dotScales = Array(dotCount).fill(1);
      badgeScale = 1;
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
    // 1. Bar fill: 0 → score over 400ms with outExpo
    const cancelBar = tween(0, issue.opinionShift, 400, ease.outExpo, (v) => {
      barFillPercent = v;
    });
    cleanups.push(cancelBar);

    // 2. Score count-up: 0 → opinionShift over 400ms with decel
    const cancelCount = countUp(0, issue.opinionShift, 400, (v) => {
      displayScore = v;
    });
    cleanups.push(cancelCount);

    // 3. Opinion dots sequential pop-in: 50ms stagger
    const cancelDots = stagger(dotCount, 50, 400, (index) => {
      dotScales = [...dotScales.slice(0, index), 1, ...dotScales.slice(index + 1)];
    });
    cleanups.push(cancelDots);

    // 4. Badge pills pop-in: 150ms delay, then spring
    const badgeTimeout = setTimeout(() => {
      badgeScale = 1;
    }, 150);
    cleanups.push(() => clearTimeout(badgeTimeout));
  }

  onDestroy(() => {
    observer?.disconnect();
    cleanups.forEach(fn => fn());
  });

  // Score color
  let scoreColor = $derived(
    issue.opinionShift >= 80 ? 'var(--score-critical)' : issue.opinionShift >= 60 ? 'var(--score-warning)' : issue.opinionShift >= 40 ? 'var(--score-info)' : 'var(--text-tertiary)'
  );
</script>

<div
  bind:this={cardEl}
  use:pressAction={{ scale: 0.97 }}
  onclick={onOpen}
  onkeydown={handleKeydown}
  role="article"
  tabindex="0"
  aria-label="{issue.headline}. Opinion Shift {issue.opinionShift}. {issue.status === 'new' ? 'New.' : issue.status === 'updated' ? 'Updated.' : ''} {isCompleted ? 'Covered.' : isStarted ? 'Exploring.' : 'Unread.'}"
  class="mobile-card"
  style="background:var(--bg-elevated);box-shadow:0 2px 12px rgba(0,0,0,{isCompleted ? '0.03' : '0.06'});"
>
  <!-- Top row: badges -->
  <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
    {#if isStarted}
      <div class="badge-pill" style="transform:scale({badgeScale});display:flex;align-items:center;gap:4px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;"><circle cx="12" cy="12" r="9" stroke="var(--score-warning)" stroke-width="2" fill="none"/><path d="M12 3a9 9 0 0 1 0 18" fill="var(--score-warning)"/></svg>
        <span style="font-size:10px;font-weight:600;color:var(--score-warning);">Exploring</span>
      </div>
    {:else if isCompleted}
      <div class="badge-pill" style="transform:scale({badgeScale});display:flex;align-items:center;gap:4px;">
        <div style="width:16px;height:16px;border-radius:50%;background:var(--status-green-bg);display:flex;align-items:center;justify-content:center;">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span style="font-size:10px;font-weight:600;color:var(--status-green);">Covered</span>
      </div>
    {:else}
      {#if issue.status === 'new'}
        <span class="badge-pill status-badge" style="transform:scale({badgeScale});font-size:11px;font-weight:700;color:var(--status-green-text);background:var(--status-green-bg);padding:4px 8px;border-radius:4px;text-transform:uppercase;">New</span>
      {:else if issue.status === 'updated'}
        <span class="badge-pill status-badge" style="transform:scale({badgeScale});font-size:11px;font-weight:700;color:var(--status-blue-text);background:var(--status-blue-bg);padding:4px 8px;border-radius:4px;text-transform:uppercase;">Updated</span>
      {/if}
    {/if}
    {#if issue.edition > 1}
      <span style="font-size:10px;color:var(--text-tertiary);">Ed.{issue.edition}</span>
    {/if}
  </div>

  <!-- Headline -->
  <h2 class="headline" style="color:{isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)'};">{issue.headline}</h2>
  <span style="font-size:10px;font-weight:500;color:var(--text-tertiary);margin-top:4px;">{category}</span>

  <!-- Score row -->
  <div style="display:flex;align-items:center;gap:8px;margin-top:12px;">
    <div style="flex:1;">
      <!-- Custom animated bar instead of OpinionBar for viewport-triggered animation -->
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="flex:1;height:6px;background:var(--bg-sunken);border-radius:3px;overflow:hidden;">
          <div class="bar-fill" style="height:100%;width:{barFillPercent}%;background:{scoreColor};border-radius:3px;"></div>
        </div>
      </div>
    </div>
    <span class="score-number" style="color:{scoreColor};">{displayScore}</span>
    <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">{label}</span>
  </div>

  <!-- Opinion dots -->
  <div style="display:flex;gap:4px;margin-top:8px;">
    {#each { length: dotCount } as _, i}
      <div
        class="opinion-dot"
        style="transform:scale({dotScales[i] ?? 0});background:{i < Math.ceil(issue.opinionShift / 20) ? scoreColor : 'var(--border-subtle)'};"
      ></div>
    {/each}
  </div>

  <!-- Verdict bar -->
  {#if issue.stageScores && issue.finalScore}
    <div style="margin-top:12px;">
      <VerdictBar scores={issue.stageScores} finalScore={issue.finalScore} compact={false} />
    </div>
  {/if}

  <!-- Context -->
  <p class="context-text">{issue.context}</p>

  <!-- Bottom — source attribution placeholder + hint -->
  <div style="flex:1;min-height:16px;"></div>
  <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
    {#if !readState}
      <span style="font-size:12px;color:var(--text-tertiary);font-weight:500;">Tap to read</span>
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
    font-weight: 800;
    line-height: 1.2;
    margin: 16px 0 0;
    letter-spacing: -0.02em;
    transition: color var(--duration-normal, 250ms) var(--ease-out-cubic, cubic-bezier(0.33, 1, 0.68, 1));
    overflow-wrap: break-word;
    word-break: break-word;
    hyphens: auto;
  }

  .bar-fill {
    transition: width 400ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
  }

  .score-number {
    font-size: 14px;
    font-weight: 700;
    min-width: 24px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .opinion-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transition: transform 300ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  }

  .badge-pill {
    transition: transform 300ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
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
    .bar-fill,
    .opinion-dot,
    .badge-pill {
      transition: none !important;
    }
  }
</style>
