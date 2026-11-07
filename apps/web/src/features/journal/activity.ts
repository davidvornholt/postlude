/**
 * The activity map's word volume and heat steps.
 * Today is decided once in `journal-day.ts` against the configured zone.
 */

import type { JournalDate } from './journal-day.ts';

/** One written day without the prose bodies, as the streaks count it. */
export type ActivityDay = {
  readonly date: JournalDate;
  readonly journalWords: number;
  readonly scriptureWords: number;
  /** The morning section was used: a passage noted, notes written, or both. */
  readonly hasScripture: boolean;
  /** The evening section was first used on the day it is about. */
  readonly journalWrittenOnTheDay: boolean;
  /** The scripture section was first used on the day it is about. */
  readonly scriptureUsedOnTheDay: boolean;
};

export type HeatLevel = 'none' | 'q1' | 'q2' | 'q3' | 'q4';

/** The three word counts that split the written days into four groups. */
export type Quartiles = readonly [number, number, number];

/** The two word counts a day is weighed by. */
export type WordCounts = Pick<ActivityDay, 'journalWords' | 'scriptureWords'>;

/** How much of the day's writing the map weighs: all of it, both sections. */
export const dayWords = (day: WordCounts): number =>
  day.journalWords + day.scriptureWords;

export const writtenDays = <Day extends WordCounts>(
  days: ReadonlyArray<Day>,
): ReadonlyArray<Day> => days.filter((day) => dayWords(day) > 0);

const firstQuartileFraction = 0.25;
const medianFraction = 0.5;
const thirdQuartileFraction = 0.75;

/**
 * The values that split the ones above zero into four equal-sized groups, by
 * nearest rank. Bucketing on the values that exist rather than on a fixed
 * scale is what keeps the darkest cells rare in a quiet year and common in a
 * heavy one.
 */
export const quartilesOf = (values: ReadonlyArray<number>): Quartiles => {
  const counts = values
    .filter((value) => value > 0)
    .sort((first, second) => first - second);
  const rankOf = (fraction: number) =>
    counts[Math.max(Math.ceil(fraction * counts.length) - 1, 0)] ?? 0;
  return [
    rankOf(firstQuartileFraction),
    rankOf(medianFraction),
    rankOf(thirdQuartileFraction),
  ];
};

/** The word counts that split the written days into four equal-sized groups. */
export const quartiles = (days: ReadonlyArray<WordCounts>): Quartiles =>
  quartilesOf(days.map(dayWords));

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
