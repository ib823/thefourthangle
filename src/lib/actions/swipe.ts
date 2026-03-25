/**
 * Svelte action: swipe gesture handler with velocity tracking,
 * gesture disambiguation, pointer capture, and rubber-band physics.
 */

import { createVelocityTracker, classifyGesture, rubberBand } from '../velocity';

export interface SwipeConfig {
  threshold: number;         // fraction of container width (default 0.15)
  velocityThreshold: number; // px/s to commit regardless of distance (default 500)
  deadZone: number;          // px before any visual response (default 3)
  ambiguousZone: number;     // px to wait in ambiguous angle zone (default 15)
  maxRubberBand: number;     // fraction of width for rubber band (default 0.25)
  canSwipeLeft: boolean;
  canSwipeRight: boolean;
}

export interface SwipeCallbacks {
  onStart?: () => void;
  onMove?: (dx: number, progress: number) => void;
  onCommit?: (direction: 'left' | 'right') => void;
  onCancel?: () => void;
  onRubberBand?: (dx: number) => void;
}

const DEFAULT_CONFIG: SwipeConfig = {
  threshold: 0.15,
  velocityThreshold: 500,
  deadZone: 3,
  ambiguousZone: 15,
  maxRubberBand: 0.25,
  canSwipeLeft: true,
  canSwipeRight: true,
};

export function createSwipeHandler(
  element: HTMLElement,
  config: Partial<SwipeConfig>,
  callbacks: SwipeCallbacks,
) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const tracker = createVelocityTracker();

  let active = false;
  let startX = 0;
  let startY = 0;
  let gesture: 'horizontal' | 'vertical' | 'ambiguous' | 'undecided' = 'undecided';
  let pointerId: number | null = null;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return; // left/touch only
    if ((e.target as HTMLElement)?.closest('button, a, input')) return;

    active = true;
    startX = e.clientX;
    startY = e.clientY;
    gesture = 'undecided';
    pointerId = e.pointerId;
    tracker.reset();
    tracker.push(e.clientX, e.clientY);

    try { element.setPointerCapture(e.pointerId); } catch {}
  }

  function onPointerMove(e: PointerEvent) {
    if (!active || e.pointerId !== pointerId) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    tracker.push(e.clientX, e.clientY);

    // Dead zone — no response
    if (gesture === 'undecided') {
      if (absDx < cfg.deadZone && absDy < cfg.deadZone) return;

      const classification = classifyGesture(dx, dy);
      if (classification === 'vertical') {
        cancel();
        return;
      }
      if (classification === 'ambiguous') {
        // Wait for more movement
        if (absDx < cfg.ambiguousZone && absDy < cfg.ambiguousZone) return;
        // Re-classify with more data
        const reclass = classifyGesture(dx, dy);
        if (reclass === 'vertical' || reclass === 'ambiguous') {
          cancel();
          return;
        }
      }
      // Confirmed horizontal
      gesture = 'horizontal';
      callbacks.onStart?.();
    }

    if (gesture !== 'horizontal') return;

    e.preventDefault();

    const width = element.offsetWidth;
    const maxRubber = width * cfg.maxRubberBand;

    // Apply rubber band if at edges
    let effectiveDx = dx;
    const isAtLeftEdge = dx > 0 && !cfg.canSwipeRight;
    const isAtRightEdge = dx < 0 && !cfg.canSwipeLeft;

    if (isAtLeftEdge || isAtRightEdge) {
      effectiveDx = rubberBand(dx, maxRubber);
      callbacks.onRubberBand?.(effectiveDx);
    } else {
      const progress = Math.min(Math.abs(dx) / (width * cfg.threshold), 1);
      callbacks.onMove?.(dx, progress);
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!active || e.pointerId !== pointerId) return;

    const dx = e.clientX - startX;
    const width = element.offsetWidth;
    const { vx } = tracker.getVelocity();
    const absDx = Math.abs(dx);

    active = false;
    pointerId = null;

    try { element.releasePointerCapture(e.pointerId); } catch {}

    if (gesture !== 'horizontal') {
      cancel();
      return;
    }

    // Commit check: velocity OR distance
    const velocityCommit = Math.abs(vx) > cfg.velocityThreshold;
    const distanceCommit = absDx > width * cfg.threshold;

    if (velocityCommit || distanceCommit) {
      const direction = (vx !== 0 ? vx : dx) < 0 ? 'left' : 'right';

      // Validate direction is allowed
      if ((direction === 'left' && cfg.canSwipeLeft) || (direction === 'right' && cfg.canSwipeRight)) {
        callbacks.onCommit?.(direction);
        return;
      }
    }

    callbacks.onCancel?.();
  }

  function onPointerCancel(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    cancel();
  }

  function cancel() {
    active = false;
    pointerId = null;
    gesture = 'undecided';
    callbacks.onCancel?.();
  }

  // Multi-touch: cancel gesture if second finger arrives
  function onTouchStart(e: TouchEvent) {
    if (e.touches.length > 1 && active) {
      cancel();
    }
  }

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerCancel);
  element.addEventListener('touchstart', onTouchStart, { passive: true });

  // Set touch-action dynamically
  element.style.touchAction = 'pan-y';

  return {
    destroy() {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerCancel);
      element.removeEventListener('touchstart', onTouchStart);
    },
    updateConfig(newConfig: Partial<SwipeConfig>) {
      Object.assign(cfg, newConfig);
    },
  };
}
