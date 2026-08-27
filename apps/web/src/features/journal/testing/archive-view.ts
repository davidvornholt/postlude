/**
 * A journal to draw an archive from, for the tests that render one.
 *
 * The days are generated rather than typed out, and generated without a clock
 * and without `Math.random`, so a test asserts against the same year every time
 * it runs. The run-and-gap shape comes from a two-state walk — writing tends to
 * continue and a lapse tends to last a few days — because a flat coin toss per
 * day produces neither a streak nor an empty week, which are the two things the
 * archive exists to show.
 */

import {
  type ActivityDay,
  activityTotals,
  activityWindow,
} from '../activity.ts';
import { type JournalDate, shiftJournalDate } from '../journal-day.ts';
import type { ArchiveView } from '../services/archive-fns.ts';
import { journalStreak, scriptureStreak } from '../streaks.ts';

const lehmerMultiplier = 48_271;
/** 2^31 − 1, prime, so the sequence visits every state before repeating. */
const lehmerModulus = 2_147_483_647;
const lehmerStates = lehmerModulus - 1;

const randomFrom = (seed: number) => {
  let state = (Math.abs(Math.trunc(seed)) % lehmerStates) + 1;
  return (): number => {
    state = (state * lehmerMultiplier) % lehmerModulus;
    return (state - 1) / lehmerStates;
  };
};

const continueChance = 0.72;
const returnChance = 0.3;
const minimumWords = 80;
const wordSpread = 820;
const scriptureChance = 0.55;
const scriptureWords = 40;
const isoYearEnd = 4;

/** A year of days ending on `today`, walked backwards from it. */
export const sampleJournal = (
  today: JournalDate,
  dayCount: number,
  seed: number,
): ReadonlyArray<ActivityDay> => {
  const random = randomFrom(seed);
  const days: Array<ActivityDay> = [];
  let writing = true;
  for (let index = dayCount - 1; index >= 0; index -= 1) {
    writing = random() < (writing ? continueChance : returnChance);
    if (writing) {
      const date = shiftJournalDate(today, -index);
      days.push({
        date,
        journalWords: minimumWords + Math.floor(random() * wordSpread),
        scriptureWords: random() < scriptureChance ? scriptureWords : 0,
        hasScripture: random() < scriptureChance,
        journalWrittenOnTheDay: true,
        scriptureUsedOnTheDay: true,
      });
    }
  }
  return days;
};

/**
 * The whole view, assembled by the same functions the server function uses, so
 * a test renders a consistent archive rather than one whose streaks disagree
 * with its map.
 */
export const sampleArchiveView = (
  days: ReadonlyArray<ActivityDay>,
  today: JournalDate,
): ArchiveView => {
  const window = activityWindow(today);
  return {
    today,
    exportAvailable: days.length > 0,
    window,
    days: days.filter(
      (day) => day.date >= window.from && day.date <= window.to,
    ),
    years: [Number(today.slice(0, isoYearEnd))],
    journalStreak: journalStreak(days, today),
    scriptureStreak: scriptureStreak(days, today),
    totals: activityTotals(days),
    anniversaries: [],
  };
};
