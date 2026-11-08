/**
 * The words the activity map is read by rather than looked at: the month names
 * above the columns, the weekday hints beside the rows, and the summary and
 * monthly breakdown that stand in for a year of unlabelled squares.
 *
 * Month names are a fixed list rather than `Intl.DateTimeFormat`, because the
 * server rendering the page and the browser hydrating it have to agree on every
 * character, and a formatter agrees only if both resolve the same locale data.
 * The number formatter is fixed to one locale for the same reason.
 */

import type { ActivityCell } from './activity-cells.ts';
import { journalDateLabel } from './day-label.ts';
import { energyOptions, progressOptions } from './evening-labels.ts';
import { energyLabel, progressLabel } from './insights-labels.ts';
import type { InsightsMeasure } from './insights-measure.ts';
import { type JournalDate, parseJournalDate } from './journal-day.ts';
import {
  journalCountLabel,
  journalMonthLabel,
  journalNumberLabel,
} from './journal-labels.ts';

type ActivityDayCell = Extract<ActivityCell, { readonly kind: 'day' }>;

const isoMonthEnd = 7;
const isoDayStart = 8;
const firstDayOfMonth = '01';
const monthAbbreviationLength = 3;

const measureNames: Record<InsightsMeasure, string> = {
  writing: 'words written',
  energy: 'energy',
  progress: 'progress',
};

const monthNameOf = (date: JournalDate): string =>
  journalMonthLabel(parseJournalDate(date).month);

export const monthYearLabel = (date: JournalDate): string => {
  const { year } = parseJournalDate(date);
  return `${monthNameOf(date)} ${year}`;
};

/**
 * The label each week column carries: the name of the month whose first day is
 * in that week, and nothing on the rest. When a week crosses a month boundary,
 * the first day wins over the month containing the Monday that opened it.
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
export const activitySummary = (
  cells: ReadonlyArray<ActivityCell>,
  measure: InsightsMeasure = 'writing',
): string => {
  const days = cells.filter((cell) => cell.kind === 'day');
  const [first] = days;
  const last = days.at(-1);
  if (first === undefined || last === undefined) {
    return 'Journal activity: this range has not started';
  }
  const written = days.filter((cell) => cell.words > 0).length;
  return `Journal activity from ${monthYearLabel(first.date)} to ${monthYearLabel(last.date)}, shaded by ${measureNames[measure]}: ${journalCountLabel(written, 'day')} written`;
};

/** A day in one line: its date, its words, and whatever it was rated. */
export const activityDayDetails = (cell: ActivityDayCell): string =>
  [
    journalDateLabel(cell.date),
    cell.words === 0 ? 'No writing' : journalCountLabel(cell.words, 'word'),
    cell.energy === null
      ? undefined
      : `Energy ${energyLabel(cell.energy).toLowerCase()}`,
    cell.progress === null
      ? undefined
      : `Progress ${progressLabel(cell.progress).toLowerCase()}`,
  ]
    .filter((part) => part !== undefined)
    .join(' · ');

const monthsOf = (
  cells: ReadonlyArray<ActivityCell>,
): ReadonlyArray<ReadonlyArray<ActivityDayCell>> => {
  const months: Array<Array<ActivityDayCell>> = [];
  for (const cell of cells) {
    if (cell.kind === 'day') {
      const open = months.at(-1);
      if (
        open?.[0]?.date.slice(0, isoMonthEnd) ===
        cell.date.slice(0, isoMonthEnd)
      ) {
        open.push(cell);
      } else {
        months.push([cell]);
      }
    }
  }
  return months;
};

const answerCounts = <Value extends string>(
  days: ReadonlyArray<ActivityDayCell>,
  options: ReadonlyArray<{ readonly value: Value; readonly label: string }>,
  pick: (day: ActivityDayCell) => Value | null,
): string => {
  const unrated = days.filter((day) => pick(day) === null).length;
  return [
    ...[...options]
      .reverse()
      .map(
        (option) =>
          `${option.label.toLowerCase()} ${journalNumberLabel(days.filter((day) => pick(day) === option.value).length)}`,
      ),
    `not rated ${journalNumberLabel(unrated)}`,
  ].join(', ');
};

const monthLine = (
  days: ReadonlyArray<ActivityDayCell>,
  measure: InsightsMeasure,
): string => {
  const written = days.filter((day) => day.words > 0).length;
  const words = days.reduce((total, day) => total + day.words, 0);
  switch (measure) {
    case 'energy':
      return `energy ${answerCounts(days, energyOptions, (day) => day.energy)}`;
    case 'progress':
      return `progress ${answerCounts(days, progressOptions, (day) => day.progress)}`;
    default:
      return `${journalCountLabel(written, 'day')} written out of ${journalCountLabel(days.length, 'day')}, ${journalCountLabel(words, 'word')}`;
  }
};

/** The month-by-month breakdown that stands in for the squares. */
export const activityDescription = (
  cells: ReadonlyArray<ActivityCell>,
  measure: InsightsMeasure = 'writing',
): string => {
  const months = monthsOf(cells);
  if (months.length === 0) {
    return 'This range has not started.';
  }
  return `Monthly breakdown. ${months
    .map(
      (days) =>
        `${monthYearLabel(days[0]?.date ?? '')}: ${monthLine(days, measure)}`,
    )
    .join('. ')}.`;
};

/**
 * Rows are Monday to Sunday, as on the calendar. Only every other weekday is
 * named — seven labels at this size collide, and three are enough to read the
 * column by.
 */
export const weekdayRows = [
  { name: 'Monday', hint: 'Mon' },
  { name: 'Tuesday', hint: '' },
  { name: 'Wednesday', hint: 'Wed' },
  { name: 'Thursday', hint: '' },
  { name: 'Friday', hint: 'Fri' },
  { name: 'Saturday', hint: '' },
  { name: 'Sunday', hint: '' },
] as const;
