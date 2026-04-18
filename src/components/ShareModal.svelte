<script lang="ts">
  import type { Issue } from '../data/issue-types';
  import { onMount, onDestroy } from 'svelte';
  import { stagger, haptic } from '../lib/animation';
  import { createSpring, animateSpring } from '../lib/spring';
  import { BUILD_ID, getSiteOrigin } from '../lib/build';
  import { shareCardAsImage, type CardVariant, type CardFormat } from '../lib/share-card';

  interface Props {
    issue: Issue;
    cardIndex: number | null;
    onClose: () => void;
  }
  let { issue, cardIndex, onClose }: Props = $props();

  let copiedId: string | null = $state(null);
  let cardVariant: CardVariant = $state('black');
  let cardFormat: CardFormat = $state('feed');
  let cardGenerating = $state(false);
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
  let inertSiblings: HTMLElement[] = [];
  // Cache the overlay element ref for onDestroy — panelEl.parentElement is null after DOM removal
  let overlayRef: HTMLElement | null = null;

  function toggleBackgroundInert(overlayEl: HTMLElement | null, shouldInert: boolean) {
    // Scope inert to immediate siblings only — never walk up to the app shell,
    // which is already managed by InsightReader's own inert logic.
    const host = overlayEl?.parentElement;
    if (!host) return;
    if (shouldInert) {
      inertSiblings = [];
      for (const node of Array.from(host.children)) {
        if (!(node instanceof HTMLElement) || node === overlayEl || node.inert) continue;
        // Skip the app shell — it's managed by the reader overlay
        if (node.classList.contains('app-shell')) continue;
        node.inert = true;
        inertSiblings.push(node);
      }
      return;
    }
    for (const node of inertSiblings) {
      node.inert = false;
    }
    inertSiblings = [];
  }

  function restoreShareFocus() {
    const target = focusOrigin instanceof HTMLElement && focusOrigin !== document.body
      ? focusOrigin
      : document.querySelector<HTMLElement>('[aria-label="Share this card"], [aria-label="Share this issue"], .btn-share');
    target?.focus();
  }

  onMount(() => {
    focusOrigin = document.activeElement;
    isDesktop = window.innerWidth >= 640;

    // Capture overlay ref while it's still in the DOM — panelEl.parentElement is null after Svelte removes the node
    requestAnimationFrame(() => {
      overlayRef = panelEl?.parentElement as HTMLElement ?? null;
      if (overlayRef) toggleBackgroundInert(overlayRef, true);

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
    // Use cached overlayRef — panelEl is already detached from DOM at this point
    if (inertSiblings.length > 0) {
      for (const node of inertSiblings) {
        node.inert = false;
      }
      inertSiblings = [];
    }
    if (copyRevertTimer) clearTimeout(copyRevertTimer);
    if (staggerCancel) staggerCancel();
    restoreShareFocus();
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
  let fullUrl = $derived(`${getSiteOrigin()}/issue/${issue.id}?v=${encodeURIComponent(BUILD_ID)}`);

  let os = $derived(issue.opinionShift);
  let ns = $derived(Math.round(issue.finalScore ?? 0));

  let waShort = $derived(shareText.length > 120 ? shareText.slice(0, 117) + '...' : shareText);
  let waText = $derived(`*${waShort}*\n${os}% goes unreported.\n${fullUrl}`);
  let tgText = $derived(`${shareText} — ${os}% of the story goes unreported.\n\nFull analysis.`);
  let tweetShort = $derived(shareText.length > 180 ? shareText.slice(0, 177) + '...' : shareText);
  let tweetText = $derived(`${tweetShort}\n\n${os}% goes unreported.\nRead the full analysis.`);
  let threadsText = $derived(`${shareText} — ${os}% goes unreported.\n\n${fullUrl}`);

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
    os >= 80 ? 'var(--score-strong)' : os >= 60 ? 'var(--score-medium)' : os >= 40 ? 'var(--score-partial)' : 'var(--score-neutral)'
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

  async function shareAsImage() {
    if (cardGenerating) return;
    cardGenerating = true;
    try {
      haptic(5);
      await shareCardAsImage(shareText, cardVariant, cardFormat);
    } catch {}
    cardGenerating = false;
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
    if (dragOffsetY > 200 || dragVelocity > 500) {
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

<!-- svelte-ignore a11y_click_events_have_key_events — backdrop dismiss; Escape key handled via onKeyDown -->
<!-- svelte-ignore a11y_no_static_element_interactions — modal backdrop, not a focusable control -->
<div
  onclick={handleBackdrop}
  class="share-backdrop"
  class:share-backdrop--visible={visible && !closing}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions — touch drag-to-dismiss, not keyboard-targetable -->
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
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    {#if cardIndex !== null}
      <!-- ═══ CARD-LEVEL SHARE: Image is primary ═══ -->

      <!-- Card text preview -->
      <div style="padding:16px;border-radius:var(--radius-md);background:var(--bg-sunken);margin-bottom:16px;">
        <div style="font-size:var(--text-sm);font-weight:600;color:var(--text-tertiary);margin-bottom:4px;">{card ? (card.lens ? `${card.lens} angle` : 'Angle') : 'Card'}</div>
        <div style="font-size:var(--text-body);font-weight:600;color:var(--text-primary);line-height:1.4;">{shareText.length > 140 ? shareText.slice(0, 137) + '...' : shareText}</div>
      </div>

      <!-- Share as image — primary action -->
      <div style="margin-bottom:16px;">
        <span class="section-label">Share as image</span>

        <!-- Options row: format + color -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <!-- Format toggle -->
          <div style="display:flex;border:1px solid var(--border-subtle);border-radius:var(--radius-md);overflow:hidden;flex:1;">
            <button
              onclick={() => { cardFormat = 'feed'; }}
              style="flex:1;padding:8px 0;border:none;font:inherit;font-size:var(--text-sm);font-weight:{cardFormat === 'feed' ? '700' : '500'};cursor:pointer;background:{cardFormat === 'feed' ? 'var(--bg-sunken)' : 'transparent'};color:{cardFormat === 'feed' ? 'var(--text-primary)' : 'var(--text-muted)'};min-height:40px;transition:background 0.2s ease-out;"
              aria-pressed={cardFormat === 'feed'}
            >Feed</button>
            <button
              onclick={() => { cardFormat = 'story'; }}
              style="flex:1;padding:8px 0;border:none;border-left:1px solid var(--border-subtle);font:inherit;font-size:var(--text-sm);font-weight:{cardFormat === 'story' ? '700' : '500'};cursor:pointer;background:{cardFormat === 'story' ? 'var(--bg-sunken)' : 'transparent'};color:{cardFormat === 'story' ? 'var(--text-primary)' : 'var(--text-muted)'};min-height:40px;transition:background 0.2s ease-out;"
              aria-pressed={cardFormat === 'story'}
            >Story</button>
          </div>

          <!-- Color toggle -->
          <div style="display:flex;gap:4px;">
            <button
              onclick={() => { cardVariant = 'black'; }}
              style="width:32px;height:32px;border-radius:var(--radius-sm);border:2px solid {cardVariant === 'black' ? 'var(--text-primary)' : 'var(--border-subtle)'};background:#000;cursor:pointer;transition:border-color 0.2s ease-out;"
              aria-label="Black card"
              aria-pressed={cardVariant === 'black'}
            ></button>
            <button
              onclick={() => { cardVariant = 'white'; }}
              style="width:32px;height:32px;border-radius:var(--radius-sm);border:2px solid {cardVariant === 'white' ? 'var(--text-primary)' : 'var(--border-subtle)'};background:#fff;cursor:pointer;transition:border-color 0.2s ease-out;"
              aria-label="White card"
              aria-pressed={cardVariant === 'white'}
            ></button>
          </div>
        </div>

        <!-- Generate button -->
        <button
          onclick={shareAsImage}
          disabled={cardGenerating}
          style="width:100%;padding:12px 16px;background:{cardVariant === 'black' ? '#000' : '#fff'};color:{cardVariant === 'black' ? '#fff' : '#000'};border:1px solid {cardVariant === 'black' ? 'rgba(255,255,255,0.1)' : 'var(--border-subtle)'};border-radius:var(--radius-md);font:inherit;font-size:var(--text-ui);font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;opacity:{cardGenerating ? 0.6 : 1};transition:opacity 0.2s ease-out;"
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          {cardGenerating ? 'Generating...' : 'Save & share card'}
        </button>
      </div>

    {:else}
      <!-- ═══ ISSUE-LEVEL SHARE: URL/platforms is primary ═══ -->

      <!-- Preview card -->
      <div class="preview-card">
        <div style="margin:-12px -14px 10px;border-radius: var(--radius-md) var(--radius-md) 0 0;overflow:hidden;background:var(--bg-sunken);">
          <img src={`/og/issue-${issue.id}.png?v=${encodeURIComponent(BUILD_ID)}`} alt="" loading="eager" decoding="async" style="width:100%;aspect-ratio:1.91/1;object-fit:cover;display:block;" onerror={(e) => { const w = (e.currentTarget as HTMLElement)?.parentElement?.parentElement; if (w) w.style.display = 'none'; }} />
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
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          Share link
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
    {/if}

    <!-- Copy link (always available) -->
    <button
      onclick={copyLink}
      class="copy-btn"
      style="background:{copyBg};border-color:{copyBorder};"
    >
      <span class="copy-label">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
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
