import { describe, it, expect } from 'vitest';
import { createSpring, stepSpring, SPRING_DEFAULT, SPRING_SNAPPY, SPRING_RUBBER } from '../spring';

describe('createSpring', () => {
  it('creates a settled spring at the initial value', () => {
    const s = createSpring(100);
    expect(s.value).toBe(100);
    expect(s.velocity).toBe(0);
    expect(s.target).toBe(100);
    expect(s.settled).toBe(true);
  });

  it('uses default config when none provided', () => {
    const s = createSpring(0);
    expect(s.config.stiffness).toBe(SPRING_DEFAULT.stiffness);
    expect(s.config.damping).toBe(SPRING_DEFAULT.damping);
  });

  it('merges partial config with defaults', () => {
    const s = createSpring(0, { stiffness: 999 });
    expect(s.config.stiffness).toBe(999);
    expect(s.config.damping).toBe(SPRING_DEFAULT.damping);
  });
});

describe('stepSpring', () => {
  it('does not move a settled spring', () => {
    const s = createSpring(50);
    const next = stepSpring(s, 0.016);
    expect(next.value).toBe(50);
    expect(next.settled).toBe(true);
  });

  it('moves toward target when displaced', () => {
    let s = createSpring(100);
    s = { ...s, target: 0, settled: false };

    const next = stepSpring(s, 0.016);
    expect(next.value).toBeLessThan(100);
    expect(next.settled).toBe(false);
  });

  it('settles within precision after enough steps', () => {
    let s = createSpring(100, SPRING_SNAPPY);
    s = { ...s, target: 0, settled: false };

    for (let i = 0; i < 500; i++) {
      s = stepSpring(s, 0.016);
      if (s.settled) break;
    }

    expect(s.settled).toBe(true);
    expect(s.value).toBe(0);
    expect(s.velocity).toBe(0);
  });

  it('SPRING_RUBBER settles faster than SPRING_GENTLE', () => {
    let rubber = createSpring(100, SPRING_RUBBER);
    rubber = { ...rubber, target: 0, settled: false };

    let gentle = createSpring(100, { stiffness: 200, damping: 22, mass: 1, precision: 0.01 });
    gentle = { ...gentle, target: 0, settled: false };

    let rubberSteps = 0;
    let gentleSteps = 0;

    for (let i = 0; i < 1000; i++) {
      if (!rubber.settled) { rubber = stepSpring(rubber, 0.016); rubberSteps++; }
      if (!gentle.settled) { gentle = stepSpring(gentle, 0.016); gentleSteps++; }
      if (rubber.settled && gentle.settled) break;
    }

    expect(rubberSteps).toBeLessThan(gentleSteps);
  });

  it('caps dt to prevent instability', () => {
    let s = createSpring(100);
    s = { ...s, target: 0, settled: false };

    // Even with a huge dt, the spring should not explode
    const next = stepSpring(s, 1.0);
    expect(Number.isFinite(next.value)).toBe(true);
    expect(Number.isFinite(next.velocity)).toBe(true);
  });
});
