/**
 * The day columns every review chart shares, so a day sits at the same place
 * in each of them and they can be read down the page as well as across.
 */

import type { ReactNode } from 'react';

import { calendarWeekdayIndex } from '../calendar.ts';
import { type JournalDate, parseJournalDate } from '../journal-day.ts';
import { weekdayAbbreviation } from '../review-labels.ts';
import { dayColumnsClass } from './review-day-columns.ts';

const daysPerWeek = 7;

export const ChartRow = ({
  scale,
  children,
}: {
  readonly scale: ReactNode;
  readonly children: ReactNode;
}) => (
  <div className="flex gap-3">
    <div
      aria-hidden="true"
      className="relative w-14 shrink-0 text-ink-faint text-xs"
    >
      {scale}
    </div>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

/**
 * A week has room to name each day. A month on a narrow screen keeps only its
 * Mondays, which still say where each week starts.
 */
export const DayAxis = ({
  dates,
  today,
}: {
  readonly dates: ReadonlyArray<JournalDate>;
  readonly today: JournalDate;
}) => {
  const week = dates.length <= daysPerWeek;
  return (
    <div
      aria-hidden="true"
      className={[
        'mt-2 grid text-center text-ink-faint text-xs tabular-nums',
        dayColumnsClass(dates.length),
      ].join(' ')}
    >
      {dates.map((date) => {
        const { day } = parseJournalDate(date);
        const monday = calendarWeekdayIndex(date) === 0;
        return (
          <span
            className={[
              date === today ? 'font-semibold text-ink' : '',
              week || monday || day === 1 ? '' : 'invisible sm:visible',
            ].join(' ')}
            key={date}
          >
            {week ? (
              <>
                <span className="block">{weekdayAbbreviation(date)}</span>
                <span className="block">{day}</span>
              </>
            ) : (
              day
            )}
          </span>
        );
      })}
    </div>
  );
};
