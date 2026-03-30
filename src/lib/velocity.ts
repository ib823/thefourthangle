/**
 * Ring-buffer velocity tracker.
 * Stores last N touch samples, computes velocity from best window.
 */

interface Sample {
  x: number;
  y: number;
  t: number;
}

export interface VelocityTracker {
  push(x: number, y: number): void;
  reset(): void;
  getVelocity(): { vx: number; vy: number };
  getAngle(): number; // degrees from horizontal
}

const BUFFER_SIZE = 16;
const MAX_AGE_MS = 100; // only use samples from last 100ms

export function createVelocityTracker(): VelocityTracker {
  const samples: Sample[] = [];
  let head = 0;
  let count = 0;

  function push(x: number, y: number) {
    const t = performance.now();
    if (count < BUFFER_SIZE) {
      samples.push({ x, y, t });
      count++;
    } else {
      samples[head] = { x, y, t };
    }
    head = (head + 1) % BUFFER_SIZE;
  }

  function reset() {
    samples.length = 0;
    head = 0;
    count = 0;
  }

  function getVelocity(): { vx: number; vy: number } {
    if (count < 2) return { vx: 0, vy: 0 };

    const now = performance.now();
    // Find oldest valid sample
    let oldest: Sample | null = null;
    let newest: Sample | null = null;

    for (let i = 0; i < count; i++) {
      const idx = (head - 1 - i + BUFFER_SIZE * 2) % BUFFER_SIZE;
      const s = samples[idx];
      if (!s) continue;
      if (now - s.t > MAX_AGE_MS) break;
      if (!newest) newest = s;
      oldest = s;
    }

    if (!oldest || !newest || oldest === newest) return { vx: 0, vy: 0 };

    const dt = (newest.t - oldest.t) / 1000; // seconds
    if (dt < 0.001) return { vx: 0, vy: 0 };

    return {
      vx: (newest.x - oldest.x) / dt, // px/s
      vy: (newest.y - oldest.y) / dt,
    };
  }

  function getAngle(): number {
    const { vx, vy } = getVelocity();
    return Math.abs(Math.atan2(Math.abs(vy), Math.abs(vx)) * (180 / Math.PI));
  }

  return { push, reset, getVelocity, getAngle };
}

/**
 * Determine gesture direction from initial movement.
 * Returns 'horizontal' | 'vertical' | 'ambiguous'
 */
export function classifyGesture(dx: number, dy: number): 'horizontal' | 'vertical' | 'ambiguous' {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const angle = Math.atan2(absDy, absDx) * (180 / Math.PI);

  if (angle < 30) return 'horizontal';
  if (angle > 60) return 'vertical';
  return 'ambiguous';
}

/**
 * Apple-style rubber band: diminishing returns as you pull past edge.
 * x = (1.0 - (1.0 / ((x * c / d) + 1.0))) * d
 * c = 0.55 (Apple's constant), d = max displacement
 */
export function rubberBand(offset: number, maxDisplacement: number, constant = 0.55): number {
  const d = maxDisplacement;
  const x = Math.abs(offset);
  const result = (1.0 - (1.0 / ((x * constant / d) + 1.0))) * d;
  return offset < 0 ? -result : result;
}
