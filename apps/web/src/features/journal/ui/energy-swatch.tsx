import type { Energy } from '../schemas/day-rating.ts';
import { activityCellClass } from './activity-cell-classes.ts';

/**
 * The square an energy answer is drawn in, set before its name wherever the
 * answer is listed, so a table and the year's picture use the same colours.
 * The name carries the meaning, so the square is hidden from screen readers.
 */
export const EnergySwatch = ({ energy }: { readonly energy: Energy }) => (
  <span
    aria-hidden="true"
    className={`inline-block shrink-0 ${activityCellClass[energy]}`}
  />
);
