<script lang="ts">
  import { onMount } from 'svelte';
  import OpinionBar from './OpinionBar.svelte';
  import VerdictBar from './VerdictBar.svelte';
  import { CARD_TYPES, opinionLabel } from '../data/issues';
  import { markStarted, markCompleted } from '../stores/reader';
  import SaveButton from './SaveButton.svelte';

  interface Props {
    issue: any;
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
    const vc = [...issue.cards].reverse().find((c: any) => c.t === 'view');
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

  function cardLabel(card: any) {
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

  let viewCard = $derived(issue.cards.findLast((c: any) => c.t === 'view'));

  let barColor = $derived(
    issue.opinionShift >= 80 ? '#E03131' : issue.opinionShift >= 60 ? '#B85C00' : issue.opinionShift >= 40 ? '#1971C2' : '#6C757D'
  );

  let label = $derived(opinionLabel(issue.opinionShift));
</script>

<div bind:this={scrollEl} role="article" aria-label="Issue reader" style="flex:1;overflow-y:auto;background:#FFFFFF;">
  <div style="max-width:680px;margin:0 auto;padding:40px 40px;">
    <!-- Reader header -->
    <h1 style="font-size:32px;font-weight:800;color:#212529;letter-spacing:-0.02em;line-height:1.15;margin:0;">{issue.headline}</h1>
    <p style="font-size:16px;color:#495057;font-weight:450;line-height:1.6;margin:16px 0 0;">{issue.context}</p>

    <!-- Opinion Shift -->
    <div style="display:flex;align-items:center;gap:12px;margin:20px 0 0;">
      <div style="flex:1;"><OpinionBar score={issue.opinionShift} height={6} showLabel={false} /></div>
      <span style="font-size:14px;font-weight:700;color:{barColor};">{issue.opinionShift}</span>
      <span style="font-size:11px;font-weight:600;color:#495057;">{label}</span>
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
        <span style="font-size:10px;font-weight:700;color:#24783C;background:#EBFBEE;padding:2px 6px;border-radius:4px;text-transform:uppercase;">New</span>
      {:else if issue.status === 'updated'}
        <span style="font-size:10px;font-weight:700;color:#1864AB;background:#E7F5FF;padding:2px 6px;border-radius:4px;text-transform:uppercase;">Updated</span>
      {/if}
      {#if issue.edition > 1}
        <span style="font-size:10px;color:#6C757D;">Edition {issue.edition}</span>
      {/if}
    </div>

    <!-- 6 Perspectives -->
    {#each issue.cards as card, i}
      {@const meta = CARD_TYPES[card.t] ?? CARD_TYPES.hook}
      <div style="margin-bottom:32px;">
        <div style="border-top:1px solid #F1F3F5;margin-bottom:20px;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:100px;background:{meta.bg};">
            <span style="width:5px;height:5px;border-radius:50%;background:{meta.color};"></span>
            <span style="font-size:12px;font-weight:600;color:{meta.color};">{cardLabel(card)}</span>
          </div>
          <SaveButton issueId={issue.id} cardIndex={i} />
        </div>
        <p style="font-size:24px;font-weight:700;color:#212529;line-height:1.35;margin:0;">{card.big}</p>
        {#if card.sub}
          <p style="font-size:15px;color:#495057;line-height:1.6;margin:12px 0 0;">{card.sub}</p>
        {/if}
      </div>
    {/each}

    <div bind:this={completionMarker} style="height:1px;"></div>

    <!-- Completion -->
    <div style="margin-top:16px;">
      <div style="height:1px;background:#2B8A3E;margin-bottom:24px;border-radius:1px;width:50%;margin:0 auto 24px;"></div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#51CF66,#37B24D);display:flex;align-items:center;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span style="font-size:14px;font-weight:600;color:#212529;">All 6 perspectives read</span>
      </div>
      {#if viewCard}
        <p style="font-size:16px;color:#495057;font-style:italic;line-height:1.6;margin:0 0 24px;padding-left:16px;border-left:3px solid #7048E8;">{viewCard.big}</p>
      {/if}
      <!-- Copy for verification -->
      <button onclick={copyForVerification} style="width:100%;padding:12px 16px;background:#F8F9FA;color:{copied ? '#2B8A3E' : '#6C757D'};border:1px solid {copied ? '#B2F2BB' : '#E9ECEF'};border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s ease;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px;"
        onmouseenter={(e) => { if (!copied) (e.currentTarget as HTMLElement).style.borderColor = '#DEE2E6'; }}
        onmouseleave={(e) => { if (!copied) (e.currentTarget as HTMLElement).style.borderColor = '#E9ECEF'; }}>
        {copied ? 'Copied — paste into the verifier' : 'Copy for verification'}
        {#if !copied}
          <a href="/verify" style="font-size:11px;color:#868E96;margin-left:4px;" onclick={(e) => e.stopPropagation()}>What is this?</a>
        {/if}
      </button>

      <!-- Next issue (not user-selectable — excluded from copy) -->
      <div style="user-select:none;-webkit-user-select:none;">
        {#if onNext && nextHeadline}
          <button onclick={onNext} style="width:100%;padding:14px 20px;background:#212529;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;text-align:left;transition:background 0.15s ease;"
            onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = '#343A40'; }}
            onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = '#212529'; }}>
            Next: {nextHeadline}
          </button>
        {/if}
      </div>
    </div>

    <div style="height:60px;"></div>
  </div>
</div>
