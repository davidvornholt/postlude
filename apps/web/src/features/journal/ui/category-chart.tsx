/**
 * Where the screen time went, by /wrap's categories, added up over the period.
 *
 * Each category is one row with its name and its time written out, so the bar
 * is there to compare lengths and nothing has to be read off it. One series,
 * so one colour. The categories are estimates, and the heading says so.
 */

import { journalCountLabel } from '../journal-labels.ts';
import { durationLabel } from '../review-labels.ts';
import type { CategoryTotal } from '../review-summary.ts';

const barScale = 100;

export const CategoryChart = ({
  categories,
}: {
  readonly categories: ReadonlyArray<CategoryTotal>;
}) => {
  const largest = Math.max(
    1,
    ...categories.map((category) => category.minutes ?? 0),
  );
  if (categories.length === 0) {
    return (
      <p className="text-ink-muted">
        No categories were measured on these days.
      </p>
    );
  }
  return (
    <ul aria-label="Estimated screen time by category" className="grid gap-3">
      {categories.map((category) => (
        // On a phone the bar takes its own line under the name and the time,
        // so a long note beside it cannot squeeze it to nothing.
        <li
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]"
          key={category.id}
        >
          <span className="truncate text-ink" title={category.label}>
            {category.label}
          </span>
          {category.minutes === null ? null : (
            <svg
              aria-hidden="true"
              className="col-span-2 row-start-2 block h-3 w-full sm:col-span-1 sm:col-start-2 sm:row-start-1"
              preserveAspectRatio="none"
              viewBox={`0 0 ${barScale} 1`}
            >
              <rect
                className="fill-primary"
                height={1}
                width={(category.minutes / largest) * barScale}
                x={0}
                y={0}
              />
            </svg>
          )}
          <span className="col-start-2 row-start-1 text-right text-ink-muted tabular-nums sm:col-start-3">
            {category.minutes === null
              ? 'Not measured'
              : durationLabel(category.minutes)}
            {category.minutes === null || category.missing === 0
              ? null
              : `, not measured on ${journalCountLabel(category.missing, 'day')}`}
          </span>
        </li>
      ))}
    </ul>
  );
};
