<script lang="ts">
  import { onMount } from 'svelte';
  import OpinionBar from './OpinionBar.svelte';
  import SaveButton from './SaveButton.svelte';
  import ShareModal from './ShareModal.svelte';
  import { CARD_TYPES } from '../data/issues';
  import { markStarted, markCompleted, updateProgress } from '../stores/reader';

  interface Card {
    t: string;
    big: string;
    sub: string;
    lens?: string;
  }

  interface Issue {
    id: string;
    headline: string;
    opinionShift: number;
    cards: Card[];
  }

  interface Props {
    issue: Issue;
    onClose: () => void;
    onNext?: () => void;
  }

  let { issue, onClose, onNext }: Props = $props();

  let current = $state(0);
  // Reactions handled by SaveButton internally
  let completed = $state(false);
  let readCards = $state(new Set<number>([0]));
  let shareOpen = $state(false);
  let shareCardIndex: number | null = $state(null);

  // Reset to first card when issue changes
  let lastIssueId = $state(issue.id);
  $effect(() => {
    if (issue.id !== lastIssueId) {
      lastIssueId = issue.id;
      current = 0;
      completed = false;
      readCards = new Set([0]);
      shareOpen = false;
      shareCardIndex = null;
      dragging = false;
      dx = 0;
      animDir = null;
      animating = false;
    }
  });

  // Swipe state
  let dragging = $state(false);
  let startX = $state(0);
  let dx = $state(0);

  // Animation direction
  let animDir = $state<'left' | 'right' | null>(null);
  let animating = $state(false);

  let overlayEl: HTMLDivElement | undefined = $state(undefined);

  let card = $derived(issue.cards[current]);
  let meta = $derived(CARD_TYPES[card?.t] ?? CARD_TYPES.hook);
  let totalCards = $derived(issue.cards.length);
  let progress = $derived(((current + 1) / totalCards) * 100);
  let rotation = $derived(Math.max(-3, Math.min(3, dx * 0.012)));

  function cardLabel(c: Card): string {
    const m = CARD_TYPES[c.t] ?? CARD_TYPES.hook;
    if (c.t === 'fact' && c.lens) {
      return `${m.label} \u00B7 ${c.lens}`;
    }
    return m.label;
  }

  function goTo(index: number, direction: 'left' | 'right') {
    if (animating || index < 0 || index >= totalCards) return;
    try { navigator.vibrate?.(10); } catch {}

    animDir = direction;
    animating = true;
    current = index;
    readCards = new Set([...readCards, index]);
    updateProgress(issue.id, index + 1);

    setTimeout(() => {
      animating = false;
      animDir = null;
    }, 300);
  }

  function next() {
    if (current >= totalCards - 1) {
      showCompletion();
      return;
    }
    goTo(current + 1, 'right');
  }

  function prev() {
    if (completed) {
      completed = false;
      goTo(totalCards - 1, 'left');
      return;
    }
    goTo(current - 1, 'left');
  }

  function showCompletion() {
    completed = true;
    markCompleted(issue.id);
  }

  function restart() {
    completed = false;
    current = 0;
    readCards = new Set([0]);
    animDir = null;
    animating = false;
  }


  // Pointer handlers
  function onPointerDown(e: PointerEvent) {
    if (animating) return;
    // Skip if target is a button or inside a button
    if ((e.target as HTMLElement)?.closest('button')) return;
    dragging = true;
    startX = e.clientX;
    dx = 0;
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    dx = e.clientX - startX;
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;

    if (dx < -60) {
      next();
    } else if (dx > 60) {
      prev();
    }
    dx = 0;
  }

  // Keyboard handler
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  onMount(() => {
    overlayEl?.focus();
    markStarted(issue.id);
  });

  // Animation transform for the card
  let cardTransform = $derived.by(() => {
    if (dragging) {
      return `translateX(${dx}px) rotate(${rotation}deg)`;
    }
    if (animating && animDir === 'right') {
      return 'translateX(0) rotate(0deg)';
    }
    if (animating && animDir === 'left') {
      return 'translateX(0) rotate(0deg)';
    }
    return 'translateX(0) rotate(0deg)';
  });

  let cardAnimClass = $derived(
    animating ? (animDir === 'right' ? 'anim-from-right' : 'anim-from-left') : ''
  );

  // Find takeaway text (last view card)
  let takeaway = $derived.by(() => {
    for (let i = issue.cards.length - 1; i >= 0; i--) {
      if (issue.cards[i].t === 'view') return issue.cards[i].big;
    }
    return issue.cards[issue.cards.length - 1].big;
  });
</script>

<svelte:window onkeydown={onKeyDown} />

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="overlay"
  bind:this={overlayEl}
  tabindex="0"
  role="dialog"
  aria-label="Insight reader"
>
  <!-- Progress bar -->
  <div class="progress-track">
    <div
      class="progress-fill"
      style="width:{completed ? 100 : progress}%;background:{meta.color};"
    ></div>
  </div>

  <!-- Header -->
  <div class="header">
    <span class="counter">{completed ? totalCards : current + 1}/{totalCards}</span>
    <button class="close-btn" onclick={onClose} aria-label="Close">&times;</button>
  </div>

  <!-- Headline + Opinion bar -->
  <div class="headline-area">
    <h2 class="headline">{issue.headline}</h2>
  </div>

  <!-- Card area -->
  <div class="card-area">
    {#if completed}
      <div class="card completion-card">
        <div class="completion-inner">
          <div class="check-circle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" stroke-dasharray="50" stroke-dashoffset="50" class="check-path" />
            </svg>
          </div>
          <p class="completion-title">All {totalCards} perspectives</p>
          <p class="completion-takeaway">{takeaway}</p>
          <div class="completion-buttons">
            <button class="btn-share" onclick={() => { shareCardIndex = null; shareOpen = true; }}>Share</button>
            {#if onNext}
              <button class="btn-next" onclick={onNext}>Next topic</button>
            {:else}
              <button class="btn-done" onclick={onClose}>Done</button>
            {/if}
          </div>
        </div>
      </div>
    {:else}
      <!-- Ghost cards -->
      <div class="ghost ghost-2"></div>
      <div class="ghost ghost-1"></div>

      <!-- Active card -->
      <div
        class="card active-card {cardAnimClass}"
        style="transform:{cardTransform};"
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
        role="group"
        aria-label="Card {current + 1} of {totalCards}"
      >
        <!-- Card top -->
        <div class="card-top">
          <div class="type-pill" style="background:{meta.bg};">
            <span class="pill-dot" style="background:{meta.color};"></span>
            <span class="pill-label" style="color:{meta.color};">{cardLabel(card)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <SaveButton issueId={issue.id} cardIndex={current} />
            <button onclick={() => { shareCardIndex = current; shareOpen = true; }} style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;background:#F8F9FA;border:1px solid #DEE2E6;border-radius:10px;cursor:pointer;transition:border-color 0.15s ease;" aria-label="Share this card">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#868E96" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            </button>
          </div>
        </div>

        <!-- Card center -->
        <div class="card-center">
          <p class="big-text" style="font-size:{card.sub ? 24 : 22}px;">{card.big}</p>
          {#if card.sub}
            <p class="sub-text">{card.sub}</p>
          {/if}
        </div>

        <!-- Card bottom -->
        <div class="card-bottom">
          {#if current === totalCards - 2 && !completed}
            <span style="font-size:12px;font-weight:600;color:#6C757D;">Almost done</span>
          {:else if current === totalCards - 1 && !completed}
            <span style="font-size:12px;font-weight:600;color:#6C757D;">Last one</span>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Dot navigation -->
  <div class="dots">
    {#each issue.cards as _, i}
      <button
        class="dot"
        class:active={i === current && !completed}
        class:read={readCards.has(i) && i !== current}
        style="
          {i === current && !completed
            ? `width:20px;background:${CARD_TYPES[issue.cards[i].t]?.color ?? '#ADB5BD'};`
            : readCards.has(i)
              ? `background:${CARD_TYPES[issue.cards[i].t]?.color ?? '#ADB5BD'};opacity:0.44;`
              : 'background:#E9ECEF;'}
        "
        onclick={() => {
          if (completed) completed = false;
          const dir = i > current ? 'right' : 'left';
          goTo(i, dir);
        }}
        aria-label="Go to card {i + 1}"
      ></button>
    {/each}
  </div>
</div>

{#if shareOpen}
  <ShareModal issue={issue} cardIndex={shareCardIndex} onClose={() => { shareOpen = false; }} />
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    display: flex;
    flex-direction: column;
    align-items: center;
    outline: none;
    overflow: hidden;
    touch-action: none;
  }

  .progress-track {
    width: 100%;
    height: 4px;
    background: #F1F3F5;
    flex-shrink: 0;
  }

  .progress-fill {
    height: 100%;
    border-radius: 0 2px 2px 0;
    transition: width 0.3s ease, background 0.3s ease;
  }

  .header {
    width: 100%;
    max-width: 440px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 20px 0;
    flex-shrink: 0;
  }

  .counter {
    font-size: 13px;
    font-weight: 600;
    color: #5A5F64;
  }

  .close-btn {
    width: 44px;
    height: 44px;
    border: none;
    background: #F8F9FA;
    border-radius: 10px;
    font-size: 20px;
    line-height: 1;
    color: #495057;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
  }

  .close-btn:hover {
    background: #E9ECEF;
  }

  .headline-area {
    width: 100%;
    max-width: 440px;
    padding: 8px 20px 0;
    flex-shrink: 0;
  }

  .headline {
    font-size: 12px;
    font-weight: 600;
    color: #495057;
    margin: 0 0 6px;
    line-height: 1.4;
  }

  .opinion-bar-wrap {
    margin-bottom: 4px;
  }

  .card-area {
    flex: 1;
    width: 100%;
    max-width: 440px;
    padding: 12px 16px 4px;
    position: relative;
    min-height: 0;
    touch-action: pan-x;
  }

  .ghost {
    position: absolute;
    left: 20px;
    right: 20px;
    height: auto;
    top: 12px;
    bottom: 4px;
    background: #fff;
    border-radius: 20px;
    pointer-events: none;
  }

  .ghost-2 {
    transform: scale(0.94) translateY(16px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
    z-index: 1;
    backface-visibility: hidden;
  }

  .ghost-1 {
    transform: scale(0.97) translateY(8px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    z-index: 2;
    backface-visibility: hidden;
  }

  .card {
    position: absolute;
    inset: 0;
    z-index: 3;
    width: auto;
    background: #fff;
    border-radius: 20px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    touch-action: pan-y;
    user-select: none;
    will-change: transform;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .active-card {
    cursor: grab;
    transition: transform 0.3s cubic-bezier(.25,.1,.25,1);
  }

  .active-card:active {
    cursor: grabbing;
    transition: none;
  }

  .card.anim-from-right {
    animation: slideFromRight 350ms cubic-bezier(.25,.1,.25,1) forwards;
  }

  .card.anim-from-left {
    animation: slideFromLeft 350ms cubic-bezier(.25,.1,.25,1) forwards;
  }

  @keyframes slideFromRight {
    from {
      transform: translateX(60px) rotate(1.5deg);
      opacity: 0.7;
    }
    to {
      transform: translateX(0) rotate(0deg);
      opacity: 1;
    }
  }

  @keyframes slideFromLeft {
    from {
      transform: translateX(-60px) rotate(-1.5deg);
      opacity: 0.7;
    }
    to {
      transform: translateX(0) rotate(0deg);
      opacity: 1;
    }
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    margin-bottom: 16px;
  }

  .type-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 100px;
  }

  .pill-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .pill-label {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  .card-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 14px;
    min-height: 0;
    overflow-y: auto;
  }

  .big-text {
    font-weight: 700;
    color: #212529;
    line-height: 1.35;
    margin: 0;
  }

  .sub-text {
    font-size: 15px;
    color: #5A5F64;
    line-height: 1.7;
    margin: 0;
  }

  .card-bottom {
    flex-shrink: 0;
    margin-top: 16px;
    text-align: right;
  }

  .swipe-hint {
    font-size: 12px;
    color: #6C757D;
    user-select: none;
    display: inline-block;
    animation: nudgeHint 1.5s ease-in-out infinite;
  }

  @keyframes nudgeHint {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(12px); }
  }

  .dots {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 20px calc(16px + env(safe-area-inset-bottom, 0));
    flex-shrink: 0;
  }

  .dot {
    width: 6px;
    height: 4px;
    border-radius: 100px;
    border: none;
    padding: 20px 6px;
    min-height: 44px;
    min-width: 20px;
    cursor: pointer;
    background-clip: content-box;
    transition: width 0.3s ease, background 0.3s ease, opacity 0.3s ease;
  }

  .dot.active {
    height: 8px;
  }

  /* Completion card */
  .completion-card {
    align-items: center;
    justify-content: center;
    text-align: center;
    max-height: 370px;
  }

  .completion-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .check-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #51CF66, #37B24D);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes bounceIn {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    60% {
      transform: scale(1.15);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .check-path {
    animation: drawCheck 0.4s ease 0.4s forwards;
  }

  @keyframes drawCheck {
    from { stroke-dashoffset: 50; }
    to { stroke-dashoffset: 0; }
  }

  .completion-title {
    font-size: 16px;
    font-weight: 700;
    color: #212529;
    margin: 0;
  }

  .completion-takeaway {
    font-size: 15px;
    font-style: italic;
    color: #495057;
    line-height: 1.6;
    margin: 0;
    max-width: 320px;
  }

  .completion-buttons {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .btn-done {
    padding: 10px 28px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    background: #212529;
    color: #fff;
    transition: background 0.15s ease;
  }

  .btn-done:hover {
    background: #343A40;
  }

  .btn-share {
    padding: 10px 28px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: 1.5px solid #E9ECEF;
    background: #F8F9FA;
    color: #495057;
    transition: background 0.15s ease;
  }

  .btn-share:hover {
    background: #E9ECEF;
  }

  .btn-next {
    padding: 10px 28px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    background: #212529;
    color: #fff;
    transition: background 0.15s ease;
  }

  .btn-next:hover {
    background: #343A40;
  }
</style>
