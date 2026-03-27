<script lang="ts">
  import type { Issue } from '../data/issues';
  import { onMount, onDestroy } from 'svelte';
  import { stagger, haptic } from '../lib/animation';
  import { createSpring, animateSpring } from '../lib/spring';

  interface Props {
    issue: Issue;
    cardIndex: number | null;
    onClose: () => void;
  }
  let { issue, cardIndex, onClose }: Props = $props();

  let copiedId: string | null = $state(null);
  let copyPhase: 'idle' | 'out' | 'check' | 'in' | 'revert-out' | 'revert-in' = $state('idle');
  let copyBgFlash = $state(false);
  let visible = $state(false);
  let closing = $state(false);
  let buttonVisible: boolean[] = $state([false, false, false, false, false, false]);
  let copyRevertTimer: ReturnType<typeof setTimeout> | null = null;
  let staggerCancel: (() => void) | null = null;

  // Drag-to-dismiss state (mobile only)
  let dragStartY = $state(0);
  let dragOffsetY = $state(0);
  let isDragging = $state(false);
  let panelEl: HTMLDivElement | undefined = $state(undefined);

  // Desktop detection
  let isDesktop = $state(false);

  // Accessibility: focus management
  let focusOrigin: Element | null = null;

  onMount(() => {
    focusOrigin = document.activeElement;
    isDesktop = window.innerWidth >= 640;

    requestAnimationFrame(() => {
      visible = true;
      staggerCancel = stagger(openPlatforms.length, 40, 250, (i) => {
        buttonVisible[i] = true;
      });
      requestAnimationFrame(() => {
        const closeBtn = panelEl?.querySelector('.close-btn') as HTMLElement;
        if (closeBtn) closeBtn.focus();
      });
    });
  });

  onDestroy(() => {
    if (copyRevertTimer) clearTimeout(copyRevertTimer);
    if (staggerCancel) staggerCancel();
    if (focusOrigin && 'focus' in focusOrigin) {
      (focusOrigin as HTMLElement).focus();
    }
  });

  function closeWithAnimation() {
    if (closing) return;
    closing = true;
    setTimeout(() => { onClose(); }, 200);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeWithAnimation();
      return;
    }
    if (e.key === 'Tab' && panelEl) {
      const focusable = panelEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  }

  let card = $derived(cardIndex !== null ? issue.cards[cardIndex] : null);
  let shareText = $derived(card ? card.big : issue.headline);
  let previewText = $derived(card ? (shareText.length > 120 ? shareText.slice(0, 117) + '...' : shareText) : (issue.context.length > 120 ? issue.context.slice(0, 117) + '...' : issue.context));
  let fullUrl = $derived(`https://thefourthangle.pages.dev/issue/${issue.id}`);

  let os = $derived(issue.opinionShift);
  let ns = $derived(Math.round(issue.finalScore ?? 0));

  let waText = $derived(`*${shareText}*\n${os}% Opinion Shift · Neutrality: ${ns}/100\n\n10-second read. What every side left out:\n${fullUrl}`);
  let tgText = $derived(`${shareText} — ${os}% Opinion Shift · Neutrality: ${ns}/100\n\n10-second read beyond the headline.`);
  let tweetText = $derived(`${shareText}\n\n${os}% Opinion Shift · Neutrality: ${ns}/100\nWhat every side left out.`);
  let threadsText = $derived(`${shareText} — ${os}% Opinion Shift · Neutrality: ${ns}/100\n\n10-second read. What every side left out:\n${fullUrl}`);

  let canNativeShare = $state(false);
  onMount(() => { canNativeShare = !!navigator.share; });

  const openPlatforms = [
    { id: 'whatsapp', label: 'WhatsApp', url: () => `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}` },
    { id: 'telegram', label: 'Telegram', url: () => `https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(tgText)}` },
    { id: 'x', label: 'X / Twitter', url: () => `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(fullUrl)}` },
    { id: 'facebook', label: 'Facebook', url: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}` },
    { id: 'linkedin', label: 'LinkedIn', url: () => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}` },
    { id: 'threads', label: 'Threads', url: () => `https://www.threads.com/intent/post?text=${encodeURIComponent(threadsText)}` },
  ];

  let barColor = $derived(
    os >= 80 ? 'var(--score-critical)' : os >= 60 ? 'var(--score-warning)' : os >= 40 ? 'var(--score-info)' : 'var(--score-neutral)'
  );
  let nsColor = $derived(
    ns >= 75 ? 'var(--score-info)' : ns >= 50 ? 'var(--score-warning)' : 'var(--score-critical)'
  );

  function openPlatform(p: typeof openPlatforms[0]) {
    window.open(p.url(), '_blank', 'noopener');
  }

  function sequence(steps: Array<[number, () => void]>): number {
    let total = 0;
    const timers: number[] = [];
    for (const [delay, fn] of steps) {
      total += delay;
      timers.push(setTimeout(fn, total) as unknown as number);
    }
    return timers[timers.length - 1];
  }

  async function copyLink() {
    if (copyPhase !== 'idle') return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      haptic(5);
      copiedId = 'link';
      copyBgFlash = true;

      copyPhase = 'out';
      copyRevertTimer = sequence([
        [100, () => { copyPhase = 'check'; }],
        [200, () => { copyPhase = 'in'; }],
        [300, () => { copyBgFlash = false; }],
        [2000, () => { copyPhase = 'revert-out'; }],
        [100, () => { copyPhase = 'revert-in'; copiedId = null; }],
        [100, () => { copyPhase = 'idle'; }],
      ]);
    } catch {}
  }

  async function nativeShare() {
    try {
      await navigator.share({
        title: shareText,
        text: `${os}% Opinion Shift · Neutrality: ${ns}/100 — 10-second read. What every side left out.`,
        url: fullUrl,
      });
    } catch {}
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) closeWithAnimation();
  }

  // Drag-to-dismiss (mobile only)
  let lastTouchY = 0;
  let lastTouchTime = 0;
  let dragVelocity = 0;

  function onTouchStart(e: TouchEvent) {
    if (isDesktop) return;
    const touch = e.touches[0];
    dragStartY = touch.clientY;
    lastTouchY = touch.clientY;
    lastTouchTime = performance.now();
    dragOffsetY = 0;
    dragVelocity = 0;
    isDragging = true;
  }

  function onTouchMove(e: TouchEvent) {
    if (!isDragging || isDesktop) return;
    const touch = e.touches[0];
    const now = performance.now();
    const dt = (now - lastTouchTime) / 1000;
    if (dt > 0.001) {
      dragVelocity = (touch.clientY - lastTouchY) / dt;
    }
    lastTouchY = touch.clientY;
    lastTouchTime = now;
    const delta = touch.clientY - dragStartY;
    dragOffsetY = Math.max(0, delta);
    if (dragOffsetY > 10) {
      e.preventDefault();
    }
  }

  function onTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (dragOffsetY > 150 || dragVelocity > 500) {
      haptic(5);
      closeWithAnimation();
    } else {
      dragOffsetY = 0;
    }
  }

  let panelTransform = $derived.by(() => {
    if (isDragging && dragOffsetY > 0) {
      return `translateY(${dragOffsetY}px)`;
    }
    if (closing) {
      return isDesktop ? 'scale(0.95) translateY(8px)' : 'translateY(100%)';
    }
    if (visible) {
      return isDesktop ? 'scale(1) translateY(0)' : 'translateY(0)';
    }
    return isDesktop ? 'scale(0.95) translateY(8px)' : 'translateY(100%)';
  });

  let copyBg = $derived(copyBgFlash ? 'var(--status-green-bg)' : 'var(--bg-elevated)');
  let copyBorder = $derived(copyBgFlash ? 'var(--status-green)' : 'var(--border-subtle)');
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  onclick={handleBackdrop}
  class="share-backdrop"
  class:share-backdrop--visible={visible && !closing}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={panelEl}
    class="share-panel"
    class:share-panel--visible={visible && !closing}
    class:share-panel--closing={closing}
    class:share-panel--dragging={isDragging}
    style="transform:{panelTransform};"
    role="dialog"
    aria-modal="true"
    aria-label="Share {issue.headline}"
    onkeydown={onKeyDown}
    ontouchstart={onTouchStart}
    ontouchmove={onTouchMove}
    ontouchend={onTouchEnd}
  >

    <!-- Drag handle (mobile only) -->
    <div class="drag-handle-wrap">
      <div class="drag-handle"></div>
    </div>

    <!-- Header -->
    <div class="panel-header">
      <span class="panel-title">Share</span>
      <button class="close-btn" onclick={closeWithAnimation} aria-label="Close">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <!-- Preview card -->
    <div class="preview-card">
      <div class="preview-headline">{issue.headline}</div>
      <div class="preview-context">{previewText}</div>
      <div class="preview-scores">
        <div class="preview-bar-track">
          <div class="preview-bar-fill" style="width:{os}%;background:{barColor};"></div>
        </div>
        <span class="preview-score" style="color:{barColor};">{os}%</span>
        <span class="preview-label">Opinion Shift</span>
        <span class="preview-dot">&middot;</span>
        <span class="preview-score" style="color:{nsColor};">{ns}</span>
        <span class="preview-label">Neutrality</span>
      </div>
    </div>

    <!-- Native share (mobile primary action) -->
    {#if canNativeShare}
      <button class="native-share-btn" onclick={nativeShare}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        Share
      </button>
    {/if}

    <!-- Platform grid -->
    <div class="section-label">Share on</div>
    <div class="platform-grid">
      {#each openPlatforms as p, i}
        <button
          onclick={() => openPlatform(p)}
          class="share-btn"
          class:share-btn--visible={buttonVisible[i]}
        >
          <span class="share-btn-label">{p.label}</span>
        </button>
      {/each}
    </div>

    <div class="divider"></div>

    <!-- Copy link -->
    <button
      onclick={copyLink}
      class="copy-btn"
      style="background:{copyBg};border-color:{copyBorder};"
    >
      <span class="copy-label" class:copy-label--hidden={copyPhase === 'out' || copyPhase === 'check' || copyPhase === 'in'}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Copy link
      </span>
      <span class="copy-right">
        {#if copyPhase === 'check' || copyPhase === 'in'}
          <span class="copy-check" class:copy-check--visible={copyPhase === 'check' || copyPhase === 'in'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <span class="copy-copied" class:copy-copied--visible={copyPhase === 'in'}>Copied!</span>
        {:else if copyPhase === 'revert-out'}
          <span style="opacity:0;transition:opacity 100ms ease;">Copied!</span>
        {:else if copyPhase === 'revert-in'}
          <span style="opacity:1;transition:opacity 100ms ease;">Copy</span>
        {:else if copiedId === 'link'}
          <span style="color:var(--status-green);">Copied!</span>
        {:else}
          <span>Copy</span>
        {/if}
      </span>
    </button>
  </div>
</div>

<style>
  /* ── Backdrop ── */
  .share-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
    opacity: 0;
    transition: opacity 200ms ease;
  }
  .share-backdrop--visible {
    opacity: 1;
  }

  @media (min-width: 640px) {
    .share-backdrop {
      align-items: center;
      padding: 24px;
      background: rgba(0, 0, 0, 0.55);
    }
  }

  /* ── Panel ── */
  .share-panel {
    background: var(--bg);
    border-radius: 16px 16px 0 0;
    padding: 0 20px max(20px, env(safe-area-inset-bottom, 20px));
    max-width: 400px;
    width: 100%;
    box-shadow: 0 -4px 40px rgba(0, 0, 0, 0.12);
    position: relative;
    max-height: 90vh;
    overflow-y: auto;
    transform: translateY(100%);
    transition: transform 300ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)),
                opacity 200ms ease;
    will-change: transform;
    opacity: 0;
  }
  .share-panel--visible {
    transform: translateY(0);
    opacity: 1;
  }
  .share-panel--closing {
    transform: translateY(100%);
    opacity: 0;
    transition: transform 200ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)),
                opacity 150ms ease;
  }
  .share-panel--dragging {
    transition: none;
  }

  @media (min-width: 640px) {
    .share-panel {
      border-radius: 14px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.06);
      max-height: max-content;
      margin: auto 0;
      padding: 0 24px 24px;
      transform: scale(0.95) translateY(8px);
      opacity: 0;
    }
    .share-panel--visible {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
    .share-panel--closing {
      transform: scale(0.95) translateY(8px);
      opacity: 0;
    }
  }

  /* ── Drag handle (mobile only) ── */
  .drag-handle-wrap {
    display: flex;
    justify-content: center;
    padding: 10px 0 4px;
  }
  @media (min-width: 640px) {
    .drag-handle-wrap {
      display: none;
    }
  }

  /* ── Header ── */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0 16px;
  }
  @media (min-width: 640px) {
    .panel-header {
      padding: 20px 0 18px;
    }
  }
  .panel-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }
  @media (min-width: 640px) {
    .panel-title {
      font-size: 16px;
    }
  }

  /* ── Close button ── */
  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--bg-sunken);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    transition: background var(--duration-fast, 150ms) ease;
    flex-shrink: 0;
  }
  .close-btn:hover {
    background: var(--border-subtle);
  }

  /* ── Preview card ── */
  .preview-card {
    background: var(--bg-elevated);
    border-radius: 12px;
    padding: 16px;
    border: 1px solid var(--border-subtle);
    margin-bottom: 20px;
  }
  .preview-headline {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.35;
    margin-bottom: 6px;
  }
  .preview-context {
    font-size: 12px;
    color: var(--text-tertiary);
    line-height: 1.5;
    margin-bottom: 10px;
  }
  .preview-scores {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .preview-bar-track {
    width: 40px;
    height: 3px;
    background: var(--bg-sunken);
    border-radius: 2px;
    overflow: hidden;
  }
  .preview-bar-fill {
    height: 100%;
    border-radius: 2px;
  }
  .preview-score {
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .preview-label {
    font-size: 9px;
    color: var(--text-muted);
  }
  .preview-dot {
    font-size: 9px;
    color: var(--text-faint);
  }

  /* ── Native share button ── */
  .native-share-btn {
    width: 100%;
    padding: 12px 16px;
    background: var(--text-primary);
    color: var(--bg);
    border: none;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 16px;
    transition: opacity var(--duration-fast, 150ms) ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
  }
  .native-share-btn:hover {
    opacity: 0.85;
  }

  /* ── Section label ── */
  .section-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  /* ── Platform grid ── */
  .platform-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }
  @media (min-width: 640px) {
    .platform-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
  }

  .share-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border-radius: 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease,
                border-color var(--duration-fast, 150ms) ease,
                opacity 200ms ease,
                transform 200ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
    min-height: 44px;
    opacity: 0;
    transform: scale(0.92);
  }
  .share-btn--visible {
    opacity: 1;
    transform: scale(1);
  }
  .share-btn:hover {
    background: var(--bg-sunken);
    border-color: var(--border-divider);
  }
  .share-btn-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  /* ── Divider ── */
  .divider {
    height: 1px;
    background: var(--border-subtle);
    margin-bottom: 12px;
  }

  /* ── Copy button ── */
  .copy-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    transition: background 300ms ease, border-color 300ms ease;
    min-height: 44px;
  }
  .copy-btn:hover {
    background: var(--bg-sunken);
  }
  .copy-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    transition: opacity 100ms ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .copy-label--hidden {
    opacity: 0;
  }
  .copy-right {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-tertiary);
  }
  .copy-check {
    display: inline-flex;
    transform: scale(0);
    transition: transform 200ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  }
  .copy-check--visible {
    transform: scale(1);
  }
  .copy-copied {
    opacity: 0;
    color: var(--status-green);
    transition: opacity 100ms ease;
  }
  .copy-copied--visible {
    opacity: 1;
  }
</style>
