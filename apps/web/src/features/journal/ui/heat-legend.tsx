/**
 * The key under a shaded picture: what an outlined square means and which way
 * the ramp runs, in the words of the measure it is shaded by.
 */

import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import { type InsightsMeasure, ratingAnswers } from '../insights-measure.ts';
import { activityCellClass } from './activity-cell-classes.ts';

const writingSteps = ['q1', 'q2', 'q3', 'q4'] as const;

export const HeatLegend = ({
  measure,
}: {
  readonly measure: InsightsMeasure;
}) => (
  <p
    className={[
      eyebrowClass,
      'mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 text-ink-faint',
    ].join(' ')}
  >
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className={activityCellClass.none} />
      {measure === 'writing' ? 'No writing' : 'Not rated'}
    </span>
    {measure === 'writing' ? (
      <span className="flex items-center gap-1">
        <span className="mr-1">Less</span>
        {writingSteps.map((step) => (
          <span
            aria-hidden="true"
            className={activityCellClass[step]}
            key={step}
          />
        ))}
        <span className="ml-1">More</span>
      </span>
    ) : (
      ratingAnswers(measure).map((answer) => (
        <span className="flex items-center gap-2" key={answer.label}>
          <span
            aria-hidden="true"
            className={activityCellClass[answer.level]}
          />
          {answer.label}
        </span>
      ))
    )}
  </p>
);
