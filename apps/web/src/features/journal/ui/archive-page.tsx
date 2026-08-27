/**
 * The archive: how the journal has actually been going.
 *
 * It reads top to bottom as three answers to three different questions. The
 * streaks say how it is going now. The map says how the year went. "On this
 * day" says what the writer was thinking about a year ago, which is the only
 * part of the page that is there to be read rather than measured.
 *
 * This is the one page that takes the wider measure: a year of days is 53
 * columns and does not fit the text column. The prose inside it still keeps to
 * a readable width of its own rather than running the full 53 columns.
 *
 * A journal with nothing in it gets one sentence instead of four empty
 * sections. Everything on this page is a reading of days that exist, and a
 * grid of 371 outlines under two zeroes says nothing except that the writer has
 * not started.
 */

import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { eyebrowClass, wideColumnClass } from '#/shared/ui/design-classes.ts';
import {
  navLinkActiveClass,
  navLinkClass,
  navLinkInactiveClass,
} from '#/shared/ui/form-classes.ts';
import { activityCells } from '../activity.ts';
import { groupDigits, monthYearLabel } from '../activity-labels.ts';
import type { ArchiveView } from '../services/archive-fns.ts';
import { ActivityMap } from './activity-map.tsx';
import { OnThisDay } from './on-this-day.tsx';
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
};

export const ArchivePage = ({ view, selectedYear }: ArchivePageProps) => {
  const cells = activityCells(view.days, view.window);
  const written = view.totals.daysWritten;
  const journalIsEmpty = view.years.length === 0;

  return (
    <div className={wideColumnClass}>
      <h1 className={headingClass}>Archive</h1>
      {journalIsEmpty ? (
        <p className="mt-8 max-w-prose border-border border-t pt-8 text-ink-muted text-lg">
          Nothing has been written yet. The streaks, the year of days, and the
          entries from earlier years all appear here as the journal fills up.
        </p>
      ) : (
        <>
          <p className="mt-4 max-w-prose text-ink-muted text-lg">
            {`${groupDigits(written)} days written, ${groupDigits(view.totals.words)} words in all.`}
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

          {view.anniversaries.length === 0 ? null : (
            <Section title="On this day">
              <OnThisDay
                anniversaries={view.anniversaries}
                today={view.today}
              />
            </Section>
          )}
        </>
      )}
    </div>
  );
};
