/**
 * The words the activity map is read by rather than looked at: the month names
 * above the columns, the weekday hints beside the rows, and the summary and
 * monthly breakdown that stand in for 371 unlabelled squares.
 *
 * Month names are a fixed list rather than `Intl.DateTimeFormat`, because the
 * server rendering the page and the browser hydrating it have to agree on every
 * character, and a formatter agrees only if both resolve the same locale data.
 * The number formatter is fixed to one locale for the same reason.
 */

import type { HeatLevel } from './activity.ts';
import type { ActivityCell } from './activity-cells.ts';
import { journalMonthLabel, journalNumberLabel } from './journal-labels.ts';

type MonthActivity = {
  readonly date: string;
  readonly days: number;
  readonly written: number;
  readonly words: number;
};

const isoYearEnd = 4;
const isoMonthStart = 5;
const isoMonthEnd = 7;
const isoDayStart = 8;
const firstDayOfMonth = '01';
const monthAbbreviationLength = 3;

export const heatLevelLabels: Record<HeatLevel, string> = {
  none: 'Nothing written',
  q1: 'Lowest quarter',
  q2: 'Lower-middle quarter',
  q3: 'Upper-middle quarter',
  q4: 'Highest quarter',
};

const monthNameOf = (date: string): string =>
  journalMonthLabel(Number(date.slice(isoMonthStart, isoMonthEnd)));

export const monthYearLabel = (date: string): string =>
  `${monthNameOf(date)} ${date.slice(0, isoYearEnd)}`;

/**
 * The label each week column carries: the name of the month whose first day is
 * in that week, and nothing on the rest. When a week crosses a month boundary,
 * the first day wins over the month containing the Sunday that opened it.
 */
export const monthColumnLabels = (
  weeks: ReadonlyArray<ReadonlyArray<ActivityCell>>,
): ReadonlyArray<string> =>
  weeks.map((week) => {
    const first = week.find(
      (cell) => cell.date.slice(isoDayStart) === firstDayOfMonth,
    );
    return first === undefined
      ? ''
      : monthNameOf(first.date).slice(0, monthAbbreviationLength);
  });

/** What the grid says when it is read rather than looked at. */
export const activitySummary = (cells: ReadonlyArray<ActivityCell>): string => {
  const days = cells.filter((cell) => cell.kind === 'day');
  const [first] = days;
  const last = days.at(-1);
  if (first === undefined || last === undefined) {
    return 'Journal activity: this range has not started';
  }
  const written = days.filter((cell) => cell.words > 0).length;
  return `Journal activity from ${monthYearLabel(first.date)} to ${monthYearLabel(last.date)}: ${written} days written`;
};

/** Monthly distribution and volume, compact enough to replace 371 cells. */
export const activityDescription = (
  cells: ReadonlyArray<ActivityCell>,
): string => {
  const months: Array<MonthActivity> = [];
  for (const cell of cells) {
    if (cell.kind === 'day') {
      const month = cell.date.slice(0, isoMonthEnd);
      const open = months.at(-1);
      if (open?.date.slice(0, isoMonthEnd) === month) {
        months[months.length - 1] = {
          ...open,
          days: open.days + 1,
          written: open.written + Number(cell.words > 0),
          words: open.words + cell.words,
        };
      } else {
        months.push({
          date: cell.date,
          days: 1,
          written: Number(cell.words > 0),
          words: cell.words,
        });
      }
    }
  }

  if (months.length === 0) {
    return 'This range has not started.';
  }

  return `Monthly breakdown. ${months
    .map(
      (month) =>
        `${monthYearLabel(month.date)}: ${journalNumberLabel(month.written)} of ${journalNumberLabel(month.days)} days written, ${journalNumberLabel(month.words)} words`,
    )
    .join('. ')}.`;
};

/**
 * Rows are Sunday to Saturday. Only every other weekday is named — seven labels
 * at this size collide, and three are enough to read the column by.
 */
export const weekdayRows = [
  { name: 'Sunday', hint: '' },
  { name: 'Monday', hint: 'Mon' },
  { name: 'Tuesday', hint: '' },
  { name: 'Wednesday', hint: 'Wed' },
  { name: 'Thursday', hint: '' },
  { name: 'Friday', hint: 'Fri' },
  { name: 'Saturday', hint: '' },
] as const;
