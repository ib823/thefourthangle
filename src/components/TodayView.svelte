<script lang="ts">
  import { QUOTES } from '../data/quotes';
  import IssueImage from './IssueImage.svelte';

  import type { IssueSummary } from '../lib/issues-loader';
  import type { FeedSection } from '../lib/feed-sections';

  interface Props {
    issueCount?: number;
    topIssue?: IssueSummary | null;
    issues?: IssueSummary[];
    sections?: FeedSection[];
    readMap?: Record<string, string>;
    readingCount?: number;
    highlightCount?: number;
    onOpenIssue?: (issue: IssueSummary) => void;
    onOpenLibraryReading?: () => void;
    onOpenLibraryHighlights?: () => void;
    onOpenLibraryArchive?: () => void;
    allowPullRefresh?: boolean;
    onPullRefresh?: () => void;
  }
  let {
    issueCount = 0,
    topIssue = null,
    issues = [],
    sections = [],
    readMap = {},
    readingCount = 0,
    highlightCount = 0,
    onOpenIssue,
    onOpenLibraryReading,
    onOpenLibraryHighlights,
    onOpenLibraryArchive,
    allowPullRefresh = false,
    onPullRefresh,
  }: Props = $props();

  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  let hasIssues = $derived(issueCount > 0);
  let continueIssue = $derived(sections.find((section) => section.kind === 'continue')?.issues[0] ?? null);
  let continueProgress = $derived.by(() => {
    if (!continueIssue) return 0;
    const raw = readMap[continueIssue.id];
    if (!raw) return 0;
    if (raw === 'true') return 6;
    try { return JSON.parse(raw).progress ?? 0; } catch { return 0; }
  });
  let nextContinueAngle = $derived(Math.min(continueProgress + 1, 6));
  let newIssues = $derived(sections.find((section) => section.kind === 'new')?.issues ?? []);
  let briefingIssues = $derived.by(() => {
    const picked: IssueSummary[] = [];
    const seen = new Set<string>();
    if (topIssue) seen.add(topIssue.id);

    for (const issue of newIssues) {
      if (seen.has(issue.id)) continue;
      seen.add(issue.id);
      picked.push(issue);
      if (picked.length === 3) return picked;
    }
    for (const issue of issues) {
      if (seen.has(issue.id)) continue;
      seen.add(issue.id);
      picked.push(issue);
      if (picked.length === 3) break;
    }
    return picked;
  });
  let readyMinutes = $derived(Math.max(4, briefingIssues.length * 3 + (continueIssue ? 2 : 0)));
  let todayDeckCopy = $derived.by(() => {
    if (continueIssue) return 'Start with the lead, then resume where you stopped.';
    return 'Start with the lead, then move into the briefing.';
  });

  const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';
  const pullThreshold = 72;
  const pullMax = 104;

  let todayShellEl: HTMLDivElement | undefined = $state();
  let touchTracking = false;
  let touchStartY = 0;
  let touchStartX = 0;
  let touchStartScrollTop = 0;
  let pullDistance = $state(0);
  let pullRefreshState = $state<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle');

  function resetPullRefresh() {
    if (pullRefreshState === 'refreshing') return;
    pullDistance = 0;
    pullRefreshState = 'idle';
  }

  function onTouchStart(event: TouchEvent) {
    if (!todayShellEl || !allowPullRefresh || pullRefreshState === 'refreshing' || event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchTracking = true;
    touchStartY = touch.clientY;
    touchStartX = touch.clientX;
    touchStartScrollTop = todayShellEl.scrollTop;
  }

  function onTouchMove(event: TouchEvent) {
    if (!todayShellEl || !touchTracking || !allowPullRefresh || pullRefreshState === 'refreshing' || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaY = touch.clientY - touchStartY;
    const deltaX = touch.clientX - touchStartX;
    const pullingFromTop = touchStartScrollTop <= 0 && todayShellEl.scrollTop <= 0 && deltaY > 0;
    const mostlyVertical = Math.abs(deltaY) >= Math.abs(deltaX) * 1.15;

    if (!pullingFromTop || !mostlyVertical) {
      if (pullRefreshState !== 'idle') resetPullRefresh();
      return;
    }

    if (event.cancelable) event.preventDefault();
    pullDistance = Math.min(pullMax, Math.max(0, deltaY * 0.5));
    pullRefreshState = pullDistance >= pullThreshold ? 'ready' : 'pulling';
  }

  function onTouchEnd() {
    touchTracking = false;
    if (pullRefreshState === 'ready' && onPullRefresh) {
      pullRefreshState = 'refreshing';
      pullDistance = 58;
      onPullRefresh();
      return;
    }
    resetPullRefresh();
  }

  function onTouchCancel() {
    touchTracking = false;
    resetPullRefresh();
  }

  function formatDate(iso: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso + 'T00:00:00Z');
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    } catch {
      return iso;
    }
  }

  function opinionTone(score: number): string {
    if (score >= 80) return 'The headline hides most of the real story.';
    if (score >= 60) return 'The headline misses major context.';
    if (score >= 40) return 'The headline only gives you part of it.';
    return 'The headline gets the surface, not the full frame.';
  }

  function opinionColor(score: number): string {
    if (score >= 80) return 'var(--score-strong)';
    if (score >= 60) return 'var(--score-medium)';
    if (score >= 40) return 'var(--score-partial)';
    return 'var(--score-neutral)';
  }
</script>

<div
  class="today-shell"
  bind:this={todayShellEl}
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ontouchend={onTouchEnd}
  ontouchcancel={onTouchCancel}
>
  {#if allowPullRefresh}
    <div
      class="pull-refresh"
      class:pull-refresh--visible={pullRefreshState !== 'idle'}
      class:pull-refresh--ready={pullRefreshState === 'ready' || pullRefreshState === 'refreshing'}
      style={`transform: translate3d(-50%, ${Math.round(Math.max(-24, pullDistance - 44))}px, 0); opacity: ${Math.min(1, pullDistance / 36)};`}
      aria-hidden="true"
    >
      {#if pullRefreshState === 'refreshing'}
        Refreshing…
      {:else if pullRefreshState === 'ready'}
        Release to refresh
      {:else}
        Pull to refresh
      {/if}
    </div>
  {/if}
  <div class="today-wrap">
    {#if hasIssues}
      <div class="today-topline">
        <div>
          <div class="today-kicker">Today</div>
          <h1 class="today-title">See what deserves your full attention.</h1>
          <p class="today-intro pretty-copy">{todayDeckCopy}</p>
        </div>
        <div class="today-status">
          <span>about {readyMinutes} min</span>
          <span class="today-divider"></span>
          <span>updated {formatDate(buildDate)}</span>
        </div>
      </div>

      {#if topIssue && onOpenIssue}
        <article class="hero-entry" aria-labelledby="lead-issue-title">
        <button
          class="hero-card"
          onclick={() => onOpenIssue?.(topIssue)}
          aria-label={`Read lead issue: ${topIssue.headline}`}
        >
          {#if topIssue.hasImage}
            <div class="hero-art">
              <IssueImage issueId={topIssue.id} size="hero" aspectRatio="16/9" borderRadius="0" alt="Illustration for {topIssue.headline}" eager={true} />
            </div>
          {/if}
          <div class="hero-scrim"></div>
          <div class="hero-grid">
            <div class="hero-copy">
              <div class="hero-badge">Editor's Pick</div>
              <h2 id="lead-issue-title" class="hero-headline balance-title">{topIssue.headline}</h2>
              <p class="hero-context pretty-copy">{topIssue.context}</p>
            </div>
            <div class="hero-shift">
              <div class="hero-shift-kicker">Opinion Shift</div>
              <div class="hero-shift-score" style="color:{opinionColor(topIssue.opinionShift)};">{topIssue.opinionShift}</div>
              <p class="hero-shift-copy">{opinionTone(topIssue.opinionShift)}</p>
              <div class="hero-shift-meter">
                <div class="hero-shift-fill" style="width:{topIssue.opinionShift}%;background:{opinionColor(topIssue.opinionShift)};"></div>
              </div>
              <div class="hero-shift-foot">How much the headline hides.</div>
              <div class="hero-cta">Start reading <span aria-hidden="true">→</span></div>
            </div>
          </div>
        </button>
        </article>
      {/if}

      <div class="today-grid">
        {#if continueIssue && onOpenIssue}
        <section class="today-panel" aria-labelledby="continue-reading-heading">
          <div class="panel-kicker">Continue Reading</div>
          <h2 id="continue-reading-heading" class="sr-only">Continue Reading</h2>
            <button class="panel-issue" onclick={() => onOpenIssue?.(continueIssue)}>
              <div class="panel-issue-title balance-title">{continueIssue.headline}</div>
              <div class="panel-issue-copy pretty-copy">Next: angle {nextContinueAngle}. Pick up where the argument starts to turn.</div>
              <div class="panel-progress-row">
                <div class="panel-progress-track">
                  <div class="panel-progress-fill" style="width:{Math.min(100, (continueProgress / 6) * 100)}%;"></div>
                </div>
                <span>Angle {nextContinueAngle} next</span>
              </div>
            </button>
        </section>
        {/if}

        <section class="today-panel" aria-labelledby="daily-briefing-heading">
          <div class="panel-kicker">Daily Briefing</div>
          <h2 id="daily-briefing-heading" class="panel-title">Three strong places to start.</h2>
          <div class="panel-subtitle">High-yield reads in about {Math.max(6, briefingIssues.length * 3)} minutes.</div>
          <div class="brief-list">
            {#each briefingIssues as issue}
              <button class="brief-item" onclick={() => onOpenIssue?.(issue)}>
                <div class="brief-score" style="color:{opinionColor(issue.opinionShift)};">{issue.opinionShift}</div>
                <div class="brief-copy">
                  <div class="brief-headline balance-title">{issue.headline}</div>
                  <div class="brief-context pretty-copy">{issue.context}</div>
                </div>
              </button>
            {/each}
          </div>
        </section>
      </div>

      <footer class="today-footer">
        <div class="today-quote">"{quote}"</div>
      </footer>
    {:else}
      <div class="coming-soon">
        <div class="today-kicker">Coming Soon</div>
        <h1 class="today-title">New issues publish three times a week.</h1>
        <p class="today-quote">"{quote}"</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .today-shell {
    position: relative;
    flex: 1;
    overflow-y: auto;
    background:
      radial-gradient(circle at top right, rgba(210, 140, 40, 0.08), transparent 28%),
      linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 22%, var(--bg) 100%);
  }

  .pull-refresh {
    position: sticky;
    top: 10px;
    left: 50%;
    z-index: 5;
    width: fit-content;
    margin: 0 0 -32px;
    padding: 8px 14px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.88);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: 700;
    box-shadow: 0 12px 28px rgba(17, 24, 39, 0.08);
    pointer-events: none;
    transition: opacity 0.18s ease, transform 0.18s ease, border-color 0.18s ease, color 0.18s ease;
    will-change: transform, opacity;
  }

  .pull-refresh--ready {
    border-color: rgba(184, 92, 0, 0.22);
    color: var(--text-primary);
  }

  @media (prefers-color-scheme: dark) {
    .pull-refresh {
      background: rgba(34, 31, 27, 0.92);
      border-color: rgba(255, 255, 255, 0.08);
      box-shadow: 0 16px 28px rgba(0, 0, 0, 0.28);
    }

    .pull-refresh--ready {
      border-color: rgba(200, 150, 58, 0.24);
    }
  }

  .today-wrap {
    max-width: 1080px;
    margin: 0 auto;
    padding: 32px 24px 56px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .today-topline {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
  }

  .today-kicker,
  .panel-kicker {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }

  .today-title {
    margin: 12px 0 0;
    font-family: var(--font-display);
    font-size: var(--text-home-title-fluid);
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    max-width: 15ch;
  }

  .today-intro {
    margin: 12px 0 0;
    max-width: 40ch;
    font-size: var(--text-body);
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .today-status {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.72);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: 600;
    white-space: nowrap;
  }

  .hero-entry {
    display: block;
  }

  .today-divider {
    width: 4px;
    height: 4px;
    border-radius: var(--radius-round);
    background: var(--border-divider);
  }

  .hero-card,
  .panel-issue,
  .brief-item {
    width: 100%;
    border: none;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }

  .hero-card {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-xl);
    min-height: 340px;
    background: linear-gradient(135deg, rgba(20, 20, 20, 0.94), rgba(28, 28, 28, 0.82));
    color: #fff;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08);
    transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
  }

  .hero-art,
  .hero-art :global(img),
  .hero-art :global(picture) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .hero-scrim {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(10, 10, 10, 0.82) 0%, rgba(10, 10, 10, 0.56) 45%, rgba(10, 10, 10, 0.7) 100%),
      linear-gradient(180deg, rgba(210, 140, 40, 0.16), transparent 36%);
  }

  .hero-grid {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(260px, 0.7fr);
    gap: 28px;
    min-height: 340px;
    padding: 32px;
    align-items: end;
  }

  .hero-copy {
    max-width: 56ch;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    padding: 8px 12px;
    border-radius: var(--radius-pill);
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.18);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hero-headline {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-issue-title-fluid);
    line-height: 1.15;
    letter-spacing: -0.02em;
    max-width: 15ch;
  }

  .hero-context,
  .hero-shift-copy,
  .hero-shift-foot {
    margin: 0;
  }

  .hero-context {
    font-size: var(--text-body);
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.78);
    max-width: 56ch;
  }

  .hero-shift {
    padding: 24px;
    border-radius: var(--radius-xl);
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .hero-shift-kicker {
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.7);
  }

  .hero-shift-score {
    font-family: var(--font-display);
    font-size: var(--text-display);
    line-height: 0.88;
    letter-spacing: -0.05em;
    margin-top: 14px;
  }

  .hero-shift-copy {
    font-size: var(--text-body);
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.82);
    margin-top: 10px;
  }

  .hero-shift-meter,
  .panel-progress-track {
    height: 8px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: var(--radius-pill);
    overflow: hidden;
    margin-top: 14px;
  }

  .hero-shift-fill,
  .panel-progress-fill {
    height: 100%;
    border-radius: var(--radius-pill);
  }

  .hero-shift-foot {
    margin-top: 10px;
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.02em;
    color: rgba(255, 255, 255, 0.58);
  }

  .hero-cta {
    margin-top: 16px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--text-ui);
    font-weight: 700;
    color: #fff;
  }

  .today-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .today-panel {
    padding: 24px;
    border-radius: var(--radius-xl);
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.76);
    box-shadow: 0 12px 28px rgba(20, 20, 20, 0.05);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .panel-title {
    font-family: var(--font-display);
    font-size: var(--text-title);
    line-height: 1.04;
    letter-spacing: -0.03em;
    color: var(--text-primary);
  }

  .panel-subtitle,
  .panel-empty-copy,
  .panel-issue-copy,
  .brief-context,
  .today-quote {
    font-size: var(--text-ui);
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .panel-issue,
  .brief-item {
    padding: 16px;
    border-radius: var(--radius-lg);
    background: var(--bg);
    border: 1px solid var(--border-subtle);
    transition: transform 0.2s ease-out, border-color 0.2s ease-out, box-shadow 0.2s ease-out;
  }

  @media (hover: hover) {
    .panel-issue:hover,
    .brief-item:hover {
      transform: translateY(-2px);
    }

    .hero-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 32px 80px rgba(0, 0, 0, 0.12);
    }
  }

  .panel-issue-title,
  .brief-headline {
    font-size: var(--text-body);
    font-weight: 700;
    line-height: 1.28;
    color: var(--text-primary);
  }

  .panel-progress-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-secondary);
  }

  .panel-progress-track {
    flex: 1;
    height: 6px;
    margin-top: 0;
    background: var(--bg-sunken);
  }

  .panel-progress-fill {
    background: var(--score-warning);
  }

  .panel-empty-title {
    font-size: var(--text-sm);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }

  .brief-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
    gap: 12px;
  }

  .brief-item {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }

  .brief-score {
    font-family: var(--font-display);
    font-size: var(--text-metric);
    line-height: 0.92;
    letter-spacing: -0.05em;
  }

  .today-footer {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 20px;
    padding: 0 2px;
  }

  .today-quote {
    font-style: italic;
    max-width: 44ch;
    text-align: right;
  }

  .coming-soon {
    padding: 40px 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  @media (min-width: 1024px) {
    .panel-issue,
    .brief-item {
      padding: 20px;
    }

    /* Fix: title at 1024px was cramped at 12ch/line. Span full width above hero. */
    .today-topline {
      flex-direction: column;
      align-items: flex-start;
    }

    .today-title {
      max-width: none;
    }

    /* Constrain hero context to prevent 82ch+ line lengths on wide viewports */
    .hero-context {
      max-width: 40ch;
    }
  }

  /* Tablet: increase body text for arm's-length reading */
  @media (min-width: 769px) and (max-width: 1023px) {
    .today-intro,
    .hero-context {
      font-size: var(--text-body-lg);
    }
  }

  @media (max-width: 1023px) {
    .hero-grid {
      grid-template-columns: minmax(0, 1.15fr) minmax(220px, 0.85fr);
      min-height: 360px;
      padding: 24px;
      gap: 24px;
      align-items: end;
    }

  }

  @media (max-width: 767px) {
    .today-wrap {
      padding: 16px 16px 28px;
      gap: 16px;
    }

    .today-topline,
    .today-footer {
      flex-direction: column;
      align-items: flex-start;
    }

    .today-status {
      flex-wrap: wrap;
      white-space: normal;
    }

    .hero-card {
      min-height: 0;
      border-radius: var(--radius-xl);
    }

    .hero-grid {
      grid-template-columns: 1fr;
      min-height: 0;
      padding: 20px;
      gap: 20px;
    }

    .hero-headline {
      max-width: none;
    }

    .hero-shift-score {
      font-size: var(--text-display);
    }

    .today-grid {
      grid-template-columns: 1fr;
    }

    .today-panel {
      padding: 16px;
      border-radius: var(--radius-xl);
    }

    .brief-list {
      grid-template-columns: 1fr;
    }

    .brief-score {
      font-size: var(--text-title-lg);
    }

    .today-quote {
      text-align: left;
      max-width: none;
    }
  }

  @media (prefers-color-scheme: dark) {
    .today-shell {
      background:
        radial-gradient(circle at top right, rgba(200, 150, 58, 0.12), transparent 28%),
        linear-gradient(180deg, #141312 0%, #171614 22%, #171614 100%);
    }

    .today-status {
      background: rgba(38, 34, 29, 0.88);
      border-color: var(--border-divider);
      color: var(--text-secondary);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    }

    .today-divider {
      background: rgba(255, 255, 255, 0.16);
    }

    .today-panel {
      background: rgba(34, 31, 27, 0.92);
      border-color: rgba(255, 255, 255, 0.06);
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.28);
    }

    .panel-issue,
    .brief-item {
      background: rgba(25, 24, 22, 0.96);
      border-color: var(--border-divider);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
    }

  }

  @media (prefers-color-scheme: dark) and (hover: hover) {
    .hero-card:hover,
    .panel-issue:hover,
    .brief-item:hover {
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34);
    }

    .today-quote {
      color: var(--text-muted);
    }
  }
</style>
