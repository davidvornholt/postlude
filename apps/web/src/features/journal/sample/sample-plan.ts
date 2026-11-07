/**
 * The whole made-up journal a pull request preview starts with, counted back
 * from the journal day `now` falls on: the last ten days laid out by hand, and
 * three years of ordinary history before them, so the calendar, the archive,
 * search and "On this day" all have something to show.
 *
 * Nothing in it is anyone's journal. Every sentence comes from the templates
 * beside this file, and the same day and seed draw the same journal again.
 */

import type { ActivityDay } from '../activity.ts';
import {
  formatJournalDate,
  isJournalDate,
  type JournalDate,
  journalDateAt,
  parseJournalDate,
  shiftJournalDate,
} from '../journal-day.ts';
import { isStored, type SampleDay } from './sample-day.ts';
import { sampleHistoryDay } from './sample-history.ts';
import { sampleJournal } from './sample-journal.ts';
import { seededRandom } from './sample-random.ts';
import { recentDayCount, sampleRecentDays } from './sample-recent-days.ts';

export type SamplePlan = {
  readonly today: JournalDate;
  /** Every day with something to store, today first. */
  readonly days: ReadonlyArray<SampleDay>;
};

export type SamplePlanInput = {
  readonly now: Date;
  readonly timeZone: string;
  readonly seed?: number;
};

/** The journal every preview shows unless a test asks for another. */
export const sampleSeed = 1957;
/** A little over three years, so "On this day" has three earlier years. */
export const historyDays = 1130;
/** How many earlier years have today's date written, for "On this day". */
const anniversaryYears = 3;
const anniversaryWords = 320;
const anniversaryScriptureWords = 40;

const anniversaryDates = (today: JournalDate): ReadonlyArray<JournalDate> => {
  const { year, month, day } = parseJournalDate(today);
  return Array.from({ length: anniversaryYears }, (_, index) =>
    formatJournalDate({ year: year - (index + 1), month, day }),
  ).filter(isJournalDate);
};

const writtenAnniversary = (date: JournalDate): ActivityDay => ({
  date,
  journalWords: anniversaryWords,
  scriptureWords: anniversaryScriptureWords,
  hasScripture: true,
  journalWrittenOnTheDay: true,
  scriptureUsedOnTheDay: true,
});

/** Which history days were written, with today's date in earlier years among them. */
const writtenHistory = (
  today: JournalDate,
  seed: number,
): ReadonlyMap<JournalDate, ActivityDay> => {
  const written = new Map(
    sampleJournal(today, historyDays, seed).map((day) => [day.date, day]),
  );
  for (const date of anniversaryDates(today)) {
    if (!written.has(date)) {
      written.set(date, writtenAnniversary(date));
    }
  }
  return written;
};

export const samplePlan = ({
  now,
  timeZone,
  seed = sampleSeed,
}: SamplePlanInput): SamplePlan => {
  const today = journalDateAt(now, timeZone);
  const random = seededRandom(seed);
  const written = writtenHistory(today, seed);
  const history: Array<SampleDay> = [];
  for (let daysAgo = recentDayCount; daysAgo < historyDays; daysAgo += 1) {
    const date = shiftJournalDate(today, -daysAgo);
    history.push(
      sampleHistoryDay({ random, timeZone, date }, daysAgo, written.get(date)),
    );
  }
  return {
    today,
    days: [
      ...sampleRecentDays({ random, timeZone, today, now }),
      ...history,
    ].filter(isStored),
  };
};
