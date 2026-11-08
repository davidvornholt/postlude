/**
 * The calendar cells that turn a stretch of the journal into a week-aligned
 * grid, coloured by one measure at a time.
 *
 * Weeks run Monday to Sunday, as the calendar's rows do, so a day sits in the
 * same row here as it does on the calendar page.
 */

import { dayWords, heatLevel, quartiles, type WordCounts } from './activity.ts';
import { calendarWeekdayIndex } from './calendar.ts';
import {
  energyOptions,
  progressOptions,
  ratingStepOf,
} from './evening-labels.ts';
import type { InsightsMeasure, Shade } from './insights-measure.ts';
import { type JournalDate, shiftJournalDate } from './journal-day.ts';
import type { Energy, Progress } from './schemas/day-rating.ts';

/** What a cell needs from a day: its words and its ratings. */
export type ActivitySource = WordCounts & {
  readonly date: JournalDate;
  readonly energy: Energy | null;
  readonly progress: Progress | null;
};

export type ActivityCell =
  | {
      readonly kind: 'day';
      readonly date: JournalDate;
      readonly words: number;
      readonly energy: Energy | null;
      readonly progress: Progress | null;
      /** What the square is filled with, for the measure on show. */
      readonly shade: Shade;
    }
  | {
      /** Keeps the calendar grid aligned without calling an un-lived day empty. */
      readonly kind: 'future-padding';
      readonly date: JournalDate;
    };

export type ActivityStretch = {
  readonly from: JournalDate;
  readonly to: JournalDate;
};

const shadeOf = (
  measure: InsightsMeasure,
  day: ActivitySource | undefined,
  words: number,
  thresholds: readonly [number, number, number],
): Shade => {
  switch (measure) {
    case 'energy':
      return ratingStepOf(energyOptions, day?.energy ?? null) ?? 'none';
    case 'progress':
      return ratingStepOf(progressOptions, day?.progress ?? null) ?? 'none';
    default:
      return heatLevel(words, thresholds);
  }
};

/**
 * Every day of the stretch in calendar order. Future dates remain padding, so
 * the calendar keeps its week columns without counting an un-lived day as
 * empty.
 */
export const activityCells = (
  days: ReadonlyArray<ActivitySource>,
  stretch: ActivityStretch,
  today: JournalDate,
  measure: InsightsMeasure = 'writing',
): ReadonlyArray<ActivityCell> => {
  const visibleDays = days.filter(
    (day) =>
      day.date >= stretch.from && day.date <= stretch.to && day.date <= today,
  );
  const thresholds = quartiles(visibleDays);
  const byDate = new Map(visibleDays.map((day) => [day.date, day]));
  const cells: Array<ActivityCell> = [];
  for (
    let date = stretch.from;
    date <= stretch.to;
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
        energy: day?.energy ?? null,
        progress: day?.progress ?? null,
        shade: shadeOf(measure, day, words, thresholds),
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
  const firstWeekLength = daysPerWeek - calendarWeekdayIndex(first.date);
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
