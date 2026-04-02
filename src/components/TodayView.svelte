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
    savedCount?: number;
    highlightCount?: number;
    onOpenIssue?: (issue: IssueSummary) => void;
    onOpenLibraryReading?: () => void;
    onOpenLibrarySaved?: () => void;
    onOpenLibraryHighlights?: () => void;
  }
  let {
    issueCount = 0,
    topIssue = null,
    issues = [],
    sections = [],
    readMap = {},
    readingCount = 0,
    savedCount = 0,
    highlightCount = 0,
    onOpenIssue,
    onOpenLibraryReading,
    onOpenLibrarySaved,
    onOpenLibraryHighlights,
  }: Props = $props();

  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  let readCount = $derived.by(() => {
    return Object.values(readMap).filter(v => {
      if (!v) return false;
      if (v === 'true') return true;
      try { return JSON.parse(v).state === 'completed'; } catch { return false; }
    }).length;
  });

  let unread = $derived(Math.max(0, issueCount - readCount));
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
  let readyCount = $derived((continueIssue ? 1 : 0) + briefingIssues.length);
  let readyMinutes = $derived(Math.max(4, briefingIssues.length * 3 + (continueIssue ? 2 : 0)));
  let todayDeckCopy = $derived.by(() => {
    if (continueIssue) return 'Start with the lead, then resume where you stopped.';
    return 'Start with the lead, then move into the briefing.';
  });

  const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';

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
    if (score >= 80) return 'var(--score-critical)';
    if (score >= 60) return 'var(--score-warning)';
    if (score >= 40) return 'var(--score-info)';
    return 'var(--score-neutral)';
  }
</script>

<div class="today-shell">
  <div class="today-wrap">
    {#if hasIssues}
      <div class="today-topline">
        <div>
          <div class="today-kicker">Today</div>
          <h1 class="today-title">See what deserves your full attention.</h1>
          <p class="today-intro pretty-copy">{todayDeckCopy}</p>
        </div>
        <div class="today-status">
          <span>{readyCount} issues ready</span>
          <span class="today-divider"></span>
          <span>about {readyMinutes} min</span>
          <span class="today-divider"></span>
          <span>updated {formatDate(buildDate)}</span>
        </div>
      </div>

      {#if topIssue && onOpenIssue}
        <article class="hero-entry" aria-labelledby="lead-issue-title">
        <button class="hero-card" onclick={() => onOpenIssue?.(topIssue)}>
          {#if topIssue.hasImage}
            <div class="hero-art">
              <IssueImage issueId={topIssue.id} size="hero" aspectRatio="16/9" borderRadius="0" alt="Illustration for {topIssue.headline}" />
            </div>
          {/if}
          <div class="hero-scrim"></div>
          <div class="hero-grid">
            <div class="hero-copy">
              <div class="hero-badge">Lead Issue</div>
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
        <section class="today-panel" aria-labelledby="continue-reading-heading">
          <div class="panel-kicker">Continue Reading</div>
          <h2 id="continue-reading-heading" class="sr-only">Continue Reading</h2>
          {#if continueIssue && onOpenIssue}
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
          {:else}
            <div class="panel-empty">
              <div class="panel-empty-title">No unfinished issue waiting.</div>
              <div class="panel-empty-copy">You are not behind. Start with today’s lead or open the daily briefing below.</div>
            </div>
          {/if}
        </section>

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

      <section class="today-library-strip" aria-labelledby="your-library-heading">
        <div class="today-library-head">
          <div class="panel-kicker">Library</div>
          <h2 id="your-library-heading" class="today-library-title">Keep your place without leaving Today.</h2>
          <p class="today-library-copy">Reading progress, saved issues, and highlights live here when you want them.</p>
        </div>
        <div class="today-library-list">
          <button class="library-item library-item--compact" onclick={() => onOpenLibraryReading?.()}>
            <span class="library-label">Reading</span>
            <span class="library-value">{readingCount}</span>
            <span class="library-copy">Resume immediately</span>
          </button>
          <button class="library-item library-item--compact" onclick={() => onOpenLibrarySaved?.()}>
            <span class="library-label">Saved</span>
            <span class="library-value">{savedCount}</span>
            <span class="library-copy">Held for later</span>
          </button>
          <button class="library-item library-item--compact" onclick={() => onOpenLibraryHighlights?.()}>
            <span class="library-label">Highlights</span>
            <span class="library-value">{highlightCount}</span>
            <span class="library-copy">Angles worth keeping</span>
          </button>
        </div>
      </section>

      <footer class="today-footer">
        <div>
          <div class="today-note">{unread > 0 ? `${unread} still unexplored in the full archive.` : 'You are fully caught up right now.'}</div>
        </div>
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
    flex: 1;
    overflow-y: auto;
    background:
      radial-gradient(circle at top right, rgba(210, 140, 40, 0.08), transparent 28%),
      linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 22%, var(--bg) 100%);
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
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }

  .today-title {
    margin: 10px 0 0;
    font-family: var(--font-display);
    font-size: clamp(30px, 4vw, 40px);
    line-height: 1.02;
    letter-spacing: -0.045em;
    color: var(--text-primary);
    max-width: 15ch;
  }

  .today-intro {
    margin: 12px 0 0;
    max-width: 40ch;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .today-status {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.72);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  .hero-entry {
    display: block;
  }

  .today-divider {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--border-divider);
  }

  .hero-card,
  .panel-issue,
  .brief-item,
  .library-item {
    width: 100%;
    border: none;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }

  .hero-card {
    position: relative;
    overflow: hidden;
    border-radius: 30px;
    min-height: 420px;
    background: linear-gradient(135deg, rgba(20, 20, 20, 0.94), rgba(28, 28, 28, 0.82));
    color: #fff;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.18);
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
    min-height: 420px;
    padding: 30px;
    align-items: end;
  }

  .hero-copy {
    max-width: 56ch;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.18);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hero-headline {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(32px, 5vw, 54px);
    line-height: 1.02;
    letter-spacing: -0.045em;
    max-width: 15ch;
  }

  .hero-context,
  .hero-shift-copy,
  .hero-shift-foot {
    margin: 0;
  }

  .hero-context {
    font-size: 15px;
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.78);
    max-width: 56ch;
  }

  .hero-shift {
    padding: 22px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .hero-shift-kicker {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.7);
  }

  .hero-shift-score {
    font-family: var(--font-display);
    font-size: 76px;
    line-height: 0.88;
    letter-spacing: -0.05em;
    margin-top: 14px;
  }

  .hero-shift-copy {
    font-size: 15px;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.82);
    margin-top: 10px;
  }

  .hero-shift-meter,
  .panel-progress-track {
    height: 8px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    overflow: hidden;
    margin-top: 14px;
  }

  .hero-shift-fill,
  .panel-progress-fill {
    height: 100%;
    border-radius: 999px;
  }

  .hero-shift-foot {
    margin-top: 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.58);
  }

  .hero-cta {
    margin-top: 16px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
  }

  .today-grid {
    display: grid;
    grid-template-columns: minmax(280px, 0.9fr) minmax(0, 1.1fr);
    gap: 18px;
  }

  .today-panel {
    padding: 22px;
    border-radius: 24px;
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.76);
    box-shadow: 0 12px 28px rgba(20, 20, 20, 0.05);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .today-library-strip {
    display: grid;
    grid-template-columns: minmax(220px, 0.72fr) minmax(0, 1.28fr);
    gap: 16px;
    padding: 18px 20px;
    border-radius: 22px;
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 12px 28px rgba(20, 20, 20, 0.05);
    align-items: start;
  }

  .today-library-head {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 30ch;
  }

  .today-library-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 22px;
    line-height: 1.08;
    letter-spacing: -0.03em;
    color: var(--text-primary);
  }

  .today-library-copy {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .panel-title {
    font-family: var(--font-display);
    font-size: 24px;
    line-height: 1.04;
    letter-spacing: -0.03em;
    color: var(--text-primary);
  }

  .panel-subtitle,
  .panel-empty-copy,
  .panel-issue-copy,
  .brief-context,
  .library-copy,
  .today-note,
  .today-quote {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .panel-issue,
  .brief-item,
  .library-item {
    padding: 16px;
    border-radius: 18px;
    background: var(--bg);
    border: 1px solid var(--border-subtle);
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .panel-issue:hover,
  .brief-item:hover,
  .library-item:hover,
  .hero-card:hover {
    transform: translateY(-2px);
  }

  .panel-issue-title,
  .brief-headline {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.28;
    color: var(--text-primary);
  }

  .panel-progress-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    font-size: 12px;
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

  .panel-empty-title,
  .library-label {
    font-size: 12px;
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

  .today-library-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .brief-item {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }

  .brief-score,
  .library-value {
    font-family: var(--font-display);
    font-size: 36px;
    line-height: 0.92;
    letter-spacing: -0.05em;
  }

  .library-item {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 10px 14px;
    align-items: center;
  }

  .library-label,
  .library-copy {
    grid-column: 1 / -1;
  }

  .library-item--compact {
    padding: 14px 16px;
    border-radius: 16px;
    gap: 8px 10px;
    align-content: start;
  }

  .library-item--compact .library-label {
    grid-column: 1;
    align-self: center;
  }

  .library-item--compact .library-value {
    grid-column: 2;
    justify-self: end;
    font-size: 28px;
  }

  .library-item--compact .library-copy {
    grid-column: 1 / -1;
    font-size: 12px;
    line-height: 1.45;
  }

  .today-footer {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 20px;
    padding: 0 2px;
  }

  .today-note {
    color: var(--text-tertiary);
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

  @media (max-width: 1023px) {
    .hero-grid {
      grid-template-columns: 1fr;
      align-items: end;
    }

    .today-library-strip {
      grid-template-columns: 1fr;
    }

    .today-library-head {
      max-width: none;
    }
  }

  @media (max-width: 767px) {
    .today-wrap {
      padding: 18px 14px 28px;
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
      border-radius: 24px;
    }

    .hero-grid {
      min-height: 0;
      padding: 20px;
      gap: 18px;
    }

    .hero-headline {
      max-width: none;
    }

    .hero-shift-score {
      font-size: 58px;
    }

    .today-grid {
      grid-template-columns: 1fr;
    }

    .today-panel {
      padding: 18px;
      border-radius: 20px;
    }

    .today-library-strip {
      padding: 18px;
      border-radius: 20px;
    }

    .today-library-list {
      grid-template-columns: 1fr;
    }

    .brief-list {
      grid-template-columns: 1fr;
    }

    .brief-score,
    .library-value {
      font-size: 28px;
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

    .today-library-strip {
      background: rgba(34, 31, 27, 0.92);
      border-color: rgba(255, 255, 255, 0.06);
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.28);
    }

    .panel-issue,
    .brief-item,
    .library-item {
      background: rgba(25, 24, 22, 0.96);
      border-color: var(--border-divider);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
    }

    .hero-card:hover,
    .panel-issue:hover,
    .brief-item:hover,
    .library-item:hover {
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34);
    }

    .today-note,
    .today-quote {
      color: var(--text-muted);
    }
  }
</style>
