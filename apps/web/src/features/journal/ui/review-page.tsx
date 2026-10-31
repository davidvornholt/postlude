/**
 * A week or a month looked back on: how the days felt, then what the day
 * metrics measured, then every day as a row.
 *
 * Only ratings and day metrics are read here, never the writing. The feeling
 * comes first for the same reason the day page asks for energy before it shows
 * the report: the numbers are there to set beside how the days felt, not to
 * tell it.
 *
 * Contract 4 holds throughout. Totals add up only days measured under one
 * metrics version and say how many days they cover, a change of version is
 * drawn where it happens, a value that was not measured is shown as missing,
 * and the categories are called estimates.
 */

import type { ReactNode } from 'react';

import { ActionLink } from '#/shared/ui/action-link.tsx';
import {
  eyebrowClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { NavigationLink } from '#/shared/ui/navigation-link.tsx';
import { PageFrame } from '#/shared/ui/page-frame.tsx';
import { journalMonthOf } from '../calendar.ts';
import { journalCountLabel } from '../journal-labels.ts';
import {
  isoWeekNumber,
  periodHolding,
  periodIncludes,
  periodLabel,
  type ReviewPeriod,
  shiftPeriod,
  weekStartOf,
} from '../review-period.ts';
import {
  categoryTotals,
  comparableDays,
  comparisonVersion,
  otherVersionDays,
} from '../review-summary.ts';
import type { ReviewView } from '../review-view.ts';
import { CategoryChart } from './category-chart.tsx';
import { RatingChart } from './rating-chart.tsx';
import { RatingCounts } from './rating-counts.tsx';
import { ReviewTable } from './review-table.tsx';
import { ReviewTotals } from './review-totals.tsx';
import { ScreenTimeChart } from './screen-time-chart.tsx';

const Section = ({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) => (
  <section className="mt-12 border-border border-t pt-8 sm:mt-16">
    <h2 className={[eyebrowClass, 'text-ink-muted'].join(' ')}>{title}</h2>
    <div className="mt-6">{children}</div>
  </section>
);

/** A link to another period, on whichever of the two pages shows it. */
const PeriodLink = ({
  period,
  children,
  ...props
}: {
  readonly period: ReviewPeriod;
  readonly children: ReactNode;
  readonly 'aria-label'?: string;
  readonly variant: 'icon' | 'quiet';
  readonly className?: string;
}) =>
  period.kind === 'week' ? (
    <ActionLink {...props} search={{ week: period.start }} to="/review/week">
      {children}
    </ActionLink>
  ) : (
    <ActionLink {...props} search={{ month: period.month }} to="/review/month">
      {children}
    </ActionLink>
  );

const ReviewHeader = ({ view }: { readonly view: ReviewView }) => {
  const { period, today } = view;
  const previous = shiftPeriod(period, -1);
  const next = shiftPeriod(period, 1);
  const noun = period.kind === 'week' ? 'week' : 'month';
  const weekNumber =
    period.kind === 'week' ? isoWeekNumber(period.start) : undefined;
  // Switching keeps the reader near the same days: today's week or month when
  // today is in view, otherwise the one the period starts in.
  const anchor = periodIncludes(period, today)
    ? today
    : (view.days[0]?.date ?? today);

  return (
    <header>
      <nav aria-label="Review period">
        <ul className="flex gap-6">
          <li>
            <NavigationLink
              activeOptions={{ includeSearch: false }}
              search={{ week: weekStartOf(anchor) }}
              to="/review/week"
            >
              Week
            </NavigationLink>
          </li>
          <li>
            <NavigationLink
              activeOptions={{ includeSearch: false }}
              search={{ month: journalMonthOf(anchor) }}
              to="/review/month"
            >
              Month
            </NavigationLink>
          </li>
        </ul>
      </nav>
      <p className={[eyebrowClass, 'mt-8 text-ink-faint'].join(' ')}>
        {weekNumber === undefined ? 'Month' : `Week ${weekNumber}`}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
        <h1 className="text-balance font-display text-3xl text-ink sm:text-4xl">
          {periodLabel(period)}
        </h1>
        <div className="flex items-center gap-1">
          {previous === undefined ? (
            <span aria-hidden="true" className="size-11" />
          ) : (
            <PeriodLink
              aria-label={`Previous ${noun}`}
              period={previous}
              variant="icon"
            >
              ←
            </PeriodLink>
          )}
          {next === undefined ? (
            <span aria-hidden="true" className="size-11" />
          ) : (
            <PeriodLink
              aria-label={`Next ${noun}`}
              period={next}
              variant="icon"
            >
              →
            </PeriodLink>
          )}
          {periodIncludes(period, today) ? null : (
            <PeriodLink
              className="ml-3"
              period={periodHolding(period.kind, today)}
              variant="quiet"
            >
              {`This ${noun}`}
            </PeriodLink>
          )}
        </div>
      </div>
    </header>
  );
};

const VersionNote = ({ view }: { readonly view: ReviewView }) => {
  const others = otherVersionDays(view.days);
  if (others.length === 0) {
    return null;
  }
  const comparable = comparableDays(view.days).length;
  return (
    <p className={[readingMeasureClass, 'mt-6 text-ink-muted'].join(' ')}>
      {`The metrics were measured differently on ${journalCountLabel(others.length, 'day')} of this period, and the dotted line marks where that changed. The totals and categories below use only the ${journalCountLabel(comparable, 'day')} measured under version ${comparisonVersion(view.days)}.`}
    </p>
  );
};

const MetricsSections = ({ view }: { readonly view: ReviewView }) => {
  const metrics = comparableDays(view.days);
  if (metrics.length === 0) {
    return (
      <Section title="Screen time">
        <p className={[readingMeasureClass, 'text-ink-muted'].join(' ')}>
          There is no report for any of these days, so there is nothing measured
          to show.
        </p>
      </Section>
    );
  }
  return (
    <>
      <Section title="Screen time">
        <ScreenTimeChart days={view.days} today={view.today} />
        <VersionNote view={view} />
        <div className="mt-10">
          <ReviewTotals metrics={metrics} />
        </div>
      </Section>
      <Section title="Where the screen time went">
        <p className={[readingMeasureClass, 'mb-6 text-ink-muted'].join(' ')}>
          Estimated. /wrap sorts the screen time into categories by what was on
          the screen, and the sorting is a guess.
        </p>
        <CategoryChart categories={categoryTotals(metrics)} />
      </Section>
    </>
  );
};

export const ReviewPage = ({ view }: { readonly view: ReviewView }) => {
  const started = view.days.some((day) => day.date <= view.today);
  return (
    <PageFrame>
      <ReviewHeader view={view} />
      {started ? (
        <>
          <Section title="How the days felt">
            <RatingChart days={view.days} today={view.today} />
            <div className="mt-8">
              <RatingCounts days={view.days} today={view.today} />
            </div>
          </Section>
          <MetricsSections view={view} />
          <Section title="Day by day">
            <ReviewTable days={view.days} today={view.today} />
          </Section>
        </>
      ) : (
        <p className={[readingMeasureClass, 'mt-10 text-ink-muted'].join(' ')}>
          {`This ${view.period.kind} has not started yet.`}
        </p>
      )}
    </PageFrame>
  );
};
