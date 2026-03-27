<script lang="ts">
  import { onMount } from 'svelte';
  import OpinionBar from './OpinionBar.svelte';
  import VerdictBar from './VerdictBar.svelte';
  import { CARD_TYPES, opinionLabel } from '../data/issues';
  import { markStarted, markCompleted } from '../stores/reader';
  import SaveButton from './SaveButton.svelte';
  import ShareModal from './ShareModal.svelte';

  import type { Issue } from '../data/issues';

  interface Props {
    issue: Issue;
    onNext?: () => void;
    nextHeadline?: string;
  }
  let { issue, onNext, nextHeadline }: Props = $props();

  // Reactions handled by SaveButton component
  let scrollEl: HTMLDivElement | undefined = $state(undefined);
  let completionMarker: HTMLDivElement | undefined = $state(undefined);
  let shareOpen = $state(false);
  let copied = $state(false);

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

  let lastId = $state(issue.id);
  $effect(() => {
    if (issue.id !== lastId) {
      lastId = issue.id;
      scrollEl?.scrollTo({ top: 0, behavior: 'smooth' });
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
</script>

<div bind:this={scrollEl} role="article" aria-label="Issue reader" style="flex:1;overflow-y:auto;background:var(--bg);">
  <div style="max-width:640px;margin:0 auto;padding:40px 24px;">
    <!-- Reader header -->
    <div style="display:flex;align-items:flex-start;gap:16px;">
      <h1 style="flex:1;font-size:32px;font-weight:800;color:var(--text-primary);letter-spacing:-0.02em;line-height:1.15;margin:0;">{issue.headline}</h1>
      <button onclick={() => { shareOpen = true; }} style="flex-shrink:0;display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px solid var(--border-subtle);background:var(--bg-elevated);cursor:pointer;transition:background 0.15s ease,border-color 0.15s ease;margin-top:4px;min-height:44px;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-divider)'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }} aria-label="Share this issue">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        <span style="font-size:12px;font-weight:600;color:var(--text-tertiary);">Share</span>
      </button>
    </div>
    <p style="font-size:16px;color:var(--text-secondary);font-weight:450;line-height:1.6;margin:16px 0 0;">{issue.context}</p>

    <!-- Opinion Shift -->
    <div style="display:flex;align-items:center;gap:12px;margin:20px 0 0;">
      <div style="flex:1;"><OpinionBar score={issue.opinionShift} height={6} showLabel={false} /></div>
      <span style="font-size:14px;font-weight:700;color:{barColor};">{issue.opinionShift}</span>
      <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">{label}</span>
    </div>
    <!-- Verdict bar -->
    {#if issue.stageScores && issue.finalScore}
      <div style="margin:16px 0 0;">
        <VerdictBar scores={issue.stageScores} finalScore={issue.finalScore} />
      </div>
    {/if}

    <!-- Meta row -->
    <div style="display:flex;align-items:center;gap:8px;margin:16px 0 32px;">
      {#if issue.status === 'new'}
        <span style="font-size:10px;font-weight:700;color:var(--status-green-text);background:var(--status-green-bg);padding:2px 6px;border-radius:4px;text-transform:uppercase;">New</span>
      {:else if issue.status === 'updated'}
        <span style="font-size:10px;font-weight:700;color:var(--status-blue-text);background:var(--status-blue-bg);padding:2px 6px;border-radius:4px;text-transform:uppercase;">Updated</span>
      {/if}
      {#if issue.edition > 1}
        <span style="font-size:10px;color:var(--text-tertiary);">Edition {issue.edition}</span>
      {/if}
    </div>

    <!-- 6 Perspectives -->
    {#each issue.cards as card, i}
      {@const meta = CARD_TYPES[card.t] ?? CARD_TYPES.hook}
      <div style="margin-bottom:32px;">
        <div style="border-top:1px solid var(--bg-sunken);margin-bottom:20px;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:100px;background:{meta.bg};">
            <span style="width:5px;height:5px;border-radius:50%;background:{meta.color};"></span>
            <span style="font-size:12px;font-weight:600;color:{meta.color};">{cardLabel(card)}</span>
          </div>
          <SaveButton issueId={issue.id} cardIndex={i} />
        </div>
        <p style="font-size:24px;font-weight:700;color:var(--text-primary);line-height:1.35;margin:0;">{card.big}</p>
        {#if card.sub}
          <p style="font-size:15px;color:var(--text-secondary);line-height:1.6;margin:12px 0 0;">{card.sub}</p>
        {/if}
      </div>
    {/each}

    <div bind:this={completionMarker} style="height:1px;"></div>

    <!-- Completion -->
    <div style="margin-top:16px;">
      <div style="height:1px;background:var(--status-green);margin-bottom:24px;border-radius:1px;width:50%;margin:0 auto 24px;"></div>
      <!-- Share -->
      <button onclick={() => { shareOpen = true; }} style="width:100%;padding:12px 16px;background:var(--bg-elevated);color:var(--text-tertiary);border:1px solid var(--border-subtle);border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s ease;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-divider)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        Share this issue
      </button>

      <!-- Copy for verification -->
      <button onclick={copyForVerification} style="width:100%;padding:12px 16px;background:var(--bg-elevated);color:{copied ? 'var(--status-green)' : 'var(--text-tertiary)'};border:1px solid {copied ? 'var(--status-green)' : 'var(--border-subtle)'};border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s ease;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px;"
        onmouseenter={(e) => { if (!copied) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-divider)'; }}
        onmouseleave={(e) => { if (!copied) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}>
        {copied ? 'Copied — paste into the verifier' : 'Copy for verification'}
        {#if !copied}
          <a href="/verify" style="font-size:11px;color:var(--text-muted);margin-left:4px;" onclick={(e) => e.stopPropagation()}>What is this?</a>
        {/if}
      </button>

    </div>

    <div style="height:60px;"></div>
  </div>
</div>

{#if shareOpen}
  <ShareModal {issue} cardIndex={null} onClose={() => { shareOpen = false; }} />
{/if}
