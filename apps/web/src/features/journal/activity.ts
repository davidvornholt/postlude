/**
 * The year of days the activity map draws: which days it covers, how much was
 * written on each, and which step of the ramp that puts a day on.
 *
 * Nothing here reads a clock. Today arrives as an argument, decided once by
 * `journal-day.ts` against the configured zone, so the map cannot disagree with
 * the page that asked for it about which day the year ends on.
 *
 * The window is always whole weeks, Sunday to Saturday, because the grid draws
 * a week as a column and a ragged column is a hole in the middle of the year.
 */

import {
  formatJournalDate,
  type JournalDate,
  journalDateWeekday,
  parseJournalDate,
  shiftJournalDate,
} from './journal-day.ts';

/**
 * One day as the archive knows it. The bodies are deliberately absent: a year
 * of prose is a lot to send in order to draw 371 squares and count two runs.
 */
export type ActivityDay = {
  readonly date: JournalDate;
  readonly journalWords: number;
  readonly scriptureWords: number;
  /** The morning section was used: a passage noted, notes written, or both. */
  readonly hasScripture: boolean;
  /**
   * The day was written on the day it is about rather than filled in later.
   * The streaks read this and nothing else reads it.
   */
  readonly writtenOnTheDay: boolean;
};

export type HeatLevel = 'none' | 'q1' | 'q2' | 'q3' | 'q4';

/** The three word counts that split the written days into four groups. */
export type Quartiles = readonly [number, number, number];

export type ActivityWindow = {
  readonly from: JournalDate;
  readonly to: JournalDate;
};

export type ActivityCell = {
  readonly date: JournalDate;
  readonly words: number;
  readonly level: HeatLevel;
};

const daysPerWeek = 7;
const saturday = 6;
/** How many week columns a rolling year shows, which is what a year needs. */
const rollingWeeks = 53;
const firstMonth = 1;
const lastMonth = 12;
const firstDayOfMonth = 1;
const lastDayOfDecember = 31;

/** How much of the day's writing the map weighs: all of it, both sections. */
export const dayWords = (day: ActivityDay): number =>
  day.journalWords + day.scriptureWords;

/** The last Saturday on or after a date, so a window ends on a whole week. */
const weekEnd = (date: JournalDate): JournalDate =>
  shiftJournalDate(date, saturday - journalDateWeekday(date));

/** The Sunday on or before a date, so a window starts on a whole week. */
const weekStart = (date: JournalDate): JournalDate =>
  shiftJournalDate(date, -journalDateWeekday(date));

/**
 * The days the map covers. With no year it is the rolling year ending this
 * week, which is what the writer wants nine times in ten; with one it is that
 * calendar year, so a journal that has run for years can be looked back through
 * rather than only forward from a year ago.
 */
export const activityWindow = (
  today: JournalDate,
  year?: number,
): ActivityWindow => {
  if (year === undefined) {
    const to = weekEnd(today);
    return { from: shiftJournalDate(to, 1 - rollingWeeks * daysPerWeek), to };
  }
  return {
    from: weekStart(
      formatJournalDate({ year, month: firstMonth, day: firstDayOfMonth }),
    ),
    to: weekEnd(
      formatJournalDate({ year, month: lastMonth, day: lastDayOfDecember }),
    ),
  };
};

/** The year a window is about, which is the year most of its days fall in. */
export const windowYear = (window: ActivityWindow): number =>
  parseJournalDate(window.to).year;

export const writtenDays = (
  days: ReadonlyArray<ActivityDay>,
): ReadonlyArray<ActivityDay> => days.filter((day) => dayWords(day) > 0);

export type ActivityTotals = {
  readonly daysWritten: number;
  readonly words: number;
};

/** What a stretch of the journal holds, counted over whatever it is given. */
export const activityTotals = (
  days: ReadonlyArray<ActivityDay>,
): ActivityTotals => ({
  daysWritten: writtenDays(days).length,
  words: days.reduce((total, day) => total + dayWords(day), 0),
});

const firstQuartileFraction = 0.25;
const medianFraction = 0.5;
const thirdQuartileFraction = 0.75;

/**
 * The word counts that split the written days into four equal-sized groups, by
 * nearest rank. Bucketing on the days that exist rather than on a fixed word
 * scale is what keeps the darkest cells rare in a quiet year and common in a
 * heavy one.
 */
export const quartiles = (days: ReadonlyArray<ActivityDay>): Quartiles => {
  const counts = writtenDays(days)
    .map(dayWords)
    .sort((first, second) => first - second);
  const rankOf = (fraction: number) =>
    counts[Math.max(Math.ceil(fraction * counts.length) - 1, 0)] ?? 0;
  return [
    rankOf(firstQuartileFraction),
    rankOf(medianFraction),
    rankOf(thirdQuartileFraction),
  ];
};

/** Which step of the ramp a day sits on. Boundaries fall to the lower step. */
export const heatLevel = (words: number, thresholds: Quartiles): HeatLevel => {
  if (words <= 0) {
    return 'none';
  }
  if (words <= thresholds[0]) {
    return 'q1';
  }
  if (words <= thresholds[1]) {
    return 'q2';
  }
  return words <= thresholds[2] ? 'q3' : 'q4';
};

/**
 * Every day of the window, written or not, in calendar order. The days that
 * exist arrive as rows and the rest are the gaps between them, so the grid is
 * built by walking the calendar rather than by trusting the query to have
 * returned one row per square.
 */
export const activityCells = (
  days: ReadonlyArray<ActivityDay>,
  window: ActivityWindow,
): ReadonlyArray<ActivityCell> => {
  const thresholds = quartiles(days);
  const byDate = new Map(days.map((day) => [day.date, day]));
  const cells: Array<ActivityCell> = [];
  for (
    let date = window.from;
    date <= window.to;
    date = shiftJournalDate(date, 1)
  ) {
    const day = byDate.get(date);
    const words = day === undefined ? 0 : dayWords(day);
    cells.push({ date, words, level: heatLevel(words, thresholds) });
  }
  return cells;
};

/** The cells as the columns the grid draws them in, one column a week. */
export const activityWeeks = (
  cells: ReadonlyArray<ActivityCell>,
): ReadonlyArray<ReadonlyArray<ActivityCell>> =>
  Array.from(
    { length: Math.ceil(cells.length / daysPerWeek) },
    (_unused, week) =>
      cells.slice(week * daysPerWeek, week * daysPerWeek + daysPerWeek),
  );
