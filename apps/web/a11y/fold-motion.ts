/**
 * Layout puts an element at a multiple of a sixty-fourth of a pixel. A year
 * and the words folded under its date change height as two separate heights,
 * each rounded that way, so where they come to rest the next year can settle
 * a little back the way it came: 0.01 px was seen. Twice that is the most two
 * roundings can add up to, and no one can see it.
 */
export const layoutRoundingTolerance = 2 / 64;

/**
 * How far the tracked element has moved back against `direction` (1 is down
 * the page, -1 is up) from the furthest point it had reached by then. Measured
 * from that point rather than from the frame before, so many small steps back
 * add up instead of each passing on its own.
 */
export const largestRetreat = (
  tops: ReadonlyArray<number>,
  direction: 1 | -1,
): number => {
  let furthest = Number.NEGATIVE_INFINITY;
  let retreat = 0;
  for (const top of tops) {
    const progress = top * direction;
    furthest = Math.max(furthest, progress);
    retreat = Math.max(retreat, furthest - progress);
  }
  return retreat;
};
