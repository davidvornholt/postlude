/**
 * The bodies of the three folds that pick something out rather than add
 * everything up: the records, the same stretch a year earlier, and how much
 * got written on the days that felt each way.
 *
 * A record is set the way the streaks are, as a large figure with its words
 * beneath, and every day or range it names is a link, because a highlight is
 * most worth something as the way back to the writing it points at.
 */

import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import { insightsSearch } from '../insights-address.ts';
import { energyLabel } from '../insights-labels.ts';
import type { EnergyWords } from '../insights-patterns.ts';
import { type InsightsRange, rangeLabel } from '../insights-range.ts';
import { type Records, recordDayLabel } from '../insights-records.ts';
import type { YearAgo } from '../insights-view.ts';
import type { JournalDate } from '../journal-day.ts';
import { journalCountLabel, journalNumberLabel } from '../journal-labels.ts';
import { DayLink } from './day-link.tsx';

const linkClass =
  'text-ink underline decoration-border underline-offset-4 hover:decoration-current';

const RecordFigure = ({
  label,
  figure,
  children,
}: {
  readonly label: string;
  readonly figure: string;
  readonly children: ReactNode;
}) => (
  <div>
    <dt className={[eyebrowClass, 'text-ink-faint'].join(' ')}>{label}</dt>
    <dd className="mt-3 font-display text-5xl text-ink tabular-nums">
      {figure}
    </dd>
    {children}
  </div>
);

const RangeLink = ({
  range,
  today,
  children,
}: {
  readonly range: InsightsRange;
  readonly today: JournalDate;
  readonly children: ReactNode;
}) => (
  <Link
    className={linkClass}
    search={insightsSearch(range, today)}
    to="/insights"
  >
    {children}
  </Link>
);

export const RecordFigures = ({
  records: { longest, ofAll, isRecord, fullest, withYear },
  today,
}: {
  readonly records: Records;
  readonly today: JournalDate;
}) => (
  <dl className="grid gap-10 sm:grid-cols-2 sm:gap-16">
    <RecordFigure
      figure={journalNumberLabel(longest.words)}
      label="Longest entry"
    >
      <dd className="mt-1 text-ink-muted">
        {longest.words === 1 ? 'word, on ' : 'words, on '}
        <DayLink
          className={linkClass}
          date={longest.date}
          today={today}
          variant="text"
        >
          {recordDayLabel(longest.date, withYear)}
        </DayLink>
      </dd>
      {isRecord ? (
        <dd className="mt-4 text-ink-faint text-sm">Your longest entry yet</dd>
      ) : null}
      {ofAll === undefined ? null : (
        <dd className="mt-4 text-ink-faint text-sm">
          {`Longest of all: ${journalCountLabel(ofAll.words, 'word')}, on `}
          <DayLink
            className={linkClass}
            date={ofAll.date}
            today={today}
            variant="text"
          >
            {recordDayLabel(ofAll.date, true)}
          </DayLink>
        </dd>
      )}
    </RecordFigure>
    {fullest === undefined ? null : (
      <RecordFigure
        figure={journalNumberLabel(fullest.written)}
        label="Fullest month"
      >
        <dd className="mt-1 text-ink-muted">
          {`of ${journalCountLabel(fullest.elapsed, 'day')} written in `}
          <RangeLink
            range={{ kind: 'month', month: fullest.month }}
            today={today}
          >
            {rangeLabel({ kind: 'month', month: fullest.month })}
          </RangeLink>
        </dd>
        <dd className="mt-4 text-ink-faint text-sm">
          {`${journalCountLabel(fullest.words, 'word')} in all`}
        </dd>
      </RecordFigure>
    )}
  </dl>
);

const cellClass = 'py-2 pr-4 text-right tabular-nums';

export const YearAgoTable = ({
  range,
  current,
  now,
  yearAgo,
  today,
}: {
  readonly range: InsightsRange;
  /** Whether the range is still going, so its row reads "so far". */
  readonly current: boolean;
  readonly now: {
    readonly elapsed: number;
    readonly written: number;
    readonly words: number;
  };
  readonly yearAgo: YearAgo;
  readonly today: JournalDate;
}) => {
  const rows = [
    {
      key: 'now',
      label: current ? `${rangeLabel(range)}, so far` : rangeLabel(range),
      ...now,
    },
    { key: 'then', label: rangeLabel(yearAgo.range), ...yearAgo },
  ];
  return (
    <>
      <table className="w-full max-w-xl border-collapse text-sm">
        <caption className="sr-only">
          This range beside the same range a year earlier
        </caption>
        <thead>
          <tr className="text-ink-faint">
            <th className="py-2 pr-4 text-left font-normal" scope="col">
              Range
            </th>
            <th className="py-2 pr-4 text-right font-normal" scope="col">
              Days written
            </th>
            <th className="py-2 text-right font-normal" scope="col">
              Words
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-border border-t" key={row.key}>
              <th
                className="py-2 pr-4 text-left font-normal text-ink"
                scope="row"
              >
                {row.label}
              </th>
              <td className={`${cellClass} text-ink`}>
                {`${journalNumberLabel(row.written)} of ${journalNumberLabel(row.elapsed)}`}
              </td>
              <td className="py-2 text-right text-ink-muted tabular-nums">
                {journalNumberLabel(row.words)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-sm">
        <RangeLink range={yearAgo.range} today={today}>
          {`Open ${rangeLabel(yearAgo.range)}`}
        </RangeLink>
      </p>
    </>
  );
};

export const EnergyWordsTable = ({
  rows,
}: {
  readonly rows: ReadonlyArray<EnergyWords>;
}) => (
  <table className="w-full max-w-xl border-collapse text-sm">
    <caption className="sr-only">
      Typical words on the written days rated at each energy
    </caption>
    <thead>
      <tr className="text-ink-faint">
        <th className="py-2 pr-4 text-left font-normal" scope="col">
          Felt
        </th>
        <th className="py-2 pr-4 text-right font-normal" scope="col">
          Written days
        </th>
        <th className="py-2 text-right font-normal" scope="col">
          Typical words
        </th>
      </tr>
    </thead>
    <tbody>
      {[...rows].reverse().map((row) => (
        <tr className="border-border border-t" key={row.energy}>
          <th className="py-2 pr-4 text-left font-normal text-ink" scope="row">
            {energyLabel(row.energy)}
          </th>
          <td className={`${cellClass} text-ink-muted`}>
            {journalNumberLabel(row.days)}
          </td>
          <td className="py-2 text-right text-ink tabular-nums">
            {journalNumberLabel(row.typicalWords)}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);
