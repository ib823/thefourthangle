<script lang="ts">
  import type { Issue } from '../data/issues';
  import { onMount, onDestroy } from 'svelte';
  import { stagger, haptic } from '../lib/animation';

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

  // Drag-to-dismiss state
  let dragStartY = $state(0);
  let dragOffsetY = $state(0);
  let isDragging = $state(false);
  let panelEl: HTMLDivElement | undefined = $state(undefined);

  onMount(() => {
    requestAnimationFrame(() => {
      visible = true;
      // Stagger platform buttons in after panel slides up
      staggerCancel = stagger(openPlatforms.length, 30, 300, (i) => {
        buttonVisible[i] = true;
      });
    });
  });

  onDestroy(() => {
    if (copyRevertTimer) clearTimeout(copyRevertTimer);
    if (staggerCancel) staggerCancel();
  });

  function closeWithAnimation() {
    if (closing) return;
    closing = true;
    // 200ms close animation, then call onClose
    setTimeout(() => { onClose(); }, 200);
  }

  let card = $derived(cardIndex !== null ? issue.cards[cardIndex] : null);
  let shareText = $derived(card ? card.big : issue.headline);
  let previewText = $derived(shareText.length > 120 ? shareText.slice(0, 117) + '...' : shareText);
  let fullUrl = $derived(`https://thefourthangle.pages.dev/issue/${issue.id}`);

  let os = $derived(issue.opinionShift);
  let ns = $derived(Math.round(issue.finalScore ?? 0));

  // Share text per platform — compelling CTA, both scores, platform-optimized
  // WhatsApp: bold headline, scores, short hook + URL last (triggers link preview)
  let waText = $derived(`*${shareText}*\n${os}% Opinion Shift · Neutrality: ${ns}/100\n\n10-second read. What every side left out:\n${fullUrl}`);
  // Telegram: scores + hook, URL passed separately via url param
  let tgText = $derived(`${shareText} — ${os}% Opinion Shift · Neutrality: ${ns}/100\n\n10-second read beyond the headline.`);
  // X/Twitter: leave room for user to add thoughts (~180 chars max, URL is separate 23-char param)
  let tweetText = $derived(`${shareText}\n\n${os}% Opinion Shift · Neutrality: ${ns}/100\nWhat every side left out.`);
  // Threads: concise, URL included (triggers preview)
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
    os >= 80 ? '#EF4444' : os >= 60 ? '#F59E0B' : os >= 40 ? '#3B82F6' : '#64748B'
  );
  let nsColor = $derived(
    ns >= 75 ? '#3B82F6' : ns >= 50 ? '#EAB308' : '#EF4444'
  );

  function openPlatform(p: typeof openPlatforms[0]) {
    window.open(p.url(), '_blank', 'noopener');
  }

  async function copyLink() {
    if (copyPhase !== 'idle') return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      haptic(5);
      copiedId = 'link';
      copyBgFlash = true;

      // Phase 1: fade out "Copy link" (100ms)
      copyPhase = 'out';
      setTimeout(() => {
        // Phase 2: scale in checkmark (200ms)
        copyPhase = 'check';
        setTimeout(() => {
          // Phase 3: fade in "Copied!" (100ms)
          copyPhase = 'in';

          // After 300ms, end the bg flash
          setTimeout(() => { copyBgFlash = false; }, 300);

          // After 2s, reverse back
          copyRevertTimer = setTimeout(() => {
            copyPhase = 'revert-out';
            setTimeout(() => {
              copyPhase = 'revert-in';
              copiedId = null;
              setTimeout(() => {
                copyPhase = 'idle';
              }, 100);
            }, 100);
          }, 2000);
        }, 200);
      }, 100);
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

  // Drag-to-dismiss handlers
  function onTouchStart(e: TouchEvent) {
    // Only drag from the top area (handle region)
    const touch = e.touches[0];
    dragStartY = touch.clientY;
    dragOffsetY = 0;
    isDragging = true;
  }

  function onTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    const touch = e.touches[0];
    const delta = touch.clientY - dragStartY;
    // Only allow dragging downward
    dragOffsetY = Math.max(0, delta);
    if (dragOffsetY > 0) {
      e.preventDefault();
    }
  }

  function onTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (dragOffsetY > 100) {
      // Dismiss
      haptic(5);
      closeWithAnimation();
    } else {
      // Snap back
      dragOffsetY = 0;
    }
  }

  // Compute panel transform based on state
  let panelTransform = $derived.by(() => {
    if (isDragging && dragOffsetY > 0) {
      return `translateY(${dragOffsetY}px)`;
    }
    if (closing) {
      return 'translateY(100%)';
    }
    if (visible) {
      return 'translateY(0)';
    }
    return 'translateY(100%)';
  });

  // Copy button background
  let copyBg = $derived(copyBgFlash ? 'var(--status-green-bg)' : 'var(--bg-elevated)');
  let copyBorder = $derived(copyBgFlash ? 'var(--status-green-bg)' : 'var(--bg-sunken)');
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  onclick={handleBackdrop}
  class="share-backdrop"
  style="opacity:{visible && !closing ? 1 : 0};"
>
  <div
    bind:this={panelEl}
    class="share-panel"
    class:share-panel--visible={visible && !closing}
    class:share-panel--closing={closing}
    class:share-panel--dragging={isDragging}
    style="transform:{panelTransform};"
    ontouchstart={onTouchStart}
    ontouchmove={onTouchMove}
    ontouchend={onTouchEnd}
  >

    <!-- Drag handle -->
    <div style="display:flex;justify-content:center;padding-top:8px;padding-bottom:4px;cursor:grab;">
      <div class="drag-handle"></div>
    </div>

    <!-- Close -->
    <button onclick={closeWithAnimation} style="position:absolute;top:10px;right:10px;width:44px;height:44px;border-radius:10px;background:var(--bg-elevated);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--text-tertiary);">x</button>

    <!-- Preview -->
    <div style="background:var(--bg-elevated);border-radius:14px;padding:18px;border:1px solid var(--border-subtle);margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <img src="/logo.png?v=2" alt="" width="18" height="20" style="display:block;" />
        <span style="font-size:9px;font-weight:700;color:var(--text-tertiary);letter-spacing:1.5px;text-transform:uppercase;">THE FOURTH ANGLE</span>
      </div>
      <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:6px;line-height:1.35;">{issue.headline}</div>
      <div style="font-size:12px;color:var(--text-tertiary);line-height:1.5;margin-bottom:10px;">{previewText}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:44px;height:3px;background:var(--bg-sunken);border-radius:2px;overflow:hidden;">
          <div style="width:{os}%;height:100%;background:{barColor};border-radius:2px;"></div>
        </div>
        <span style="font-size:10px;font-weight:700;color:{barColor};">{os}%</span>
        <span style="font-size:9px;color:var(--text-muted);">Opinion Shift</span>
        <span style="font-size:9px;color:var(--text-faint);">·</span>
        <span style="font-size:10px;font-weight:700;color:{nsColor};">{ns}<span style="font-size:8px;color:var(--text-muted);">/100</span></span>
        <span style="font-size:9px;color:var(--text-muted);">Neutrality</span>
      </div>
    </div>

    <!-- Native share (mobile primary action) -->
    {#if canNativeShare}
      <button
        onclick={nativeShare}
        style="width:100%;padding:14px 20px;background:var(--text-primary);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:16px;transition:background 0.15s ease;display:flex;align-items:center;justify-content:center;gap:8px;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--text-primary)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--text-primary)'; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        Share
      </button>
    {/if}

    <!-- Platform grid -->
    <div style="font-size:11px;font-weight:600;color:var(--text-tertiary);letter-spacing:0.5px;margin-bottom:8px;">SHARE ON</div>
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:16px;">
      {#each openPlatforms as p, i}
        <button
          onclick={() => openPlatform(p)}
          class="share-btn"
          class:share-btn--visible={buttonVisible[i]}
          onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-divider)'; }}
          onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-sunken)'; }}
        >
          <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">{p.label}</span>
        </button>
      {/each}
    </div>

    <div style="height:1px;background:var(--bg-sunken);margin-bottom:14px;"></div>

    <!-- Copy link -->
    <button
      onclick={copyLink}
      class="copy-btn"
      style="background:{copyBg};border-color:{copyBorder};"
    >
      <span class="copy-label" class:copy-label--hidden={copyPhase === 'out' || copyPhase === 'check' || copyPhase === 'in'}>
        Copy link
      </span>
      <span class="copy-right">
        {#if copyPhase === 'check' || copyPhase === 'in'}
          <span class="copy-check" class:copy-check--visible={copyPhase === 'check' || copyPhase === 'in'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#37B24D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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
  .share-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
    transition: opacity 200ms ease;
  }

  @media (min-width: 640px) {
    .share-backdrop {
      align-items: center;
      padding: 20px;
    }
  }

  .share-panel {
    background: var(--bg);
    border-radius: 20px 20px 0 0;
    padding: 0 24px max(24px, env(safe-area-inset-bottom, 24px));
    max-width: 380px;
    width: 100%;
    box-shadow: 0 -4px 40px rgba(0, 0, 0, 0.12);
    position: relative;
    max-height: 90vh;
    overflow-y: auto;
    transform: translateY(100%);
    transition: transform 300ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
    will-change: transform;
  }

  .share-panel--visible {
    transform: translateY(0);
  }

  .share-panel--closing {
    transform: translateY(100%);
    transition: transform 200ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
  }

  .share-panel--dragging {
    transition: none;
  }

  @media (min-width: 640px) {
    .share-panel {
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    }
  }

  /* Platform button stagger animation */
  .share-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 8px;
    border-radius: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--bg-sunken);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, opacity 200ms ease, transform 200ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
    min-height: 44px;
    opacity: 0;
    transform: scale(0.9);
  }

  .share-btn--visible {
    opacity: 1;
    transform: scale(1);
  }

  /* Copy button */
  .copy-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid var(--bg-sunken);
    cursor: pointer;
    transition: background 300ms ease, border-color 300ms ease;
  }

  .copy-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    transition: opacity 100ms ease;
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
