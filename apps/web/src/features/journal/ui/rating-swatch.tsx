import type { RatingStep } from '../evening-labels.ts';
import { activityCellClass } from './activity-cell-classes.ts';

/**
 * The square an answer is drawn in, set before its name wherever a rating is
 * listed, so a table, a meter and the year's picture use the same colors.
 * The name carries the meaning, so the square is hidden from screen readers,
 * and an answer missing from its scale gets no square at all.
 */
export const RatingSwatch = ({ step }: { readonly step: RatingStep | null }) =>
  step === null ? null : (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 ${activityCellClass[step]}`}
    />
  );
