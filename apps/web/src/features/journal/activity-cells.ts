/** The calendar cells that turn journal activity into a week-aligned grid. */

import {
  type ActivityDay,
  type ActivityWindow,
  dayWords,
  type HeatLevel,
  heatLevel,
  quartiles,
} from './activity.ts';
import {
  type JournalDate,
  journalDateWeekday,
  shiftJournalDate,
} from './journal-day.ts';

export type ActivityCell =
  | {
      readonly kind: 'day';
      readonly date: JournalDate;
      readonly words: number;
      readonly level: HeatLevel;
    }
  | {
      /** Keeps the calendar grid aligned without calling an un-lived day empty. */
      readonly kind: 'future-padding';
      readonly date: JournalDate;
    };

/**
 * Every day of the window in calendar order. Future dates remain padding, so
 * the calendar keeps its week columns without counting an un-lived day as
 * empty.
 */
export const activityCells = (
  days: ReadonlyArray<ActivityDay>,
  window: ActivityWindow,
  today: JournalDate,
): ReadonlyArray<ActivityCell> => {
  const visibleDays = days.filter(
    (day) =>
      day.date >= window.from && day.date <= window.to && day.date <= today,
  );
  const thresholds = quartiles(visibleDays);
  const byDate = new Map(visibleDays.map((day) => [day.date, day]));
  const cells: Array<ActivityCell> = [];
  for (
    let date = window.from;
    date <= window.to;
    date = shiftJournalDate(date, 1)
  ) {
    if (date > today) {
      cells.push({ kind: 'future-padding', date });
    } else {
      const day = byDate.get(date);
      const words = day === undefined ? 0 : dayWords(day);
      cells.push({
        kind: 'day',
        date,
        words,
        level: heatLevel(words, thresholds),
      });
    }
  }
  return cells;
};

const daysPerWeek = 7;

/** The cells as calendar-week columns, including a clipped first week. */
export const activityWeeks = (
  cells: ReadonlyArray<ActivityCell>,
): ReadonlyArray<ReadonlyArray<ActivityCell>> => {
  const [first] = cells;
  if (first === undefined) {
    return [];
  }
  const firstWeekLength = daysPerWeek - journalDateWeekday(first.date);
  const weeks: Array<ReadonlyArray<ActivityCell>> = [
    cells.slice(0, firstWeekLength),
  ];
  for (
    let offset = firstWeekLength;
    offset < cells.length;
    offset += daysPerWeek
  ) {
    weeks.push(cells.slice(offset, offset + daysPerWeek));
  }
  return weeks;
};
