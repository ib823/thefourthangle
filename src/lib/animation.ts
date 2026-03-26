/**
 * Animation utilities: tween, stagger, sequence.
 * All return cancel functions.
 */

export type EasingFn = (t: number) => number;

// Standard easing functions
export const ease = {
  // Micro-interactions
  outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  // Standard transitions
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  // Spring-like (approximation for CSS cubic-bezier(0.34, 1.56, 0.64, 1))
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  // Snap (for quick transitions)
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  // Linear
  linear: (t: number) => t,
  // Decelerate (for count-ups)
  decel: (t: number) => t * (2 - t),
};

/**
 * Tween from → to over duration ms. Returns cancel.
 */
export function tween(
  from: number,
  to: number,
  duration: number,
  easing: EasingFn,
  onUpdate: (value: number) => void,
  onComplete?: () => void,
): () => void {
  const start = performance.now();
  let raf = 0;

  function tick(now: number) {
    const elapsed = now - start;
    const t = Math.min(elapsed / duration, 1);
    const value = from + (to - from) * easing(t);
    onUpdate(value);
    if (t < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      onComplete?.();
    }
  }

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/**
 * Stagger: run callback for each index with delay.
 * Returns cancel function.
 */
export function stagger(
  count: number,
  delayPerItem: number,
  maxDelay: number,
  callback: (index: number) => (() => void) | void,
): () => void {
  const cancels: (() => void)[] = [];
  const timeouts: ReturnType<typeof setTimeout>[] = [];

  for (let i = 0; i < count; i++) {
    const delay = Math.min(i * delayPerItem, maxDelay);
    const timeout = setTimeout(() => {
      const cancel = callback(i);
      if (cancel) cancels.push(cancel);
    }, delay);
    timeouts.push(timeout);
  }

  return () => {
    timeouts.forEach(clearTimeout);
    cancels.forEach(fn => fn());
  };
}

/**
 * Count up animation for numbers.
 */
export function countUp(
  from: number,
  to: number,
  duration: number,
  onUpdate: (value: number) => void,
  onComplete?: () => void,
): () => void {
  return tween(from, to, duration, ease.decel, (v) => onUpdate(Math.round(v)), onComplete);
}

/**
 * Trigger haptic feedback if available.
 */
export function haptic(pattern: number | number[] = 5): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Silently fail — not all devices support vibration
  }
}

/**
 * Detect animation performance tier.
 * Tier 1: Full effects (flagship, 4+ cores, 4+ GB)
 * Tier 2: Reduced effects (mid-range, 2-4 cores)
 * Tier 3: Minimal animation (low-end, ≤2 cores)
 * Tier 4: No animation (prefers-reduced-motion or failed frame test)
 */
export type AnimationTier = 1 | 2 | 3 | 4;

export function detectAnimationTier(): AnimationTier {
  if (typeof window === 'undefined') return 1;

  // Tier 4: user explicitly prefers reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 4;

  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as any).deviceMemory || 8; // deviceMemory API (Chrome only)

  if (cores >= 4 && memory >= 4) return 1;
  if (cores >= 2) return 2;
  return 3;
}

let _cachedTier: AnimationTier | null = null;
export function getAnimationTier(): AnimationTier {
  if (_cachedTier === null) {
    _cachedTier = detectAnimationTier();
    // Cache in sessionStorage
    try { sessionStorage.setItem('fa-anim-tier', String(_cachedTier)); } catch {}
  }
  return _cachedTier;
}

/**
 * Check if reduced motion is preferred.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Sequence: run animations in order, each starting after previous completes.
 * Returns cancel function.
 */
export function sequence(
  steps: Array<(done: () => void) => (() => void) | void>,
): () => void {
  const cancels: (() => void)[] = [];
  let currentStep = 0;
  let cancelled = false;

  function next() {
    if (cancelled || currentStep >= steps.length) return;
    const step = steps[currentStep];
    currentStep++;
    const cancel = step(() => next());
    if (cancel) cancels.push(cancel);
  }

  next();

  return () => {
    cancelled = true;
    cancels.forEach(fn => fn());
  };
}

/**
 * Run callback on next idle frame (requestIdleCallback with fallback).
 */
export function onIdle(callback: () => void, timeout = 100): number {
  if (typeof requestIdleCallback !== 'undefined') {
    return requestIdleCallback(callback, { timeout }) as unknown as number;
  }
  return setTimeout(callback, 16) as unknown as number;
}

/**
 * Pause all rAF loops when page is hidden, resume when visible.
 */
let _visibilityListenerAdded = false;
const _pauseCallbacks = new Set<(hidden: boolean) => void>();

export function onVisibilityChange(callback: (hidden: boolean) => void): () => void {
  _pauseCallbacks.add(callback);

  if (!_visibilityListenerAdded && typeof document !== 'undefined') {
    _visibilityListenerAdded = true;
    document.addEventListener('visibilitychange', () => {
      const hidden = document.hidden;
      _pauseCallbacks.forEach(cb => cb(hidden));
    });
  }

  return () => { _pauseCallbacks.delete(callback); };
}
