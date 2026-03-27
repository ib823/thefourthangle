import { describe, it, expect } from 'vitest';
import { classifyGesture, rubberBand } from '../velocity';

describe('classifyGesture', () => {
  it('returns horizontal for flat movement', () => {
    expect(classifyGesture(50, 5)).toBe('horizontal');
    expect(classifyGesture(-80, 10)).toBe('horizontal');
  });

  it('returns vertical for steep movement', () => {
    expect(classifyGesture(5, 50)).toBe('vertical');
    expect(classifyGesture(10, -80)).toBe('vertical');
  });

  it('returns ambiguous for diagonal movement', () => {
    expect(classifyGesture(30, 30)).toBe('ambiguous');
    expect(classifyGesture(40, 35)).toBe('ambiguous');
  });

  it('handles zero displacement', () => {
    // atan2(0, 0) = 0 degrees → horizontal
    expect(classifyGesture(0, 0)).toBe('horizontal');
  });

  it('handles negative values correctly', () => {
    expect(classifyGesture(-50, -5)).toBe('horizontal');
    expect(classifyGesture(-5, -50)).toBe('vertical');
  });
});

describe('rubberBand', () => {
  it('returns 0 for 0 offset', () => {
    expect(rubberBand(0, 100)).toBe(0);
  });

  it('returns diminishing values as offset increases', () => {
    const small = rubberBand(10, 100);
    const medium = rubberBand(50, 100);
    const large = rubberBand(100, 100);

    expect(small).toBeGreaterThan(0);
    expect(medium).toBeGreaterThan(small);
    expect(large).toBeGreaterThan(medium);

    // Rubber band: each increment yields less displacement
    const ratio1 = medium / small;
    const ratio2 = large / medium;
    expect(ratio2).toBeLessThan(ratio1);
  });

  it('preserves sign for negative offset', () => {
    const pos = rubberBand(50, 100);
    const neg = rubberBand(-50, 100);
    expect(neg).toBe(-pos);
  });

  it('never exceeds maxDisplacement', () => {
    const result = rubberBand(10000, 100);
    expect(result).toBeLessThan(100);
  });

  it('uses Apple constant 0.55 by default', () => {
    const withDefault = rubberBand(50, 100);
    const withExplicit = rubberBand(50, 100, 0.55);
    expect(withDefault).toBe(withExplicit);
  });
});
