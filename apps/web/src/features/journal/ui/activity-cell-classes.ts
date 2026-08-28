import type { HeatLevel } from '../activity.ts';

export const activityCellClass: Record<HeatLevel, string> = {
  // A hairline, not a fill: "nothing written" has to read as a different kind
  // of thing from "a little written", not as less of it.
  none: 'size-3 border border-heat-none-mark bg-heat-none',
  q1: 'size-3 bg-heat-q1',
  q2: 'size-3 bg-heat-q2',
  q3: 'size-3 bg-heat-q3',
  q4: 'size-3 bg-heat-q4',
};
