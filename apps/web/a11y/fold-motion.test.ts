import { describe, expect, it } from 'bun:test';
import { largestRetreat, layoutRoundingTolerance } from './fold-motion.ts';

describe('largestRetreat', () => {
  it('is zero for a steady move in the direction asked for', () => {
    expect(largestRetreat([620, 600, 580, 560, 540], -1)).toBe(0);
    expect(largestRetreat([540, 560, 580, 620], 1)).toBe(0);
  });

  it('stays within the tolerance for the rounding step seen at rest', () => {
    const settling = [620.17, 587.64, 553, 540.25, 540.16, 540.17, 540.17];
    expect(largestRetreat(settling, -1)).toBeLessThanOrEqual(
      layoutRoundingTolerance,
    );
  });

  it('counts a jump back against the direction', () => {
    expect(largestRetreat([620, 600, 650, 560], -1)).toBe(50);
  });

  it('adds up many small steps back that no single frame shows', () => {
    const creep = [
      620,
      600,
      580,
      560,
      540,
      ...Array.from({ length: 16 }, (_, step) => 540.5 + step * 0.5),
    ];
    expect(largestRetreat(creep, -1)).toBe(8);
    expect(largestRetreat(creep, -1)).toBeGreaterThan(layoutRoundingTolerance);
  });
});
