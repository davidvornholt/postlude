import type { Shade } from '../insights-measure.ts';

/**
 * The colour of each fill, without a size, for a square of any size. A change
 * of shading fades rather than snaps, so switching what the squares show reads
 * as the same squares taking on new values.
 */
export const heatFillClass: Record<Shade, string> = {
  // A hairline, not a fill: "nothing" has to read as a different kind of thing
  // from "a little", not as less of it.
  none: 'border border-heat-none-mark bg-heat-none',
  q1: 'bg-heat-q1',
  q2: 'bg-heat-q2',
  q3: 'bg-heat-q3',
  q4: 'bg-heat-q4',
  drained: 'bg-energy-drained',
  okay: 'bg-energy-okay',
  fresh: 'bg-energy-fresh',
};

const fadeClass =
  'transition-colors duration-300 ease-standard motion-reduce:transition-none';

export const activityCellClass: Record<Shade, string> = {
  none: `size-3 ${heatFillClass.none} ${fadeClass}`,
  q1: `size-3 ${heatFillClass.q1} ${fadeClass}`,
  q2: `size-3 ${heatFillClass.q2} ${fadeClass}`,
  q3: `size-3 ${heatFillClass.q3} ${fadeClass}`,
  q4: `size-3 ${heatFillClass.q4} ${fadeClass}`,
  drained: `size-3 ${heatFillClass.drained} ${fadeClass}`,
  okay: `size-3 ${heatFillClass.okay} ${fadeClass}`,
  fresh: `size-3 ${heatFillClass.fresh} ${fadeClass}`,
};

export const heatSquareClass = (shade: Shade): string =>
  `${heatFillClass[shade]} ${fadeClass}`;
