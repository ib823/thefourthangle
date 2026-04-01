<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import OpinionBar from './OpinionBar.svelte';
  import VerdictBar from './VerdictBar.svelte';
  import SaveButton from './SaveButton.svelte';
  import ShareModal from './ShareModal.svelte';
  import PushPrompt from './PushPrompt.svelte';
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

  interface Connection {
    id: string;
    weight: number;
    sharedEntities: string[];
    headline: string;
    opinionShift: number;
    readState: string | null;
    hasReaction: boolean;
  }

  interface Props {
    issue: Issue;
    onClose: () => void;
    onNext?: () => void;
    onNavigateToIssue?: (issueId: string) => void;
    initialCardIndex?: number;
    originRect?: DOMRect;
    connections?: Connection[];
    threadNextId?: string | null;
    threadNextHeadline?: string;
    threadName?: string;
    threadPosition?: number | null;
    threadTotal?: number | null;
    nextIssueHeadline?: string;
  }

  let { issue, onClose, onNext, onNavigateToIssue, initialCardIndex = 0, originRect, connections = [], threadNextId = null, threadNextHeadline = '', threadName = '', threadPosition = null, threadTotal = null, nextIssueHeadline = '' }: Props = $props();

  let patternSheetOpen = $state(false);

  let current = $state(Math.min(initialCardIndex, 5));
  let completed = $state(false);
  // Mark all cards up to initial position as read
  let readCards = $state(new Set<number>(Array.from({ length: Math.min(initialCardIndex, 5) + 1 }, (_, i) => i)));
  let shareOpen = $state(false);
  let shareCardIndex: number | null = $state(null);
  let showSwipeHint = $state(false);
  let bigTextVisible = $state(true);
  let subTextVisible = $state(true);
  let subRevealTimer: ReturnType<typeof setTimeout> | null = null;
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
  let canDismissFromHere = false; // restrict dismiss to header/card-top zones
  let pointerCaptured = false; // track whether we've captured the pointer

  // Cached dot elements — avoid querySelectorAll on every pointermove
  let cachedDots: HTMLElement[] = [];

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

  /**
   * Auto-fit: reduce font size + line-height + gap if card content overflows.
   * Runs after card transition. No scroll needed — text always fits.
   */
  function autoFitCardText() {
    if (!cardContentEl) return;
    const bigEl = cardContentEl.querySelector('.big-text') as HTMLElement;
    const subEl = cardContentEl.querySelector('.sub-text') as HTMLElement;
    if (!bigEl) return;

    // Reset to base sizes
    const baseBig = card?.sub ? 24 : 22;
    const baseBigLH = 1.45;
    const baseSubLH = 1.65;
    const baseGap = 14;
    bigEl.style.fontSize = baseBig + 'px';
    bigEl.style.lineHeight = String(baseBigLH);
    if (subEl) { subEl.style.fontSize = '17px'; subEl.style.lineHeight = String(baseSubLH); }
    cardContentEl.style.gap = baseGap + 'px';

    // Already fits — done
    if (cardContentEl.scrollHeight <= cardContentEl.clientHeight + 2) return;

    // Shrink until it fits (min 14px big / 12px sub, tighter line-height)
    let currentBig = baseBig;
    let currentSub = 17;
    let currentBigLH = baseBigLH;
    let currentSubLH = baseSubLH;
    let currentGap = baseGap;
    const MIN_BIG = 14;
    const MIN_SUB = 12;
    const MIN_BIG_LH = 1.25;
    const MIN_SUB_LH = 1.4;
    const MIN_GAP = 6;

    for (let i = 0; i < 16; i++) {
      if (cardContentEl.scrollHeight <= cardContentEl.clientHeight + 2) break;
      currentBig = Math.max(MIN_BIG, currentBig - 1);
      currentSub = Math.max(MIN_SUB, currentSub - 0.8);
      currentBigLH = Math.max(MIN_BIG_LH, currentBigLH - 0.025);
      currentSubLH = Math.max(MIN_SUB_LH, currentSubLH - 0.03);
      currentGap = Math.max(MIN_GAP, currentGap - 1);
      bigEl.style.fontSize = currentBig + 'px';
      bigEl.style.lineHeight = String(currentBigLH);
      cardContentEl.style.gap = currentGap + 'px';
      if (subEl) {
        subEl.style.fontSize = currentSub + 'px';
        subEl.style.lineHeight = String(currentSubLH);
      }
    }
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
    const scaleVal = 1.0 + absDx * 0.0001;

    cardEl.style.transform = `translateX(${dx}px) rotate(${rotation}deg) scale(${scaleVal})`;

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

  function cacheDotElements() {
    // Dots are now non-interactive — no caching needed for animation
  }

  function interpolateDots(_dx: number) {
    // Dots use opacity only — no width interpolation during drag
  }

  function resetDotStyles() {
    // No inline styles to reset — dots use CSS classes only
  }

  function resetGhostStyles() {
    if (ghost1El) ghost1El.style.transform = '';
    if (ghost2El) ghost2El.style.transform = '';
  }

  // --- Navigation with spring physics ---
  let textRevealSafety: ReturnType<typeof setTimeout> | null = null;

  function goTo(index: number, direction: 'left' | 'right', initialVelocity = 0) {
    if (index < 0 || index >= totalCards) return;
    // Allow interruption of ongoing animation
    if (animating) {
      cancelAnimation?.();
      cancelAnimation = null;
      animating = false;
      if (cardEl) { cardEl.style.transform = ''; cardEl.style.opacity = ''; }
      resetGhostStyles();
      resetDotStyles();
    }
    haptic(5);
    savePosition(issue.id, index);

    animating = true;
    cancelAnimation?.();
    // A1: Hide text for stagger reveal
    if (!prefersReducedMotion) {
      bigTextVisible = false;
      subTextVisible = false;
      if (subRevealTimer) clearTimeout(subRevealTimer);
    }

    // Safety: guarantee text becomes visible even if animation callback fails
    if (textRevealSafety) clearTimeout(textRevealSafety);
    textRevealSafety = setTimeout(() => {
      if (!bigTextVisible) { bigTextVisible = true; subTextVisible = true; autoFitCardText(); }
    }, 800);

    const width = getCardWidth();
    const exitTarget = direction === 'right' ? -width * 1.2 : width * 1.2;

    // Exit animation
    const startPos = dragDeltaX || 0;
    const remaining = Math.abs(exitTarget - startPos);
    const exitDuration = prefersReducedMotion ? 0 : Math.max(180, Math.min(350, remaining / width * 350));

    const exitSpring = createSpring(startPos, {
      stiffness: 500,
      damping: 30,
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
          autoFitCardText();
          return;
        }

        const enterSpring = createSpring(enterFrom, {
          stiffness: 500,
          damping: 30,
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
          // A1: Stagger text reveal — big first, sub 400ms later
          bigTextVisible = true;
          subRevealTimer = setTimeout(() => { subTextVisible = true; autoFitCardText(); }, 400);
          // A8: Haptic pulse on settle
          haptic(3);
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

    // A3: Edge glow flash
    if (!prefersReducedMotion && cardEl) {
      const glowSide = dragDeltaX > 0 ? 'inset -12px 0 20px -12px rgba(25,113,194,0.1)' : 'inset 12px 0 20px -12px rgba(25,113,194,0.1)';
      cardEl.style.boxShadow = glowSide;
      setTimeout(() => { if (cardEl) cardEl.style.boxShadow = ''; }, 300);
    }

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
    // A2: Micro-pause before final card (reframe → view transition)
    if (current === totalCards - 2 && !prefersReducedMotion) {
      setTimeout(() => goTo(current + 1, 'right'), 600);
    } else {
      goTo(current + 1, 'right');
    }
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
    // Disable expensive backdrop-filter during drag for perf
    overlayEl.style.backdropFilter = 'none';
    (overlayEl.style as any).webkitBackdropFilter = 'none';
    overlayEl.style.transform = `translateY(${Math.max(0, dy)}px)`;
    overlayEl.style.opacity = `${opacity}`;
  }

  function finishVerticalDismiss(dy: number) {
    const { vy } = tracker.getVelocity();
    // Dismiss if dragged far enough OR fast enough downward flick
    if (dy > 200 || vy > 500) {
      onClose();
    } else if (overlayEl) {
      // Snap back with spring
      const startDy = Math.max(0, dy);
      const spring = createSpring(startDy, { stiffness: 500, damping: 30, mass: 1, precision: 0.5 });
      cancelAnimation = animateSpring(spring, 0, (value) => {
        if (overlayEl) {
          overlayEl.style.transform = `translateY(${value}px)`;
          overlayEl.style.opacity = `${Math.max(0, 1 - Math.abs(value) / 400)}`;
        }
      }, () => {
        if (overlayEl) {
          overlayEl.style.transform = '';
          overlayEl.style.opacity = '';
          // Restore backdrop-filter after snap-back
          overlayEl.style.backdropFilter = '';
          (overlayEl.style as any).webkitBackdropFilter = '';
        }
        cancelAnimation = null;
      });
    }
    verticalDismissActive = false;
  }

  // --- Pointer event handlers ---
  function onPointerDown(e: PointerEvent) {
    if (completed) return;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement)?.closest('button, a, input')) return;

    // No scroll blocking — card content auto-fits, never scrolls

    // Allow interruption of ongoing animation
    if (animating) {
      cancelAnimation?.();
      cancelAnimation = null;
      animating = false;
      if (cardEl) { cardEl.style.transform = ''; cardEl.style.opacity = ''; }
      resetGhostStyles();
      resetDotStyles();
    }

    isDragging = true;
    gestureDirection = 'undecided';
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragDeltaX = 0;
    dragDeltaY = 0;
    activePointerId = e.pointerId;
    crossedCommitThreshold = false;
    verticalDismissActive = false;
    pointerCaptured = false;
    cachedCardWidth = 0; // Reset width cache for this drag session

    // Determine if this touch can trigger vertical dismiss (only from header zones)
    canDismissFromHere = !!((e.target as HTMLElement)?.closest('.card-top, .headline-area, .progress-track, .header'));

    tracker.reset();
    tracker.push(e.clientX, e.clientY);

    // Do NOT capture pointer here — wait until gesture is classified as horizontal
    // This allows the browser to handle vertical scroll natively

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

    // Gesture disambiguation — single pass, minimal dead zone
    if (gestureDirection === 'undecided') {
      if (absDx < 3 && absDy < 3) return; // minimal dead zone

      const classification = classifyGesture(dx, dy);
      if (classification === 'horizontal') {
        gestureDirection = 'horizontal';
        // NOW capture the pointer — only for confirmed horizontal swipes
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); pointerCaptured = true; } catch {}
        // Dynamically block touch-action during horizontal drag
        if (cardEl) (cardEl as HTMLElement).style.touchAction = 'none';
      } else {
        // Vertical or ambiguous — default to vertical (scroll or dismiss)
        gestureDirection = 'vertical';
        if (canDismissFromHere) {
          verticalDismissActive = true;
        } else {
          // Not in dismiss zone — release entirely, let browser handle scroll
          isDragging = false;
          gestureDirection = 'undecided';
          return;
        }
      }
    }

    if (gestureDirection === 'vertical') {
      if (verticalDismissActive) {
        dragDeltaY = dy;
        handleVerticalDismiss(dy);
      }
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

    if (pointerCaptured) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      pointerCaptured = false;
    }

    // Restore touch-action and transition
    if (cardEl) {
      (cardEl as HTMLElement).style.touchAction = '';
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
    pointerCaptured = false;
    if (cardEl) {
      (cardEl as HTMLElement).style.touchAction = '';
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
    // H5: Focus trap — Tab cycles within the reader overlay
    if (e.key === 'Tab' && overlayEl) {
      const focusable = overlayEl.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
      if (focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
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

  // Screen Wake Lock: keep screen on while reading
  let wakeLock: WakeLockSentinel | null = null;
  let wakeLockVisCleanup: (() => void) | null = null;

  onMount(() => {
    focusOrigin = document.activeElement;
    overlayEl?.focus();
    markStarted(issue.id);
    lockScroll();

    // Acquire wake lock
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then(wl => { wakeLock = wl; }).catch(() => {});
    }
    // Re-acquire on visibility change (released when tab goes background)
    const onVis = () => {
      if (document.visibilityState === 'visible' && !wakeLock && 'wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(wl => { wakeLock = wl; }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    wakeLockVisCleanup = () => document.removeEventListener('visibilitychange', onVis);

    // Clear notification for this issue
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'ISSUE_OPENED', issueId: issue.id });
    }

    // Check reduced motion preference
    if (typeof window !== 'undefined') {
      prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    maybeShowSwipeHint();

    // Announce initial card for screen readers
    requestAnimationFrame(announceCard);

    // Auto-fit initial card text
    requestAnimationFrame(() => { requestAnimationFrame(autoFitCardText); });

    // Cache dot elements for perf
    requestAnimationFrame(cacheDotElements);

    // Attach scroll observer after first render
    requestAnimationFrame(attachScrollObserver);

    // Shared-element entry animation from card origin
    if (originRect && overlayEl && !prefersReducedMotion) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const sx = originRect.width / vw;
      const sy = originRect.height / vh;
      const tx = originRect.left;
      const ty = originRect.top;

      // Disable the CSS entry animation when using shared-element
      overlayEl.style.animation = 'none';

      const spring = createSpring(1, { stiffness: 500, damping: 30, mass: 1, precision: 0.01 });
      animateSpring(spring, 0, (t) => {
        if (overlayEl) {
          overlayEl.style.transformOrigin = '0 0';
          overlayEl.style.transform = `translate(${tx * t}px, ${ty * t}px) scale(${1 + (sx - 1) * t}, ${1 + (sy - 1) * t})`;
          overlayEl.style.borderRadius = `${20 * t}px`;
          overlayEl.style.opacity = `${1 - t * 0.3}`;
        }
      }, () => {
        if (overlayEl) {
          overlayEl.style.transform = '';
          overlayEl.style.transformOrigin = '';
          overlayEl.style.borderRadius = '';
          overlayEl.style.opacity = '';
        }
      });
    }
  });

  onDestroy(() => {
    unlockScroll();
    cancelAnimation?.();
    cleanupScrollObserver?.();
    if (scrollIndicatorTimer) clearTimeout(scrollIndicatorTimer);
    // Release wake lock
    wakeLock?.release().catch(() => {});
    wakeLock = null;
    wakeLockVisCleanup?.();
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
    requestAnimationFrame(cacheDotElements);
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
  <div class="sr-announce" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>

  <!-- Progress bar -->
  <div class="progress-track">
    <div
      class="progress-fill"
      style="width:{completed ? 100 : progress}%;background:{meta.color};"
    ></div>
  </div>

  <!-- Header -->
  <div class="header">
    <span class="counter">{completed ? totalCards : current + 1}/{totalCards} <span style="color:{issue.opinionShift >= 80 ? 'var(--score-critical)' : issue.opinionShift >= 60 ? 'var(--score-warning)' : issue.opinionShift >= 40 ? 'var(--score-info)' : 'var(--text-tertiary)'};font-variant-numeric:tabular-nums;">· {issue.opinionShift}</span></span>
    <button class="close-btn" onclick={onClose} aria-label="Close">&times;</button>
  </div>

  <!-- Headline -->
  <div class="headline-area">
    {#if threadName && threadPosition !== null && threadTotal}
      <div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Part {threadPosition + 1} of {threadTotal} · {threadName}</div>
    {/if}
    <h2 class="headline">{issue.headline}</h2>
  </div>

  <!-- Hero image -->
  {#if current === 0 && !completed}
    <div style="padding:0 20px;margin-bottom:8px;">
      <div style="border-radius:10px;overflow:hidden;background:var(--bg-sunken);max-width:440px;margin:0 auto;">
        <picture>
          <source srcset={`/og/backgrounds/issue-${issue.id}-hero.avif`} type="image/avif" />
          <img src={`/og/backgrounds/issue-${issue.id}-hero.jpg`} alt="" loading="eager" decoding="async" style="width:100%;aspect-ratio:1.91/1;object-fit:cover;display:block;" onerror={(e) => { const w = (e.currentTarget as HTMLElement)?.parentElement?.parentElement; if (w) w.style.display = 'none'; }} />
        </picture>
      </div>
    </div>
  {/if}

  <!-- Card area -->
  <div
    class="card-area"
    bind:this={cardAreaEl}
    ontouchstart={onTouchStart}
  >
    {#if completed}
      <div class="card completion-card" class:completion-visible={completionVisible}>
        <div class="completion-inner">
          <div class="check-circle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" stroke-dasharray="50" stroke-dashoffset="50" class="check-path" />
            </svg>
          </div>
          <p class="completion-title">All {totalCards} perspectives</p>

          <!-- Trust summary: Opinion Shift + Editorial Audit -->
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

          <!-- Thread navigation: "Next in thread" -->
          {#if threadNextId && threadNextHeadline}
            <button
              onclick={() => onNavigateToIssue?.(threadNextId)}
              style="width:100%;max-width:300px;text-align:left;padding:12px 14px;background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:10px;cursor:pointer;transition:border-color 0.15s ease;margin:4px 0;"
            >
              <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Next in thread{threadTotal ? ` · ${(threadPosition ?? 0) + 2} of ${threadTotal}` : ''}</div>
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);line-height:1.35;margin-top:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">{threadNextHeadline}</div>
            </button>
          {/if}

          {#if connections.length >= 2}
            <button class="connection-nudge" onclick={() => { patternSheetOpen = true; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
              {connections.length} connected {connections.length === 1 ? 'issue' : 'issues'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          {/if}

          <!-- C6: Next issue preview -->
          {#if nextIssueHeadline && !threadNextId}
            <div style="width:100%;max-width:300px;padding:10px 14px;background:var(--bg-sunken);border-radius:8px;margin:4px 0;">
              <div style="font-size:10px;font-weight:600;color:var(--text-faint);text-transform:uppercase;">Up next</div>
              <div style="font-size:12px;font-weight:600;color:var(--text-secondary);line-height:1.35;margin-top:2px;">{nextIssueHeadline}</div>
            </div>
          {/if}

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
          <PushPrompt />
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
          <div style="display:flex;align-items:center;gap:6px;touch-action:manipulation;position:relative;z-index:15;">
            <button onclick={(e) => { e.stopPropagation(); shareCardIndex = current; shareOpen = true; }} style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;background:var(--bg-elevated);border:1px solid var(--border-divider);border-radius:10px;cursor:pointer;transition:border-color 0.15s ease;touch-action:manipulation;" aria-label="Share this card" aria-expanded={shareOpen}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            </button>
          </div>
        </div>

        <!-- Card center -->
        <div class="card-center" bind:this={cardContentEl}>
          <p class="big-text" style="font-size:{card.sub ? 24 : 22}px;opacity:{bigTextVisible ? 1 : 0};transition:opacity 250ms ease;">{card.big}</p>
          {#if card.sub}
            <p class="sub-text" style="opacity:{subTextVisible ? 1 : 0};transition:opacity 250ms ease;">{card.sub}</p>
          {/if}
        </div>

        <!-- Card bottom -->
        <div class="card-bottom" style="display:flex;align-items:center;justify-content:space-between;">
          <div style="touch-action:manipulation;"><SaveButton issueId={issue.id} cardIndex={current} /></div>
          <div>
          {#if showSwipeHint && current === 0}
            <span class="swipe-hint" class:swipe-hint-fade={swipeHintFaded}>Swipe or tap arrows</span>
          {:else if card.t === 'fact' && connections.length > 0}
            <span style="font-size:11px;color:var(--text-muted);">Tracked in {connections.length} {connections.length === 1 ? 'issue' : 'issues'}</span>
          {:else if current === totalCards - 2 && !completed}
            <span style="font-size:12px;font-weight:600;color:var(--text-tertiary);">Almost done</span>
          {:else if current === totalCards - 1 && !completed}
            <span style="font-size:12px;font-weight:600;color:var(--text-tertiary);">Last one</span>
          {/if}
          </div>
        </div>
      </div>

      <!-- Nav chevrons -->
      {#if current > 0}
        <button class="nav-chevron nav-prev" onclick={prev} aria-label="Previous card">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      {/if}
      {#if current < totalCards - 1}
        <button class="nav-chevron nav-next" onclick={next} aria-label="Next card">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      {/if}
    {/if}
  </div>

  <!-- Bottom safe area spacing (dots removed — 2/6 counter + card type pill + ghost cards are sufficient) -->
  <div style="height:calc(12px + env(safe-area-inset-bottom, 0));flex-shrink:0;"></div>
</div>

{#if shareOpen}
  <ShareModal issue={issue} cardIndex={shareCardIndex} onClose={() => { shareOpen = false; }} />
{/if}

{#if patternSheetOpen && connections.length > 0}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="pattern-backdrop" class:pattern-backdrop--visible={patternSheetOpen} onclick={(e) => { if (e.target === e.currentTarget) patternSheetOpen = false; }}>
    <div class="pattern-panel" class:pattern-panel--visible={patternSheetOpen} role="dialog" aria-modal="true" aria-label="Connected issues">
      <div class="drag-handle-wrap"><div class="drag-handle"></div></div>
      <div class="panel-header">
        <span class="panel-title">Connected issues</span>
        <button class="close-btn" onclick={() => { patternSheetOpen = false; }} aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;padding-bottom:8px;">
        {#each connections as conn}
          <button
            class="pattern-issue-card"
            onclick={() => {
              patternSheetOpen = false;
              if (onNavigateToIssue) {
                onNavigateToIssue(conn.id);
              }
            }}
          >
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;">
                {#if conn.readState === 'completed'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>
                {:else if conn.readState === 'started'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;"><circle cx="12" cy="12" r="9" stroke="var(--score-warning)" stroke-width="2" fill="none"/><path d="M12 3a9 9 0 0 1 0 18" fill="var(--score-warning)"/></svg>
                {/if}
                <div style="font-size:13px;font-weight:{conn.readState === 'completed' ? '500' : '600'};color:{conn.readState === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)'};line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">{conn.headline}</div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
                <div style="width:32px;height:3px;background:var(--bg-sunken);border-radius:2px;overflow:hidden;">
                  <div style="height:100%;width:{conn.opinionShift}%;background:{conn.opinionShift >= 80 ? 'var(--score-critical)' : conn.opinionShift >= 60 ? 'var(--score-warning)' : conn.opinionShift >= 40 ? 'var(--score-info)' : 'var(--score-neutral)'};border-radius:2px;"></div>
                </div>
                <span style="font-size:10px;font-weight:700;color:var(--text-secondary);font-variant-numeric:tabular-nums;">{conn.opinionShift}%</span>
                <span style="font-size:9px;color:var(--text-muted);">{conn.sharedEntities.slice(0, 3).join(' · ')}</span>
                {#if conn.hasReaction}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--score-critical)" stroke="none" style="flex-shrink:0;opacity:0.6;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                {/if}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        {/each}
      </div>

      {#if connections.length > 5}
        <div style="font-size:11px;color:var(--text-muted);text-align:center;padding:4px 0;">
          +{connections.length - 5} more
        </div>
      {/if}
    </div>
  </div>
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
    touch-action: auto;
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
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
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
    touch-action: pan-y;
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
  }

  .active-card {
    cursor: grab;
    touch-action: pan-y;
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
    overflow: hidden;
    position: relative;
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
    line-height: 1.45;
    margin: 0;
    overflow-wrap: break-word;
    word-break: break-word;
    hyphens: auto;
    font-optical-sizing: auto;
    max-width: 65ch;
  }

  .sub-text {
    font-size: 17px;
    color: var(--text-secondary);
    line-height: 1.65;
    margin: 0;
    max-width: 65ch;
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
    animation: nudgeHint 1.5s ease-in-out 3;
    transition: opacity 0.4s ease;
  }

  .swipe-hint-fade {
    opacity: 0;
  }

  @keyframes nudgeHint {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(12px); }
  }


  /* Completion card */
  .completion-card {
    align-items: center;
    justify-content: flex-start;
    text-align: center;
    overflow-y: auto;
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
    padding: 24px 0 16px;
    width: 100%;
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

  /* Navigation chevron buttons */
  .nav-chevron {
    position: absolute;
    top: 55%;
    transform: translateY(-50%);
    width: 48px;
    height: 48px;
    border: none;
    background: var(--bg-elevated);
    border-radius: 50%;
    color: var(--text-secondary);
    cursor: pointer;
    opacity: 0.4;
    transition: opacity 150ms ease, background 150ms ease;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-sm);
    touch-action: manipulation;
  }
  .nav-chevron:hover {
    opacity: 0.8;
    background: var(--bg);
  }
  .nav-prev { left: 4px; }
  .nav-next { right: 4px; }

  .reduced-motion .nav-chevron {
    transition: none;
  }

  /* Connection nudge on completion card */
  .connection-nudge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease;
    min-height: 36px;
    margin-bottom: 4px;
  }
  .connection-nudge:hover {
    background: var(--bg-sunken);
  }
</style>
