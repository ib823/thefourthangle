<script lang="ts">
  import { readIssues } from '../stores/reader';
  import { QUOTES } from '../data/quotes';
  import IssueImage from './IssueImage.svelte';

  import type { IssueSummary } from '../lib/issues-loader';
  import type { FeedSection } from '../lib/feed-sections';

  interface Props {
    issueCount?: number;
    topIssue?: IssueSummary | null;
    issues?: IssueSummary[];
    sections?: FeedSection[];
    onOpenIssue?: (issue: IssueSummary) => void;
  }
  let { issueCount = 0, topIssue = null, issues = [], sections = [], onOpenIssue }: Props = $props();

  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  let readCount = $state(0);
  let readMap: Record<string, string> = $state({});
  $effect(() => {
    const unsub = readIssues.subscribe(val => {
      readMap = { ...val };
      readCount = Object.values(val).filter(v => {
        if (!v) return false;
        if (v === 'true') return true;
        try { return JSON.parse(v).state === 'completed'; } catch { return false; }
      }).length;
    });
    return unsub;
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
          <h2 class="today-title">Start with what matters now, not the whole archive.</h2>
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
        <button class="hero-card" onclick={() => onOpenIssue?.(topIssue)}>
          {#if topIssue.hasImage}
            <div class="hero-art">
              <IssueImage issueId={topIssue.id} size="hero" aspectRatio="16/9" borderRadius="0" alt="Illustration for {topIssue.headline}" />
            </div>
          {/if}
          <div class="hero-scrim"></div>
          <div class="hero-grid">
            <div class="hero-copy">
              <div class="hero-badge">Featured Issue</div>
              <h3 class="hero-headline">{topIssue.headline}</h3>
              <p class="hero-context">{topIssue.context}</p>
              <p class="hero-hook">Read past the headline, then decide what the story is really about.</p>
            </div>
            <div class="hero-shift">
              <div class="hero-shift-kicker">Opinion Shift</div>
              <div class="hero-shift-score" style="color:{opinionColor(topIssue.opinionShift)};">{topIssue.opinionShift}</div>
              <p class="hero-shift-copy">{opinionTone(topIssue.opinionShift)}</p>
              <div class="hero-shift-meter">
                <div class="hero-shift-fill" style="width:{topIssue.opinionShift}%;background:{opinionColor(topIssue.opinionShift)};"></div>
              </div>
              <div class="hero-shift-foot">How much the headline hides.</div>
              <div class="hero-cta">Read all 6 angles</div>
            </div>
          </div>
        </button>
      {/if}

      <div class="today-grid">
        <div class="today-panel">
          <div class="panel-kicker">Continue Reading</div>
          {#if continueIssue && onOpenIssue}
            <button class="panel-issue" onclick={() => onOpenIssue?.(continueIssue)}>
              <div class="panel-issue-title">{continueIssue.headline}</div>
              <div class="panel-issue-copy">You stopped after {continueProgress} of 6 angles. Pick up where the argument starts to turn.</div>
              <div class="panel-progress-row">
                <div class="panel-progress-track">
                  <div class="panel-progress-fill" style="width:{Math.min(100, (continueProgress / 6) * 100)}%;"></div>
                </div>
                <span>{continueProgress}/6</span>
              </div>
            </button>
          {:else}
            <div class="panel-empty">
              <div class="panel-empty-title">No unfinished issue waiting.</div>
              <div class="panel-empty-copy">You are not behind. Start with today’s lead or open the daily briefing below.</div>
            </div>
          {/if}
        </div>

        <div class="today-panel">
          <div class="panel-kicker">Daily Briefing</div>
          <div class="panel-title">Three strong places to start.</div>
          <div class="panel-subtitle">High-yield reads in about {Math.max(6, briefingIssues.length * 3)} minutes.</div>
          <div class="brief-list">
            {#each briefingIssues as issue}
              <button class="brief-item" onclick={() => onOpenIssue?.(issue)}>
                <div class="brief-score" style="color:{opinionColor(issue.opinionShift)};">{issue.opinionShift}</div>
                <div class="brief-copy">
                  <div class="brief-headline">{issue.headline}</div>
                  <div class="brief-context">{issue.context}</div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="today-footer">
        <div class="today-note">{unread > 0 ? `${unread} still unexplored in the full archive.` : 'You are fully caught up right now.'}</div>
        <div class="today-quote">"{quote}"</div>
      </div>
    {:else}
      <div class="coming-soon">
        <div class="today-kicker">Coming Soon</div>
        <h2 class="today-title">New issues publish three times a week.</h2>
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
    max-width: 1040px;
    margin: 0 auto;
    padding: 40px 32px 56px;
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
    font-size: 36px;
    line-height: 1.05;
    letter-spacing: -0.04em;
    color: var(--text-primary);
    max-width: 14ch;
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

  .today-divider {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--border-divider);
  }

  .hero-card {
    position: relative;
    min-height: 460px;
    border-radius: 28px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: #141414;
    cursor: pointer;
    text-align: left;
    padding: 0;
    box-shadow: 0 24px 60px rgba(24, 24, 24, 0.12);
  }

  .hero-art,
  .hero-scrim {
    position: absolute;
    inset: 0;
  }

  .hero-scrim {
    background:
      linear-gradient(90deg, rgba(15, 15, 15, 0.92) 0%, rgba(15, 15, 15, 0.7) 42%, rgba(15, 15, 15, 0.46) 100%),
      linear-gradient(180deg, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0.5) 100%);
    z-index: 1;
  }

  .hero-grid {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(240px, 0.65fr);
    gap: 24px;
    align-items: end;
    min-height: 460px;
    padding: 32px;
  }

  .hero-copy {
    max-width: 640px;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.94);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    backdrop-filter: blur(10px);
  }

  .hero-headline {
    margin: 16px 0 0;
    font-family: var(--font-display);
    font-size: 44px;
    line-height: 0.98;
    letter-spacing: -0.05em;
    color: #fff;
    max-width: 11.5ch;
  }

  .hero-context {
    margin: 16px 0 0;
    max-width: 58ch;
    font-size: 16px;
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.84);
  }

  .hero-hook {
    margin: 18px 0 0;
    max-width: 36ch;
    font-size: 18px;
    font-style: italic;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.94);
  }

  .hero-shift {
    align-self: stretch;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 10px;
    padding: 20px;
    border-radius: 22px;
    background: rgba(15, 15, 15, 0.58);
    border: 1px solid rgba(255, 255, 255, 0.14);
    backdrop-filter: blur(12px);
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
    font-size: 64px;
    line-height: 0.92;
    letter-spacing: -0.05em;
  }

  .hero-shift-copy,
  .hero-shift-foot {
    margin: 0;
    color: rgba(255, 255, 255, 0.84);
    line-height: 1.5;
  }

  .hero-shift-copy {
    font-size: 15px;
    font-weight: 600;
  }

  .hero-shift-foot {
    font-size: 12px;
  }

  .hero-shift-meter,
  .panel-progress-track {
    width: 100%;
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.12);
  }

  .hero-shift-fill,
  .panel-progress-fill {
    height: 100%;
    border-radius: 999px;
  }

  .panel-progress-fill {
    background: var(--score-warning);
  }

  .hero-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
  }

  .today-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
  }

  .today-panel {
    padding: 22px;
    border-radius: 22px;
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 10px 30px rgba(24, 24, 24, 0.05);
  }

  .panel-title {
    margin-top: 12px;
    font-family: var(--font-display);
    font-size: 24px;
    line-height: 1.1;
    letter-spacing: -0.03em;
    color: var(--text-primary);
  }

  .panel-subtitle,
  .panel-issue-copy,
  .panel-empty-copy,
  .brief-context {
    margin-top: 8px;
    font-size: 14px;
    line-height: 1.55;
    color: var(--text-secondary);
  }

  .panel-issue,
  .brief-item {
    width: 100%;
    border: none;
    background: var(--bg);
    text-align: left;
    cursor: pointer;
  }

  .panel-issue {
    margin-top: 14px;
    padding: 18px;
    border-radius: 18px;
    border: 1px solid var(--border-subtle);
  }

  .panel-issue-title,
  .brief-headline,
  .panel-empty-title {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.3;
    color: var(--text-primary);
  }

  .panel-progress-row {
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-tertiary);
  }

  .panel-empty {
    margin-top: 14px;
    padding: 18px;
    border-radius: 18px;
    background: var(--bg);
    border: 1px solid var(--border-subtle);
  }

  .brief-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 16px;
  }

  .brief-item {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 14px;
    align-items: start;
    padding: 14px 0;
    border-top: 1px solid var(--bg-sunken);
  }

  .brief-item:first-child {
    border-top: none;
    padding-top: 0;
  }

  .brief-score {
    font-family: var(--font-display);
    font-size: 28px;
    line-height: 0.95;
    letter-spacing: -0.04em;
  }

  .today-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .today-note {
    font-weight: 600;
  }

  .today-quote {
    max-width: 40ch;
    text-align: right;
    font-style: italic;
  }

  .coming-soon {
    min-height: 60vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  @media (max-width: 1180px) {
    .hero-grid,
    .today-grid,
    .today-topline,
    .today-footer {
      grid-template-columns: 1fr;
      flex-direction: column;
      align-items: flex-start;
    }

    .hero-headline,
    .today-title {
      max-width: unset;
    }

    .today-status,
    .today-quote {
      white-space: normal;
      text-align: left;
    }
  }
</style>
