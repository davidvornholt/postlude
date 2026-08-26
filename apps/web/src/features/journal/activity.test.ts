import { expect, it } from 'bun:test';

import {
  type ActivityDay,
  activityCells,
  activityTotals,
  activityWeeks,
  activityWindow,
  heatLevel,
  quartiles,
} from './activity.ts';
import { daysBetweenJournalDates, journalDateWeekday } from './journal-day.ts';

const day = (date: string, journalWords: number): ActivityDay => ({
  date,
  journalWords,
  scriptureWords: 0,
  hasScripture: false,
  writtenOnTheDay: true,
});

const sunday = 0;
const saturday = 6;
const daysPerWeek = 7;
const today = '2026-08-26';
const namedYear = 2025;
/* Four days apart in word count, one to a quartile, plus a day left blank. */
const words = { none: 0, low: 100, some: 200, more: 300, most: 400 } as const;
const thresholds = [words.low, words.some, words.more] as const;

/*
 * The grid draws a week as a column, so a window that starts mid-week is a hole
 * in the first column. Every window is whole weeks whatever it was asked for.
 */
it('opens on a Sunday and closes on a Saturday', () => {
  const window = activityWindow(today);
  expect(journalDateWeekday(window.from)).toBe(sunday);
  expect(journalDateWeekday(window.to)).toBe(saturday);
});

it('covers a rolling year of whole weeks', () => {
  const weeksShown = 53;
  const window = activityWindow(today);
  expect(daysBetweenJournalDates(window.from, window.to) + 1).toBe(
    weeksShown * daysPerWeek,
  );
});

it('ends the rolling window on this week rather than on today', () => {
  expect(activityWindow(today).to).toBe('2026-08-29');
});

it('wraps a named year in the weeks that hold it', () => {
  const window = activityWindow(today, namedYear);
  expect(window.from).toBe('2024-12-29');
  expect(window.to).toBe('2026-01-03');
});

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

it('draws a square for every day of the window, written or not', () => {
  const window = activityWindow(today, namedYear);
  const cells = activityCells([day('2025-06-01', words.most)], window);
  expect(cells.length).toBe(
    daysBetweenJournalDates(window.from, window.to) + 1,
  );
  expect(cells.filter((cell) => cell.level !== 'none').length).toBe(1);
});

it('leaves the days outside the window off the grid', () => {
  const window = activityWindow(today, namedYear);
  const cells = activityCells([day('2023-06-01', words.most)], window);
  expect(cells.every((cell) => cell.words === words.none)).toBe(true);
});

it('weighs a day by both of the sections it holds', () => {
  const scriptureWords = 40;
  const both: ActivityDay = {
    date: today,
    journalWords: words.more,
    scriptureWords,
    hasScripture: true,
    writtenOnTheDay: true,
  };
  expect(activityTotals([both])).toEqual({
    daysWritten: 1,
    words: words.more + scriptureWords,
  });
});

it('lays the squares out as columns of a week each', () => {
  const window = activityWindow(today);
  const weeks = activityWeeks(activityCells([], window));
  expect(weeks.every((week) => week.length === daysPerWeek)).toBe(true);
});
