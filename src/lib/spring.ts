/**
 * Spring physics for natural-feeling animations.
 * x(t) = A * e^(-ζωt) * cos(ωd*t - φ)
 *
 * Default: ζ=0.7, ω=12 (slightly underdamped — one small overshoot then settle)
 */

export interface SpringConfig {
  stiffness: number;  // ω² * mass (default 400)
  damping: number;    // 2ζω * mass (default 28)
  mass: number;       // default 1
  precision: number;  // settle threshold (default 0.01)
}

export const SPRING_DEFAULT: SpringConfig = { stiffness: 400, damping: 28, mass: 1, precision: 0.01 };
export const SPRING_SNAPPY: SpringConfig = { stiffness: 600, damping: 32, mass: 1, precision: 0.01 };
export const SPRING_GENTLE: SpringConfig = { stiffness: 200, damping: 22, mass: 1, precision: 0.01 };
export const SPRING_RUBBER: SpringConfig = { stiffness: 800, damping: 36, mass: 1, precision: 0.01 };

export interface SpringState {
  value: number;
  velocity: number;
  target: number;
  config: SpringConfig;
  settled: boolean;
}

export function createSpring(initial: number, config: Partial<SpringConfig> = {}): SpringState {
  const c = { ...SPRING_DEFAULT, ...config };
  return { value: initial, velocity: 0, target: initial, config: c, settled: true };
}

/**
 * Advance spring by dt seconds. Returns new state (immutable).
 */
export function stepSpring(s: SpringState, dt: number): SpringState {
  if (s.settled) return s;

  const { stiffness, damping, mass, precision } = s.config;
  const displacement = s.value - s.target;
  const springForce = -stiffness * displacement;
  const dampingForce = -damping * s.velocity;
  const acceleration = (springForce + dampingForce) / mass;

  const newVelocity = s.velocity + acceleration * dt;
  const newValue = s.value + newVelocity * dt;
  const newDisplacement = Math.abs(newValue - s.target);
  const settled = newDisplacement < precision && Math.abs(newVelocity) < precision;

  return {
    ...s,
    value: settled ? s.target : newValue,
    velocity: settled ? 0 : newVelocity,
    settled,
  };
}

/**
 * Animate a spring to a target using rAF. Calls onUpdate each frame.
 * Returns a cancel function.
 */
export function animateSpring(
  spring: SpringState,
  target: number,
  onUpdate: (value: number, velocity: number) => void,
  onComplete?: () => void,
): () => void {
  spring.target = target;
  spring.settled = false;
  let raf = 0;
  let lastTime = performance.now();

  function tick(now: number) {
    const dt = Math.min((now - lastTime) / 1000, 0.064); // cap at ~15fps minimum
    lastTime = now;
    spring = stepSpring(spring, dt);
    onUpdate(spring.value, spring.velocity);
    if (spring.settled) {
      onComplete?.();
    } else {
      raf = requestAnimationFrame(tick);
    }
  }

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
