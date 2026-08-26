/**
 * The archive's server function: everything the archive page draws, read in one
 * round trip.
 *
 * It carries `sessionRequired` like every other function here. The archive is a
 * map of the whole journal — when it was written, how much, and the opening
 * lines of days from earlier years — so an unguarded one would leak the shape
 * of a private journal to anyone who found the address.
 *
 * The streaks are counted over the whole history rather than over the year the
 * map shows, because a run that started before the window is still the run the
 * writer is on. Only the window's days are sent back: the grid needs one entry
 * per square and the rest of the journal has already been reduced to two runs
 * and two totals by the time it leaves the server.
 *
 * Whether a day was written on the day it is about is decided here rather than
 * in the browser, because the comparison needs the configured zone — and the
 * browser's zone is whatever a phone was carried into last week.
 */

import { createServerFn } from '@tanstack/react-start';
import { Effect, Schema } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { env } from '#/shared/env.ts';
import { runServerEffect } from '#/shared/runtime/app-runtime.ts';
import {
  type ActivityDay,
  type ActivityTotals,
  type ActivityWindow,
  activityTotals,
  activityWindow,
} from '../activity.ts';
import {
  type JournalDate,
  journalDateAt,
  parseJournalDate,
} from '../journal-day.ts';
import type { EntrySummary, JournalEntry } from '../schemas/entry.ts';
import { journalSnippet } from '../snippet.ts';
import { journalStreak, type Streak, scriptureStreak } from '../streaks.ts';
import { EntryRepository } from './entry-repository.ts';
import { currentJournalDate } from './journal-fns.ts';

/** One earlier year's entry for the same day of the month. */
export type Anniversary = {
  readonly date: JournalDate;
  readonly yearsAgo: number;
  readonly words: number;
  readonly snippet: string;
};

export type ArchiveView = {
  readonly today: JournalDate;
  /** The stretch the map draws, always whole weeks. */
  readonly window: ActivityWindow;
  /** Every day in the window that has a row; the gaps are the days without. */
  readonly days: ReadonlyArray<ActivityDay>;
  /** The years the journal covers, newest first, for the map's navigation. */
  readonly years: ReadonlyArray<number>;
  readonly journalStreak: Streak;
  readonly scriptureStreak: Streak;
  /** The whole journal, which is what the streaks are counted against. */
  readonly totals: ActivityTotals;
  readonly anniversaries: ReadonlyArray<Anniversary>;
};

const anniversaryLimit = 4;
const isoMonthStart = 5;

const firstYear = 1000;
const lastYear = 9999;

/**
 * What the archive can be asked for: a year, or nothing.
 *
 * The map either shows the rolling year ending this week or one calendar year,
 * so a year is the whole of the question. Four digits is the whole of what a
 * year can be, because that is what the ISO dates the journal stores hold.
 *
 * The route validates its `?year=` search parameter against this same schema
 * rather than restating the bounds, so the address bar and the server function
 * cannot come to disagree about what a year is.
 */
export const ArchiveQuery = Schema.Struct({
  year: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.between(firstYear, lastYear)),
  ),
});

export type ArchiveQueryParams = Schema.Schema.Type<typeof ArchiveQuery>;

const decodeQuery = Schema.decodeUnknownSync(ArchiveQuery);

const activityDayOf =
  (timeZone: string) =>
  (summary: EntrySummary): ActivityDay => ({
    date: summary.date,
    journalWords: summary.journalWordCount,
    scriptureWords: summary.scriptureWordCount,
    hasScripture: summary.hasScriptureReference,
    writtenOnTheDay:
      journalDateAt(summary.createdAt, timeZone) === summary.date,
  });

/**
 * Every year the journal touches, newest first. It runs from the first day
 * written to today rather than listing only the years with rows in them, so a
 * year the writer skipped is still a page they can open and see was empty.
 */
const yearsCovered = (
  earliest: JournalDate | undefined,
  today: JournalDate,
): ReadonlyArray<number> => {
  if (earliest === undefined) {
    return [];
  }
  const first = parseJournalDate(earliest).year;
  const last = parseJournalDate(today).year;
  return Array.from(
    { length: last - first + 1 },
    (_unused, index) => last - index,
  );
};

const anniversaryOf =
  (today: JournalDate) =>
  (entry: JournalEntry): Anniversary => ({
    date: entry.date,
    yearsAgo: parseJournalDate(today).year - parseJournalDate(entry.date).year,
    words: entry.journalWordCount + entry.scriptureWordCount,
    snippet: journalSnippet(entry.journalMarkdown),
  });

export const readArchiveFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeQuery(input ?? {}))
  .handler(({ data }): Promise<ArchiveView> => {
    const today = currentJournalDate();
    const window = activityWindow(today, data.year);
    return runServerEffect(
      Effect.gen(function* () {
        const entries = yield* EntryRepository;
        const earliest = yield* entries.earliestDate();
        const summaries =
          earliest === undefined
            ? []
            : yield* entries.listBetween(earliest, today);
        const history = summaries.map(activityDayOf(env.JOURNAL_TIME_ZONE));
        const anniversaries = yield* entries.readAnniversaries(
          today.slice(isoMonthStart),
          today,
          anniversaryLimit,
        );

        return {
          today,
          window,
          days: history.filter(
            (day) => day.date >= window.from && day.date <= window.to,
          ),
          years: yearsCovered(earliest, today),
          journalStreak: journalStreak(history, today),
          scriptureStreak: scriptureStreak(history, today),
          totals: activityTotals(history),
          anniversaries: anniversaries.map(anniversaryOf(today)),
        };
      }),
    );
  });
