/**
 * The scales are short and ordered, so a meter of three steps says a rating at
 * a glance: one step for the low end, three for the high end, and the same
 * green throughout, because more of it means more and not something else. A day
 * without a rating is a dashed outline, so it reads as a gap rather than as the
 * lowest answer.
 */

import { useId } from 'react';

import { eyebrowClass, focusRingClass } from '#/shared/ui/design-classes.ts';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import { ratingDetails, ratingScales } from '../review-day-details.ts';
import type { ReviewDay } from '../review-view.ts';
import { ChartRow, DayAxis } from './review-day-axis.tsx';
import { dayColumnsClass } from './review-day-columns.ts';
import { useDaySelection } from './use-day-selection.ts';

const Meter = ({
  steps,
  filled,
  upcoming,
}: {
  readonly steps: number;
  readonly filled: number | null;
  readonly upcoming: boolean;
}) => {
  const shape = 'mx-auto h-9 w-3/5 max-w-6';
  if (upcoming) {
    return <div className={shape} />;
  }
  if (filled === null) {
    return (
      <div
        className={[shape, 'border border-ink-faint border-dashed'].join(' ')}
      />
    );
  }
  return (
    <div className={[shape, 'flex flex-col-reverse gap-0.5'].join(' ')}>
      {Array.from({ length: steps }, (_, index) => index + 1).map((step) => (
        <span
          className={[
            'flex-1',
            step <= filled ? 'bg-primary' : 'bg-border',
          ].join(' ')}
          key={step}
        />
      ))}
    </div>
  );
};

const ScaleNames = () => (
  <div className="flex flex-col gap-4 pt-2 text-right">
    {ratingScales.map((scale) => (
      <span className="flex h-9 items-center justify-end" key={scale.name}>
        {scale.short}
      </span>
    ))}
  </div>
);

export const RatingChart = ({
  days,
  today,
}: {
  readonly days: ReadonlyArray<ReviewDay>;
  readonly today: JournalDate;
}) => {
  const detailsId = useId();
  const instructionsId = useId();
  const summaryId = useId();
  const initial = days.some((day) => day.date === today)
    ? today
    : days.at(-1)?.date;
  const { active, activeIndex, selectAtPointer, selectWithKeyboard } =
    useDaySelection(days, initial);

  return (
    <figure className="m-0">
      <ChartRow scale={<ScaleNames />}>
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the chart is one keyboard stop; Left, Right, Home, and End inspect its days without adding a tab stop for each one. */}
        <section
          aria-describedby={`${summaryId} ${instructionsId} ${detailsId}`}
          aria-label="Ratings chart"
          className={focusRingClass}
          onKeyDown={selectWithKeyboard}
          onPointerDown={selectAtPointer}
          onPointerMove={selectAtPointer}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: one focusable region exposes the chart without placing every day in the tab order.
          tabIndex={0}
        >
          <div
            aria-hidden="true"
            className={['grid', dayColumnsClass(days.length)].join(' ')}
          >
            {days.map((day, index) => (
              <div
                className={[
                  'flex flex-col gap-4 py-2',
                  index === activeIndex ? 'bg-surface-sunken' : '',
                ].join(' ')}
                key={day.date}
              >
                {ratingScales.map((scale) => (
                  <Meter
                    filled={scale.filled(day)}
                    key={scale.name}
                    steps={scale.steps}
                    upcoming={day.date > today}
                  />
                ))}
              </div>
            ))}
          </div>
          <DayAxis dates={days.map((day) => day.date)} today={today} />
        </section>
      </ChartRow>
      <p hidden={true} id={summaryId}>
        Energy, progress and whether the day was worth repeating, for each day.
        Each rating fills one, two or three steps, from the low end of its scale
        to the high end. Days without a rating are drawn as dashed outlines.
      </p>
      <p hidden={true} id={instructionsId}>
        Use Left and Right to inspect days. Home and End move to the first and
        last day.
      </p>
      <p
        aria-live="polite"
        className="mt-4 min-h-5 text-ink-muted text-sm"
        id={detailsId}
      >
        {active === undefined
          ? null
          : `${journalDateLabel(active.date)} · ${ratingDetails(active, today)}`}
      </p>
      <figcaption
        className={[
          eyebrowClass,
          'mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 text-ink-faint',
        ].join(' ')}
      >
        <span>One step: drained, little, no</span>
        <span>Three steps: fresh, a lot, yes</span>
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3 border border-ink-faint border-dashed"
          />
          Not rated
        </span>
      </figcaption>
    </figure>
  );
};
