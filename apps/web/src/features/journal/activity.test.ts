import { expect, it } from 'bun:test';

import {
  type ActivityDay,
  dayWords,
  heatLevel,
  quartiles,
} from './activity.ts';

const day = (date: string, journalWords: number): ActivityDay => ({
  date,
  journalWords,
  scriptureWords: 0,
  hasScripture: false,
  journalWrittenOnTheDay: true,
  scriptureUsedOnTheDay: true,
});

const today = '2026-08-26';
/* Four days apart in word count, one to a quartile, plus a day left blank. */
const words = { none: 0, low: 100, some: 200, more: 300, most: 400 } as const;
const thresholds = [words.low, words.some, words.more] as const;

it('splits the written days into four groups by nearest rank', () => {
  const days = [
    day('2026-01-01', words.low),
    day('2026-01-02', words.some),
    day('2026-01-03', words.more),
    day('2026-01-04', words.most),
    day('2026-01-05', words.none),
  ];
  expect(quartiles(days)).toEqual(thresholds);
});

it('reads a day at a boundary as the lower step', () => {
  expect(heatLevel(words.low, thresholds)).toBe('q1');
  expect(heatLevel(words.some, thresholds)).toBe('q2');
  expect(heatLevel(words.more, thresholds)).toBe('q3');
  expect(heatLevel(words.more + 1, thresholds)).toBe('q4');
});

/*
 * Nothing written is a different kind of thing from a little written, so it is
 * never the bottom step of the ramp.
 */
it('reads a day with nothing on it as no step of the ramp', () => {
  expect(heatLevel(words.none, thresholds)).toBe('none');
});

it('weighs a day by both of the sections it holds', () => {
  const scriptureWords = 40;
  const both: ActivityDay = {
    date: today,
    journalWords: words.more,
    scriptureWords,
    hasScripture: true,
    journalWrittenOnTheDay: true,
    scriptureUsedOnTheDay: true,
  };
  expect(dayWords(both)).toBe(words.more + scriptureWords);
});
