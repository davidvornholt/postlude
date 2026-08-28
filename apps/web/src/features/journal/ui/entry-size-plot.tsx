import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import type { EntrySizePoint } from '../entry-size.ts';
import { parseJournalDate } from '../journal-day.ts';
import { journalMonthLabel } from '../journal-labels.ts';

const chartWidth = 840;
const chartTop = 8;
const chartBottom = 176;
const chartHeight = chartBottom - chartTop;
const firstQuarter = 0.25;
const halfway = 0.5;
const thirdQuarter = 0.75;
const guideFractions = [0, firstQuarter, halfway, thirdQuarter, 1] as const;
const monthAbbreviationLength = 3;
const isoMonthLength = 7;

const xAt = (index: number, length: number): number =>
  length <= 1 ? chartWidth / 2 : (index / (length - 1)) * chartWidth;

const yAt = (words: number, maximum: number): number =>
  chartBottom - (words / maximum) * chartHeight;

const monthName = (date: string): string =>
  journalMonthLabel(parseJournalDate(date).month).slice(
    0,
    monthAbbreviationLength,
  );

const visibleMonths = (
  points: ReadonlyArray<EntrySizePoint>,
): ReadonlyArray<EntrySizePoint> =>
  points
    .filter(
      (point, index) =>
        index === 0 ||
        point.date.slice(0, isoMonthLength) !==
          points[index - 1]?.date.slice(0, isoMonthLength),
    )
    .filter(
      (_point, index, labels) => index % 2 === 0 || index === labels.length - 1,
    );

export const EntrySizePlot = ({
  activeIndex,
  maximum,
  points,
}: {
  readonly activeIndex: number;
  readonly maximum: number;
  readonly points: ReadonlyArray<EntrySizePoint>;
}) => {
  const averagePoints = points
    .map(
      (point, index) =>
        `${xAt(index, points.length)},${yAt(point.average, maximum)}`,
    )
    .join(' ');

  return (
    <>
      <svg
        aria-hidden="true"
        className="h-52 w-full overflow-visible"
        preserveAspectRatio="none"
        viewBox={`0 0 ${chartWidth} ${chartBottom}`}
      >
        {guideFractions.map((fraction) => {
          const y = chartTop + chartHeight * fraction;
          return (
            <line
              className="stroke-border"
              key={fraction}
              vectorEffect="non-scaling-stroke"
              x1={0}
              x2={chartWidth}
              y1={y}
              y2={y}
            />
          );
        })}
        {points.map((point, index) => (
          <line
            className="stroke-ink-faint opacity-50"
            key={point.date}
            vectorEffect="non-scaling-stroke"
            x1={xAt(index, points.length)}
            x2={xAt(index, points.length)}
            y1={chartBottom}
            y2={yAt(point.words, maximum)}
          />
        ))}
        <polyline
          className="fill-none stroke-primary"
          points={averagePoints}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <line
          className="stroke-primary"
          vectorEffect="non-scaling-stroke"
          x1={xAt(activeIndex, points.length)}
          x2={xAt(activeIndex, points.length)}
          y1={chartTop}
          y2={chartBottom}
        />
      </svg>
      <div
        aria-hidden="true"
        className="mt-2 flex justify-between text-ink-faint text-xs"
      >
        {visibleMonths(points).map((point) => (
          <span key={point.date}>{monthName(point.date)}</span>
        ))}
      </div>
    </>
  );
};

export const EntrySizeLegend = () => (
  <figcaption
    className={[
      eyebrowClass,
      'mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 text-ink-faint',
    ].join(' ')}
  >
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="h-4 border-ink-faint border-l" />
      Each day
    </span>
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="h-px w-6 bg-primary" />
      Seven-day average
    </span>
  </figcaption>
);
