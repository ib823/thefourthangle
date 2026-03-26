/**
 * Scroll physics for card content areas.
 * Handles: overscroll detection, fade gradients, scroll indicators,
 * and swipe-vs-scroll gesture coordination.
 */

export interface ScrollState {
  atTop: boolean;
  atBottom: boolean;
  canScroll: boolean;
  scrollProgress: number; // 0-1
}

/**
 * Observe scroll state of an element. Returns cleanup function.
 */
export function observeScroll(
  el: HTMLElement,
  onState: (state: ScrollState) => void,
): () => void {
  function update() {
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    const canScroll = maxScroll > 2; // 2px threshold
    const atTop = scrollTop <= 1;
    const atBottom = maxScroll > 0 && scrollTop >= maxScroll - 1;
    const scrollProgress = maxScroll > 0 ? scrollTop / maxScroll : 0;
    onState({ atTop, atBottom, canScroll, scrollProgress });
  }

  el.addEventListener('scroll', update, { passive: true });
  // Initial check
  update();
  // Re-check on resize
  const ro = new ResizeObserver(update);
  ro.observe(el);

  return () => {
    el.removeEventListener('scroll', update);
    ro.disconnect();
  };
}

/**
 * Apply fade gradient mask to a scrollable container.
 * Shows gradient at bottom when more content below,
 * gradient at top when scrolled down.
 */
export function applyFadeGradient(el: HTMLElement, state: ScrollState): void {
  if (!state.canScroll) {
    el.style.maskImage = '';
    el.style.webkitMaskImage = '';
    return;
  }

  const masks: string[] = [];

  if (!state.atTop) {
    masks.push('linear-gradient(to bottom, transparent 0%, black 8%)');
  } else {
    masks.push('linear-gradient(to bottom, black 0%, black 8%)');
  }

  if (!state.atBottom) {
    masks.push('linear-gradient(to top, transparent 0%, black 8%)');
  } else {
    masks.push('linear-gradient(to top, black 0%, black 8%)');
  }

  // Combine masks: both top and bottom fades
  if (!state.atTop && !state.atBottom) {
    const mask = 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)';
    el.style.maskImage = mask;
    el.style.webkitMaskImage = mask;
  } else if (!state.atTop) {
    const mask = 'linear-gradient(to bottom, transparent 0%, black 8%)';
    el.style.maskImage = mask;
    el.style.webkitMaskImage = mask;
  } else if (!state.atBottom) {
    const mask = 'linear-gradient(to bottom, black 92%, transparent 100%)';
    el.style.maskImage = mask;
    el.style.webkitMaskImage = mask;
  } else {
    el.style.maskImage = '';
    el.style.webkitMaskImage = '';
  }
}

/**
 * Determine if a scroll container should block horizontal swipe.
 * If user is mid-scroll (not at top/bottom), swipe should be disabled
 * to avoid gesture conflicts.
 */
export function shouldBlockSwipe(el: HTMLElement): boolean {
  const { scrollTop, scrollHeight, clientHeight } = el;
  const maxScroll = scrollHeight - clientHeight;
  // Block swipe if content is scrollable and not at an edge
  return maxScroll > 10 && scrollTop > 5 && scrollTop < maxScroll - 5;
}
