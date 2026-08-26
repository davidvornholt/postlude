/**
 * The two runs the archive states in words: consecutive evenings written, and
 * consecutive mornings the scripture section was used. They are counted
 * separately and neither one repairs the other — a morning passage read on a
 * day nothing was written in the evening keeps one run alive and not the other.
 *
 * A day only joins a run if it was written on the day it is about. Filling in
 * last Tuesday this evening is worth doing and the archive shows it on the map,
 * but it does not put back a run that ended on Tuesday: a streak that can be
 * repaired afterwards measures bookkeeping rather than the habit.
 *
 * Today never breaks a run. The evening it is the page for has not finished, so
 * a run that reaches yesterday is still the run the writer is on; only a run
 * that stopped before yesterday is over.
 *
 * Nothing here reads a clock: today arrives as an argument, and the days arrive
 * already marked with whether they were written on the day, because that
 * comparison needs the configured zone and this module has no business knowing
 * one.
 */

import type { ActivityDay } from './activity.ts';
import { type JournalDate, shiftJournalDate } from './journal-day.ts';

export type Streak = {
  /** The run the writer is on now, which may be zero. */
  readonly current: number;
  /** The longest run anywhere in the journal, this one included. */
  readonly longest: number;
};

type Run = {
  readonly length: number;
  readonly last: JournalDate;
};

/**
 * The dates as runs of consecutive days. The input is expected in calendar
 * order and without duplicates, which is what a query keyed by day returns.
 */
const runsOf = (dates: ReadonlyArray<JournalDate>): ReadonlyArray<Run> => {
  const runs: Array<Run> = [];
  for (const date of dates) {
    const open = runs.at(-1);
    if (open !== undefined && shiftJournalDate(open.last, 1) === date) {
      runs[runs.length - 1] = { length: open.length + 1, last: date };
    } else {
      runs.push({ length: 1, last: date });
    }
  }
  return runs;
};

/**
 * The current and longest runs among these dates. A date after today is ignored
 * rather than trusted: the writing pages refuse to open one, but an importer
 * reaches the table by another road, and a day that has not happened must not be
 * able to report a run the writer is not on.
 */
export const streakOf = (
  dates: ReadonlyArray<JournalDate>,
  today: JournalDate,
): Streak => {
  const runs = runsOf(dates.filter((date) => date <= today));
  const last = runs.at(-1);
  const yesterday = shiftJournalDate(today, -1);
  return {
    current:
      last !== undefined && (last.last === today || last.last === yesterday)
        ? last.length
        : 0,
    longest: runs.reduce((longest, run) => Math.max(longest, run.length), 0),
  };
};

/**
 * Whether the evening was written, and whether the morning section was used.
 * The morning counts on a passage alone: noting what was read and leaving the
 * notes empty is still a morning the writer sat down to it.
 */
const wroteJournal = (day: ActivityDay): boolean => day.journalWords > 0;
const usedScripture = (day: ActivityDay): boolean =>
  day.hasScripture || day.scriptureWords > 0;

const countedDates = (
  days: ReadonlyArray<ActivityDay>,
  counts: (day: ActivityDay) => boolean,
  usedOnTheDay: (day: ActivityDay) => boolean,
): ReadonlyArray<JournalDate> =>
  days.filter((day) => usedOnTheDay(day) && counts(day)).map((day) => day.date);

export const journalStreak = (
  days: ReadonlyArray<ActivityDay>,
  today: JournalDate,
): Streak =>
  streakOf(
    countedDates(days, wroteJournal, (day) => day.journalWrittenOnTheDay),
    today,
  );

export const scriptureStreak = (
  days: ReadonlyArray<ActivityDay>,
  today: JournalDate,
): Streak =>
  streakOf(
    countedDates(days, usedScripture, (day) => day.scriptureUsedOnTheDay),
    today,
  );
