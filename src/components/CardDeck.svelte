<script lang="ts">
  import { onMount } from 'svelte';
  import type { Card, AuditData } from '../lib/types';
  import HookCard from './HookCard.svelte';
  import FactCard from './FactCard.svelte';
  import ReframeCard from './ReframeCard.svelte';
  import MatureCard from './MatureCard.svelte';
  import AuditFooter from './AuditFooter.svelte';
  import ContentFingerprint from './ContentFingerprint.svelte';
  import SaveButton from './SaveButton.svelte';
  import ShareButton from './ShareButton.svelte';
  import SwipeHint from './SwipeHint.svelte';

  interface Props {
    cards: Card[];
    issueSlug: string;
    audit: AuditData;
    sources?: string;
    confidence?: string;
    lenses?: string[];
  }
  let { cards, issueSlug, audit, sources = '', confidence = '', lenses = [] }: Props = $props();

  let currentIndex = $state(0);
  let dragX = $state(0);
  let isDragging = $state(false);
  let cardEl = $state<HTMLDivElement | null>(null);
  let deckEl = $state<HTMLDivElement | null>(null);

  let startX = 0;
  let startTime = 0;
  let startY = 0;
  let isHorizontalSwipe: boolean | null = null;

  const THRESHOLD = 60;
  const VELOCITY_THRESHOLD = 400;
  const RESISTANCE = 0.8;
  const EDGE_RESISTANCE = 0.3;

  const cardTypeLabels: Record<string, string> = {
    hook: 'The framing',
    fact: 'The evidence',
    reframe: 'The fourth angle',
    mature: 'The considered view',
  };

  function goTo(index: number) {
    if (index < 0 || index >= cards.length) return;
    currentIndex = index;
    dragX = 0;
    try { navigator.vibrate?.(5); } catch {}
  }

  function handlePointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement)?.closest('button')) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startTime = Date.now();
    isHorizontalSwipe = null;
    try { cardEl?.setPointerCapture(e.pointerId); } catch {}
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (isHorizontalSwipe === null) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isHorizontalSwipe = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }
    if (!isHorizontalSwipe) return;

    e.preventDefault();

    const atStart = currentIndex === 0 && dx > 0;
    const atEnd = currentIndex === cards.length - 1 && dx < 0;
    const resistance = (atStart || atEnd) ? EDGE_RESISTANCE : RESISTANCE;
    dragX = dx * resistance;
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;

    const dx = e.clientX - startX;
    const dt = (Date.now() - startTime) / 1000;
    const velocity = Math.abs(dx / dt);

    if (isHorizontalSwipe && (Math.abs(dragX) > THRESHOLD || velocity > VELOCITY_THRESHOLD)) {
      if (dragX < 0 && currentIndex < cards.length - 1) {
        goTo(currentIndex + 1);
      } else if (dragX > 0 && currentIndex > 0) {
        goTo(currentIndex - 1);
      } else {
        dragX = 0;
      }
    } else {
      dragX = 0;
    }
    isHorizontalSwipe = null;
  }

  function handleTap(e: MouseEvent) {
    if (Math.abs(dragX) > 5) return;
    if ((e.target as HTMLElement)?.closest('button')) return;
    if (!deckEl) return;
    const rect = deckEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    if (pct < 0.3 && currentIndex > 0) {
      goTo(currentIndex - 1);
    } else if (pct > 0.7 && currentIndex < cards.length - 1) {
      goTo(currentIndex + 1);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
    if (e.key === 'ArrowRight') goTo(currentIndex + 1);
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  let rotation = $derived(isDragging ? Math.max(-3, Math.min(3, dragX * 0.02)) : 0);
  let scale = $derived(isDragging ? 0.98 : 1);
  let isFirst = $derived(currentIndex === 0);
  let isLast = $derived(currentIndex === cards.length - 1);
</script>

<div bind:this={deckEl} style="padding:0 18px;user-select:none;-webkit-user-select:none;">
  <!-- Q4: Progress bar 4px height, 15% inactive opacity -->
  <div style="display:flex;gap:3px;margin-bottom:14px;" role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemin={1} aria-valuemax={cards.length}>
    {#each cards as _, i}
      <div style="flex:1;height:4px;border-radius:2px;background:{i < currentIndex ? 'var(--amber-light)' : i === currentIndex ? 'var(--amber)' : 'rgba(44,34,21,0.15)'};transition:background 0.2s ease;"></div>
    {/each}
  </div>

  <!-- Card type label -->
  <div style="text-align:center;margin-bottom:8px;">
    <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-tertiary);font-weight:600;">
      {cardTypeLabels[cards[currentIndex]?.t] || ''}
    </span>
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    bind:this={cardEl}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    onclick={handleTap}
    style="touch-action:pan-y;cursor:grab;transform:translateX({dragX}px) rotate({rotation}deg) scale({scale});transition:{isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'};"
    role="application"
    aria-label="Card {currentIndex + 1} of {cards.length}. Use arrow keys to navigate."
    tabindex="0"
    onkeydown={handleKeydown}
  >
    {#key currentIndex}
      {#if cards[currentIndex]?.t === 'hook'}
        <HookCard text={cards[currentIndex].text} sub={cards[currentIndex].sub} />
      {:else if cards[currentIndex]?.t === 'fact'}
        <FactCard lens={cards[currentIndex].lens} h={cards[currentIndex].h} s={cards[currentIndex].s} d={cards[currentIndex].d} />
      {:else if cards[currentIndex]?.t === 'reframe'}
        <ReframeCard h={cards[currentIndex].h} s={cards[currentIndex].s} />
      {:else if cards[currentIndex]?.t === 'mature'}
        <MatureCard h={cards[currentIndex].h} s={cards[currentIndex].s} />
      {/if}
    {/key}

    <!-- Save + Share buttons -->
    <div style="display:flex;justify-content:flex-end;gap:4px;margin-top:8px;">
      <SaveButton {issueSlug} cardIndex={currentIndex} />
      <ShareButton />
    </div>
  </div>

  <!-- Q5: Back 38% / Next 62% asymmetric -->
  <div style="display:flex;gap:10px;margin-top:14px;">
    <button
      onclick={() => goTo(currentIndex - 1)}
      disabled={isFirst}
      style="flex:38;padding:15px 16px;border-radius:14px;border:1px solid var(--border);background:{isFirst ? '#F1EAE0' : '#FFFFFF'};color:{isFirst ? '#9A8D7D' : 'var(--text-primary)'};font-size:14px;font-weight:700;cursor:{isFirst ? 'default' : 'pointer'};"
    >Back</button>
    <button
      onclick={() => goTo(currentIndex + 1)}
      disabled={isLast}
      style="flex:62;padding:15px 16px;border-radius:14px;border:1px solid {isLast ? 'var(--border)' : 'var(--amber-light)'};background:{isLast ? '#F7F1E7' : '#FFF8E8'};color:{isLast ? '#9A8D7D' : 'var(--amber)'};font-size:14px;font-weight:800;cursor:{isLast ? 'default' : 'pointer'};"
    >Next</button>
  </div>

  <!-- Card counter -->
  <div style="text-align:center;margin-top:12px;">
    <span style="font-size:13px;color:var(--text-tertiary);">{currentIndex + 1} / {cards.length}</span>
  </div>

  <!-- Audit footer after last card -->
  {#if isLast}
    <AuditFooter {audit} {sources} {confidence} {lenses} />
    <ContentFingerprint {issueSlug} />
  {/if}
</div>

<SwipeHint />
