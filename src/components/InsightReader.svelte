<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import OpinionBar from './OpinionBar.svelte';
  import VerdictBar from './VerdictBar.svelte';
  import SaveButton from './SaveButton.svelte';
  import ShareModal from './ShareModal.svelte';
  import { CARD_TYPES } from '../data/issues';
  import { markStarted, markCompleted, updateProgress, savePosition } from '../stores/reader';
  import { createSpring, animateSpring, SPRING_DEFAULT, SPRING_SNAPPY, SPRING_RUBBER, type SpringConfig } from '../lib/spring';
  import { createVelocityTracker, classifyGesture, rubberBand } from '../lib/velocity';
  import { haptic, stagger, tween, ease } from '../lib/animation';
  import { lockScroll, unlockScroll } from '../lib/scroll-lock';
  import { observeScroll, applyFadeGradient, shouldBlockSwipe, type ScrollState } from '../lib/scroll-physics';

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
    stageScores?: { pa: number; ba: number; fc: number; af: number; ct: number; sr: number };
    finalScore?: number;
  }

  interface Props {
    issue: Issue;
    onClose: () => void;
    onNext?: () => void;
    initialCardIndex?: number;
  }

  let { issue, onClose, onNext, initialCardIndex = 0 }: Props = $props();

  let current = $state(Math.min(initialCardIndex, 5));
  let completed = $state(false);
  // Mark all cards up to initial position as read
  let readCards = $state(new Set<number>(Array.from({ length: Math.min(initialCardIndex, 5) + 1 }, (_, i) => i)));
  let shareOpen = $state(false);
  let shareCardIndex: number | null = $state(null);
  let showSwipeHint = $state(false);
  let swipeHintFaded = $state(false);
  let completionVisible = $state(false);
  let completionButtonsVisible = $state<boolean[]>([]);

  // Drag state - NOT reactive for perf (we use direct DOM manipulation during drag)
  let isDragging = false;
  let gestureDirection: 'horizontal' | 'vertical' | 'ambiguous' | 'undecided' = 'undecided';
  let dragStartX = 0;
  let dragStartY = 0;
  let dragDeltaX = 0;
  let dragDeltaY = 0;
  let activePointerId: number | null = null;
  let crossedCommitThreshold = false;

  // Animation cancellation
  let cancelAnimation: (() => void) | null = null;
  let animating = false;

  // Reduced motion
  let prefersReducedMotion = $state(false);

  // Element refs
  let overlayEl: HTMLDivElement | undefined = $state(undefined);
  let cardEl: HTMLDivElement | undefined = $state(undefined);
  let ghost1El: HTMLDivElement | undefined = $state(undefined);
  let ghost2El: HTMLDivElement | undefined = $state(undefined);
  let dotsContainerEl: HTMLDivElement | undefined = $state(undefined);
  let cardAreaEl: HTMLDivElement | undefined = $state(undefined);
  let cardContentEl: HTMLDivElement | undefined = $state(undefined);

  // Scroll physics state for card content
  let scrollState: ScrollState = $state({ atTop: true, atBottom: true, canScroll: false, scrollProgress: 0 });
  let scrollIndicatorVisible = $state(false);
  let scrollIndicatorTimer: ReturnType<typeof setTimeout> | null = null;
  let cleanupScrollObserver: (() => void) | null = null;

  // Velocity tracker
  const tracker = createVelocityTracker();

  let card = $derived(issue.cards[current]);
  let meta = $derived(CARD_TYPES[card?.t] ?? CARD_TYPES.hook);
  let totalCards = $derived(issue.cards.length);
  let progress = $derived(((current + 1) / totalCards) * 100);

  // Accessibility: screen reader announcements for card transitions
  let announcement = $state('');

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
      isDragging = false;
      dragDeltaX = 0;
      animating = false;
      cancelAnimation?.();
      cancelAnimation = null;
      completionVisible = false;
      completionButtonsVisible = [];
    }
  });

  function cardLabel(c: Card): string {
    const m = CARD_TYPES[c.t] ?? CARD_TYPES.hook;
    if (c.t === 'fact' && c.lens) {
      return `${m.label} \u00B7 ${c.lens}`;
    }
    return m.label;
  }

  function announceCard() {
    const c = issue.cards[current];
    if (c) {
      announcement = `Card ${current + 1} of ${totalCards}: ${cardLabel(c)}`;
    }
  }

  function announceCompletion() {
    announcement = `All ${totalCards} perspectives read.`;
  }

  // Find takeaway text (last view card)
  let takeaway = $derived.by(() => {
    for (let i = issue.cards.length - 1; i >= 0; i--) {
      if (issue.cards[i].t === 'view') return issue.cards[i].big;
    }
    return issue.cards[issue.cards.length - 1].big;
  });

  // --- Swipe threshold logic ---
  let cachedCardWidth = 0;
  function getCardWidth(): number {
    // Cache offsetWidth per drag session to avoid layout reads on every pointer move
    if (cachedCardWidth > 0) return cachedCardWidth;
    cachedCardWidth = cardEl?.offsetWidth ?? 340;
    return cachedCardWidth;
  }

  function isAtEdge(direction: 'left' | 'right'): boolean {
    if (completed) return direction === 'left';
    if (direction === 'left' && current >= totalCards - 1) return false; // can go to completion
    if (direction === 'right' && current <= 0) return true;
    return false;
  }

  function shouldCommit(dx: number, vx: number): 'left' | 'right' | null {
    const absDx = Math.abs(dx);
    const absVx = Math.abs(vx);
    const width = getCardWidth();
    const distanceThreshold = width * 0.15;

    if (absVx > 500 || absDx > distanceThreshold) {
      const direction = (vx !== 0 ? vx : dx) < 0 ? 'left' : 'right';
      return direction;
    }
    return null;
  }

  // --- Direct DOM transforms during drag ---
  function applyDragTransform(dx: number) {
    if (!cardEl) return;

    const width = getCardWidth();
    const absDx = Math.abs(dx);
    const rotation = Math.max(-8, Math.min(8, dx * 0.04));
    const rotateY = dx * 0.015;
    const scaleVal = 1.0 + absDx * 0.0001;

    cardEl.style.transform = `translateX(${dx}px) rotate(${rotation}deg) rotateY(${rotateY}deg) scale(${scaleVal})`;

    // Ghost card interpolation based on progress
    const progressFrac = Math.min(absDx / (width * 0.5), 1);
    if (ghost1El) {
      const g1Scale = 0.97 + progressFrac * 0.03;
      const g1TransY = 8 - progressFrac * 8;
      ghost1El.style.transform = `scale(${g1Scale}) translateY(${g1TransY}px)`;
    }
    if (ghost2El) {
      const g2Scale = 0.94 + progressFrac * 0.03;
      const g2TransY = 16 - progressFrac * 8;
      ghost2El.style.transform = `scale(${g2Scale}) translateY(${g2TransY}px)`;
    }

    // Dot interpolation
    interpolateDots(dx);
  }

  function interpolateDots(dx: number) {
    if (!dotsContainerEl || completed) return;
    const width = getCardWidth();
    const progressFrac = Math.min(Math.abs(dx) / (width * 0.3), 1);
    const dots = dotsContainerEl.querySelectorAll('.dot');

    const nextIndex = dx < 0 ? current + 1 : current - 1;
    if (nextIndex < 0 || nextIndex >= totalCards) return;

    dots.forEach((dot, i) => {
      const el = dot as HTMLElement;
      if (i === current) {
        // Current dot shrinks
        const w = 20 - progressFrac * 14;
        el.style.width = `${w}px`;
      } else if (i === nextIndex) {
        // Next dot grows
        const w = 6 + progressFrac * 14;
        el.style.width = `${w}px`;
      }
    });
  }

  function resetDotStyles() {
    if (!dotsContainerEl) return;
    const dots = dotsContainerEl.querySelectorAll('.dot');
    dots.forEach((dot) => {
      (dot as HTMLElement).style.width = '';
    });
  }

  function resetGhostStyles() {
    if (ghost1El) ghost1El.style.transform = '';
    if (ghost2El) ghost2El.style.transform = '';
  }

  // --- Navigation with spring physics ---
  function goTo(index: number, direction: 'left' | 'right', initialVelocity = 0) {
    if (animating || index < 0 || index >= totalCards) return;
    haptic(5);
    savePosition(issue.id, index);

    animating = true;
    cancelAnimation?.();

    const width = getCardWidth();
    const exitTarget = direction === 'right' ? -width * 1.2 : width * 1.2;

    // Exit animation
    const startPos = dragDeltaX || 0;
    const remaining = Math.abs(exitTarget - startPos);
    const exitDuration = prefersReducedMotion ? 0 : Math.max(180, Math.min(350, remaining / width * 350));

    const exitSpring = createSpring(startPos, {
      stiffness: 600,
      damping: 38,
      mass: 1,
      precision: 5,
    });
    exitSpring.velocity = initialVelocity;

    cancelAnimation = animateSpring(exitSpring, exitTarget, (value) => {
      if (cardEl) {
        const rot = Math.max(-8, Math.min(8, value * 0.04));
        cardEl.style.transform = `translateX(${value}px) rotate(${rot}deg)`;
        cardEl.style.opacity = `${Math.max(0, 1 - Math.abs(value) / (width * 1.5))}`;
      }
    }, () => {
      // Exit complete — switch card
      current = index;
      readCards = new Set([...readCards, index]);
      updateProgress(issue.id, index + 1);

      resetGhostStyles();
      resetDotStyles();

      // Enter animation
      if (cardEl) {
        const enterFrom = direction === 'right' ? 60 : -60;
        cardEl.style.opacity = '1';

        if (prefersReducedMotion) {
          cardEl.style.transform = 'translateX(0) rotate(0deg)';
          animating = false;
          cancelAnimation = null;
          announceCard();
          return;
        }

        const enterSpring = createSpring(enterFrom, {
          stiffness: 500,
          damping: 26, // slight underdamping for overshoot
          mass: 1,
          precision: 0.5,
        });

        cancelAnimation = animateSpring(enterSpring, 0, (value) => {
          if (cardEl) {
            const rot = value * 0.02;
            cardEl.style.transform = `translateX(${value}px) rotate(${rot}deg)`;
          }
        }, () => {
          if (cardEl) {
            cardEl.style.transform = '';
          }
          animating = false;
          cancelAnimation = null;
          announceCard();
        });
      } else {
        animating = false;
        cancelAnimation = null;
        announceCard();
      }
    });
  }

  function snapBack(initialVelocity = 0) {
    if (!cardEl) return;
    animating = true;

    if (prefersReducedMotion) {
      cardEl.style.transform = '';
      cardEl.style.transition = '';
      resetGhostStyles();
      resetDotStyles();
      animating = false;
      return;
    }

    const startPos = dragDeltaX;
    const spring = createSpring(startPos, SPRING_SNAPPY);
    spring.velocity = initialVelocity;

    cancelAnimation = animateSpring(spring, 0, (value) => {
      if (cardEl) {
        const rot = Math.max(-8, Math.min(8, value * 0.04));
        const sc = 1.0 + Math.abs(value) * 0.0001;
        cardEl.style.transform = `translateX(${value}px) rotate(${rot}deg) scale(${sc})`;
      }
    }, () => {
      if (cardEl) {
        cardEl.style.transform = '';
      }
      resetGhostStyles();
      resetDotStyles();
      animating = false;
      cancelAnimation = null;
    });
  }

  function rubberBandBack() {
    if (!cardEl) return;
    animating = true;

    const startPos = dragDeltaX;
    // Use SPRING_RUBBER with omega=18 equivalent
    const spring = createSpring(startPos, {
      stiffness: 324, // omega^2 * mass = 18^2 = 324
      damping: 36,
      mass: 1,
      precision: 0.5,
    });

    cancelAnimation = animateSpring(spring, 0, (value) => {
      if (cardEl) {
        const rot = Math.max(-8, Math.min(8, value * 0.04));
        cardEl.style.transform = `translateX(${value}px) rotate(${rot}deg)`;
      }
    }, () => {
      if (cardEl) {
        cardEl.style.transform = '';
      }
      resetGhostStyles();
      resetDotStyles();
      animating = false;
      cancelAnimation = null;
    });
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
      completionVisible = false;
      completionButtonsVisible = [];
      goTo(totalCards - 1, 'left');
      return;
    }
    goTo(current - 1, 'left');
  }

  function showCompletion() {
    completed = true;
    markCompleted(issue.id);
    completionVisible = true;
    announceCompletion();
    // Stagger buttons in
    const btnCount = onNext ? 2 : 2; // share + next/done
    completionButtonsVisible = [];
    stagger(btnCount, 120, 500, (i) => {
      completionButtonsVisible = [...completionButtonsVisible, true];
    });
  }

  function restart() {
    completed = false;
    completionVisible = false;
    completionButtonsVisible = [];
    current = 0;
    readCards = new Set([0]);
    animating = false;
    cancelAnimation?.();
    cancelAnimation = null;
    if (cardEl) cardEl.style.transform = '';
  }

  // --- Dismiss overlay via vertical drag ---
  let verticalDismissActive = false;

  function handleVerticalDismiss(dy: number) {
    if (!overlayEl) return;
    const absDy = Math.abs(dy);
    const opacity = Math.max(0, 1 - absDy / 400);
    overlayEl.style.transform = `translateY(${Math.max(0, dy)}px)`;
    overlayEl.style.opacity = `${opacity}`;
  }

  function finishVerticalDismiss(dy: number) {
    const { vy } = tracker.getVelocity();
    // Dismiss if dragged far enough OR fast enough downward flick
    if (dy > 200 || vy > 500) {
      onClose();
    } else if (overlayEl) {
      // Snap back
      overlayEl.style.transition = 'transform var(--duration-normal, 250ms) var(--ease-out-cubic, ease), opacity var(--duration-normal, 250ms) var(--ease-out-cubic, ease)';
      overlayEl.style.transform = '';
      overlayEl.style.opacity = '';
      setTimeout(() => {
        if (overlayEl) overlayEl.style.transition = '';
      }, 260);
    }
    verticalDismissActive = false;
  }

  // --- Pointer event handlers ---
  function onPointerDown(e: PointerEvent) {
    if (animating || completed) return;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement)?.closest('button, a, input')) return;

    // Block swipe initiation when user is mid-scroll in card content
    if (cardContentEl && shouldBlockSwipe(cardContentEl)) return;

    isDragging = true;
    gestureDirection = 'undecided';
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragDeltaX = 0;
    dragDeltaY = 0;
    activePointerId = e.pointerId;
    crossedCommitThreshold = false;
    verticalDismissActive = false;
    cachedCardWidth = 0; // Reset width cache for this drag session

    tracker.reset();
    tracker.push(e.clientX, e.clientY);

    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}

    // Remove CSS transitions during drag
    if (cardEl) {
      cardEl.style.transition = 'none';
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging || e.pointerId !== activePointerId) return;

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    tracker.push(e.clientX, e.clientY);

    // Gesture disambiguation
    if (gestureDirection === 'undecided') {
      if (absDx < 3 && absDy < 3) return; // dead zone

      const classification = classifyGesture(dx, dy);
      if (classification === 'vertical') {
        gestureDirection = 'vertical';
        verticalDismissActive = true;
        return;
      }
      if (classification === 'ambiguous') {
        if (absDx < 15 && absDy < 15) return; // wait for more data
        const reclass = classifyGesture(dx, dy);
        if (reclass === 'vertical') {
          gestureDirection = 'vertical';
          verticalDismissActive = true;
          return;
        }
        if (reclass === 'ambiguous') {
          // Ambiguous twice — cancel gesture rather than risk accidental dismiss
          isDragging = false;
          gestureDirection = 'undecided';
          return;
        }
      }
      gestureDirection = 'horizontal';
    }

    if (gestureDirection === 'vertical') {
      dragDeltaY = dy;
      handleVerticalDismiss(dy);
      return;
    }

    if (gestureDirection !== 'horizontal') return;

    e.preventDefault();

    const width = getCardWidth();
    const maxRubber = width * 0.25;

    // Check if at edge (rubber band)
    const swipingRight = dx > 0;
    const swipingLeft = dx < 0;
    const atLeftEdge = swipingRight && current <= 0 && !completed;
    const atRightEdge = swipingLeft && current >= totalCards - 1 && !completed;

    if (atLeftEdge || atRightEdge) {
      dragDeltaX = rubberBand(dx, maxRubber);
    } else {
      dragDeltaX = dx;
    }

    // Check commit threshold for haptic
    const commitDist = width * 0.15;
    if (!crossedCommitThreshold && Math.abs(dragDeltaX) > commitDist) {
      crossedCommitThreshold = true;
      haptic(5);
    } else if (crossedCommitThreshold && Math.abs(dragDeltaX) < commitDist * 0.8) {
      crossedCommitThreshold = false;
    }

    applyDragTransform(dragDeltaX);
  }

  function onPointerUp(e: PointerEvent) {
    if (!isDragging || e.pointerId !== activePointerId) return;

    isDragging = false;
    activePointerId = null;

    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}

    // Restore transition
    if (cardEl) {
      cardEl.style.transition = '';
    }

    // Vertical dismiss
    if (gestureDirection === 'vertical' && verticalDismissActive) {
      finishVerticalDismiss(dragDeltaY);
      gestureDirection = 'undecided';
      return;
    }

    if (gestureDirection !== 'horizontal') {
      gestureDirection = 'undecided';
      return;
    }

    const { vx } = tracker.getVelocity();
    const direction = shouldCommit(dragDeltaX, vx);

    if (direction) {
      // Check edge cases
      const atLeftEdge = direction === 'right' && current <= 0 && !completed;
      const atRightEdge = direction === 'left' && current >= totalCards - 1;

      if (atLeftEdge) {
        rubberBandBack();
      } else if (atRightEdge) {
        // Go to completion
        showCompletion();
        snapBack(vx);
      } else if (direction === 'left') {
        if (current < totalCards - 1) {
          goTo(current + 1, 'right', vx);
        } else {
          showCompletion();
          snapBack(vx);
        }
      } else {
        // right swipe = go back
        if (completed) {
          completed = false;
          completionVisible = false;
          goTo(totalCards - 1, 'left', vx);
        } else if (current > 0) {
          goTo(current - 1, 'left', vx);
        } else {
          rubberBandBack();
        }
      }
    } else {
      // Snap back
      snapBack(vx);
    }

    dragDeltaX = 0;
    gestureDirection = 'undecided';
  }

  function onPointerCancel(e: PointerEvent) {
    if (e.pointerId !== activePointerId) return;
    isDragging = false;
    activePointerId = null;
    gestureDirection = 'undecided';
    if (cardEl) {
      cardEl.style.transition = '';
    }
    snapBack();
    dragDeltaX = 0;
  }

  // Multi-touch cancellation
  function onTouchStart(e: TouchEvent) {
    if (e.touches.length > 1 && isDragging) {
      isDragging = false;
      activePointerId = null;
      gestureDirection = 'undecided';
      if (cardEl) cardEl.style.transition = '';
      snapBack();
      dragDeltaX = 0;
    }
  }

  // Keyboard handler
  function onKeyDown(e: KeyboardEvent) {
    if (shareOpen) return;
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

  // --- Swipe hint ---
  function maybeShowSwipeHint() {
    if (typeof sessionStorage === 'undefined') return;
    const key = 'tfa_swipe_hint_shown';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    showSwipeHint = true;
    let iterCount = 0;
    const interval = setInterval(() => {
      iterCount++;
      if (iterCount >= 3) {
        clearInterval(interval);
        swipeHintFaded = true;
        setTimeout(() => { showSwipeHint = false; }, 400);
      }
    }, 1500);
  }

  // --- Content scroll overflow detection (now driven by scroll-physics) ---
  let contentOverflows = $derived(scrollState.canScroll);

  function attachScrollObserver() {
    cleanupScrollObserver?.();
    cleanupScrollObserver = null;

    if (!cardContentEl) return;

    cleanupScrollObserver = observeScroll(cardContentEl, (state) => {
      scrollState = state;
      applyFadeGradient(cardContentEl!, state);

      // Show scroll indicator while scrolling, fade out after stop
      scrollIndicatorVisible = true;
      if (scrollIndicatorTimer) clearTimeout(scrollIndicatorTimer);
      scrollIndicatorTimer = setTimeout(() => {
        scrollIndicatorVisible = false;
      }, 1200);
    });
  }

  // Accessibility: store focus origin for restoration on close
  let focusOrigin: Element | null = null;

  onMount(() => {
    focusOrigin = document.activeElement;
    overlayEl?.focus();
    markStarted(issue.id);
    lockScroll();

    // Check reduced motion preference
    if (typeof window !== 'undefined') {
      prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    maybeShowSwipeHint();

    // Announce initial card for screen readers
    requestAnimationFrame(announceCard);

    // Attach scroll observer after first render
    requestAnimationFrame(attachScrollObserver);
  });

  onDestroy(() => {
    unlockScroll();
    cancelAnimation?.();
    cleanupScrollObserver?.();
    if (scrollIndicatorTimer) clearTimeout(scrollIndicatorTimer);
    // Restore focus to the element that opened the reader
    if (focusOrigin && 'focus' in focusOrigin) {
      (focusOrigin as HTMLElement).focus();
    }
  });

  // Re-attach scroll observer when card changes (new content element)
  $effect(() => {
    // Depend on current card and completed state
    void current;
    void completed;
    // Reset scroll state for new card
    scrollState = { atTop: true, atBottom: true, canScroll: false, scrollProgress: 0 };
    requestAnimationFrame(attachScrollObserver);
  });
</script>

<svelte:window onkeydown={onKeyDown} />

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="overlay"
  class:reduced-motion={prefersReducedMotion}
  bind:this={overlayEl}
  tabindex="0"
  role="dialog"
  aria-modal="true"
  aria-label="Reading: {issue.headline}"
>
  <!-- Screen reader announcements for card transitions -->
  <div class="sr-announce" aria-live="polite" aria-atomic="true">{announcement}</div>

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

  <!-- Headline -->
  <div class="headline-area">
    <h2 class="headline">{issue.headline}</h2>
  </div>

  <!-- Card area -->
  <div
    class="card-area"
    bind:this={cardAreaEl}
    ontouchstart={onTouchStart}
  >
    {#if completed}
      <div class="card completion-card" class:completion-visible={completionVisible} style="overflow-y:auto;">
        <div class="completion-inner">
          <div class="check-circle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" stroke-dasharray="50" stroke-dashoffset="50" class="check-path" />
            </svg>
          </div>
          <p class="completion-title">All {totalCards} perspectives</p>

          <!-- Trust summary: Opinion Shift + Verdict Bar -->
          <div style="width:100%;max-width:300px;margin:4px 0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <div style="flex:1;"><OpinionBar score={issue.opinionShift} height={4} showLabel={false} /></div>
              <span style="font-size:12px;font-weight:700;color:var(--text-secondary);">{issue.opinionShift}%</span>
              <span style="font-size:10px;color:var(--text-tertiary);">Opinion Shift</span>
            </div>
            {#if issue.stageScores && issue.finalScore}
              <VerdictBar scores={issue.stageScores} finalScore={issue.finalScore} compact={false} />
            {/if}
          </div>

          <div class="completion-buttons">
            {#if completionButtonsVisible.length > 0}
              <button class="btn-share completion-btn-enter" onclick={() => { shareCardIndex = null; shareOpen = true; }}>Share</button>
            {/if}
            {#if completionButtonsVisible.length > 1}
              {#if onNext}
                <button class="btn-next completion-btn-enter" onclick={onNext}>Next topic</button>
              {:else}
                <button class="btn-done completion-btn-enter" onclick={onClose}>Done</button>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    {:else}
      <!-- Ghost cards -->
      <div class="ghost ghost-2" bind:this={ghost2El}></div>
      <div class="ghost ghost-1" bind:this={ghost1El}></div>

      <!-- Active card -->
      <div
        class="card active-card"
        bind:this={cardEl}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerCancel}
        role="group"
        aria-label="Card {current + 1} of {totalCards}"
      >
        <!-- Card top -->
        <div class="card-top">
          <div class="type-pill" style="background:{meta.bg};">
            <span class="pill-dot" style="background:{meta.color};"></span>
            <span class="pill-label" style="color:{meta.color};">{cardLabel(card)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;touch-action:manipulation;position:relative;z-index:5;" onpointerdown={(e) => e.stopPropagation()}>
            <SaveButton issueId={issue.id} cardIndex={current} />
            <button onclick={(e) => { e.stopPropagation(); shareCardIndex = current; shareOpen = true; }} style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;background:var(--bg-elevated);border:1px solid var(--border-divider);border-radius:10px;cursor:pointer;transition:border-color 0.15s ease;touch-action:manipulation;" aria-label="Share this card" aria-expanded={shareOpen}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            </button>
          </div>
        </div>

        <!-- Card center -->
        <div class="card-center" bind:this={cardContentEl} class:has-overflow={contentOverflows}>
          <p class="big-text" style="font-size:{card.sub ? 24 : 22}px;">{card.big}</p>
          {#if card.sub}
            <p class="sub-text">{card.sub}</p>
          {/if}
          {#if contentOverflows}
            <div class="scroll-indicator" class:scroll-indicator-visible={scrollIndicatorVisible} style="top:{scrollState.scrollProgress * 100}%;"></div>
          {/if}
        </div>

        <!-- Card bottom -->
        <div class="card-bottom">
          {#if showSwipeHint && current === 0}
            <span class="swipe-hint" class:swipe-hint-fade={swipeHintFaded}>Swipe to continue</span>
          {:else if current === totalCards - 2 && !completed}
            <span style="font-size:12px;font-weight:600;color:var(--text-tertiary);">Almost done</span>
          {:else if current === totalCards - 1 && !completed}
            <span style="font-size:12px;font-weight:600;color:var(--text-tertiary);">Last one</span>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Dot navigation -->
  <div class="dots" bind:this={dotsContainerEl}>
    {#each issue.cards as _, i}
      <button
        class="dot"
        class:active={i === current && !completed}
        class:read={readCards.has(i) && i !== current}
        style="
          {i === current && !completed
            ? `width:20px;background:${CARD_TYPES[issue.cards[i].t]?.color ?? 'var(--text-faint)'};`
            : readCards.has(i)
              ? `background:${CARD_TYPES[issue.cards[i].t]?.color ?? 'var(--text-faint)'};opacity:0.44;`
              : 'background:var(--border-subtle);'}
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
  .sr-announce {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: var(--overlay-bg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    display: flex;
    flex-direction: column;
    align-items: center;
    outline: none;
    overflow: hidden;
    touch-action: none;
    will-change: transform, opacity;
    padding-top: env(safe-area-inset-top, 0);
    padding-bottom: env(safe-area-inset-bottom, 0);
    animation: overlayEnter 0.3s var(--ease-out-cubic, cubic-bezier(0.33, 1, 0.68, 1)) both;
  }

  @keyframes overlayEnter {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .progress-track {
    width: 100%;
    height: 4px;
    background: var(--bg-sunken);
    flex-shrink: 0;
  }

  .progress-fill {
    height: 100%;
    border-radius: 0 2px 2px 0;
    transition: width var(--duration-normal, 250ms) ease, background var(--duration-normal, 250ms) ease;
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
    color: var(--text-secondary);
  }

  .close-btn {
    width: 44px;
    height: 44px;
    border: none;
    background: var(--bg-elevated);
    border-radius: 10px;
    font-size: 20px;
    line-height: 1;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--duration-fast, 150ms) ease;
  }

  .close-btn:hover {
    background: var(--border-subtle);
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
    color: var(--text-secondary);
    margin: 0 0 6px;
    line-height: 1.4;
  }

  .card-area {
    flex: 1;
    width: 100%;
    max-width: 440px;
    padding: 12px 16px 4px;
    position: relative;
    min-height: 0;
    perspective: 1000px;
    touch-action: none;
  }

  .ghost {
    position: absolute;
    left: 20px;
    right: 20px;
    height: auto;
    top: 12px;
    bottom: 4px;
    background: var(--bg);
    border-radius: 20px;
    pointer-events: none;
    will-change: transform;
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
    background: var(--bg);
    border-radius: 20px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    user-select: none;
    will-change: transform;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    transform-style: preserve-3d;
  }

  .active-card {
    cursor: grab;
    touch-action: none;
  }

  .active-card:active {
    cursor: grabbing;
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
    overscroll-behavior-y: contain;
    position: relative;
    touch-action: pan-y; /* Allow native vertical scroll within card content */
  }

  .scroll-indicator {
    position: absolute;
    right: 2px;
    width: 3px;
    height: 24px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.15);
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
    z-index: 5;
  }

  .scroll-indicator-visible {
    opacity: 1;
  }

  .big-text {
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.35;
    margin: 0;
    overflow-wrap: break-word;
    word-break: break-word;
    hyphens: auto;
  }

  .sub-text {
    font-size: 15px;
    color: var(--text-secondary);
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
    color: var(--text-tertiary);
    user-select: none;
    display: inline-block;
    animation: nudgeHint 1.5s ease-in-out infinite;
    transition: opacity 0.4s ease;
  }

  .swipe-hint-fade {
    opacity: 0;
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
    opacity: 0;
    transform: scale(0.95);
    transition: opacity var(--duration-medium, 350ms) ease, transform var(--duration-medium, 350ms) ease;
  }

  .completion-card.completion-visible {
    opacity: 1;
    transform: scale(1);
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
    background: linear-gradient(135deg, var(--status-green), var(--status-green-text));
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
    color: var(--text-primary);
    margin: 0;
  }

  .completion-takeaway {
    font-size: 15px;
    font-style: italic;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
    max-width: 320px;
  }

  .completion-buttons {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .completion-btn-enter {
    animation: fadeSlideUp 0.3s ease both;
  }

  @keyframes fadeSlideUp {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .btn-done {
    padding: 10px 28px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    background: var(--text-primary);
    color: var(--bg);
    transition: background var(--duration-fast, 150ms) ease;
  }

  .btn-done:hover {
    background: var(--text-secondary);
  }

  .btn-share {
    padding: 10px 28px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: 1.5px solid var(--border-subtle);
    background: var(--bg-elevated);
    color: var(--text-secondary);
    transition: background var(--duration-fast, 150ms) ease;
    touch-action: auto;
  }

  .btn-share:hover {
    background: var(--border-subtle);
  }

  .btn-next {
    padding: 10px 28px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    background: var(--text-primary);
    color: var(--bg);
    transition: background var(--duration-fast, 150ms) ease;
  }

  .btn-next:hover {
    background: var(--text-secondary);
  }

  /* Reduced motion overrides */
  .reduced-motion .check-circle,
  .reduced-motion .completion-btn-enter {
    animation: none;
  }

  .reduced-motion .check-path {
    animation: none;
    stroke-dashoffset: 0;
  }

  .reduced-motion .swipe-hint {
    animation: none;
  }

  .reduced-motion .completion-card {
    transition: none;
  }

  .reduced-motion .progress-fill {
    transition: none;
  }

  .reduced-motion .dot {
    transition: none;
  }
</style>
