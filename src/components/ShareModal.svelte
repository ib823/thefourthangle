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

  let waText = $derived(`*${shareText}*\n${os}% Opinion Shift · Neutrality: ${ns}/100\n\nRead the full analysis:\n${fullUrl}`);
  let tgText = $derived(`${shareText} — ${os}% Opinion Shift · Neutrality: ${ns}/100\n\nRead the full analysis.`);
  let tweetText = $derived(`${shareText}\n\n${os}% Opinion Shift · Neutrality: ${ns}/100\nRead the full analysis.`);
  let threadsText = $derived(`${shareText} — ${os}% Opinion Shift · Neutrality: ${ns}/100\n\nRead the full analysis:\n${fullUrl}`);

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
    if (copiedId === 'link') return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      haptic(5);
      copiedId = 'link';
      copyBgFlash = true;
      copyRevertTimer = setTimeout(() => {
        copiedId = null;
        copyBgFlash = false;
      }, 2000) as unknown as ReturnType<typeof setTimeout>;
    } catch {}
  }

  async function nativeShare() {
    try {
      await navigator.share({
        title: shareText,
        text: `${os}% Opinion Shift · Neutrality: ${ns}/100 — Read the full analysis.`,
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
      <div style="margin:-12px -14px 10px;border-radius:10px 10px 0 0;overflow:hidden;background:#0f0f23;">
        <picture>
          <source srcset={`/og/backgrounds/issue-${issue.id}-card.avif`} type="image/avif" />
          <img src={`/og/backgrounds/issue-${issue.id}-card.jpg`} alt="" loading="eager" decoding="async" style="width:100%;aspect-ratio:1.91/1;object-fit:cover;display:block;" onerror={(e) => { (e.currentTarget as HTMLElement).parentElement!.parentElement!.style.display = 'none'; }} />
        </picture>
      </div>
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

    <!-- Platform grid: only on desktop where native share is unavailable -->
    {#if !canNativeShare}
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
    {/if}

    <!-- Copy link -->
    <button
      onclick={copyLink}
      class="copy-btn"
      style="background:{copyBg};border-color:{copyBorder};"
    >
      <span class="copy-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Copy link
      </span>
      <span class="copy-right">
        {#if copiedId === 'link'}
          <span style="color:var(--status-green);">Copied!</span>
        {:else}
          <span>Copy</span>
        {/if}
      </span>
    </button>
  </div>
</div>

