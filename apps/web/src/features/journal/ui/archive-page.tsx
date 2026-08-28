/**
 * The archive: how the journal has actually been going.
 *
 * It reads top to bottom as answers to different questions. The streaks say how
 * it is going now. The map says how the year went. Nothing here is an entry:
 * reading what was written belongs to the day it was written on, which is why
 * the years behind a date are shown on that date's own page rather than here.
 * The download at the foot is the one thing that is not a reading of the
 * journal at all — it is the way out, and it sits under the measurements
 * because it belongs to the same question, what is in here, rather than to the
 * writing.
 *
 * A year of days is 53 columns wide, and it is what set the page frame every
 * page now shares. The prose inside it still keeps to a reading measure of its
 * own rather than running the full 53 columns.
 *
 * A journal with no activity gets one sentence instead of three empty reading
 * sections. Export availability is separate: Markdown structure and whitespace
 * can still be recoverable source even when they produce no activity year.
 */

import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import {
  eyebrowClass,
  pageFrameClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import {
  navLinkActiveClass,
  navLinkClass,
  navLinkInactiveClass,
} from '#/shared/ui/form-classes.ts';
import { activityCells } from '../activity-cells.ts';
import { monthYearLabel } from '../activity-labels.ts';
import { journalCountLabel } from '../journal-labels.ts';
import type { ArchiveView } from '../services/archive-fns.ts';
import { ActivityMap } from './activity-map.tsx';
import { EntrySizeChart } from './entry-size-chart.tsx';
import { ExportControl, type SettleAutosaves } from './export-control.tsx';
import { StreakPanel } from './streak-panel.tsx';

const headingClass = 'font-display text-4xl text-ink sm:text-5xl';
const sectionHeadingClass = [eyebrowClass, 'text-ink-muted'].join(' ');
const archiveYearDigits = 4;
const archiveYearLabel = (year: number): string =>
  String(year).padStart(archiveYearDigits, '0');

const Section = ({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) => (
  <section className="mt-12 border-border border-t pt-8 sm:mt-16">
    <h2 className={sectionHeadingClass}>{title}</h2>
    <div className="mt-8">{children}</div>
  </section>
);

/**
 * The years the map can be pointed at. "Past year" is the rolling window and
 * carries no year in the address, so the plain `/archive` and the view the
 * writer lands on are the same page rather than two that have to agree.
 */
const YearNav = ({
  years,
  selected,
}: {
  readonly years: ReadonlyArray<number>;
  readonly selected: number | undefined;
}) => {
  const availableYears =
    selected === undefined || years.includes(selected)
      ? years
      : [...years, selected].sort((first, second) => second - first);

  return (
    <nav aria-label="Activity years">
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {[undefined, ...availableYears].map((year) => {
          const current = year === selected;
          return (
            <li key={year ?? 'rolling'}>
              <Link
                activeOptions={{ exact: true, includeSearch: true }}
                aria-current={current ? 'page' : undefined}
                className={[
                  navLinkClass,
                  current ? navLinkActiveClass : navLinkInactiveClass,
                ].join(' ')}
                search={year === undefined ? {} : { year }}
                to="/archive"
              >
                {year === undefined ? 'Past year' : archiveYearLabel(year)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

type ArchivePageProps = {
  readonly view: ArchiveView;
  /** The year in the address, absent when the map shows the rolling year. */
  readonly selectedYear: number | undefined;
  readonly settleAutosaves?: SettleAutosaves;
};

export const ArchivePage = ({
  view,
  selectedYear,
  settleAutosaves,
}: ArchivePageProps) => {
  const cells = activityCells(view.days, view.window, view.today);
  const written = view.totals.daysWritten;
  const journalIsEmpty = view.years.length === 0;

  return (
    <div className={pageFrameClass}>
      <h1 className={headingClass}>Archive</h1>
      {journalIsEmpty ? (
        <p
          className={[
            readingMeasureClass,
            'mt-8 border-border border-t pt-8 text-ink-muted text-lg',
          ].join(' ')}
        >
          No writing activity yet. The streaks, the year of days, and entries
          appear once a day contains prose or a scripture reference.
        </p>
      ) : (
        <>
          <p
            className={[
              readingMeasureClass,
              'mt-4 text-ink-muted text-lg',
            ].join(' ')}
          >
            {`${journalCountLabel(written, 'day')} written, ${journalCountLabel(view.totals.words, 'word')} in all.`}
          </p>

          <Section title="Streaks">
            <StreakPanel
              journal={view.journalStreak}
              scripture={view.scriptureStreak}
            />
          </Section>

          <Section title="Activity">
            <YearNav selected={selectedYear} years={view.years} />
            <p className="mt-8 text-ink-faint">
              {`${monthYearLabel(view.window.from)} to ${monthYearLabel(view.window.to)}`}
            </p>
            <div className="mt-4">
              <ActivityMap cells={cells} today={view.today} />
            </div>
          </Section>

          <Section title="Entry length">
            <p className={[readingMeasureClass, 'text-ink-muted'].join(' ')}>
              Each vertical mark is one day. The green line shows the trailing
              seven-day average, including days without writing.
            </p>
            <div className="mt-8">
              <EntrySizeChart cells={cells} />
            </div>
          </Section>
        </>
      )}
      {view.exportAvailable ? (
        <Section title="Your own copy">
          <ExportControl settleAutosaves={settleAutosaves} />
        </Section>
      ) : null}
    </div>
  );
};
