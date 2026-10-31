/**
 * Focused and scattered are two parts of one amount rather than two things to
 * tell apart, so they are two steps of the journal's one green, the deeper step
 * for focus, with a sliver of page between them. Screen time that is neither,
 * or a whole day whose split is unknown, is an outline of the same green, so
 * every bar is as tall as the day's screen time. A day with no measurement is
 * a dashed outline the height of the chart: an empty slot, which a short bar
 * could be mistaken for zero and an absent one for a gap in the axis.
 */

import { useId } from 'react';

import { eyebrowClass, focusRingClass } from '#/shared/ui/design-classes.ts';
import { journalDateLabel } from '../day-label.ts';
import type { JournalDate } from '../journal-day.ts';
import { screenTimeDetails } from '../review-day-details.ts';
import {
  metricsStateOf,
  screenTimeSplit,
  versionChanges,
} from '../review-summary.ts';
import type { ReviewDay } from '../review-view.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';
import { ChartRow, DayAxis } from './review-day-axis.tsx';
import { useDaySelection } from './use-day-selection.ts';

const columnWidth = 10;
const barInset = 2;
const barWidth = columnWidth - barInset * 2;
const plotHeight = 100;
const segmentGap = 1.5;
const missingInset = 1;
const dash = '4 3';
const unsplitClass = 'fill-none stroke-primary';
const minutesPerHour = 60;
const gridSteps = 4;
const hoursPerDay = 24;
/**
 * The hours a gridline can stand for: those that divide a day evenly, up to a
 * whole day across the chart. The scale takes the smallest that fits the
 * busiest day.
 */
const hourSteps = Array.from(
  { length: hoursPerDay / gridSteps },
  (_, index) => index + 1,
).filter((hours) => hoursPerDay % hours === 0);
const scaleClasses = [
  'top-full',
  'top-3/4',
  'top-1/2',
  'top-1/4',
  'top-0',
] as const;

const scaleMinutes = (days: ReadonlyArray<ReviewDay>): number => {
  const busiest = Math.max(
    0,
    ...days.map((day) => day.metrics?.activeMinutes ?? 0),
  );
  const step =
    hourSteps.find((hours) => hours * minutesPerHour * gridSteps >= busiest) ??
    hourSteps.at(-1) ??
    1;
  return step * minutesPerHour * gridSteps;
};

const hasUnsplitTime = (metrics: DayMetrics): boolean => {
  if (metrics.activeMinutes === null || metrics.activeMinutes === 0) {
    return false;
  }
  const split = screenTimeSplit(metrics);
  return split === undefined || split.rest > 0;
};

const DayBar = ({
  day,
  index,
  scale,
  today,
}: {
  readonly day: ReviewDay;
  readonly index: number;
  readonly scale: number;
  readonly today: JournalDate;
}) => {
  const x = index * columnWidth + barInset;
  const heightOf = (minutes: number) => (minutes / scale) * plotHeight;
  const state = metricsStateOf(day, today);
  const active = day.metrics?.activeMinutes ?? null;
  if (state === 'upcoming') {
    return null;
  }
  if (active === null) {
    return (
      <rect
        className="fill-none stroke-ink-faint"
        height={plotHeight - missingInset * 2}
        strokeDasharray={dash}
        vectorEffect="non-scaling-stroke"
        width={barWidth}
        x={x}
        y={missingInset}
      />
    );
  }
  const split = day.metrics === null ? undefined : screenTimeSplit(day.metrics);
  const parts =
    split === undefined
      ? [{ className: unsplitClass, minutes: active }]
      : [
          { className: 'fill-primary', minutes: split.focus },
          { className: 'fill-heat-q1', minutes: split.scattered },
          { className: unsplitClass, minutes: split.rest },
        ].filter((part) => part.minutes > 0);
  return parts.map((part, position) => {
    const below = parts
      .slice(0, position)
      .reduce((sum, { minutes }) => sum + minutes, 0);
    const top = heightOf(below + part.minutes);
    const height = top - heightOf(below);
    const gap = position === 0 ? 0 : Math.min(segmentGap, height / 2);
    return (
      <rect
        className={part.className}
        height={height - gap}
        key={part.className}
        vectorEffect="non-scaling-stroke"
        width={barWidth}
        x={x}
        y={plotHeight - top}
      />
    );
  });
};

const HourScale = ({ minutes }: { readonly minutes: number }) => (
  <div className="relative h-48">
    {scaleClasses.map((position, step) => (
      <span
        className={['absolute right-0 -translate-y-1/2', position].join(' ')}
        key={position}
      >
        {step === 0
          ? '0'
          : `${(minutes / gridSteps / minutesPerHour) * step} h`}
      </span>
    ))}
  </div>
);

const LegendSwatch = ({ className }: { readonly className: string }) => (
  <span
    aria-hidden="true"
    className={['size-3 shrink-0', className].join(' ')}
  />
);

const ScreenTimeLegend = ({
  showsUnsplit,
  showsVersionChange,
}: {
  readonly showsUnsplit: boolean;
  readonly showsVersionChange: boolean;
}) => (
  <figcaption
    className={[
      eyebrowClass,
      'mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 text-ink-faint',
    ].join(' ')}
  >
    <span className="flex items-center gap-2">
      <LegendSwatch className="bg-primary" />
      Focused
    </span>
    <span className="flex items-center gap-2">
      <LegendSwatch className="bg-heat-q1" />
      Scattered
    </span>
    <span className="flex items-center gap-2">
      <LegendSwatch className="border border-ink-faint border-dashed" />
      Not measured
    </span>
    {showsUnsplit ? (
      <span className="flex items-center gap-2">
        <LegendSwatch className="border border-primary" />
        Not split
      </span>
    ) : null}
    {showsVersionChange ? (
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-4 border-ink border-l-2 border-dotted"
        />
        Measured differently from here
      </span>
    ) : null}
  </figcaption>
);

export const ScreenTimeChart = ({
  days,
  today,
}: {
  readonly days: ReadonlyArray<ReviewDay>;
  readonly today: JournalDate;
}) => {
  const detailsId = useId();
  const instructionsId = useId();
  const summaryId = useId();
  const scale = scaleMinutes(days);
  const changes = versionChanges(days);
  const initial = days.some((day) => day.date === today)
    ? today
    : days.at(-1)?.date;
  const { active, activeIndex, selectAtPointer, selectWithKeyboard } =
    useDaySelection(days, initial);
  const width = days.length * columnWidth;

  return (
    <figure className="m-0">
      <ChartRow scale={<HourScale minutes={scale} />}>
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the chart is one keyboard stop; Left, Right, Home, and End inspect its days without adding a tab stop for each one. */}
        <section
          aria-describedby={`${summaryId} ${instructionsId} ${detailsId}`}
          aria-label="Screen time chart"
          className={focusRingClass}
          onKeyDown={selectWithKeyboard}
          onPointerDown={selectAtPointer}
          onPointerMove={selectAtPointer}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: one focusable region exposes the chart without placing every day in the tab order.
          tabIndex={0}
        >
          <svg
            aria-hidden="true"
            className="block h-48 w-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${width} ${plotHeight}`}
          >
            <rect
              className="fill-surface-sunken"
              height={plotHeight}
              width={columnWidth}
              x={activeIndex * columnWidth}
              y={0}
            />
            {scaleClasses.map((position, step) => (
              <line
                className="stroke-border"
                key={position}
                vectorEffect="non-scaling-stroke"
                x1={0}
                x2={width}
                y1={plotHeight - (plotHeight / gridSteps) * step}
                y2={plotHeight - (plotHeight / gridSteps) * step}
              />
            ))}
            {days.map((day, index) => (
              <DayBar
                day={day}
                index={index}
                key={day.date}
                scale={scale}
                today={today}
              />
            ))}
            {changes.map(({ index }) => (
              <line
                className="stroke-ink"
                key={index}
                strokeDasharray="1 3"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                x1={index * columnWidth}
                x2={index * columnWidth}
                y1={0}
                y2={plotHeight}
              />
            ))}
          </svg>
          <DayAxis dates={days.map((day) => day.date)} today={today} />
        </section>
      </ChartRow>
      <p hidden={true} id={summaryId}>
        Time at the screen each day, split into focused and scattered time.
        Screen time that is not split into either is drawn as an outline, and a
        day without a measurement as a dashed outline.
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
          : `${journalDateLabel(active.date)} · ${screenTimeDetails(active, today)}`}
      </p>
      <ScreenTimeLegend
        showsUnsplit={days.some(
          ({ metrics }) => metrics !== null && hasUnsplitTime(metrics),
        )}
        showsVersionChange={changes.length > 0}
      />
    </figure>
  );
};
