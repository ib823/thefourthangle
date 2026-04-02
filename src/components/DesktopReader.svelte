<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import OpinionBar from './OpinionBar.svelte';
  import VerdictBar from './VerdictBar.svelte';
  import { CARD_TYPES, opinionLabel } from '../data/issues';
  import { markStarted, markCompleted } from '../stores/reader';
  import { countUp } from '../lib/animation';
  import SaveButton from './SaveButton.svelte';
  import ShareModal from './ShareModal.svelte';
  import PushPrompt from './PushPrompt.svelte';
  import IssueImage from './IssueImage.svelte';

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
    onNext?: () => void;
    nextHeadline?: string;
    connections?: Connection[];
    onNavigateToIssue?: (issueId: string) => void;
  }
  let { issue, onNext, nextHeadline, connections = [], onNavigateToIssue }: Props = $props();

  // Reactions handled by SaveButton component
  let scrollEl: HTMLDivElement | undefined = $state(undefined);
  let completionMarker: HTMLDivElement | undefined = $state(undefined);
  let cardEls: Array<HTMLDivElement | undefined> = $state([]);
  let shareOpen = $state(false);
  let copied = $state(false);
  let activeStep = $state(0);
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
    markStarted(issue.id);
  });

  $effect(() => {
    if (!completionMarker) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        markCompleted(issue.id);
      }
    }, { threshold: 0.5 });
    obs.observe(completionMarker);
    return () => obs.disconnect();
  });

  let viewCard = $derived(issue.cards.findLast((c) => c.t === 'view'));

  let barColor = $derived(
    issue.opinionShift >= 80 ? 'var(--score-critical)' : issue.opinionShift >= 60 ? 'var(--score-warning)' : issue.opinionShift >= 40 ? 'var(--score-info)' : 'var(--text-tertiary)'
  );

  let label = $derived(opinionLabel(issue.opinionShift));

  function opinionNarrative(score: number): string {
    if (score >= 80) return `Reading only the headline would hide about ${score}% of the story.`;
    if (score >= 60) return `The headline leaves out most of the context that changes the meaning.`;
    if (score >= 40) return `The headline is directionally true, but it still misses a consequential layer.`;
    return `The headline gets the outline, but the deeper frame still matters.`;
  }

  function toneForCard(index: number): string {
    return index < activeStep ? 'done' : index === activeStep ? 'active' : 'idle';
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

        if (bestRatio > 0) activeStep = bestIndex;
      }, { root: scrollEl, threshold: [0.25, 0.45, 0.7] });

      els.forEach((el) => stepObserver?.observe(el));
    });
  }

  $effect(() => {
    void issue.id;
    activeStep = 0;
    cardEls = [];
    setupStepObserver();
  });

  $effect(() => {
    const ready = cardEls.filter(Boolean).length;
    if (ready === issue.cards.length && ready > 0) {
      setupStepObserver();
    }
  });
</script>

<div bind:this={scrollEl} role="article" aria-label="Issue reader" class:reader-switching={transitioning}
  style="flex:1;overflow-y:auto;background:var(--bg);transition:opacity var(--duration-fast, 150ms) ease, transform var(--duration-fast, 150ms) ease;">
  <!-- Screen reader announcement for issue change -->
  <div class="sr-only" aria-live="polite" aria-atomic="true">Now reading: {issue.headline}</div>
  <div style="max-width:760px;margin:0 auto;padding:32px 24px 56px;">
    <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-tertiary);">Six-Angle Reader</div>
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);">Angle {activeStep + 1} of {issue.cards.length}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        {#each issue.cards as step, i}
          <div style="
            display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;
            background:{toneForCard(i) === 'active' ? 'rgba(210,140,40,0.14)' : toneForCard(i) === 'done' ? 'rgba(46,125,50,0.12)' : 'var(--bg-elevated)'};
            border:1px solid {toneForCard(i) === 'active' ? 'rgba(210,140,40,0.28)' : toneForCard(i) === 'done' ? 'rgba(46,125,50,0.2)' : 'var(--border-subtle)'};
            color:{toneForCard(i) === 'active' ? 'var(--score-warning)' : toneForCard(i) === 'done' ? 'var(--status-green)' : 'var(--text-secondary)'};
          ">
            <span style="width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:{toneForCard(i) === 'active' ? 'rgba(210,140,40,0.18)' : toneForCard(i) === 'done' ? 'rgba(46,125,50,0.18)' : 'var(--bg-sunken)'};">{i + 1}</span>
            <span style="font-size:11px;font-weight:700;">{cardLabel(step)}</span>
          </div>
        {/each}
      </div>
    </div>

    <div style="display:flex;align-items:flex-start;gap:16px;">
      <div style="flex:1;">
        <h1 style="font-family:var(--font-display);font-size:40px;font-weight:800;color:var(--text-primary);letter-spacing:-0.04em;line-height:0.98;margin:0;max-width:14ch;">{issue.headline}</h1>
      </div>
      <button onclick={() => { shareOpen = true; }} style="flex-shrink:0;display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;border:1px solid var(--border-subtle);background:var(--bg-elevated);cursor:pointer;transition:background 0.15s ease,border-color 0.15s ease;margin-top:4px;min-height:44px;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-divider)'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }} aria-label="Share this issue" aria-expanded={shareOpen}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        <span style="font-size:12px;font-weight:700;color:var(--text-tertiary);">Share</span>
      </button>
    </div>
    <p style="font-size:18px;color:var(--text-secondary);font-weight:450;line-height:1.65;margin:16px 0 0;max-width:62ch;">{issue.context}</p>

    <div style="margin:24px -24px 0;overflow:hidden;background:var(--bg-sunken);border-radius:24px;">
      <picture>
        <source srcset={`/og/backgrounds/issue-${issue.id}-hero.avif`} type="image/avif" />
        <img src={`/og/backgrounds/issue-${issue.id}-hero.jpg`} alt="" loading="lazy" decoding="async" style="width:100%;aspect-ratio:1.91/1;object-fit:cover;display:block;" onerror={(e) => { const w = (e.currentTarget as HTMLElement)?.parentElement?.parentElement; if (w) w.style.display = 'none'; }} />
      </picture>
    </div>

    <div style="margin:22px 0 0;padding:20px 22px;border-radius:22px;border:1px solid var(--border-subtle);background:linear-gradient(135deg, rgba(210,140,40,0.08) 0%, rgba(255,255,255,0.9) 55%);display:grid;grid-template-columns:minmax(110px, 0.4fr) minmax(0, 1fr);gap:18px;align-items:center;">
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-tertiary);">Opinion Shift</div>
        <div style="font-family:var(--font-display);font-size:64px;line-height:0.9;letter-spacing:-0.05em;color:{barColor};margin-top:10px;">{displayOS}</div>
        <div style="font-size:11px;font-weight:700;color:{barColor};text-transform:uppercase;letter-spacing:0.06em;margin-top:8px;">{label}</div>
      </div>
      <div>
        <p style="font-size:18px;font-weight:700;line-height:1.35;color:var(--text-primary);margin:0;">{opinionNarrative(issue.opinionShift)}</p>
        <p style="font-size:13px;line-height:1.6;color:var(--text-secondary);margin:8px 0 0;">This is the signature T4A measure: how much the story changes when you read beyond the first telling.</p>
        <div style="margin-top:14px;"><OpinionBar score={issue.opinionShift} height={8} showLabel={false} /></div>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:16px 0 32px;">
      {#if issue.status === 'new'}
        <span style="font-size:10px;font-weight:700;color:var(--status-green-text);background:var(--status-green-bg);padding:4px 8px;border-radius:999px;text-transform:uppercase;">New</span>
      {:else if issue.status === 'updated'}
        <span style="font-size:10px;font-weight:700;color:var(--status-blue-text);background:var(--status-blue-bg);padding:4px 8px;border-radius:999px;text-transform:uppercase;">Updated</span>
      {/if}
      {#if issue.edition > 1}
        <span style="font-size:11px;font-weight:700;color:var(--text-secondary);padding:4px 8px;border-radius:999px;background:var(--bg-elevated);border:1px solid var(--border-subtle);">Edition {issue.edition}</span>
      {/if}
    </div>

    <!-- 6 Perspectives -->
    {#each issue.cards as card, i}
      {@const meta = CARD_TYPES[card.t] ?? CARD_TYPES.hook}
      <div bind:this={cardEls[i]} data-step={i} style="margin-bottom:20px;">
        <div style="padding:24px;border-radius:22px;background:var(--bg-elevated);border:1px solid var(--border-subtle);box-shadow:0 16px 36px rgba(24,24,24,0.05);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px;">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:{meta.bg};color:{meta.color};font-size:12px;font-weight:800;">{i + 1}</div>
              <div style="display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;background:{meta.bg};">
                <span style="width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.66);">
                  {#if card.t === 'hook'}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={meta.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {:else if card.t === 'fact'}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={meta.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"></circle><path d="m20 20-3.5-3.5"></path></svg>
                  {:else if card.t === 'reframe'}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={meta.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>
                  {:else}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={meta.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle><path d="m14.5 9.5-3 7-1-4-4-1z"></path></svg>
                  {/if}
                </span>
                <span style="font-size:12px;font-weight:700;color:{meta.color};">{cardLabel(card)}</span>
              </div>
            </div>
            <SaveButton issueId={issue.id} cardIndex={i} />
          </div>

          <p style="font-size:24px;font-weight:700;color:var(--text-primary);line-height:1.45;margin:0;max-width:33ch;">{card.big}</p>
          {#if card.sub}
            <p style="font-size:17px;color:var(--text-secondary);line-height:1.65;margin:12px 0 0;max-width:52ch;">{card.sub}</p>
          {/if}
          {#if card.t === 'fact' && connections.length > 0}
            <span style="font-size:11px;font-weight:700;color:var(--text-muted);margin-top:14px;display:block;">Tracked in {connections.length} {connections.length === 1 ? 'issue' : 'issues'}</span>
          {/if}
        </div>
      </div>
    {/each}

    <div bind:this={completionMarker} style="height:1px;"></div>

    <div style="margin-top:20px;padding:22px;border-radius:22px;border:1px solid rgba(46,125,50,0.16);background:linear-gradient(180deg, rgba(46,125,50,0.08) 0%, rgba(255,255,255,0.92) 100%);">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(46,125,50,0.14);color:var(--status-green);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <div style="font-family:var(--font-display);font-size:24px;line-height:1.05;letter-spacing:-0.03em;color:var(--text-primary);">You’ve seen all 6 angles.</div>
          <div style="font-size:13px;line-height:1.55;color:var(--text-secondary);margin-top:4px;">The headline, the evidence, the reframing, and the considered view are now on the table.</div>
        </div>
      </div>

      <!-- Connected issues -->
      {#if connections.length >= 2}
        <div style="margin:18px 0 16px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em;">{connections.length} connected issues</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            {#each connections as conn}
              <button
                onclick={() => onNavigateToIssue?.(conn.id)}
                style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:var(--bg-elevated);border:1px solid var(--border-subtle);cursor:pointer;text-align:left;width:100%;transition:background var(--duration-fast, 150ms) ease;"
                onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)'; }}
                onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
              >
                <div style="width:36px;height:36px;flex-shrink:0;border-radius:6px;overflow:hidden;background:var(--bg-sunken);">
                  <picture>
                    <source srcset={`/og/backgrounds/issue-${conn.id}-thumb.avif`} type="image/avif" />
                    <img src={`/og/backgrounds/issue-${conn.id}-thumb.jpg`} alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;" onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                  </picture>
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:6px;">
                    {#if conn.readState === 'completed'}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>
                    {:else if conn.readState === 'started'}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;"><circle cx="12" cy="12" r="9" stroke="var(--score-warning)" stroke-width="2" fill="none"/><path d="M12 3a9 9 0 0 1 0 18" fill="var(--score-warning)"/></svg>
                    {/if}
                    <div style="font-size:12px;font-weight:{conn.readState === 'completed' ? '500' : '600'};color:{conn.readState === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)'};line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;">{conn.headline}</div>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                    <span style="font-size:10px;color:var(--text-muted);">{conn.sharedEntities.slice(0, 3).join(' · ')}</span>
                    {#if conn.hasReaction}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--score-critical)" stroke="none" style="flex-shrink:0;opacity:0.6;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    {/if}
                  </div>
                </div>
                <span style="font-size:12px;font-weight:700;color:{conn.opinionShift >= 80 ? 'var(--score-critical)' : conn.opinionShift >= 60 ? 'var(--score-warning)' : conn.opinionShift >= 40 ? 'var(--score-info)' : 'var(--score-neutral)'};font-variant-numeric:tabular-nums;flex-shrink:0;">{conn.opinionShift}%</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Editorial Audit — revealed after reading all perspectives -->
      {#if issue.stageScores && issue.finalScore}
        <div style="margin:0 0 20px;padding:18px;background:var(--bg-elevated);border-radius:18px;border:1px solid var(--border-subtle);">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em;">Editorial Audit</div>
          <p style="font-size:13px;line-height:1.55;color:var(--text-secondary);margin:0 0 12px;">Tap any stage to see what was being tested and how this issue held up under that part of the editorial process.</p>
          <VerdictBar scores={issue.stageScores} finalScore={issue.finalScore} />
        </div>
      {/if}

      <!-- Share -->
      <button onclick={() => { shareOpen = true; }} style="width:100%;padding:12px 16px;background:var(--bg-elevated);color:var(--text-tertiary);border:1px solid var(--border-subtle);border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.15s ease,border-color 0.15s ease,color 0.15s ease;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-divider)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        Share this issue
      </button>

      <!-- Copy for verification -->
      <button onclick={copyForVerification} style="width:100%;padding:12px 16px;background:var(--bg-elevated);color:{copied ? 'var(--status-green)' : 'var(--text-tertiary)'};border:1px solid {copied ? 'var(--status-green)' : 'var(--border-subtle)'};border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.15s ease,border-color 0.15s ease,color 0.15s ease;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px;"
        onmouseenter={(e) => { if (!copied) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-divider)'; }}
        onmouseleave={(e) => { if (!copied) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}>
        {copied ? 'Copied — paste into the verifier' : 'Copy for verification'}
        {#if !copied}
          <a href="/verify" style="font-size:11px;color:var(--text-muted);margin-left:4px;" onclick={(e) => e.stopPropagation()}>What is this?</a>
        {/if}
      </button>
    </div>

    <PushPrompt />

    <div style="height:60px;"></div>
  </div>
</div>

{#if shareOpen}
  <ShareModal {issue} cardIndex={null} onClose={() => { shareOpen = false; }} />
{/if}

<style>
  .reader-switching {
    opacity: 0;
    transform: translateY(8px);
  }
</style>
