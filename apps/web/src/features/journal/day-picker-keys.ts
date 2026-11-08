/**
 * Where a key moves the day a calendar popover has in hand. The keys are the
 * ones every date grid shares: arrows by a day or a week, Home and End to the
 * week's edges, Page Up and Page Down by a month, and with Shift by a year.
 *
 * A move never leaves the dates the journal can hold. One that would stops on
 * the first or last of them, and a month that has no such day keeps the
 * nearest one it has, so the 31st moved a month on becomes the 30th.
 */

import {
  calendarWeekdayIndex,
  datesInMonth,
  type JournalMonth,
  journalMonthOf,
  shiftJournalMonth,
} from './calendar.ts';
import {
  daysBetweenJournalDates,
  earliestJournalDate,
  type JournalDate,
  latestJournalDate,
  shiftJournalDate,
} from './journal-day.ts';

const week = 7;
const monthsPerYear = 12;
const lastColumn = week - 1;

/** The day `days` away, stopped at the journal's first or last day. */
export const stepJournalDate = (
  date: JournalDate,
  days: number,
): JournalDate => {
  if (days < 0 && daysBetweenJournalDates(earliestJournalDate, date) < -days) {
    return earliestJournalDate;
  }
  if (days > 0 && daysBetweenJournalDates(date, latestJournalDate) < days) {
    return latestJournalDate;
  }
  return shiftJournalDate(date, days);
};

/** The same day of the month in another month, or that month's last day. */
export const sameDayIn = (
  date: JournalDate,
  month: JournalMonth,
): JournalDate => {
  const dates = datesInMonth(month);
  const day = Number(date.slice(-2));
  return dates[Math.min(day, dates.length) - 1] ?? date;
};

/** The same day `months` away, or the day itself past the journal's ends. */
export const stepJournalMonth = (
  date: JournalDate,
  months: number,
): JournalDate => {
  const month = shiftJournalMonth(journalMonthOf(date), months);
  return month === undefined ? date : sameDayIn(date, month);
};

/** The day a key moves to, or undefined when the key moves nothing. */
export const dayPickerTarget = (
  key: string,
  shift: boolean,
  date: JournalDate,
): JournalDate | undefined => {
  switch (key) {
    case 'ArrowLeft':
      return stepJournalDate(date, -1);
    case 'ArrowRight':
      return stepJournalDate(date, 1);
    case 'ArrowUp':
      return stepJournalDate(date, -week);
    case 'ArrowDown':
      return stepJournalDate(date, week);
    case 'Home':
      return stepJournalDate(date, -calendarWeekdayIndex(date));
    case 'End':
      return stepJournalDate(date, lastColumn - calendarWeekdayIndex(date));
    case 'PageUp':
      return stepJournalMonth(date, shift ? -monthsPerYear : -1);
    case 'PageDown':
      return stepJournalMonth(date, shift ? monthsPerYear : 1);
    default:
      return undefined;
  }
};
