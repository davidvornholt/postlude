/**
 * Everything Insights holds beyond its opening sentence and picture, each in a
 * fold that says its one finding while it is closed.
 *
 * A fold is shown only when it has something to say about the range: no
 * streaks for a month that is over, no weekdays for a single week, no screen
 * time where /wrap stored no report, and none at all before anything is
 * stored. A page that lists every section whether or not it is empty is the
 * clutter this page is meant to leave behind.
 *
 * Folds are keyed by their names, so one the reader opened stays open while
 * they step to the next week or month and the same question is answered
 * again with new numbers.
 */

import type { ReactNode } from 'react';

import { readingMeasureClass } from '#/shared/ui/design-classes.ts';
import { activityCells } from '../activity-cells.ts';
import {
  comparableDays,
  comparisonVersion,
  measuresAnything,
  otherVersionDays,
  ratingCounts,
  tally,
} from '../day-measures.ts';
import { averageWrittenDayWords, entrySizeSeries } from '../entry-size.ts';
import { energyOptions } from '../evening-labels.ts';
import { durationLabel, energyLabel } from '../insights-labels.ts';
import {
  energyScreenTime,
  mostWrittenWeekday,
  pastDays,
  scriptureBookCounts,
  scriptureMornings,
  weekdayPatterns,
  writingSummary,
} from '../insights-patterns.ts';
import { rangeIncludes, rangeNoun } from '../insights-range.ts';
import type { InsightsView } from '../insights-view.ts';
import { journalCountLabel, journalWeekdayLabel } from '../journal-labels.ts';
import { CategoryChart } from './category-chart.tsx';
import { DayTable } from './day-table.tsx';
import { EnergyScreenTimeTable } from './energy-screen-time.tsx';
import { EntrySizeChart } from './entry-size-chart.tsx';
import { InsightFold } from './insight-fold.tsx';
import { RatingCounts } from './rating-counts.tsx';
import { ScreenTimeChart } from './screen-time-chart.tsx';
import { ScreenTimeTotals } from './screen-time-totals.tsx';
import { ScriptureBooks } from './scripture-books.tsx';
import { StreakPanel } from './streak-panel.tsx';
import { WeekdayPatternTable } from './weekday-pattern.tsx';

/** Under two weeks, a weekday has not come round often enough to compare. */
const weekdayMinimumDays = 14;
const daysPerWeek = 7;

type Fold = {
  readonly title: string;
  readonly takeaway: string;
  readonly body: ReactNode;
};

const Note = ({ children }: { readonly children: ReactNode }) => (
  <p className={[readingMeasureClass, 'mt-6 text-ink-muted text-sm'].join(' ')}>
    {children}
  </p>
);

const ratingsTakeaway = (
  rated: number,
  share: string,
  mostly: string | undefined,
): string => {
  if (rated === 0) {
    return 'No day rated yet';
  }
  return mostly === undefined ? share : `Mostly ${mostly} · ${share}`;
};

const ratingsFold = (view: InsightsView): Fold | undefined => {
  const past = pastDays(view.days, view.today);
  if (past.length === 0) {
    return;
  }
  // A day counts as rated once any of its three answers is given, as the
  // fold's counts show each answer on its own.
  const rated = past.filter(
    (day) =>
      day.energy !== null || day.progress !== null || day.repeatDay !== null,
  ).length;
  const { counts } = ratingCounts(
    view.days,
    view.today,
    energyOptions.map((option) => option.value),
    (day) => day.energy,
  );
  const [mostly] = [...energyOptions]
    .reverse()
    .map((option) => ({ ...option, count: counts.get(option.value) ?? 0 }))
    .filter((option) => option.count > 0)
    .sort((first, second) => second.count - first.count);
  const share = `${rated} of ${journalCountLabel(past.length, 'day')} rated`;
  return {
    title: 'Ratings',
    takeaway: ratingsTakeaway(rated, share, mostly?.label.toLowerCase()),
    body: <RatingCounts days={view.days} today={view.today} />,
  };
};

const streaksFold = (view: InsightsView): Fold | undefined => {
  if (
    !rangeIncludes(view.range, view.today) ||
    view.journalStreak.longest + view.scriptureStreak.longest === 0
  ) {
    return;
  }
  const evenings = view.journalStreak.current;
  const mornings = view.scriptureStreak.current;
  // "0 evenings and 0 mornings in a row" reads as a reproach; the longest run
  // is the finding when there is no current one.
  return {
    title: 'Streaks',
    takeaway:
      evenings + mornings === 0
        ? `No run going · longest ${journalCountLabel(view.journalStreak.longest, 'evening')}`
        : `${journalCountLabel(evenings, 'evening')} and ${journalCountLabel(mornings, 'morning')} in a row`,
    body: (
      <StreakPanel
        journal={view.journalStreak}
        scripture={view.scriptureStreak}
      />
    ),
  };
};

const weekdaysFold = (view: InsightsView): Fold | undefined => {
  const summary = writingSummary(view.days, view.today);
  if (
    view.range.kind === 'week' ||
    summary.elapsed < weekdayMinimumDays ||
    summary.written === 0
  ) {
    return;
  }
  const patterns = weekdayPatterns(view.days, view.today);
  const most = mostWrittenWeekday(patterns);
  return {
    title: 'Weekdays',
    takeaway:
      most === undefined
        ? 'Written evenly across the week'
        : `Most often written on ${journalWeekdayLabel((most + 1) % daysPerWeek)}s`,
    body: (
      <>
        <WeekdayPatternTable patterns={patterns} />
        <Note>
          Words is the middle length of a written day, so one long evening does
          not lift it. Fresh is the share of rated days that felt fresh.
        </Note>
      </>
    ),
  };
};

const entryLengthFold = (view: InsightsView): Fold | undefined => {
  const past = pastDays(view.days, view.today);
  const first = past[0]?.date;
  const last = past.at(-1)?.date;
  if (view.range.kind === 'week' || first === undefined || last === undefined) {
    return;
  }
  const cells = activityCells(view.days, { from: first, to: last }, view.today);
  const average = averageWrittenDayWords(entrySizeSeries(cells));
  if (average === undefined) {
    return;
  }
  return {
    title: 'Entry length',
    takeaway: `${journalCountLabel(average, 'word')} on an average written day`,
    body: <EntrySizeChart cells={cells} />,
  };
};

const scriptureFold = (view: InsightsView): Fold | undefined => {
  const mornings = scriptureMornings(view.days, view.today);
  if (mornings === 0) {
    return;
  }
  const books = scriptureBookCounts(view.days, view.today);
  const [top] = books;
  return {
    title: 'Scripture',
    takeaway:
      top === undefined
        ? `${journalCountLabel(mornings, 'morning')} with scripture`
        : `${journalCountLabel(mornings, 'morning')} with scripture, most often ${top.book}`,
    body:
      books.length === 0 ? (
        <Note>No passage was named on these mornings, only notes.</Note>
      ) : (
        <ScriptureBooks books={books} />
      ),
  };
};

const VersionNote = ({ view }: { readonly view: InsightsView }) => {
  const others = otherVersionDays(view.days);
  if (others.length === 0) {
    return null;
  }
  const comparable = comparableDays(view.days).length;
  const noun = rangeNoun(view.range.kind);
  const marked =
    view.range.kind === 'week' || view.range.kind === 'month'
      ? ', and the dotted line marks where that changed'
      : '';
  return (
    <Note>
      {`The metrics were measured differently on ${journalCountLabel(others.length, 'day')} of this ${noun}${marked}. The totals use only the ${journalCountLabel(comparable, 'day')} measured under version ${comparisonVersion(view.days)}.`}
    </Note>
  );
};

const screenTimeFolds = (view: InsightsView): ReadonlyArray<Fold> => {
  const metrics = comparableDays(view.days);
  if (!measuresAnything(metrics)) {
    return [];
  }
  const active = tally(metrics, (day) => day.activeMinutes);
  // Without screen time the fold stays for the other totals /wrap measured.
  const daily =
    active.measured > 0 &&
    (view.range.kind === 'week' || view.range.kind === 'month');
  const folds: Array<Fold> = [
    {
      title: 'Screen time',
      takeaway:
        active.measured === 0
          ? `Not measured · other totals from ${journalCountLabel(metrics.length, 'report')}`
          : `${durationLabel(Math.round(active.total / active.measured))} on an average measured day`,
      body: (
        <>
          {daily ? (
            <div className="mb-10">
              <ScreenTimeChart days={view.days} today={view.today} />
            </div>
          ) : null}
          <ScreenTimeTotals metrics={metrics} />
          <VersionNote view={view} />
        </>
      ),
    },
  ];
  // A category without measured minutes cannot be where most of it went.
  const largest = view.categories.find(
    (category) => category.minutes !== null && category.minutes > 0,
  );
  if (largest !== undefined) {
    folds.push({
      title: 'Where it went',
      takeaway: `Most of it: ${largest.label}`,
      body: (
        <>
          <p className={[readingMeasureClass, 'mb-6 text-ink-muted'].join(' ')}>
            Estimated. /wrap sorts the screen time into categories by what was
            on the screen, and the sorting is a guess.
          </p>
          <CategoryChart categories={view.categories} />
        </>
      ),
    });
  }
  const byEnergy = energyScreenTime(view.days);
  const [lowest] = byEnergy;
  const highest = byEnergy.at(-1);
  if (byEnergy.length >= 2 && lowest !== undefined && highest !== undefined) {
    folds.push({
      title: 'Energy and screens',
      takeaway: `${energyLabel(highest.energy)} days ${durationLabel(highest.activeMinutes)}, ${energyLabel(lowest.energy).toLowerCase()} days ${durationLabel(lowest.activeMinutes)}`,
      body: (
        <>
          <EnergyScreenTimeTable rows={byEnergy} />
          <Note>
            The average time at the screen on the days that felt each way, set
            side by side and left for you to read.
          </Note>
        </>
      ),
    });
  }
  return folds;
};

const dayByDayFold = (view: InsightsView): Fold | undefined =>
  view.range.kind === 'week' || view.range.kind === 'month'
    ? {
        title: 'Day by day',
        takeaway: `Each day's ratings and measures`,
        body: <DayTable days={view.days} today={view.today} />,
      }
    : undefined;

export const InsightsFolds = ({ view }: { readonly view: InsightsView }) => {
  // A journal with nothing stored has nothing to fold away; the opening
  // sentence says so, and a list of empty sections would only repeat it.
  if (view.earliest === undefined) {
    return null;
  }
  const folds = [
    ratingsFold(view),
    streaksFold(view),
    weekdaysFold(view),
    entryLengthFold(view),
    scriptureFold(view),
    ...screenTimeFolds(view),
    dayByDayFold(view),
  ].flatMap((fold) => (fold === undefined ? [] : [fold]));
  if (folds.length === 0) {
    return null;
  }
  return (
    <div className="border-border border-b">
      {folds.map((fold) => (
        <InsightFold
          key={fold.title}
          takeaway={fold.takeaway}
          title={fold.title}
        >
          {fold.body}
        </InsightFold>
      ))}
    </div>
  );
};
