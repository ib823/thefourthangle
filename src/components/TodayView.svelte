<script lang="ts">
  import { QUOTES } from '../data/quotes';
  import { opinionLabel, opinionColor as issueOpinionColor } from '../data/issue-types';
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
  let nextContinueAngle = $derived(Math.min(continueProgress + 1, continueIssue?.cards.length ?? 6));
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
  // Topic clusters: derive primary lens per issue, group into browsable topics
  interface TopicCluster {
    topic: string;
    count: number;
    issues: IssueSummary[];
  }

  let topicClusters = $derived.by((): TopicCluster[] => {
    const topicMap = new Map<string, IssueSummary[]>();
    for (const issue of issues) {
      const lensCounts = new Map<string, number>();
      for (const card of issue.cards) {
        if (card.lens) lensCounts.set(card.lens, (lensCounts.get(card.lens) ?? 0) + 1);
      }
      if (lensCounts.size === 0) continue;
      const primary = [...lensCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const list = topicMap.get(primary) ?? [];
      list.push(issue);
      topicMap.set(primary, list);
    }
    return [...topicMap.entries()]
      .map(([topic, issues]) => ({ topic, count: issues.length, issues: issues.sort((a, b) => b.opinionShift - a.opinionShift) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  });

  let activeTopic = $state<string | null>(null);
  let activeTopicIssues = $derived.by(() => {
    if (!activeTopic) return [];
    const cluster = topicClusters.find(c => c.topic === activeTopic);
    return cluster?.issues.slice(0, 5) ?? [];
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

  // Welcome card — shown once for first-time visitors
  let welcomeDismissed = $state(typeof localStorage !== 'undefined' && localStorage.getItem('tfa:v1:welcome-dismissed') === '1');
  function dismissWelcome() { localStorage.setItem('tfa:v1:welcome-dismissed', '1'); welcomeDismissed = true; }

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

      {#if !welcomeDismissed}
        <div class="welcome-card" role="note" aria-label="Welcome to The Fourth Angle">
          <div class="welcome-content">
            <p class="welcome-text"><strong>The Fourth Angle</strong> is a non-partisan Malaysian issues platform. We show you what every side left out — then let you decide.</p>
            <p class="welcome-text">The <strong>Opinion Shift</strong> number on each issue tells you how much you would miss by reading only the headline. Higher means more hidden complexity.</p>
            <a href="/about" class="welcome-link">How this works <span aria-hidden="true">→</span></a>
          </div>
          <button class="welcome-dismiss" onclick={dismissWelcome} aria-label="Dismiss welcome message">&times;</button>
        </div>
      {/if}

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
              <div class="hero-inline-score" title="Opinion Shift: reading only the headline would hide about {topIssue.opinionShift}% of the story">
                <span class="hero-inline-number" style="color:{opinionColor(topIssue.opinionShift)};">{topIssue.opinionShift}</span>
                <span class="hero-inline-label">Opinion Shift &middot; {opinionLabel(topIssue.opinionShift)}</span>
              </div>
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
                  <div class="panel-progress-fill" style="width:{Math.min(100, (continueProgress / (continueIssue?.cards.length ?? 6)) * 100)}%;"></div>
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
                <div class="brief-score" style="color:{opinionColor(issue.opinionShift)};" title="{issue.opinionShift} — {opinionLabel(issue.opinionShift)}: Reading only the headline would hide about {issue.opinionShift}% of the story">{issue.opinionShift}</div>
                <div class="brief-copy">
                  <div class="brief-headline balance-title">{issue.headline}</div>
                  <div class="brief-context pretty-copy">{issue.context}</div>
                </div>
              </button>
            {/each}
          </div>
        </section>
      </div>

      {#if topicClusters.length > 0}
        <section class="topic-section" aria-labelledby="topic-heading">
          <div class="topic-header">
            <div class="panel-kicker">Browse by Topic</div>
            <h2 id="topic-heading" class="panel-title">{issues.length} issues across {topicClusters.length} topics.</h2>
          </div>
          <div class="topic-chips" role="tablist" aria-label="Topic filters">
            {#each topicClusters as cluster}
              <button
                class="topic-chip"
                class:topic-chip--active={activeTopic === cluster.topic}
                onclick={() => { activeTopic = activeTopic === cluster.topic ? null : cluster.topic; }}
                role="tab"
                aria-selected={activeTopic === cluster.topic}
                aria-label="{cluster.topic}: {cluster.count} issues"
              >
                <span class="topic-chip-name">{cluster.topic}</span>
                <span class="topic-chip-count">{cluster.count}</span>
              </button>
            {/each}
          </div>
          {#if activeTopic && activeTopicIssues.length > 0}
            <div class="topic-issues" role="tabpanel" aria-label="{activeTopic} issues">
              {#each activeTopicIssues as issue}
                <button class="topic-issue" onclick={() => onOpenIssue?.(issue)}>
                  <span class="topic-issue-score" style="color:{issueOpinionColor(issue.opinionShift)};">{issue.opinionShift}</span>
                  <div class="topic-issue-copy">
                    <div class="topic-issue-headline balance-title">{issue.headline}</div>
                    <div class="topic-issue-context pretty-copy">{issue.context}</div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </section>
      {/if}

      <footer class="today-footer">
        <div class="today-quote">"{quote}"</div>
        <div class="today-ethos">Editorial ethos</div>
        <nav class="today-footer-links" aria-label="Footer navigation">
          <a href="/about">How This Works</a>
          <span class="footer-dot" aria-hidden="true">&middot;</span>
          <a href="/disclaimer">Disclaimer</a>
          <span class="footer-dot" aria-hidden="true">&middot;</span>
          <a href="/verify">Verify Content</a>
        </nav>
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

  /* ── Welcome card ── */
  .welcome-card {
    display: flex;
    gap: 12px;
    padding: 16px 20px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    background: var(--bg-elevated);
  }

  .welcome-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .welcome-text {
    font-size: var(--text-sm);
    line-height: 1.55;
    color: var(--text-secondary);
    margin: 0;
  }

  .welcome-link {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--score-medium);
    text-decoration: none;
  }

  .welcome-dismiss {
    align-self: flex-start;
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--text-body);
    color: var(--text-muted);
    padding: 4px 8px;
    min-width: 32px;
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
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
    max-width: 20ch;
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
    max-width: 20ch;
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

  .hero-inline-score {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 6px 14px;
    border-radius: var(--radius-pill);
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
  }

  .hero-inline-number {
    font-family: var(--font-display);
    font-size: var(--text-reading);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .hero-inline-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
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
    /* auto-fit so 1 panel fills the row, 2 panels sit side-by-side.
       brief-list inside each panel adapts independently via its own auto-fit. */
    grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
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

  /* ── Browse by topic ── */
  .topic-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .topic-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .topic-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .topic-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-subtle);
    background: var(--bg-elevated);
    cursor: pointer;
    font: inherit;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .topic-chip-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-secondary);
  }

  .topic-chip-count {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  .topic-chip--active {
    border-color: var(--score-medium);
    background: rgba(210, 140, 40, 0.08);
  }

  .topic-chip--active .topic-chip-name {
    color: var(--text-primary);
  }

  .topic-chip--active .topic-chip-count {
    color: var(--score-medium);
  }

  @media (hover: hover) {
    .topic-chip:hover {
      border-color: var(--border-divider);
      background: var(--bg-sunken);
    }
  }

  .topic-issues {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .topic-issue {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px 16px;
    border-radius: var(--radius-lg);
    background: var(--bg);
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    text-align: left;
    font: inherit;
    width: 100%;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }

  @media (hover: hover) {
    .topic-issue:hover {
      border-color: var(--border-divider);
      transform: translateY(-1px);
    }
  }

  .topic-issue-score {
    font-family: var(--font-display);
    font-size: var(--text-reading);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    min-width: 32px;
    flex-shrink: 0;
    padding-top: 2px;
  }

  .topic-issue-copy {
    flex: 1;
    min-width: 0;
  }

  .topic-issue-headline {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .topic-issue-context {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    line-height: 1.5;
    margin-top: 4px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  @media (prefers-color-scheme: dark) {
    .topic-chip {
      background: rgba(34, 31, 27, 0.7);
    }
    .topic-chip--active {
      background: rgba(210, 140, 40, 0.14);
    }
  }

  .today-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px 2px 0;
    border-top: 1px solid var(--border-subtle);
  }

  .today-quote {
    font-style: italic;
    max-width: 44ch;
    text-align: center;
  }

  .today-ethos {
    font-size: var(--text-micro);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
  }

  .today-footer-links {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .today-footer-links a {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .today-footer-links a:hover {
    color: var(--text-primary);
  }

  .footer-dot {
    color: var(--text-faint);
    font-size: var(--text-xs);
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

  /* Widescreen tiers — only adjust full-width sections (today-wrap padding,
     topic-issues grid). today-grid and brief-list use auto-fit at the base
     and adapt to their container width without manual column overrides. */

  @media (min-width: 1600px) {
    .today-wrap {
      max-width: 1560px;
      padding: clamp(32px, 3vw, 48px) clamp(24px, 2.5vw, 40px) 56px;
      gap: clamp(24px, 2vw, 32px);
    }

    .hero-entry {
      max-width: 100%;
    }

    .topic-issues {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
  }

  @media (min-width: 1920px) {
    .today-wrap {
      max-width: 1820px;
      padding: clamp(36px, 2.6vw, 56px) clamp(32px, 2.4vw, 56px) 64px;
    }

    .topic-issues {
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
  }

  @media (min-width: 2560px) {
    .today-wrap {
      max-width: 2280px;
      padding: clamp(44px, 2.4vw, 64px) clamp(40px, 2.4vw, 72px) 72px;
    }

    .topic-issues {
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
  }

  @media (min-width: 3440px) {
    .today-wrap {
      max-width: 3040px;
      padding: clamp(52px, 2.2vw, 80px) clamp(56px, 2.4vw, 96px) 80px;
    }

    .topic-issues {
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
    }
  }

  @media (min-width: 3840px) {
    .today-wrap {
      max-width: 3400px;
      padding: 80px 96px 88px;
    }

    .topic-issues {
      grid-template-columns: repeat(5, 1fr);
      gap: 24px;
    }
  }

  @media (min-width: 5120px) {
    .today-wrap {
      max-width: 4000px;
      padding: 88px 120px 96px;
    }

    .topic-issues {
      grid-template-columns: repeat(5, 1fr);
      gap: 28px;
    }
  }

  @media (min-width: 7680px) {
    .today-wrap {
      max-width: 5200px;
      padding: 96px 144px 104px;
    }

    .topic-issues {
      grid-template-columns: repeat(6, 1fr);
      gap: 32px;
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

    .today-topline {
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
      text-align: center;
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
