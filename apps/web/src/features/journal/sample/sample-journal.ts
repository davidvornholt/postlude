/**
 * Which days of a made-up journal were written, and how much.
 *
 * The run-and-gap shape comes from a two-state walk — writing tends to continue
 * and a lapse tends to last a few days — because a flat coin toss per day
 * produces neither a streak nor an empty week, which are the two things
 * Insights most needs to show. The preview sample data writes its history
 * along it.
 */

import type { ActivityDay } from '../activity.ts';
import { type JournalDate, shiftJournalDate } from '../journal-day.ts';
import { seededRandom } from './sample-random.ts';

const continueChance = 0.72;
const returnChance = 0.3;
const minimumWords = 80;
const wordSpread = 820;
const scriptureChance = 0.55;
const scriptureWords = 40;

/** `dayCount` days ending on `today`, walked backwards from it. */
export const sampleJournal = (
  today: JournalDate,
  dayCount: number,
  seed: number,
): ReadonlyArray<ActivityDay> => {
  const random = seededRandom(seed);
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
