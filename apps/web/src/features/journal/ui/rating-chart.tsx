/**
 * The scales are short and ordered, so a meter of three steps says a rating at
 * a glance: one step for the low end, three for the high end. Every scale
 * shares one set of colors, and the meter fills in its answer's: umber for
 * the low answer, ochre for the middle and green for the high, the colors the
 * year's picture and the day page give the same answers. The height says how
 * far up the scale a day sat and the color says it again, so a drained day,
 * a day of little progress and a day not worth repeating look the same kind
 * of day wherever they show. A day without a rating is a dashed outline, so
 * it reads as a gap rather than as the lowest answer.
 */

import { useId } from 'react';

import { eyebrowClass, focusRingClass } from '#/shared/ui/design-classes.ts';
import { ratingDetails, ratingScales } from '../day-details.ts';
import { journalDateLabel } from '../day-label.ts';
import { type RatingStep, ratingSteps } from '../evening-labels.ts';
import type { InsightsDay } from '../insights-view.ts';
import type { JournalDate } from '../journal-day.ts';
import { heatFillClass } from './activity-cell-classes.ts';
import { ChartRow, DayAxis } from './day-axis.tsx';
import { dayColumnsClass } from './day-columns.ts';
import { RatingSwatch } from './rating-swatch.tsx';
import { useDaySelection } from './use-day-selection.ts';

const Meter = ({
  answer,
  upcoming,
}: {
  readonly answer: RatingStep | null;
  readonly upcoming: boolean;
}) => {
  const shape = 'mx-auto h-9 w-3/5 max-w-6';
  if (upcoming) {
    return <div className={shape} />;
  }
  if (answer === null) {
    return (
      <div
        className={[shape, 'border border-ink-faint border-dashed'].join(' ')}
      />
    );
  }
  const filled = ratingSteps.indexOf(answer);
  return (
    <div className={[shape, 'flex flex-col-reverse gap-0.5'].join(' ')}>
      {ratingSteps.map((step, index) => (
        <span
          className={[
            'flex-1',
            index <= filled ? heatFillClass[answer] : 'bg-border',
          ].join(' ')}
          key={step}
        />
      ))}
    </div>
  );
};

const stepNames: Readonly<Record<RatingStep, string>> = {
  low: 'One step: drained, little, no',
  middle: 'Two steps: okay, solid, partly',
  high: 'Three steps: fresh, a lot, yes',
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
  readonly days: ReadonlyArray<InsightsDay>;
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
                    answer={scale.step(day)}
                    key={scale.name}
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
        {ratingSteps.map((step) => (
          <span className="flex items-center gap-2" key={step}>
            <RatingSwatch step={step} />
            {stepNames[step]}
          </span>
        ))}
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
