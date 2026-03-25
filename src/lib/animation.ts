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
