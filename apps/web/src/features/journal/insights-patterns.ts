/**
 * The patterns Insights reads out of a range of days, as plain numbers the
 * page then puts into words.
 *
 * Every count here is taken over the days up to today, because a day still to
 * come has had no chance to be written or rated and counting it would make
 * every current range look emptier than it is.
 *
 * Nothing is scored or ranked against a target. A pattern says what happened —
 * which weekdays got written, how the screen time sat beside the energy — and
 * leaves what it means to the writer.
 */

import { dayWords } from './activity.ts';
import {
  calendarWeekdayIndex,
  firstDateOfMonth,
  type JournalMonth,
} from './calendar.ts';
import { comparisonVersion } from './day-measures.ts';
import { energyOptions, progressOptions } from './evening-labels.ts';
import { energyScore, progressScore } from './insights-measure.ts';
import type { InsightsDay } from './insights-view.ts';
import { type JournalDate, parseJournalDate } from './journal-day.ts';
import type { Energy, Progress } from './schemas/day-rating.ts';
import { scriptureBooks } from './scripture-books.ts';

const daysPerWeek = 7;
const monthsPerYear = 12;
const isoMonthLength = 7;

export const pastDays = (
  days: ReadonlyArray<InsightsDay>,
  today: JournalDate,
): ReadonlyArray<InsightsDay> => days.filter((day) => day.date <= today);

const average = (values: ReadonlyArray<number>): number | undefined =>
  values.length === 0
    ? undefined
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const median = (values: ReadonlyArray<number>): number | undefined => {
  const sorted = [...values].sort((first, second) => first - second);
  if (sorted.length === 0) {
    return;
  }
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1
    ? upper
    : Math.round(((sorted[middle - 1] ?? 0) + upper) / 2);
};

export type WritingSummary = {
  /** Days of the range up to today. */
  readonly elapsed: number;
  readonly written: number;
  readonly words: number;
};

export const writingSummary = (
  days: ReadonlyArray<InsightsDay>,
  today: JournalDate,
): WritingSummary => {
  const past = pastDays(days, today);
  return {
    elapsed: past.length,
    written: past.filter((day) => dayWords(day) > 0).length,
    words: past.reduce((total, day) => total + dayWords(day), 0),
  };
};

export type WeekdayPattern = {
  /** Monday is 0, as in the calendar's rows. */
  readonly weekday: number;
  readonly elapsed: number;
  readonly written: number;
  /** The middle word count of the written ones, so one long night does not lift it. */
  readonly typicalWords: number | undefined;
  readonly rated: number;
  readonly fresh: number;
};

/** One row per weekday, Monday first, over the range's past days. */
export const weekdayPatterns = (
  days: ReadonlyArray<InsightsDay>,
  today: JournalDate,
): ReadonlyArray<WeekdayPattern> => {
  const past = pastDays(days, today);
  return Array.from({ length: daysPerWeek }, (_, weekday) => {
    const ofWeekday = past.filter(
      (day) => calendarWeekdayIndex(day.date) === weekday,
    );
    const written = ofWeekday.map(dayWords).filter((words) => words > 0);
    const rated = ofWeekday.filter((day) => day.energy !== null);
    return {
      weekday,
      elapsed: ofWeekday.length,
      written: written.length,
      typicalWords: median(written),
      rated: rated.length,
      fresh: rated.filter((day) => day.energy === 'fresh').length,
    };
  });
};

const shareOf = (part: number, whole: number): number =>
  whole === 0 ? 0 : part / whole;

/**
 * The weekday written on most often, by share rather than count so a range
 * that holds five Mondays and four Sundays does not favour Monday for it.
 * Undefined when nothing was written or every weekday was written alike.
 */
export const mostWrittenWeekday = (
  patterns: ReadonlyArray<WeekdayPattern>,
): number | undefined => {
  const shares = patterns.map((pattern) =>
    shareOf(pattern.written, pattern.elapsed),
  );
  const highest = Math.max(0, ...shares);
  const lowest = Math.min(...shares);
  if (highest === 0 || highest === lowest) {
    return;
  }
  return patterns[shares.indexOf(highest)]?.weekday;
};

export type EnergyScreenTime = {
  readonly energy: Energy;
  /** Comparable days rated at this energy whose screen time was measured. */
  readonly days: number;
  readonly activeMinutes: number;
  readonly focusMinutes: number | undefined;
};

/**
 * The average screen time on the days rated at each energy, over the days
 * measured under the newest metrics version only. Levels without a measured
 * day are left out rather than shown as zero.
 */
export const energyScreenTime = (
  days: ReadonlyArray<InsightsDay>,
): ReadonlyArray<EnergyScreenTime> => {
  const version = comparisonVersion(days);
  return energyOptions.flatMap(({ value: energy }) => {
    const measured = days.flatMap((day) =>
      day.energy === energy &&
      day.metrics !== null &&
      day.metrics.metricsVersion === version &&
      day.metrics.activeMinutes !== null
        ? [day.metrics]
        : [],
    );
    const active = average(
      measured.map((metrics) => metrics.activeMinutes ?? 0),
    );
    if (active === undefined) {
      return [];
    }
    const focus = average(
      measured.flatMap((metrics) =>
        metrics.focusMinutes === null ? [] : [metrics.focusMinutes],
      ),
    );
    return [
      {
        energy,
        days: measured.length,
        activeMinutes: Math.round(active),
        focusMinutes: focus === undefined ? undefined : Math.round(focus),
      },
    ];
  });
};

export type EnergyWords = {
  readonly energy: Energy;
  /** Written days rated at this energy. */
  readonly days: number;
  /** The middle word count of those days, so one long evening does not lift it. */
  readonly typicalWords: number;
};

/**
 * How much got written on the days that felt each way, low energy first. Only
 * days that were both written and rated count, and a feeling without such a
 * day is left out rather than shown as no words at all.
 */
export const energyWords = (
  days: ReadonlyArray<InsightsDay>,
  today: JournalDate,
): ReadonlyArray<EnergyWords> => {
  const past = pastDays(days, today);
  return energyOptions.flatMap(({ value: energy }) => {
    const words = past
      .filter((day) => day.energy === energy)
      .map(dayWords)
      .filter((count) => count > 0);
    const typical = median(words);
    return typical === undefined
      ? []
      : [{ energy, days: words.length, typicalWords: typical }];
  });
};

/** A morning counts when its section was used: a passage or topic, notes, or both. */
export const scriptureMornings = (
  days: ReadonlyArray<InsightsDay>,
  today: JournalDate,
): number =>
  pastDays(days, today).filter(
    (day) => day.hasScripture || day.scriptureWords > 0,
  ).length;

export type BookCount = {
  readonly book: string;
  readonly mornings: number;
};

const canonicalIndex = new Map(
  scriptureBooks.map((book, index) => [book.english, index]),
);

/** The books read, most mornings first and then in the order of the bible. */
export const scriptureBookCounts = (
  days: ReadonlyArray<InsightsDay>,
  today: JournalDate,
): ReadonlyArray<BookCount> => {
  const counts = new Map<string, number>();
  for (const day of pastDays(days, today)) {
    if (day.scriptureBook !== null) {
      counts.set(day.scriptureBook, (counts.get(day.scriptureBook) ?? 0) + 1);
    }
  }
  const order = (book: string): number =>
    canonicalIndex.get(book) ?? scriptureBooks.length;
  return [...counts]
    .map(([book, mornings]) => ({ book, mornings }))
    .sort(
      (first, second) =>
        second.mornings - first.mornings ||
        order(first.book) - order(second.book) ||
        first.book.localeCompare(second.book),
    );
};

/** How many days gave each answer of a rating, and the answers' average. */
export type AnswerTally<Answer extends string> = {
  readonly counts: Readonly<Record<Answer, number>>;
  readonly rated: number;
  /** From 1 at the low end to 3 at the high end; undefined with no answer. */
  readonly average: number | undefined;
};

const answerTally = <Answer extends string>(
  answers: ReadonlyArray<{ readonly value: Answer }>,
  given: ReadonlyArray<Answer>,
  score: (answer: Answer) => number,
): AnswerTally<Answer> => {
  const counts = Object.fromEntries(
    answers.map(({ value }) => [
      value,
      given.filter((answer) => answer === value).length,
    ]),
  ) as Record<Answer, number>;
  return {
    counts,
    rated: given.length,
    average: average(given.map(score)),
  };
};

export type MonthSummary = {
  readonly month: JournalMonth;
  /** The month's days up to today and from the first one the range holds. */
  readonly elapsed: number;
  readonly written: number;
  readonly words: number;
  readonly energy: AnswerTally<Energy>;
  readonly progress: AnswerTally<Progress>;
};

const monthSummaryOf = (
  month: JournalMonth,
  days: ReadonlyArray<InsightsDay>,
): MonthSummary => ({
  month,
  elapsed: days.length,
  written: days.filter((day) => dayWords(day) > 0).length,
  words: days.reduce((total, day) => total + dayWords(day), 0),
  energy: answerTally(
    energyOptions,
    days.flatMap((day) => (day.energy === null ? [] : [day.energy])),
    energyScore,
  ),
  progress: answerTally(
    progressOptions,
    days.flatMap((day) => (day.progress === null ? [] : [day.progress])),
    progressScore,
  ),
});

export type YearOfMonths = {
  readonly year: number;
  /** January to December; undefined where the range holds none of the month. */
  readonly months: ReadonlyArray<MonthSummary | undefined>;
};

/** The range's past days as a row of months for each year, newest year first. */
export const monthGrid = (
  days: ReadonlyArray<InsightsDay>,
  today: JournalDate,
): ReadonlyArray<YearOfMonths> => {
  const byMonth = new Map<JournalMonth, Array<InsightsDay>>();
  for (const day of pastDays(days, today)) {
    const month = day.date.slice(0, isoMonthLength);
    const held = byMonth.get(month);
    if (held === undefined) {
      byMonth.set(month, [day]);
    } else {
      held.push(day);
    }
  }
  const years = new Map<number, Array<MonthSummary | undefined>>();
  for (const [month, held] of byMonth) {
    const { year, month: index } = parseJournalDate(firstDateOfMonth(month));
    const row =
      years.get(year) ??
      Array.from<MonthSummary | undefined>({ length: monthsPerYear });
    row[index - 1] = monthSummaryOf(month, held);
    years.set(year, row);
  }
  return [...years]
    .sort(([first], [second]) => second - first)
    .map(([year, months]) => ({ year, months }));
};

/**
 * The month an arrow key leads to from `month`. Left and right run through
 * time, so they cross from December into the next January; up and down keep
 * the month and move a year, skipping a year the journal had not reached yet.
 */
export const monthAfterKey = (
  years: ReadonlyArray<YearOfMonths>,
  month: JournalMonth,
  key: string,
): MonthSummary | undefined => {
  const row = years.findIndex((year) =>
    year.months.some((summary) => summary?.month === month),
  );
  const column =
    years[row]?.months.findIndex((summary) => summary?.month === month) ?? -1;
  if (row < 0 || column < 0) {
    return;
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    // The newest year is the top row.
    const along =
      key === 'ArrowUp' ? years.slice(0, row).reverse() : years.slice(row + 1);
    return along.find((year) => year.months[column] !== undefined)?.months[
      column
    ];
  }
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') {
    return;
  }
  const ordered = years
    .flatMap((year) => year.months)
    .filter((summary) => summary !== undefined)
    .sort((first, second) => first.month.localeCompare(second.month));
  const index = ordered.findIndex((summary) => summary.month === month);
  return ordered[index + (key === 'ArrowLeft' ? -1 : 1)];
};
