<script lang="ts">
  import { onMount } from 'svelte';
  import MobileCard from './MobileCard.svelte';
  import { readIssues, savePosition } from '../stores/reader';
  import { createSpring, animateSpring, SPRING_SNAPPY, SPRING_RUBBER, type SpringState } from '../lib/spring';
  import { createVelocityTracker, classifyGesture, rubberBand } from '../lib/velocity';
  import { haptic } from '../lib/animation';

  interface Props {
    issues: any[];
    onOpenIssue: (issue: any) => void;
    initialFeedIndex?: number;
  }
  let { issues, onOpenIssue, initialFeedIndex = 0 }: Props = $props();

  let mounted = $state(false);
  let current = $state(Math.min(initialFeedIndex, Math.max(0, issues.length - 1)));
  let isDragging = $state(false);
  let readMap: Record<string, string> = $state({});
  let animating = $state(false);

  // Drag state (not reactive — used for direct DOM manipulation)
  let dragOffset = 0;
  let startX = 0;
  let startY = 0;
  let gestureDirection: 'horizontal' | 'vertical' | 'ambiguous' | null = null;
  let gestureClassified = false;
  let activePointerId: number | null = null;
  let cancelSpring: (() => void) | null = null;

  // Reduced motion preference
  let prefersReducedMotion = false;

  // DOM refs
  let containerEl: HTMLDivElement | undefined = $state();
  let activeCardEl: HTMLDivElement | undefined = $state();
  let peekCardEl: HTMLDivElement | undefined = $state();
  let thirdCardEl: HTMLDivElement | undefined = $state();

  const velocityTracker = createVelocityTracker();

  function getState(id: string) {
    const raw = readMap[id];
    if (!raw) return null;
    if (raw === 'true') return { state: 'completed', progress: 6 };
    try { return JSON.parse(raw); } catch { return null; }
  }

  $effect(() => {
    const unsub = readIssues.subscribe(v => { readMap = { ...v }; });
    return unsub;
  });

  onMount(() => {
    requestAnimationFrame(() => { mounted = true; });

    // Check reduced motion
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = mq.matches;
    const onMqChange = (e: MediaQueryListEvent) => { prefersReducedMotion = e.matches; };
    mq.addEventListener('change', onMqChange);

    // Keyboard navigation
    function onKeyDown(e: KeyboardEvent) {
      if (animating) return;
      if (e.key === 'ArrowDown' && current < issues.length - 1) { e.preventDefault(); commitSwipe('up'); }
      else if (e.key === 'ArrowUp' && current > 0) { e.preventDefault(); commitSwipe('down'); }
      else if (e.key === 'Enter') { e.preventDefault(); onOpenIssue(issues[current]); }
    }
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      mq.removeEventListener('change', onMqChange);
      if (cancelSpring) cancelSpring();
    };
  });

  // --- Swipe thresholds ---
  const VELOCITY_THRESHOLD = 500; // px/s
  const DISTANCE_FRACTION = 0.15; // 15% of card height
  const MAX_ROTATION = 8; // degrees
  const GESTURE_SLOP = 10; // px before classifying gesture

  function getCardHeight(): number {
    return activeCardEl?.offsetHeight ?? window.innerHeight * 0.7;
  }

  // --- Direct DOM updates during drag ---
  function applyDragTransform(offset: number) {
    const h = getCardHeight();
    const progress = Math.min(Math.abs(offset) / h, 1);
    const rotation = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, offset * 0.008));
    const scale = Math.max(0.95, 1 - Math.abs(offset) * 0.0003);

    // Active card
    if (activeCardEl) {
      activeCardEl.style.transition = 'none';
      activeCardEl.style.transform = `translateY(${offset}px) rotate(${rotation}deg) scale(${scale})`;
    }

    // Ghost/peek cards interpolate based on drag progress
    if (peekCardEl) {
      const peekScale = 0.95 + progress * 0.05; // 0.95 -> 1.0
      const peekTranslateY = 12 - progress * 12; // 12 -> 0
      const peekBrightness = 0.96 + progress * 0.04; // 0.96 -> 1.0
      peekCardEl.style.transition = 'none';
      peekCardEl.style.transform = `scale(${peekScale}) translateY(${peekTranslateY}px)`;
      peekCardEl.style.filter = `brightness(${peekBrightness})`;
    }

    if (thirdCardEl) {
      const thirdScale = 0.90 + progress * 0.05; // 0.90 -> 0.95
      const thirdTranslateY = 24 - progress * 12; // 24 -> 12
      const thirdBrightness = 0.92 + progress * 0.04; // 0.92 -> 0.96
      thirdCardEl.style.transition = 'none';
      thirdCardEl.style.transform = `scale(${thirdScale}) translateY(${thirdTranslateY}px)`;
      thirdCardEl.style.filter = `brightness(${thirdBrightness})`;
    }
  }

  function resetCardStyles() {
    if (activeCardEl) {
      activeCardEl.style.transition = '';
      activeCardEl.style.transform = '';
    }
    if (peekCardEl) {
      peekCardEl.style.transition = '';
      peekCardEl.style.transform = '';
      peekCardEl.style.filter = '';
    }
    if (thirdCardEl) {
      thirdCardEl.style.transition = '';
      thirdCardEl.style.transform = '';
      thirdCardEl.style.filter = '';
    }
  }

  // --- Pointer events ---
  function onPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement)?.closest('button')) return;
    if (animating) return;
    if (activePointerId !== null) return; // already tracking a pointer

    activePointerId = e.pointerId;
    // Capture pointer for reliable tracking
    (e.currentTarget as HTMLElement)?.setPointerCapture(e.pointerId);

    startX = e.clientX;
    startY = e.clientY;
    dragOffset = 0;
    gestureDirection = null;
    gestureClassified = false;
    isDragging = true;

    velocityTracker.reset();
    velocityTracker.push(e.clientX, e.clientY);

    if (cancelSpring) {
      cancelSpring();
      cancelSpring = null;
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerId !== activePointerId) {
      // Multi-touch: second finger cancels swipe
      if (isDragging && activePointerId !== null) {
        cancelDrag(e);
      }
      return;
    }
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    velocityTracker.push(e.clientX, e.clientY);

    // Classify gesture after passing slop threshold
    if (!gestureClassified && (Math.abs(dx) > GESTURE_SLOP || Math.abs(dy) > GESTURE_SLOP)) {
      gestureDirection = classifyGesture(dx, dy);
      gestureClassified = true;

      // If vertical, let the browser handle scrolling and cancel our drag
      if (gestureDirection === 'vertical') {
        cancelDrag(e);
        return;
      }
    }

    // Only process if horizontal or ambiguous (waiting for classification)
    if (gestureDirection === 'vertical') return;

    // Use vertical component for card swiping (up/down to change cards)
    const atStart = current === 0 && dy > 0;
    const atEnd = current === issues.length - 1 && dy < 0;

    if (atStart || atEnd) {
      // Rubber-band effect at edges
      dragOffset = rubberBand(dy, getCardHeight() * 0.5);
    } else {
      dragOffset = dy;
    }

    applyDragTransform(dragOffset);
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId !== activePointerId) return;
    if (!isDragging) return;

    isDragging = false;
    activePointerId = null;

    try {
      (e.currentTarget as HTMLElement)?.releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }

    const { vy } = velocityTracker.getVelocity();
    const absVelocity = Math.abs(vy);
    const absDistance = Math.abs(dragOffset);
    const cardHeight = getCardHeight();
    const shouldCommit = absVelocity > VELOCITY_THRESHOLD || absDistance > cardHeight * DISTANCE_FRACTION;

    if (shouldCommit) {
      if (dragOffset < 0 && current < issues.length - 1) {
        commitSwipe('up');
        return;
      } else if (dragOffset > 0 && current > 0) {
        commitSwipe('down');
        return;
      }
    }

    // Snap back with spring
    snapBack();
  }

  function cancelDrag(e: PointerEvent) {
    isDragging = false;
    activePointerId = null;
    try {
      (e.currentTarget as HTMLElement)?.releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }
    snapBack();
  }

  function onPointerCancel(e: PointerEvent) {
    if (e.pointerId !== activePointerId) return;
    cancelDrag(e);
  }

  function snapBack() {
    if (prefersReducedMotion) {
      dragOffset = 0;
      resetCardStyles();
      return;
    }

    const spring = createSpring(dragOffset, SPRING_RUBBER);
    cancelSpring = animateSpring(spring, 0, (value) => {
      dragOffset = value;
      applyDragTransform(value);
    }, () => {
      cancelSpring = null;
      dragOffset = 0;
      resetCardStyles();
    });
  }

  function commitSwipe(dir: 'up' | 'down') {
    haptic(5);
    animating = true;

    const exitTarget = dir === 'up' ? -window.innerHeight : window.innerHeight;

    if (prefersReducedMotion) {
      // Instant transition
      resetCardStyles();
      current = dir === 'up' ? current + 1 : current - 1;
      dragOffset = 0;
      animating = false;
      return;
    }

    // Exit phase: spring the active card off screen
    const exitSpring = createSpring(dragOffset, SPRING_SNAPPY);
    cancelSpring = animateSpring(exitSpring, exitTarget, (value) => {
      dragOffset = value;
      if (activeCardEl) {
        activeCardEl.style.transition = 'none';
        activeCardEl.style.transform = `translateY(${value}px) scale(1)`;
      }
    }, () => {
      // Update index
      resetCardStyles();
      current = dir === 'up' ? current + 1 : current - 1;

      // Persist feed position
      if (issues[current]) {
        savePosition(issues[current].id, 0);
      }

      // Enter phase: spring from slight offset to 0
      const enterOffset = dir === 'up' ? 60 : -60;
      dragOffset = enterOffset;

      // Need to wait a tick for Svelte to re-render with new current
      requestAnimationFrame(() => {
        if (activeCardEl) {
          activeCardEl.style.transition = 'none';
          activeCardEl.style.transform = `translateY(${enterOffset}px) scale(1)`;
        }

        const enterSpring = createSpring(enterOffset, SPRING_SNAPPY);
        cancelSpring = animateSpring(enterSpring, 0, (value) => {
          dragOffset = value;
          if (activeCardEl) {
            activeCardEl.style.transition = 'none';
            activeCardEl.style.transform = `translateY(${value}px) scale(1)`;
          }
        }, () => {
          cancelSpring = null;
          dragOffset = 0;
          resetCardStyles();
          animating = false;
        });
      });
    });
  }

  // Content-visibility: only render visible cards + 1 above/below
  let visibleRange = $derived({
    start: Math.max(0, current - 1),
    end: Math.min(issues.length - 1, current + 2),
  });
</script>

<div
  bind:this={containerEl}
  style="flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;touch-action:none;"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerCancel}
>
  <!-- Card area -->
  <div style="flex:1;position:relative;padding:0 12px max(12px, env(safe-area-inset-bottom, 12px));opacity:{mounted ? 1 : 0};transition:opacity 0.4s ease;">
    <!-- Third peek card behind -->
    {#if current + 2 <= visibleRange.end}
      <div
        bind:this={thirdCardEl}
        style="position:absolute;inset:0 12px 12px 12px;transform:scale(0.90) translateY(24px);pointer-events:none;border-radius:20px;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;will-change:transform;transition:transform 0.35s cubic-bezier(.25,.1,.25,1);content-visibility:auto;filter:brightness(0.92);"
      >
        <MobileCard issue={issues[current + 2]} readState={getState(issues[current + 2].id)} onOpen={() => {}} />
      </div>
    {/if}

    <!-- Peek card behind -->
    {#if current + 1 <= visibleRange.end}
      <div
        bind:this={peekCardEl}
        style="position:absolute;inset:0 12px 12px 12px;transform:scale(0.95) translateY(12px);pointer-events:none;border-radius:20px;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;will-change:transform;transition:transform 0.35s cubic-bezier(.25,.1,.25,1);content-visibility:auto;filter:brightness(0.96);"
      >
        <MobileCard issue={issues[current + 1]} readState={getState(issues[current + 1].id)} onOpen={() => {}} />
      </div>
    {/if}

    <!-- Active card -->
    {#key current}
      <div
        bind:this={activeCardEl}
        style="position:absolute;inset:0 12px 12px 12px;will-change:transform;backface-visibility:hidden;-webkit-backface-visibility:hidden;"
      >
        <MobileCard issue={issues[current]} readState={getState(issues[current].id)} onOpen={() => onOpenIssue(issues[current])} />
      </div>
    {/key}
  </div>
</div>
