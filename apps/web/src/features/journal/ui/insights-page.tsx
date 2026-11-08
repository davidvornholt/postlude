/**
 * Insights: how the journal has been going over a week, a month, a year, or
 * all of it, in one place rather than two tabs that each held half.
 *
 * It opens quietly, on a sentence and one picture, because that is what a
 * look back usually wants: how much got written and how it felt. The picture
 * fits the range — the days of a week or month as ratings, a year as its days,
 * all time as its months — and everything else waits in folds below, each
 * saying its finding while closed, so the detail is there when asked for and
 * not before.
 *
 * Stepping to the range before or after slides it the way a day slides on the
 * day page, and while the next range loads the current one dims rather than
 * blanking, so the reader can see that the press was taken.
 *
 * The download sits at the foot, under the readings, because it answers the
 * same question — what is in here — and is not a reading of the journal at all.
 */

import { useRouterState } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';

import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import { PageFrame } from '#/shared/ui/page-frame.tsx';
import { activityCells } from '../activity-cells.ts';
import type { InsightsMeasure } from '../insights-measure.ts';
import { pastDays } from '../insights-patterns.ts';
import type { InsightsView } from '../insights-view.ts';
import { ActivityMap } from './activity-map.tsx';
import { ExportControl, type SettleAutosaves } from './export-control.tsx';
import { InsightsFolds } from './insights-folds.tsx';
import { RangeHeading, RangeSwitcher } from './insights-header.tsx';
import { InsightsLead } from './insights-lead.tsx';
import { MeasurePicker } from './measure-picker.tsx';
import { MonthGrid } from './month-grid.tsx';
import { RatingChart } from './rating-chart.tsx';

const sectionHeadingClass = [eyebrowClass, 'text-ink-muted'].join(' ');

const Picture = ({
  title,
  control,
  children,
}: {
  readonly title: string;
  readonly control?: ReactNode;
  readonly children: ReactNode;
}) => (
  <section className="mt-12 sm:mt-14">
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <h2 className={sectionHeadingClass}>{title}</h2>
      {control}
    </div>
    <div className="mt-6">{children}</div>
  </section>
);

const RangePicture = ({
  view,
  measure,
  onMeasure,
}: {
  readonly view: InsightsView;
  readonly measure: InsightsMeasure;
  readonly onMeasure: (measure: InsightsMeasure) => void;
}) => {
  const { range, today, days } = view;
  const first = days[0]?.date;
  const last = days.at(-1)?.date;
  if (
    view.earliest === undefined ||
    pastDays(days, today).length === 0 ||
    first === undefined ||
    last === undefined
  ) {
    return null;
  }
  const picker = <MeasurePicker measure={measure} onChange={onMeasure} />;
  switch (range.kind) {
    case 'year':
      return (
        <Picture control={picker} title="The year at a glance">
          <ActivityMap
            cells={activityCells(
              days,
              { from: first, to: last },
              today,
              measure,
            )}
            measure={measure}
            today={today}
          />
        </Picture>
      );
    case 'all':
      return (
        <Picture control={picker} title="Month by month">
          <MonthGrid days={days} measure={measure} today={today} />
        </Picture>
      );
    default:
      return (
        <Picture title="How the days felt">
          <RatingChart days={days} today={today} />
        </Picture>
      );
  }
};

/** True while a step or switch within Insights is loading its range. */
const useRangePending = (): boolean =>
  useRouterState({
    select: (state) =>
      state.status === 'pending' && state.location.pathname === '/insights',
  });

type InsightsPageProps = {
  readonly view: InsightsView;
  readonly settleAutosaves?: SettleAutosaves;
};

export const InsightsPage = ({ view, settleAutosaves }: InsightsPageProps) => {
  // The shading is a way of looking, so it stays as the reader steps between
  // ranges instead of resetting with each one.
  const [measure, setMeasure] = useState<InsightsMeasure>('writing');
  const pending = useRangePending();
  const bounds = { earliest: view.earliest ?? view.today, today: view.today };

  return (
    <PageFrame>
      <RangeSwitcher bounds={bounds} range={view.range} />
      <div
        aria-busy={pending}
        className={[
          'mt-10 transition-opacity duration-200 ease-standard motion-reduce:transition-none',
          pending ? 'opacity-50 delay-150' : '',
        ].join(' ')}
      >
        <RangeHeading bounds={bounds} range={view.range} />
        <div className="mt-4">
          <InsightsLead view={view} />
        </div>
        <RangePicture measure={measure} onMeasure={setMeasure} view={view} />
        <section className="mt-14 sm:mt-16">
          <h2 className="sr-only">In detail</h2>
          <InsightsFolds view={view} />
        </section>
      </div>
      {view.exportAvailable ? (
        <section className="mt-16 sm:mt-20">
          <h2 className={sectionHeadingClass}>Your own copy</h2>
          <div className="mt-6">
            <ExportControl settleAutosaves={settleAutosaves} />
          </div>
        </section>
      ) : null}
    </PageFrame>
  );
};
