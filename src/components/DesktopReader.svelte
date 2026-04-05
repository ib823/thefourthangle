<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import OpinionBar from './OpinionBar.svelte';
  import VerdictBar from './VerdictBar.svelte';
  import { CARD_TYPES, opinionColor, opinionLabel } from '../data/issues';
  import { getReadState, markCompleted, updateProgress } from '../stores/reader';
  import { countUp } from '../lib/animation';
  import SaveButton from './SaveButton.svelte';
  import ShareModal from './ShareModal.svelte';
  import PushPrompt from './PushPrompt.svelte';
  import IssueImage from './IssueImage.svelte';
  import { withBuildId } from '../lib/build';

  import type { Issue } from '../data/issues';

  interface Connection {
    id: string;
    weight: number;
    sharedEntities: string[];
    headline: string;
    opinionShift: number;
    readState: string | null;
    hasReaction: boolean;
  }

  interface Props {
    issue: Issue;
    onReturnHome?: () => void;
    onNext?: () => void;
    nextHeadline?: string;
    connections?: Connection[];
    onNavigateToIssue?: (issueId: string) => void;
    initialCardIndex?: number;
  }
  let { issue, onReturnHome, onNext, nextHeadline, connections = [], onNavigateToIssue, initialCardIndex = 0 }: Props = $props();

  // Reactions handled by SaveButton component
  let scrollEl: HTMLDivElement | undefined = $state(undefined);
  let completionMarker: HTMLDivElement | undefined = $state(undefined);
  let cardEls: Array<HTMLDivElement | undefined> = $state([]);
  let shareOpen = $state(false);
  let shareCardIndex: number | null = $state(null);
  let copied = $state(false);
  let activeStep = $state(Math.max(0, Math.min(initialCardIndex, Math.max(issue.cards.length - 1, 0))));
  let persistedProgress = $state(0);
  let pendingInitialCardIndex: number | null = $state(initialCardIndex > 0 ? initialCardIndex : null);
  let stepObserver: IntersectionObserver | null = null;

  const CARD_LABELS: Record<string, string> = {
    hook: 'What they said',
    fact: 'What we found',
    reframe: 'The real question',
    view: 'The considered view',
  };

  function buildVerificationText() {
    const lines: string[] = [];
    lines.push(issue.headline);
    lines.push(issue.context);
    lines.push('');
    lines.push(String(issue.opinionShift));
    lines.push(opinionLabel(issue.opinionShift));

    // Stage scores
    if (issue.stageScores) {
      const s = issue.stageScores;
      lines.push('PA');
      lines.push('BA');
      lines.push('FC');
      lines.push('AF');
      lines.push('CT');
      lines.push('SR');
    }
    if (issue.finalScore != null) {
      lines.push(String(issue.finalScore));
      lines.push('/100');
    }

    if (issue.status) lines.push(issue.status === 'new' ? 'New' : 'Updated');

    for (const card of issue.cards) {
      lines.push('');
      let lbl = CARD_LABELS[card.t] || card.t;
      if (card.t === 'fact' && card.lens) lbl += ` \u00B7 ${card.lens}`;
      lines.push(lbl);
      lines.push('');
      lines.push(card.big);
      if (card.sub) {
        lines.push('');
        lines.push(card.sub);
      }
    }

    lines.push('');
    lines.push('All 6 perspectives read');
    const vc = [...issue.cards].reverse().find((c) => c.t === 'view');
    if (vc) lines.push(vc.big);

    return lines.join('\n');
  }

  async function copyForVerification() {
    try {
      await navigator.clipboard.writeText(buildVerificationText());
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch {}
  }

  function cardLabel(card: Issue['cards'][number]) {
    const m = CARD_TYPES[card.t] ?? CARD_TYPES.hook;
    return card.t === 'fact' && card.lens ? `${m.label} \u00B7 ${card.lens}` : m.label;
  }

  // Screen Wake Lock: keep screen on while reading
  let wakeLock: WakeLockSentinel | null = null;
  let visCleanup: (() => void) | null = null;

  onMount(async () => {
    // Acquire wake lock
    if ('wakeLock' in navigator) {
      try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
    }
    // Re-acquire on visibility change (released when tab goes background)
    const onVis = async () => {
      if (document.visibilityState === 'visible' && !wakeLock) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
      }
    };
    document.addEventListener('visibilitychange', onVis);
    visCleanup = () => document.removeEventListener('visibilitychange', onVis);

    // Clear notification for this issue
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'ISSUE_OPENED', issueId: issue.id });
    }
  });

  onDestroy(() => {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
    visCleanup?.();
    countUpCancel?.();
    stepObserver?.disconnect();
  });

  // C1: Animated opinion shift count-up
  let displayOS = $state(issue.opinionShift);
  let countUpCancel: (() => void) | null = null;

  // F13: Content fade+slide on article switch
  let transitioning = $state(false);
  let lastId = $state(issue.id);
  $effect(() => {
    if (issue.id !== lastId) {
      lastId = issue.id;
      transitioning = true;
      requestAnimationFrame(() => {
        // C2: Smooth scroll to top
        scrollEl?.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => { transitioning = false; }, 50);
      });
      // C1: Count-up animation on issue switch
      countUpCancel?.();
      displayOS = 0;
      setTimeout(() => {
        countUpCancel = countUp(0, issue.opinionShift, 600, (v) => { displayOS = v; });
      }, 100);
    }
  });

  $effect(() => {
    if (!completionMarker) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        markCompleted(issue.id, issue.cards.length);
      }
    }, { threshold: 0.5 });
    obs.observe(completionMarker);
    return () => obs.disconnect();
  });

  let viewCard = $derived(issue.cards.findLast((c) => c.t === 'view'));
  let activeStageLabel = $derived(cardLabel(issue.cards[activeStep] ?? issue.cards[0]));

  let barColor = $derived(opinionColor(issue.opinionShift));

  let label = $derived(opinionLabel(issue.opinionShift));

  function opinionNarrative(score: number): string {
    if (score >= 80) return `Reading only the headline would hide about ${score}% of the story.`;
    if (score >= 60) return `The headline leaves out most of the context that changes the meaning.`;
    if (score >= 40) return `The headline is directionally true, but it still misses a consequential layer.`;
    return `The headline gets the outline, but the deeper frame still matters.`;
  }

  function setupStepObserver() {
    stepObserver?.disconnect();
    stepObserver = null;

    requestAnimationFrame(() => {
      if (!scrollEl) return;
      const els = cardEls.filter(Boolean) as HTMLDivElement[];
      if (els.length === 0) return;

      stepObserver = new IntersectionObserver((entries) => {
        let bestIndex = activeStep;
        let bestRatio = 0;

        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).dataset.step ?? '-1');
          if (Number.isNaN(idx)) continue;
          if (entry.intersectionRatio >= bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIndex = idx;
          }
        }

        if (bestRatio > 0) {
          activeStep = bestIndex;
          const nextProgress = bestIndex + 1;
          if (bestIndex > 0 && nextProgress > persistedProgress) {
            persistedProgress = nextProgress;
            updateProgress(issue.id, nextProgress);
          }
        }
      }, { root: scrollEl, threshold: [0.25, 0.45, 0.7] });

      els.forEach((el) => stepObserver?.observe(el));

      if (pendingInitialCardIndex != null && pendingInitialCardIndex > 0) {
        const targetIndex = Math.max(0, Math.min(pendingInitialCardIndex, els.length - 1));
        const targetEl = els[targetIndex];
        if (targetEl) {
          scrollEl.scrollTop = Math.max(0, targetEl.offsetTop - 24);
          activeStep = targetIndex;
        }
        pendingInitialCardIndex = null;
      }
    });
  }

  $effect(() => {
    void issue.id;
    void initialCardIndex;
    const nextInitialIndex = Math.max(0, Math.min(initialCardIndex, Math.max(issue.cards.length - 1, 0)));
    activeStep = nextInitialIndex;
    persistedProgress = getReadState(issue.id)?.progress ?? 0;
    pendingInitialCardIndex = nextInitialIndex > 0 ? nextInitialIndex : null;
    cardEls = [];
    setupStepObserver();
  });

  $effect(() => {
    const ready = cardEls.filter(Boolean).length;
    if (ready === issue.cards.length && ready > 0) {
      setupStepObserver();
    }
  });

  // J/K keyboard navigation between cards
  function onReaderKeyDown(e: KeyboardEvent) {
    // Don't intercept if user is typing in an input
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
    const els = cardEls.filter(Boolean) as HTMLDivElement[];
    if (els.length === 0) return;
    if (e.key === 'j' || e.key === 'ArrowDown') {
      const next = Math.min(activeStep + 1, els.length - 1);
      if (next !== activeStep) {
        e.preventDefault();
        els[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      const prev = Math.max(activeStep - 1, 0);
      if (prev !== activeStep) {
        e.preventDefault();
        els[prev]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
</script>

<svelte:window onkeydown={onReaderKeyDown} />
<div bind:this={scrollEl} role="article" aria-label="Issue reader — use J/K or arrow keys to navigate between cards" class:reader-switching={transitioning}
  style="flex:1;overflow-y:auto;background:var(--bg);transition:opacity var(--duration-fast, 150ms) ease-out, transform var(--duration-fast, 150ms) ease-out;">
  <!-- Screen reader announcement for issue change -->
  <div class="sr-only" aria-live="polite" aria-atomic="true">Now reading: {issue.headline}</div>
  <div style="max-width:760px;margin:0 auto;padding:32px 24px 56px;">
    <div class="reader-progress-shell">
      <div class="reader-progress-copy">
        <div class="reader-progress-kicker">Reading path</div>
        <div class="reader-progress-label balance-title">{activeStageLabel}</div>
      </div>
      <div class="reader-progress-track" style="--steps:{issue.cards.length};" aria-hidden="true">
        {#each issue.cards as _, i}
          <span
            class="reader-progress-segment"
            class:reader-progress-segment--done={i < activeStep}
            class:reader-progress-segment--active={i === activeStep}
          ></span>
        {/each}
      </div>
    </div>

    <div class="reader-head">
      <div class="reader-headline-wrap">
        <h1 class="reader-headline balance-title">{issue.headline}</h1>
      </div>
      <div class="reader-actions">
        <button onclick={() => { shareCardIndex = null; shareOpen = true; }} style="flex-shrink:0;display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius: var(--radius-pill);border:1px solid var(--border-subtle);background:var(--bg-elevated);cursor:pointer;transition:background 0.2s ease-out,border-color 0.2s ease-out;margin-top:4px;min-height:44px;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-divider)'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }} aria-label="Share this issue" aria-expanded={shareOpen} aria-haspopup="dialog">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          <span style="font-size: var(--text-sm);font-weight:700;color:var(--text-tertiary);">Share</span>
        </button>
      </div>
    </div>
    <p style="font-size: var(--text-reading-lg);color:var(--text-secondary);font-weight: 400;line-height:1.65;margin:16px 0 0;max-width:62ch;">{issue.context}</p>

    <div style="margin:24px -24px 0;overflow:hidden;background:var(--bg-sunken);border-radius: var(--radius-xl);">
      <img src={withBuildId(`/og/issue-${issue.id}.png`)} alt="" loading="eager" decoding="sync" fetchpriority="high" style="width:100%;aspect-ratio:1.91/1;object-fit:cover;display:block;" onerror={(e) => { const w = (e.currentTarget as HTMLElement)?.parentElement?.parentElement; if (w) w.style.display = 'none'; }} />
    </div>

    <div style="margin:24px 0 0;padding:20px 24px;border-radius: var(--radius-xl);border:1px solid var(--border-subtle);background:linear-gradient(135deg, rgba(210,140,40,0.08) 0%, rgba(255,255,255,0.9) 55%);display:grid;grid-template-columns:minmax(110px, 0.4fr) minmax(0, 1fr);gap:20px;align-items:center;">
      <div>
        <div style="font-size: var(--text-xs);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-tertiary);">Opinion Shift</div>
        <div style="font-family:var(--font-display);font-size: var(--text-display);line-height:0.9;letter-spacing:-0.05em;color:{barColor};margin-top:12px;">{displayOS}</div>
        <div style="font-size: var(--text-xs);font-weight:700;color:{barColor};text-transform:uppercase;letter-spacing:0.06em;margin-top:8px;">{label}</div>
      </div>
      <div>
        <p style="font-size: var(--text-reading-lg);font-weight:700;line-height:1.35;color:var(--text-primary);margin:0;">{opinionNarrative(issue.opinionShift)}</p>
        <p style="font-size: var(--text-ui);line-height:1.6;color:var(--text-secondary);margin:8px 0 0;">This is the signature T4A measure: how much the story changes when you read beyond the first telling.</p>
        <div style="margin-top:16px;"><OpinionBar score={issue.opinionShift} height={8} showLabel={false} /></div>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:16px 0 32px;">
      {#if issue.status === 'new'}
        <span style="font-size: var(--text-micro);font-weight:700;color:var(--status-green-text);background:var(--status-green-bg);padding:4px 8px;border-radius: var(--radius-pill);text-transform:uppercase;">New</span>
      {:else if issue.status === 'updated'}
        <span style="font-size: var(--text-micro);font-weight:700;color:var(--status-blue-text);background:var(--status-blue-bg);padding:4px 8px;border-radius: var(--radius-pill);text-transform:uppercase;">Updated</span>
      {/if}
      {#if issue.edition > 1}
        <span style="font-size: var(--text-xs);font-weight:700;color:var(--text-secondary);padding:4px 8px;border-radius: var(--radius-pill);background:var(--bg-elevated);border:1px solid var(--border-subtle);">Edition {issue.edition}</span>
      {/if}
    </div>

    <!-- 6 Perspectives -->
    {#each issue.cards as card, i}
      {@const meta = CARD_TYPES[card.t] ?? CARD_TYPES.hook}
      <div bind:this={cardEls[i]} data-step={i} style="margin-bottom:20px;">
        <div style="padding:24px;border-radius: var(--radius-xl);background:var(--bg-elevated);border:1px solid var(--border-subtle);box-shadow:0 16px 36px rgba(24,24,24,0.05);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <div style="width:32px;height:32px;border-radius: var(--radius-round);display:flex;align-items:center;justify-content:center;background:{meta.bg};color:{meta.color};font-size: var(--text-sm);font-weight: 700;">{i + 1}</div>
              <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius: var(--radius-pill);background:{meta.bg};">
                <span style="width:20px;height:20px;border-radius: var(--radius-round);display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.66);">
                  {#if card.t === 'hook'}
                    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={meta.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {:else if card.t === 'fact'}
                    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={meta.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"></circle><path d="m20 20-3.5-3.5"></path></svg>
                  {:else if card.t === 'reframe'}
                    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={meta.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>
                  {:else if card.t === 'analogy'}
                    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={meta.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>
                  {:else}
                    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={meta.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle><path d="m14.5 9.5-3 7-1-4-4-1z"></path></svg>
                  {/if}
                </span>
                <span style="font-size: var(--text-sm);font-weight:700;color:{meta.color};">{cardLabel(card)}</span>
              </div>
            </div>
            <SaveButton issueId={issue.id} cardIndex={i} />
          </div>

          <p style="font-size: var(--text-title);font-weight:700;color:var(--text-primary);line-height:1.45;margin:0;max-width:33ch;">{card.big}</p>
          {#if card.sub}
            <p style="font-size: var(--text-reading);color:var(--text-secondary);line-height:1.65;margin:12px 0 0;max-width:52ch;">{card.sub}</p>
          {/if}
          {#if card.t === 'fact' && connections.length > 0}
            <span style="font-size: var(--text-xs);font-weight:700;color:var(--text-muted);margin-top:16px;display:block;">Tracked in {connections.length} {connections.length === 1 ? 'issue' : 'issues'}</span>
          {/if}
        </div>
      </div>
    {/each}

    <div bind:this={completionMarker} style="height:1px;"></div>

    <div style="margin-top:20px;padding:24px;border-radius: var(--radius-xl);border:1px solid rgba(46,125,50,0.16);background:linear-gradient(180deg, rgba(46,125,50,0.08) 0%, rgba(255,255,255,0.92) 100%);">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:34px;height:34px;border-radius: var(--radius-round);display:flex;align-items:center;justify-content:center;background:rgba(46,125,50,0.14);color:var(--status-green);">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <div style="font-family:var(--font-display);font-size: var(--text-title);line-height:1.05;letter-spacing:-0.03em;color:var(--text-primary);">You’ve seen the full picture.</div>
          <div style="font-size: var(--text-ui);line-height:1.55;color:var(--text-secondary);margin-top:4px;">The headline, the evidence, the reframing, and the considered view are now on the table.</div>
        </div>
      </div>

      <!-- Connected issues -->
      {#if connections.length >= 2}
        <div style="margin:20px 0 16px;">
          <div style="font-size: var(--text-xs);font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em;">{connections.length} connected issues</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            {#each connections as conn}
              <button
                onclick={() => onNavigateToIssue?.(conn.id)}
                style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius: var(--radius-md);background:var(--bg-elevated);border:1px solid var(--border-subtle);cursor:pointer;text-align:left;width:100%;transition:background 0.2s ease-out;"
                onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)'; }}
                onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
              >
                <div style="width:36px;height:36px;flex-shrink:0;border-radius: var(--radius-sm);overflow:hidden;background:var(--bg-sunken);">
                  <img src={withBuildId(`/og/issue-${conn.id}.png`)} alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;" onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    {#if conn.readState === 'completed'}
                      <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>
                    {:else if conn.readState === 'started'}
                      <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;"><circle cx="12" cy="12" r="9" stroke="var(--score-warning)" stroke-width="2" fill="none"/><path d="M12 3a9 9 0 0 1 0 18" fill="var(--score-warning)"/></svg>
                    {/if}
                    <div style="font-size: var(--text-sm);font-weight:{conn.readState === 'completed' ? '600' : '600'};color:{conn.readState === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)'};line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;">{conn.headline}</div>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                    <span style="font-size: var(--text-micro);color:var(--text-muted);">{conn.sharedEntities.slice(0, 3).join(' · ')}</span>
                    {#if conn.hasReaction}
                      <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="var(--highlight-accent)" stroke="none" style="flex-shrink:0;opacity:0.6;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    {/if}
                  </div>
                </div>
                <span style="font-size: var(--text-sm);font-weight:700;color:{opinionColor(conn.opinionShift)};font-variant-numeric:tabular-nums;flex-shrink:0;">{conn.opinionShift}%</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Editorial Audit — revealed after reading all perspectives -->
      {#if issue.stageScores && issue.finalScore}
        <div style="margin:0 0 20px;padding:20px;background:var(--bg-elevated);border-radius: var(--radius-lg);border:1px solid var(--border-subtle);">
          <div style="font-size: var(--text-xs);font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em;">Editorial Audit</div>
          <p style="font-size: var(--text-ui);line-height:1.55;color:var(--text-secondary);margin:0 0 12px;">Tap any stage to see what was being tested and how this issue held up under that part of the editorial process.</p>
          <VerdictBar scores={issue.stageScores} finalScore={issue.finalScore} />
        </div>
      {/if}

      <div class="reader-completion-actions">
        {#if onReturnHome}
          <button onclick={onReturnHome} class="completion-primary-btn">
            Back to Today
          </button>
        {/if}

        <div class="completion-verify-row">
          <button
            onclick={copyForVerification}
            class="completion-utility-btn"
            class:completion-utility-btn--copied={copied}
          >
            {copied ? 'Copied — paste into the verifier' : 'Copy for verification'}
          </button>
          <a href="/verify" class="completion-help-link">What is this?</a>
        </div>
      </div>
    </div>

    <PushPrompt />

    <div style="height:60px;"></div>
  </div>
</div>

{#if shareOpen}
  <ShareModal {issue} cardIndex={shareCardIndex} onClose={() => { shareOpen = false; }} />
{/if}

<style>
  .reader-switching {
    opacity: 0;
    transform: translateY(8px);
  }

  .reader-progress-shell {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 28px;
  }

  .reader-progress-copy {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .reader-progress-kicker {
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }

  .reader-progress-label {
    font-size: var(--text-ui);
    font-weight: 700;
    line-height: 1.35;
    color: var(--text-secondary);
    max-width: 30ch;
  }

  .reader-progress-track {
    display: grid;
    grid-template-columns: repeat(var(--steps, 6), minmax(0, 1fr));
    gap: 8px;
  }

  .reader-progress-segment {
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    transition: background 0.2s ease-out, border-color 0.2s ease-out;
  }

  .reader-progress-segment--done {
    background: rgba(46, 125, 50, 0.14);
    border-color: rgba(46, 125, 50, 0.18);
  }

  .reader-progress-segment--active {
    background: rgba(210, 140, 40, 0.18);
    border-color: rgba(210, 140, 40, 0.26);
  }

  .reader-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 20px;
  }

  .reader-headline-wrap {
    min-width: 0;
  }

  .reader-headline {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-reader-title-fluid);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    line-height: 1.01;
    max-width: 17ch;
  }

  .reader-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .reader-completion-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 4px;
  }

  .completion-primary-btn,
  .completion-utility-btn {
    width: 100%;
    border-radius: var(--radius-pill);
    font: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition:
      background 200ms ease-out,
      border-color 200ms ease-out,
      color 200ms ease-out,
      transform 200ms ease-out,
      box-shadow 200ms ease-out;
  }

  .completion-primary-btn {
    min-height: 48px;
    padding: 0 24px;
    border: 1px solid rgba(210, 140, 40, 0.22);
    background: linear-gradient(180deg, rgba(210, 140, 40, 0.12), rgba(210, 140, 40, 0.08));
    color: var(--score-warning);
    font-size: var(--text-ui);
    font-weight: 700;
    box-shadow: 0 14px 28px rgba(210, 140, 40, 0.08);
  }

  @media (hover: hover) {
    .completion-primary-btn:hover {
      border-color: rgba(210, 140, 40, 0.3);
      background: linear-gradient(180deg, rgba(210, 140, 40, 0.15), rgba(210, 140, 40, 0.1));
      transform: translateY(-1px);
      box-shadow: 0 18px 32px rgba(210, 140, 40, 0.12);
    }
  }

  .completion-utility-btn {
    min-height: 44px;
    padding: 0 20px;
    border: 1px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.64);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: 600;
    box-shadow: none;
  }

  @media (hover: hover) {
    .completion-utility-btn:hover {
      background: var(--bg);
      border-color: var(--border-divider);
      color: var(--text-primary);
      transform: translateY(-1px);
      box-shadow: 0 8px 18px rgba(17, 24, 39, 0.06);
    }
  }

  .completion-utility-btn--copied {
    border-color: rgba(46, 125, 50, 0.28);
    color: var(--status-green);
    background: rgba(46, 125, 50, 0.08);
  }

  .completion-verify-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
  }

  .completion-verify-row .completion-utility-btn {
    min-height: 40px;
    font-size: var(--text-xs);
    border-color: transparent;
    background: var(--bg-elevated);
  }

  .completion-help-link {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
    text-decoration: none;
  }

  @media (hover: hover) {
    .completion-help-link:hover {
      color: var(--text-secondary);
    }
  }

  @media (prefers-color-scheme: dark) {
    .completion-primary-btn {
      border-color: rgba(200, 150, 58, 0.24);
      background: linear-gradient(180deg, rgba(200, 150, 58, 0.13), rgba(200, 150, 58, 0.08));
      box-shadow: 0 16px 30px rgba(0, 0, 0, 0.22);
    }

    .completion-utility-btn {
      background: rgba(34, 31, 27, 0.74);
    }

    .completion-verify-row .completion-utility-btn {
      background: rgba(30, 28, 24, 0.64);
    }
  }

  @media (prefers-color-scheme: dark) and (hover: hover) {
    .completion-primary-btn:hover {
      border-color: rgba(200, 150, 58, 0.3);
      background: linear-gradient(180deg, rgba(200, 150, 58, 0.16), rgba(200, 150, 58, 0.1));
      box-shadow: 0 20px 36px rgba(0, 0, 0, 0.26);
    }

    .completion-utility-btn:hover {
      background: rgba(40, 36, 31, 0.94);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.28);
    }
  }

  @media (max-width: 720px) {
    .reader-head {
      grid-template-columns: 1fr;
    }

    .reader-actions {
      justify-content: flex-start;
    }

    .reader-headline {
      max-width: 100%;
      font-size: var(--text-reader-title-mobile);
    }

    .completion-verify-row {
      grid-template-columns: 1fr;
    }

    .completion-help-link {
      justify-self: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .completion-primary-btn,
    .completion-utility-btn {
      transition: none;
    }
  }
</style>
