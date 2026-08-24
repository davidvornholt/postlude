/**
 * Shaping the year of days into what the heatmap draws: columns of whole
 * weeks, the month labels that sit above them, and the summary a screen reader
 * gets in place of the grid.
 *
 * Month names are a fixed list rather than `Intl.DateTimeFormat`, because the
 * server rendering the page and the browser hydrating it must agree on every
 * character, and a formatter agrees only if both resolve the same locale data.
 */

import {
  type HeatLevel,
  heatLevel,
  type JournalDay,
  quartiles,
  writtenDays,
} from '#/features/design-comparison/archive-data.ts';
import { groupDigits } from '#/features/design-comparison/content.ts';

export type HeatmapCell = {
  readonly date: string;
  readonly level: HeatLevel;
};

export type MonthSegment = {
  readonly key: string;
  readonly label: string;
  readonly weeks: number;
};

type MonthActivity = {
  readonly date: string;
  readonly days: number;
  readonly written: number;
  readonly words: number;
};

const daysPerWeek = 7;
const isoYearEnd = 4;
const isoMonthStart = 5;
const isoMonthEnd = 7;
/** A month narrower than this cannot hold its own label without colliding. */
const minimumLabelledWeeks = 2;
const monthAbbreviationLength = 3;

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const monthKeyOf = (date: string): string =>
  date.slice(0, isoMonthEnd).replace('-', '');

const monthNameOf = (date: string): string =>
  monthNames[Number(date.slice(isoMonthStart, isoMonthEnd)) - 1] ?? '';

export const monthYearLabel = (date: string): string =>
  `${monthNameOf(date)} ${date.slice(0, isoYearEnd)}`;

export const heatmapWeeks = (
  days: ReadonlyArray<JournalDay>,
): ReadonlyArray<ReadonlyArray<HeatmapCell>> => {
  const thresholds = quartiles(days);
  const cells = days.map((day) => ({
    date: day.date,
    level: heatLevel(day.words, thresholds),
  }));
  return Array.from(
    { length: Math.ceil(cells.length / daysPerWeek) },
    (_unused, week) =>
      cells.slice(week * daysPerWeek, week * daysPerWeek + daysPerWeek),
  );
};

/**
 * One entry per run of weeks that belongs to the same month, in order, so the
 * label row can span each run across the columns it covers.
 */
export const monthSegments = (
  weeks: ReadonlyArray<ReadonlyArray<HeatmapCell>>,
): ReadonlyArray<MonthSegment> => {
  const segments: Array<MonthSegment> = [];
  for (const week of weeks) {
    const date = week[0]?.date ?? '';
    const key = monthKeyOf(date);
    const open = segments.at(-1);
    if (open?.key === key) {
      segments[segments.length - 1] = { ...open, weeks: open.weeks + 1 };
    } else {
      segments.push({
        key,
        label: monthNameOf(date).slice(0, monthAbbreviationLength),
        weeks: 1,
      });
    }
  }
  return segments.map((segment) =>
    segment.weeks >= minimumLabelledWeeks ? segment : { ...segment, label: '' },
  );
};

/**
 * The label each week column carries: the month's name on the column it starts
 * in, nothing on the rest. Labels are set above their own column and allowed to
 * run past it, which is why a month is only named where the next name is far
 * enough away to leave it room.
 */
export const monthColumnLabels = (
  weeks: ReadonlyArray<ReadonlyArray<HeatmapCell>>,
): ReadonlyArray<string> =>
  monthSegments(weeks).flatMap((segment) =>
    Array.from({ length: segment.weeks }, (_unused, week) =>
      week === 0 ? segment.label : '',
    ),
  );

/** What the grid says when it is read rather than looked at. */
export const activitySummary = (days: ReadonlyArray<JournalDay>): string => {
  const first = monthYearLabel(days[0]?.date ?? '');
  const last = monthYearLabel(days.at(-1)?.date ?? '');
  return `Journal activity from ${first} to ${last}: ${writtenDays(days).length} days written`;
};

/** Monthly distribution and volume, compact enough to replace 371 cells. */
export const activityDescription = (
  days: ReadonlyArray<JournalDay>,
): string => {
  const months: Array<MonthActivity> = [];
  for (const day of days) {
    const open = months.at(-1);
    const month = day.date.slice(0, isoMonthEnd);
    if (open?.date.slice(0, isoMonthEnd) === month) {
      months[months.length - 1] = {
        ...open,
        days: open.days + 1,
        written: open.written + Number(day.words > 0),
        words: open.words + day.words,
      };
    } else {
      months.push({
        date: day.date,
        days: 1,
        written: Number(day.words > 0),
        words: day.words,
      });
    }
  }

  return `Monthly breakdown. ${months
    .map(
      (month) =>
        `${monthYearLabel(month.date)}: ${month.written} of ${month.days} days written, ${groupDigits(month.words)} words`,
    )
    .join('. ')}.`;
};

/**
 * Rows are Sunday to Saturday. Only every other weekday is named — seven
 * labels at this size collide, and three are enough to read the column by.
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
